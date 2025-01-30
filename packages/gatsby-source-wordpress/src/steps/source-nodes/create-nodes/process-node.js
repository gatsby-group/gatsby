/* eslint-disable no-useless-escape */
import { isWebUri } from "valid-url"
import { GatsbyImage } from "gatsby-plugin-image"
import React from "react"
import ReactDOMServer from "react-dom/server"
import stringify from "fast-json-stable-stringify"
import execall from "execall"
import cheerio from "cheerio"
import url from "url"
import path from "path"
import fs from "fs-extra"
import { supportedExtensions } from "gatsby-transformer-sharp/supported-extensions"
import replaceAll from "replaceall"
import { usingGatsbyV4OrGreater } from "~/utils/gatsby-version"
import {
  gatsbyImageResolver,
  publicUrlResolver,
} from "gatsby-plugin-utils/polyfill-remote-file"

import { formatLogMessage } from "~/utils/format-log-message"

import fetchReferencedMediaItemsAndCreateNodes, {
  stripImageSizesFromUrl,
} from "../fetch-nodes/fetch-referenced-media-items"
import { b64e } from "~/utils/string-encoding"
import { getStore } from "~/store"

import { store as gatsbyStore } from "gatsby/dist/redux"

/**
 * Takes in a MediaItem node from WPGraphQL as well as Gatsby plugin options and returns the correct placeholder URL for GatsbyImage
 *
 * The user must set the placeholderSizeName plugin option, or otherwise create an image size in WP where the name is `gatsby-image-placeholder`
 */
export function getPlaceholderUrlFromMediaItemNode(node, pluginOptions) {
  let placeholderSizeByWidth
  let placeholderSizeByName

  node.mediaDetails?.sizes?.forEach(size => {
    if (
      size.name ===
      (pluginOptions?.type?.MediaItem?.placeholderSizeName ||
        `gatsby-image-placeholder`)
    ) {
      placeholderSizeByName = size
    } else if (Number(size.width) <= 20) {
      placeholderSizeByWidth = size
    }
  })

  const placeHolderSize = placeholderSizeByName || placeholderSizeByWidth

  return placeHolderSize?.sourceUrl
}

const findReferencedImageNodeIds = ({ nodeString, pluginOptions, node }) => {
  // if the lazyNodes plugin option is set we don't need to find
  // image node id's because those nodes will be fetched lazily in resolvers.
  if (
    pluginOptions.type.MediaItem.lazyNodes &&
    // but not in Gatsby v4+ because lazyNodes is no longer supported
    !usingGatsbyV4OrGreater
  ) {
    return []
  }

  // get an array of all referenced media file ID's
  const matchedIds = execall(
    /"__typename":"MediaItem","id":"([^"]*)"/gm,
    nodeString
  )
    .map(match => match.subMatches[0])
    .filter(id => id !== node.id)

  return matchedIds
}

// Find Image IDs in this node's content using the regex set by the
// createStaticFilesForImageIds plugin option.
const findReferencedImageNodeIdsForCustomRegex = ({
  nodeString,
  pluginOptions,
  node,
}) => {
  // Return if the option is not set
  if (!pluginOptions.html.createStaticFilesForImageIds) {
    return []
  }

  // if the lazyNodes plugin option is set we don't need to find
  // image node id's because those nodes will be fetched lazily in resolvers.
  if (
    pluginOptions.type.MediaItem.lazyNodes &&
    // but not in Gatsby v4+ because lazyNodes is no longer supported
    !usingGatsbyV4OrGreater
  ) {
    return []
  }

  // If the plugin option is defined, get an array of all referenced media file database ID's matching the regex provided
  // and convert the IDs to the graphQL IDs
  const regex = new RegExp(
    pluginOptions.html.createStaticFilesForImageIds,
    `gm`
  )
  const matchedIds = []
  execall(regex, nodeString).forEach(match => {
    const dbId = match.subMatches[0]
    if (dbId && !isNaN(dbId)) {
      const nodeId = b64e(`post:${dbId}`)
      if (nodeId !== node.id) {
        matchedIds.push(nodeId)
      }
    }
  })

  return matchedIds
}

