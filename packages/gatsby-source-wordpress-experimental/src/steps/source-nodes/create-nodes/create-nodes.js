import execall from "execall"
import fetchReferencedMediaItemsAndCreateNodes from "../fetch-nodes/fetch-referenced-media-items"
import urlToPath from "~/utils/url-to-path"
import { getGatsbyApi } from "~/utils/get-gatsby-api"
import store from "~/store"
import fetchGraphql from "~/utils/fetch-graphql"

import {
  buildTypeName,
  getTypeSettingsByType,
} from "~/steps/create-schema-customization/helpers"

// const imgSrcRemoteFileRegex = /(?:src=\\")((?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[A-Z0-9+&@#/%=~_|$])\.(?:jpeg|jpg|png|gif|ico|pdf|doc|docx|ppt|pptx|pps|ppsx|odt|xls|psd|mp3|m4a|ogg|wav|mp4|m4v|mov|wmv|avi|mpg|ogv|3gp|3g2|svg|bmp|tif|tiff|asf|asx|wm|wmx|divx|flv|qt|mpe|webm|mkv|txt|asc|c|cc|h|csv|tsv|ics|rtx|css|htm|html|m4b|ra|ram|mid|midi|wax|mka|rtf|js|swf|class|tar|zip|gz|gzip|rar|7z|exe|pot|wri|xla|xlt|xlw|mdb|mpp|docm|dotx|dotm|xlsm|xlsb|xltx|xltm|xlam|pptm|ppsm|potx|potm|ppam|sldx|sldm|onetoc|onetoc2|onetmp|onepkg|odp|ods|odg|odc|odb|odf|wp|wpd|key|numbers|pages))(?=\\"| |\.)/gim

export const createGatsbyNodesFromWPGQLContentNodes = async ({
  wpgqlNodesByContentType,
}) => {
  const { helpers, pluginOptions } = getGatsbyApi()

  const { actions, createContentDigest } = helpers

  const createdNodeIds = []
  const referencedMediaItemNodeIds = new Set()

  for (const wpgqlNodesGroup of wpgqlNodesByContentType) {
    const wpgqlNodes = wpgqlNodesGroup.allNodesOfContentType

    for (const node of wpgqlNodes.values()) {
      if (node.link) {
        // create a pathname for the node using the WP permalink
        node.path = urlToPath(node.link)
      }

      // here we're searching for file strings in our node
      // we use this to download only the media items
      // that are being used in posts
      // this is important not only for downloading only used images
      // but also for downloading images in post content
      if (wpgqlNodesGroup.plural !== `mediaItems`) {
        const nodeString = JSON.stringify(node)

        // const imageUrlMatches = execall(imgSrcRemoteFileRegex, nodeString)

        // if (imageUrlMatches.length) {
        //   store.dispatch.imageNodes.addImgMatches(imageUrlMatches)
        // }

        if (!pluginOptions.type.MediaItem.lazyNodes) {
          // get an array of all referenced media file ID's
          const matchedIds = execall(/"id":"([^"]*)","sourceUrl"/gm, nodeString)
            .map(match => match.subMatches[0])
            .filter(id => id !== node.id)

          if (matchedIds.length) {
            matchedIds.forEach(id => referencedMediaItemNodeIds.add(id))
          }
        }
      }

      const remoteNode = {
        ...node,
        id: node.id,
        parent: null,
        internal: {
          contentDigest: createContentDigest(node),
          type: buildTypeName(node.type),
        },
      }

      const typeSettings = getTypeSettingsByType({
        name: node.type,
      })

      if (
        typeSettings.beforeChangeNode &&
        typeof typeSettings.beforeChangeNode === `function`
      ) {
        const { additionalNodeIds } =
          (await typeSettings.beforeChangeNode({
            actionType: `CREATE_ALL`,
            remoteNode,
            actions,
            helpers,
            type: node.type,
            fetchGraphql,
            typeSettings,
            buildTypeName,
            wpStore: store,
          })) || {}

        if (additionalNodeIds && additionalNodeIds.length) {
          additionalNodeIds.forEach(id => createdNodeIds.push(id))
        }
      }

      await actions.createNode(remoteNode)

      createdNodeIds.push(node.id)
    }
  }

  const referencedMediaItemNodeIdsArray = [...referencedMediaItemNodeIds]

  /**
   * if we're not lazy fetching media items, we need to fetch them
   * upfront here
   */
  if (
    !pluginOptions.type.MediaItem.lazyNodes &&
    referencedMediaItemNodeIdsArray.length
  ) {
    await fetchReferencedMediaItemsAndCreateNodes({
      referencedMediaItemNodeIds: referencedMediaItemNodeIdsArray,
    })

    return [...createdNodeIds, ...referencedMediaItemNodeIdsArray]
  }

  return createdNodeIds
}