const getCheerioImgDbId = cheerioImg => {
  // try to get the db id from data attributes
  const dataAttributeId =
    cheerioImg.attribs[`data-id`] || cheerioImg.attribs[`data-image-id`]

  if (dataAttributeId) {
    return dataAttributeId
  }

  if (!cheerioImg.attribs.class) {
    return null
  }

  // try to get the db id from the wp-image-id classname
  const wpImageClass = cheerioImg.attribs.class
    .split(` `)
    .find(className => className.includes(`wp-image-`))

  if (wpImageClass) {
    const wpImageClassDashArray = wpImageClass.split(`-`)
    const wpImageClassId = Number(
      wpImageClassDashArray[wpImageClassDashArray.length - 1]
    )

    if (wpImageClassId) {
      return wpImageClassId
    }
  }

  return null
}

// media items are of the "post" type
const dbIdToMediaItemRelayId = dbId => (dbId ? b64e(`post:${dbId}`) : null)

const getCheerioImgRelayId = cheerioImg =>
  dbIdToMediaItemRelayId(getCheerioImgDbId(cheerioImg))

export const ensureSrcHasHostname = ({ src, wpUrl }) => {
  const { protocol, host } = url.parse(wpUrl)

  if (src.startsWith(`/wp-content`)) {
    src = `${protocol}//${host}${src}`
  }

  return src
}

const pickNodeBySourceUrlOrCheerioImg = ({
  url,
  cheerioImg,
  mediaItemNodes,
}) => {
  const possibleHtmlSrcs = [
    // try to match the media item source url by original html src
    url,
    // or by the src minus any image sizes string
    stripImageSizesFromUrl(url),
  ]

  let imageNode = mediaItemNodes.find(
    mediaItemNode =>
      // either find our node by the source url
      possibleHtmlSrcs.includes(mediaItemNode.sourceUrl) ||
      possibleHtmlSrcs.includes(
        // try to match without -scaled in the sourceUrl as well
        // since WP adds -scaled to image urls if they were too large
        // at upload time but image urls in html don't have this requirement.
        // the sourceUrl may have -scaled in it but the full size image is still
        // stored on the server (just not in the db)
        (mediaItemNode.sourceUrl || mediaItemNode.mediaItemUrl)?.replace(
          `-scaled`,
          ``
        )
      )
  )

  if (!imageNode && cheerioImg) {
    imageNode = mediaItemNodes.find(
      mediaItemNode => getCheerioImgRelayId(cheerioImg) === mediaItemNode.id
    )
  }

  return imageNode
}

let displayedFailedToRestoreMessage = false

const fetchNodeHtmlImageMediaItemNodes = async ({
  // node, // for inspecting nodes while debugging
  cheerioImages,
  helpers,
  wpUrl,
}) => {
  // get all the image nodes we've cached from elsewhere
  const { nodeMetaByUrl } = getStore().getState().imageNodes

  const previouslyCachedNodesByUrl = (
    await Promise.all(
      Object.entries(nodeMetaByUrl).map(([sourceUrl, { id } = {}]) => {
        if (!sourceUrl || !id) {
          return null
        }

        sourceUrl = ensureSrcHasHostname({ wpUrl, src: sourceUrl })

        const existingNode = helpers.getNode(id)

        if (!existingNode) {
          if (!displayedFailedToRestoreMessage) {
            helpers.reporter.warn(
              formatLogMessage(
                `File node failed to restore from cache. This is a bug in gatsby-source-wordpress. Please open an issue so we can help you out :)`
              )
            )
            displayedFailedToRestoreMessage = true
          }

          return null
        }

        return {
          sourceUrl,
          ...existingNode,
        }
      })
    )
  ).filter(Boolean)

  const mediaItemUrls = cheerioImages
    // filter out nodes we already have
    .filter(({ cheerioImg }) => {
      const url = ensureSrcHasHostname({ wpUrl, src: cheerioImg.attribs.src })

      const existingNode = pickNodeBySourceUrlOrCheerioImg({
        url,
        mediaItemNodes: previouslyCachedNodesByUrl,
      })

      return !existingNode
    })
    // get remaining urls
    .map(({ cheerioImg }) => {
      const src = ensureSrcHasHostname({
        src: cheerioImg.attribs.src,
        wpUrl,
      })

      return src
    })

  // build a query to fetch all media items that we don't already have
  const mediaItemNodesBySourceUrl =
    await fetchReferencedMediaItemsAndCreateNodes({
      mediaItemUrls,
    })
  // images that have been edited from the media library that were previously
  // uploaded to a post/page will have a different sourceUrl so they can't be fetched by it
  // in many cases we have data-id or data-image-id as attributes on the img
  // we can try to use those to fetch media item nodes as well
  // this will keep us from missing nodes
  const mediaItemDbIds = cheerioImages
    .map(({ cheerioImg }) => getCheerioImgDbId(cheerioImg))
    .filter(Boolean)

  const mediaItemRelayIds = mediaItemDbIds
    .map(dbId => dbIdToMediaItemRelayId(dbId))
    .filter(
      // filter out any media item ids we already fetched
      relayId =>
        ![...mediaItemNodesBySourceUrl, ...previouslyCachedNodesByUrl].find(
          ({ id } = {}) => id === relayId
        )
    )

  const mediaItemNodesById = await fetchReferencedMediaItemsAndCreateNodes({
    referencedMediaItemNodeIds: mediaItemRelayIds,
  })

  const createdNodes = [...mediaItemNodesById, ...mediaItemNodesBySourceUrl]

  const mediaItemNodes = [...createdNodes, ...previouslyCachedNodesByUrl]

  const htmlMatchesToMediaItemNodesMap = new Map()
  for (const { cheerioImg, match } of cheerioImages) {
    const htmlImgSrc = ensureSrcHasHostname({
      src: cheerioImg.attribs.src,
      wpUrl,
    })

    const imageNode = pickNodeBySourceUrlOrCheerioImg({
      url: htmlImgSrc,
      cheerioImg,
      mediaItemNodes,
    })

    cacheCreatedFileNodeBySrc({ node: imageNode, src: htmlImgSrc })

    if (imageNode) {
      // match is the html string of the img tag
      htmlMatchesToMediaItemNodesMap.set(match, { imageNode, cheerioImg })
    }
  }

  return htmlMatchesToMediaItemNodesMap
}

const getCheerioElementFromMatch =
  wpUrl =>
  ({ match, tag = `img` }) => {
    // unescape quotes
    const parsedMatch = JSON.parse(`"${match}"`)

    // load our matching img tag into cheerio
    const $ = cheerio.load(parsedMatch, {
      xml: {
        // make sure it's not wrapped in <body></body>
        withDomLvl1: false,
        // no need to normalize whitespace, we're dealing with a single element here
        normalizeWhitespace: false,
        xmlMode: true,
        // entity decoding isn't our job here, that will be the responsibility of WPGQL
        // or of the source plugin elsewhere.
        decodeEntities: false,
      },
    })

    // there's only ever one element due to our match matching a single tag
    // $(tag) isn't an array, it's an object with a key of 0
    const cheerioElement = $(tag)[0]

    if (cheerioElement?.attribs?.src?.startsWith(`/wp-content`)) {
      cheerioElement.attribs.src = `${wpUrl}${cheerioElement.attribs.src}`
    }

    return {
      match,
      cheerioElement,
      // @todo this is from when this function was just used for images
      // remove this by refactoring
      cheerioImg: cheerioElement,
    }
  }

const getCheerioElementsFromMatches = ({ imgTagMatches, wpUrl }) =>
  imgTagMatches
    .map(getCheerioElementFromMatch(wpUrl))
    .filter(({ cheerioImg: { attribs } }) => {
      if (!attribs.src) {
        return false
      }

      return isWebUri(encodeURI(attribs.src))
    })

const getLargestSizeFromSizesAttribute = sizesString => {
  const sizesStringsArray = sizesString.split(`,`)

  return sizesStringsArray.reduce((largest, currentSizeString) => {
    const maxWidth = currentSizeString
      .substring(
        currentSizeString.indexOf(`max-width: `) + 1,
        currentSizeString.indexOf(`px`)
      )
      .trim()

    const maxWidthNumber = Number(maxWidth)
    const noLargestAndMaxWidthIsANumber = !largest && !isNaN(maxWidthNumber)
    const maxWidthIsALargerNumberThanLargest =
      largest && !isNaN(maxWidthNumber) && maxWidthNumber > largest

    if (noLargestAndMaxWidthIsANumber || maxWidthIsALargerNumberThanLargest) {
      largest = maxWidthNumber
    }

    return largest
  }, null)
}

const findImgTagMaxWidthFromCheerioImg = cheerioImg => {
  const {
    attribs: { width, sizes },
  } = cheerioImg || { attribs: { width: null, sizes: null } }

  if (width) {
    const widthNumber = Number(width)

    if (!isNaN(widthNumber)) {
      return widthNumber
    }
  }

  if (sizes) {
    const largestSize = getLargestSizeFromSizesAttribute(sizes)

    if (largestSize && !isNaN(largestSize)) {
      return largestSize
    }
  }

  return null
}

const getFileNodeRelativePathname = fileNode => {
  const fileName = `${fileNode.internal.contentDigest}/${fileNode.base}`

  return fileName
}

const getFileNodePublicPath = fileNode => {
  const fileName = getFileNodeRelativePathname(fileNode)

  const publicPath = path.join(process.cwd(), `public`, `static`, fileName)

  return publicPath
}

const copyFileToStaticAndReturnUrlPath = async (fileNode, helpers) => {
  const publicPath = getFileNodePublicPath(fileNode)

  if (!fs.existsSync(publicPath)) {
    await fs.copy(
      fileNode.absolutePath,
      publicPath,
      { dereference: true },
      err => {
        if (err) {
          console.error(
            `error copying file from ${fileNode.absolutePath} to ${publicPath}`,
            err
          )
        }
      }
    )
  }

  const fileName = getFileNodeRelativePathname(fileNode)

  const relativeUrl = `${helpers.pathPrefix ?? ``}/static/${fileName}`

  return relativeUrl
}

const cacheCreatedFileNodeBySrc = ({ node, src }) => {
  if (node) {
    // save any fetched media items in our global media item cache
    getStore().dispatch.imageNodes.pushNodeMeta({
      sourceUrl: src,
      id: node.id,
      modifiedGmt: node.modifiedGmt,
    })
  }
}

const imgSrcRemoteFileRegex =
  /(?:src=\\")((?:(?:https?|ftp|file):\/\/|www\.|ftp\.|\/)(?:[^'"])*\.(?:jpeg|jpg|png|gif|ico|mpg|ogv|svg|bmp|tif|tiff))(\?[^\\" \.]*|)(?=\\"| |\.)/gim

export const getImgSrcRemoteFileMatchesFromNodeString = nodeString =>
  execall(imgSrcRemoteFileRegex, nodeString).filter(({ subMatches }) => {
    // if our match is json encoded, that means it's inside a JSON
    // encoded string field.
    const isInJSON = subMatches[0].includes(`\\/\\/`)

    // we shouldn't process encoded JSON, so skip this match if it's JSON
    return !isInJSON
  })

export const getImgTagMatches = ({ nodeString }) =>
  execall(
    /<img([\w\W]+?)[\/]?>/gim,
    nodeString
      // we don't want to match images inside pre
      .replace(/<pre([\w\W]+?)[\/]?>(?:(?!<\/pre>).)+(<\/pre>)/gim, ``)
      // and code tags, so temporarily remove those tags and everything inside them
      .replace(/<code([\w\W]+?)[\/]?>(?:(?!<\/code>).)+(<\/code>)/gim, ``)
  )

export const replaceNodeHtmlImages = async ({
  nodeString,
  node,
  helpers,
  wpUrl,
  pluginOptions,
}) => {
  // this prevents fetching inline html images
  if (
    !pluginOptions?.html?.useGatsbyImage ||
    pluginOptions?.type?.MediaItem?.exclude
  ) {
    return nodeString
  }

  const imageUrlMatches = getImgSrcRemoteFileMatchesFromNodeString(nodeString)

  const imgTagMatches = getImgTagMatches({ nodeString })

  if (imageUrlMatches.length && imgTagMatches.length) {
    const cheerioImages = getCheerioElementsFromMatches({
      imgTagMatches,
      wpUrl,
    })

    const htmlMatchesToMediaItemNodesMap =
      await fetchNodeHtmlImageMediaItemNodes({
        cheerioImages,
        nodeString,
        node,
        helpers,
        pluginOptions,
        wpUrl,
      })

    // generate gatsby images for each cheerioImage
    const htmlMatchesWithImageResizes = await Promise.all(
      imgTagMatches.map(async ({ match }) => {
        const matchInfo = htmlMatchesToMediaItemNodesMap.get(match)

        if (!matchInfo) {
          return null
        }

        const { imageNode, cheerioImg } = matchInfo

        const isMediaItemNode = imageNode.__typename === `MediaItem`

        if (!imageNode) {
          return null
        }

        const fileNode =
          // if we couldn't get a MediaItem node for this image in WPGQL
          !isMediaItemNode
            ? // this will already be a file node
              imageNode
            : // otherwise grab the file node
              helpers.getNode(imageNode?.localFile?.id)

        const extension = imageNode?.mimeType?.replace(
          `${imageNode?.mediaType}/`,
          ``
        )

        const imgTagMaxWidth = findImgTagMaxWidthFromCheerioImg(cheerioImg)

        const mediaItemNodeWidth = isMediaItemNode
          ? imageNode?.mediaDetails?.width
          : null

        // if a max width can't be inferred from html, this value will be passed to Sharp
        let fallbackImageMaxWidth = pluginOptions?.html?.fallbackImageMaxWidth

        if (
          // if the image is smaller than the fallback max width,
          // the images width will be used instead if we have a media item node
          fallbackImageMaxWidth > mediaItemNodeWidth &&
          // of course that means we have to have a media item node
          // and a media item node max width
          mediaItemNodeWidth &&
          typeof mediaItemNodeWidth === `number` &&
          mediaItemNodeWidth > 0
        ) {
          fallbackImageMaxWidth = mediaItemNodeWidth
        }

        let maxWidth =
          // if we inferred a maxwidth from html
          (imgTagMaxWidth &&
          // and we have a media item node to know it's full size max width
          mediaItemNodeWidth &&
          // and this isn't an svg which has no maximum width
          extension !== `svg` &&
          // and the media item node max width is smaller than what we inferred
          // from html
          mediaItemNodeWidth < imgTagMaxWidth
            ? // use the media item node width
              mediaItemNodeWidth
            : // otherwise use the width inferred from html
              imgTagMaxWidth) ??
          // if we don't have a media item node and we inferred no width
          // from html, then use the fallback max width from plugin options
          fallbackImageMaxWidth

        const configuredMaxWidth = pluginOptions?.html?.imageMaxWidth

        // if the configured html.maxWidth property is less than the result, then
        // override the resulting width
        if (configuredMaxWidth && configuredMaxWidth < maxWidth) {
          maxWidth = configuredMaxWidth
        }

        const quality = pluginOptions?.html?.imageQuality ?? 70

        const { reporter } = helpers

        const gatsbyTransformerSharpSupportsThisFileType =
          supportedExtensions[extension] || extension === `gif`

        let imageResize = null
        let publicUrl

        const imageUrl =
          imageNode.mediaItemUrl || imageNode.sourceUrl || imageNode.url

        try {
          if (gatsbyTransformerSharpSupportsThisFileType) {
            const placeholderUrl = getPlaceholderUrlFromMediaItemNode(
              imageNode,
              pluginOptions
            )

            const formats = [`auto`]
            if (pluginOptions.html.generateWebpImages) {
              formats.push(`webp`)
            }
            if (pluginOptions.html.generateAvifImages) {
              formats.push(`avif`)
            }

            imageResize = await gatsbyImageResolver(
              {
                url: imageUrl,
                placeholderUrl,
                mimeType: imageNode.mimeType,
                width: imageNode.mediaDetails.width,
                height: imageNode.mediaDetails.height,
                filename: path.basename(imageNode.mediaDetails.file),
                internal: {
                  contentDigest: imageNode.modifiedGmt,
                },
              },
              {
                width: maxWidth,
                layout: `constrained`,
                placeholder: !placeholderUrl
                  ? `none`
                  : pluginOptions?.html?.placeholderType || `dominantColor`,
                quality,
                formats,
              },
              helpers.actions,
              gatsbyStore
            )
          } else {
            publicUrl = publicUrlResolver(
              {
                url: imageUrl,
                mimeType: imageNode.mimeType,
                filename: path.basename(imageNode.sourceUrl || imageNode.url),
                internal: {
                  contentDigest: imageNode.modifiedGmt,
                },
              },
              helpers.actions,
              gatsbyStore
            )
          }
        } catch (e) {
          reporter.error(e)
          reporter.warn(
            formatLogMessage(
              `${node.__typename} ${node.id} couldn't process inline html image ${imageUrl}`
            )
          )
          return null
        }

        return {
          match,
          cheerioImg,
          fileNode,
          imageResize,
          maxWidth,
          publicUrl,
        }
      })
    )

    // find/replace mutate nodeString to replace matched images with rendered gatsby images
    let replaceIndex = 0
    for (const matchResize of htmlMatchesWithImageResizes) {
      if (!matchResize) {
        continue
      }

      const { match, imageResize, cheerioImg, publicUrl } = matchResize

      let ReactGatsbyImage
      // used to create hydration data for images
      let gatsbyImageHydrationData = null
      if (
        imageResize &&
        (imageResize.images.sources.length > 0 || imageResize.images.fallback)
      ) {
        gatsbyImageHydrationData = {
          image: imageResize,
          // Wordpress tells users to leave "alt" empty if image is decorative. But it returns undefined, not ``
          alt: cheerioImg?.attribs?.alt ?? ``,
          className: `${
            cheerioImg?.attribs?.class || ``
          } inline-gatsby-image-wrapper`,
          "data-wp-inline-image": String(++replaceIndex),
        }
        ReactGatsbyImage = React.createElement(
          GatsbyImage,
          gatsbyImageHydrationData,
          null
        )
      } else if (publicUrl) {
        ReactGatsbyImage = React.createElement(
          `img`,
          {
            src: publicUrl,
            // Wordpress tells users to leave "alt" empty if image is decorative. But it returns undefined, not ``
            alt: cheerioImg?.attribs?.alt ?? ``,
            className: `${
              cheerioImg?.attribs?.class || ``
            } inline-gatsby-image-wrapper`,
          },
          null
        )
      }

      if (ReactGatsbyImage) {
        let gatsbyImageStringRaw =
          ReactDOMServer.renderToString(ReactGatsbyImage)

        // gatsby-plugin-image needs hydration data to work on navigations - we add the hydration data to the DOM to use it in gatsby-browser.ts
        if (gatsbyImageHydrationData) {
          gatsbyImageStringRaw += `<script type="application/json" data-wp-inline-image-hydration="${replaceIndex}">${JSON.stringify(
            gatsbyImageHydrationData
          )}</script>`
        }
        // need to remove the JSON stringify quotes around our image since we're
        // threading this JSON string back into a larger JSON object string
        const gatsbyImageStringJSON = JSON.stringify(gatsbyImageStringRaw)
        const gatsbyImageString = gatsbyImageStringJSON.substring(
          1,
          gatsbyImageStringJSON.length - 1
        )

        nodeString = replaceAll(match, gatsbyImageString, nodeString)
      }
    }
  }

  return nodeString
}

const replaceFileLinks = async ({
  nodeString,
  helpers,
  wpUrl,
  pluginOptions,
  node,
}) => {
  if (
    !pluginOptions?.html?.createStaticFiles ||
    pluginOptions?.type?.MediaItem?.exclude
  ) {
    return nodeString
  }

  if (node.__typename === `MediaItem`) {
    // we don't want to replace file links on MediaItem nodes because they're processed specially from other node types.
    // if we replace file links here then we wont be able to properly fetch the localFile node
    return nodeString
  }

  const hrefMatches = [
    // match url pathnames in html fields, for ex /wp-content/uploads/2019/01/image.jpg
    ...(execall(
      /(\\"|\\'|\()([^'"()]*)(\/wp-content\/uploads\/[^'">()]+)(\\"|\\'|>|\))/gm,
      nodeString
    ) || []),
    // match full urls in json fields, for ex https://example.com/wp-content/uploads/2019/01/image.jpg
    ...(execall(
      new RegExp(
        `(\\"|\\'|\\()([^'"()]*)(${wpUrl}\/wp-content\/uploads\/[^'">()]+)(\\"|\\'|>|\\))`,
        `gm`
      ),
      nodeString
    ) || []),
  ]

  if (hrefMatches.length) {
    // eslint-disable-next-line arrow-body-style
    const mediaItemUrlsAndMatches = hrefMatches.map(matchGroup => {
      const match = matchGroup.subMatches[2]
      const url = match.startsWith(wpUrl) ? match : `${wpUrl}${match}`
      return {
        matchGroup,
        url,
      }
    })

    const mediaItemUrls = mediaItemUrlsAndMatches
      .map(({ url }) => url)
      .filter(isWebUri)

    const mediaItemNodesBySourceUrl =
      await fetchReferencedMediaItemsAndCreateNodes({
        mediaItemUrls,
      })

    const findReplaceMaps = []

    await Promise.all(
      mediaItemNodesBySourceUrl.map(async node => {
        let fileNode
        let mediaItemNode

        if (node.internal.type === `File`) {
          fileNode = node
          mediaItemNode = await helpers.getNode(node.parent)
        } else if (node.localFile?.id) {
          fileNode = await helpers.getNode(node.localFile.id)
          mediaItemNode = node
        } else {
          return null
        }

        const relativeUrl = await copyFileToStaticAndReturnUrlPath(
          fileNode,
          helpers
        )

        if (!relativeUrl || !mediaItemNode?.mediaItemUrl || !fileNode) {
          return null
        }

        const mediaItemMatchGroup = mediaItemUrlsAndMatches.find(
          ({
            matchGroup: {
              subMatches: [, , path],
            },
          }) => mediaItemNode.mediaItemUrl.includes(path)
        )?.matchGroup

        if (!mediaItemMatchGroup) {
          return null
        }

        const [, hostname, path] = mediaItemMatchGroup.subMatches

        cacheCreatedFileNodeBySrc({
          node: mediaItemNode,
          src: `${wpUrl}${path}`,
        })

        findReplaceMaps.push({
          find: `${hostname || ``}${path}`,
          replace: relativeUrl,
        })

        findReplaceMaps.push({
          find: path,
          replace: relativeUrl,
        })

        return null
      })
    )

    for (const { find, replace } of findReplaceMaps.filter(Boolean)) {
      nodeString = replaceAll(find, replace, nodeString)
    }
  }

  return nodeString
}

export const getWpLinkRegex = wpUrl =>
  new RegExp(
    `["']${wpUrl}(?!/wp-content|/wp-admin|/wp-includes)(/[^'"]+)["']`,
    `gim`
  )

// replaces any url which is a front-end WP url with a relative path
const replaceNodeHtmlLinks = ({ wpUrl, nodeString, node }) => {
  const wpLinkRegex = getWpLinkRegex(wpUrl)
  const linkMatches = execall(wpLinkRegex, nodeString)

  if (linkMatches.length) {
    linkMatches.forEach(({ match, subMatches: [path] }) => {
      if (path) {
        try {
          // remove \, " and ' characters from match
          const normalizedMatch = match
            .replace(/['"\\]/g, ``)
            // ensure that query params are properly quoted
            .replace(/\?/, `\\?`)

          const normalizedPath = path.replace(/\\/g, ``)

          // replace normalized match with relative path
          const thisMatchRegex = new RegExp(
            normalizedMatch + `(?!/?wp-content|/?wp-admin|/?wp-includes)`,
            `g`
          )

          nodeString = nodeString.replace(thisMatchRegex, normalizedPath)
        } catch (e) {
          console.error(e)
          console.warn(
            formatLogMessage(
              `Failed to process inline html links in ${node.__typename} ${node.id}`
            )
          )
        }
      }
    })
  }

  return nodeString
}

// replaces specific string or regex with a given string from the plugin options config
export const searchAndReplaceNodeStrings = ({
  nodeString,
  node,
  pluginOptions,
}) => {
  if (Array.isArray(pluginOptions?.searchAndReplace)) {
    pluginOptions.searchAndReplace.forEach(({ search, replace }) => {
      const searchRegex = new RegExp(search, `g`)

      const stringMatches = execall(searchRegex, nodeString)

      if (stringMatches.length) {
        stringMatches.forEach(({ match }) => {
          if (match) {
            try {
              nodeString = nodeString.replace(search, replace)
            } catch (e) {
              console.error(e)
              console.warn(
                formatLogMessage(
                  `Failed to process search and replace string in ${node.__typename} ${node.id}`
                )
              )
            }
          }
        })
      }
    })
  }

  return nodeString
}

const processNodeString = async ({
  nodeString,
  node,
  pluginOptions,
  helpers,
  wpUrl,
}) => {
  const nodeStringFilters = [
    searchAndReplaceNodeStrings,
    replaceNodeHtmlImages,
    replaceFileLinks,
    replaceNodeHtmlLinks,
  ]

  for (const nodeStringFilter of nodeStringFilters) {
    nodeString = await nodeStringFilter({
      nodeString,
      node,
      pluginOptions,
      helpers,
      wpUrl,
    })
  }

  return nodeString
}

const processNode = async ({
  node,
  pluginOptions,
  wpUrl,
  helpers,
  referencedMediaItemNodeIds,
}) => {
  const nodeString = stringify(node)
  let extraNodeMediaItemIdReferences = []

  // find referenced node ids
  // here we're searching for node id strings in our node
  // we use this to download only the media items
  // that are being used in posts
  // this is important for downloading images nodes that are connected somewhere
  // on a node field
  let nodeMediaItemIdReferences =
    findReferencedImageNodeIds({
      nodeString,
      pluginOptions,
      node,
    }) || []

  // Find extra referenced image IDs for the option createStaticFilesForImageIds
  if (node.contentTypeName === `post` || node.contentTypeName === `page`) {
    extraNodeMediaItemIdReferences =
      findReferencedImageNodeIdsForCustomRegex({
        nodeString,
        pluginOptions,
        node,
      }) || []
  }

  if (referencedMediaItemNodeIds) {
    // Add the extra images found to the original array
    nodeMediaItemIdReferences = nodeMediaItemIdReferences.concat(
      extraNodeMediaItemIdReferences
    )

    // push them to our store of referenced id's
    if (nodeMediaItemIdReferences?.length) {
      nodeMediaItemIdReferences.forEach(id =>
        referencedMediaItemNodeIds.add(id)
      )
    }
  }

  const processedNodeString = await processNodeString({
    nodeString,
    node,
    pluginOptions,
    helpers,
    wpUrl,
  })

  const processedNode =
    // only parse if the nodeString has changed
    processedNodeString !== nodeString ? JSON.parse(processedNodeString) : node

  return {
    processedNode,
    nodeMediaItemIdReferences,
  }
}

export { processNode }
