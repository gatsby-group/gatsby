import reporter from "gatsby/reporter"
import path from "path"
import { SchemaComposer } from "graphql-compose"
import type {
  EnumTypeComposerAsObjectDefinition,
  EnumTypeComposer,
  InterfaceTypeComposerAsObjectDefinition,
} from "graphql-compose"
import type { Store, Node, GatsbyNode } from "gatsby"
import type { Application } from "express"
import { actions } from "gatsby/dist/redux/actions"
import { resize } from "./utils/image-handler"

type ImageFormat = "jpg" | "png" | "webp" | "avif" | "auto"
type ImageLayout = "fixed" | "constrained" | "fullWidth"
type ImageFit = import("sharp").FitEnum[keyof import("sharp").FitEnum]
type WidthOrHeight =
  | { width: number; height: never }
  | { width: never; height: number }
  | { width: number; height: number }
type CalculateImageSizesArgs = WidthOrHeight & {
  fit: ImageFit
  layout: ImageLayout
  outputPixelDensities: Array<number>
  breakpoints?: Array<number>
}

type SchemaBuilder = Parameters<
  NonNullable<GatsbyNode["createSchemaCustomization"]>
>[0]["schema"]

interface IRemoteFileNode extends Node {
  url: string
  contentType: string
  filename: string
  filesize?: number
}

interface IRemoteImageNode extends IRemoteFileNode {
  width: number
  height: number
}

interface IImageSizes {
  sizes: Array<number>
  presentationWidth: number
  presentationHeight: number
  aspectRatio: number
  unscaledWidth: number
}

interface ISourceMetadata {
  width: number
  height: number
  format: ImageFormat
  filename: string
}

type ImageSizeArgs = CalculateImageSizesArgs & {
  sourceMetadata: ISourceMetadata
}

interface IGatsbyImageData {
  sources: Array<{
    srcSet: string
    type: string
    sizes: string
  }>
  fallback: {
    srcSet: string
    src: string
    sizes: string
  }
}

interface IEnumArgs {
  fit: EnumTypeComposer
  layout: EnumTypeComposer
  placeholder: EnumTypeComposer
  format: EnumTypeComposer
}

type GraphQLArg<T> =
  | T
  | {
      type: T
      description?: string
      defaultValue?: T
    }

interface IGraphQLFieldConfigDefinition<
  TSource,
  R,
  TArgs = Record<string, GraphQLArg<unknown>>
> {
  type: string
  args?: TArgs
  resolve(source: TSource, args: TArgs): R
}

export const DEFAULT_PIXEL_DENSITIES = [0.25, 0.5, 1, 2]
export const DEFAULT_BREAKPOINTS = [750, 1080, 1366, 1920]

export function getRemoteFileEnums(
  buildEnumType: (obj: EnumTypeComposerAsObjectDefinition) => EnumTypeComposer
): IEnumArgs {
  const remoteFileFit = buildEnumType({
    name: `RemoteFileFit`,
    values: {
      COVER: { value: `cover` },
      FILL: { value: `fill` },
      OUTSIDE: { value: `outside` },
      CONTAIN: { value: `contain` },
    },
  })

  const remoteFormatEnum = buildEnumType({
    name: `RemoteFileFormat`,
    values: {
      AUTO: { value: `auto` },
      JPG: { value: `jpg` },
      PNG: { value: `png` },
      WEBP: { value: `webp` },
      AVIF: { value: `avif` },
    },
  })

  const remoteLayoutEnum = buildEnumType({
    name: `RemoteFileLayout`,
    values: {
      FIXED: { value: `fixed` },
      FULL_WIDTH: { value: `fullWidth` },
      CONSTRAINED: { value: `constrained` },
    },
  })

  const remotePlaceholderEnum = buildEnumType({
    name: `RemoteFilePlaceholder`,
    values: {
      DOMINANT_COLOR: { value: `dominantColor` },
      TRACED_SVG: { value: `tracedSVG` },
      BLURRED: { value: `blurred` },
      NONE: { value: `none` },
    },
  })

  return {
    fit: remoteFileFit,
    format: remoteFormatEnum,
    layout: remoteLayoutEnum,
    placeholder: remotePlaceholderEnum,
  }
}

export function getRemoteFileFields(
  enums: IEnumArgs,
  store: Store
): Record<
  string,
  string | IGraphQLFieldConfigDefinition<IRemoteFileNode, unknown>
> {
  // TODO find a way if image-service is supported so we don't polyfill
  // TODO: we shouldn't download files during development or when the server has image service enabled
  const shouldDispatchJobs = process.env.NODE_ENV === `production`

  return {
    id: `ID!`,
    contentType: `String!`,
    filename: `String!`,
    filesize: `Int`,
    width: `Int`,
    publicUrl: {
      type: `String!`,
      resolve(source): string {
        dispatchLocalFileServiceJob(
          {
            url: source.url,
            contentType: source.contentType,
          },
          store
        )

        return generatePublicUrl(source)
      },
    },
    resize: {
      type: `String`,
      args: {
        width: `Int`,
        height: `Int`,
        fit: {
          type: enums.fit.getTypeName(),
          defaultValue: enums.fit.getField(`COVER`).value,
        },
      },
      resolve(
        source,
        args: { width: number; height: number; fit: ImageFit }
      ): string | null {
        if (!isImage(source)) {
          return null
        }

        if (shouldDispatchJobs) {
          dispatchLocalImageServiceJob(
            {
              url: source.url,
              contentType: source.contentType,
              ...args,
              format: getImageFormatFromContentType(source.contentType),
            },
            store
          )
        }

        return `${generatePublicUrl(source)}/${generateImageArgs({
          ...args,
          format: getImageFormatFromContentType(source.contentType),
        })}`
      },
    },
    gatsbyImageData: {
      type: `JSON`,
      args: {
        layout: {
          type: enums.layout.NonNull.getTypeName(),
          description: stripIndent`
        The layout for the image.
        FIXED: A static image sized, that does not resize according to the screen width
        FULL_WIDTH: The image resizes to fit its container. Pass a "sizes" option if it isn't going to be the full width of the screen.
        CONSTRAINED: Resizes to fit its container, up to a maximum width, at which point it will remain fixed in size.
        `,
        },
        width: {
          type: `Int`,
          description: stripIndent`
    The display width of the generated image for layout = FIXED, and the display width of the largest image for layout = CONSTRAINED.
    The actual largest image resolution will be this value multiplied by the largest value in outputPixelDensities
    Ignored if layout = FLUID.
    `,
        },
        height: {
          type: `Int`,
          description: stripIndent`
    If set, the height of the generated image. If omitted, it is calculated from the supplied width, matching the aspect ratio of the source image.`,
        },
        placeholder: {
          type: enums.placeholder.getTypeName(),
          defaultValue: enums.placeholder.getField(`DOMINANT_COLOR`).value,
          description: stripIndent`
        Format of generated placeholder image, displayed while the main image loads.
        BLURRED: a blurred, low resolution image, encoded as a base64 data URI (default)
        DOMINANT_COLOR: a solid color, calculated from the dominant color of the image.
        TRACED_SVG: a low-resolution traced SVG of the image.
        NONE: no placeholder. Set the argument "backgroundColor" to use a fixed background color.`,
        },
        formats: {
          type: enums.format.NonNull.List.getTypeName(),
          description: stripIndent`
        The image formats to generate. Valid values are AUTO (meaning the same format as the source image), JPG, PNG, WEBP and AVIF.
        The default value is [AUTO, WEBP, AVIF], and you should rarely need to change this. Take care if you specify JPG or PNG when you do
        not know the formats of the source images, as this could lead to unwanted results such as converting JPEGs to PNGs. Specifying
        both PNG and JPG is not supported and will be ignored.
    `,
          defaultValue: [
            enums.format.getField(`AUTO`).value,
            enums.format.getField(`WEBP`).value,
            enums.format.getField(`AVIF`).value,
          ],
        },
        outputPixelDensities: {
          type: `[Float]`,
          defaultValue: DEFAULT_PIXEL_DENSITIES,
          description: stripIndent`
        A list of image pixel densities to generate for FIXED and CONSTRAINED images. You should rarely need to change this. It will never generate images larger than the source, and will always include a 1x image.
        Default is [ 1, 2 ] for fixed images, meaning 1x, 2x, and [0.25, 0.5, 1, 2] for fluid. In this case, an image with a fluid layout and width = 400 would generate images at 100, 200, 400 and 800px wide.
        `,
        },
        breakpoints: {
          type: `[Int]`,
          defaultValue: DEFAULT_BREAKPOINTS,
          description: stripIndent`
    Specifies the image widths to generate. You should rarely need to change this. For FIXED and CONSTRAINED images it is better to allow these to be determined automatically,
    based on the image size. For FULL_WIDTH images this can be used to override the default, which is [750, 1080, 1366, 1920].
    It will never generate any images larger than the source.
    `,
        },
        sizes: {
          type: `String`,
          description: stripIndent`
        The "sizes" property, passed to the img tag. This describes the display size of the image.
        This does not affect the generated images, but is used by the browser to decide which images to download. You can leave this blank for fixed images, or if the responsive image
        container will be the full width of the screen. In these cases we will generate an appropriate value.
    `,
        },
        backgroundColor: {
          type: `String`,
          description: `Background color applied to the wrapper, or when "letterboxing" an image to another aspect ratio.`,
        },
        fit: {
          type: enums.fit.getTypeName(),
          defaultValue: enums.fit.getField(`COVER`).value,
        },
      },
      resolve(
        source,
        args: CalculateImageSizesArgs & {
          formats: Array<ImageFormat>
          backgroundColor: string
        }
      ): {
        images: IGatsbyImageData
        layout: string
        backgroundColor: string
      } | null {
        if (!isImage(source)) {
          return null
        }
        const sourceMetadata: ISourceMetadata = {
          width: source.width,
          height: source.height,
          format: getImageFormatFromContentType(source.contentType),
          filename: source.filename,
        }
        const formats = validateAndNormalizeFormats(
          args.formats,
          sourceMetadata.format
        )
        const imageSizes = calculateImageSizes(sourceMetadata, args)
        const sizes = getSizesAttrFromLayout(
          args.layout,
          imageSizes.presentationWidth
        )
        const result: Partial<IGatsbyImageData> & {
          sources: IGatsbyImageData["sources"]
        } = {
          sources: [],
          fallback: undefined,
        }

        for (const format of formats) {
          let fallbackSrc: string | undefined = undefined
          const images = imageSizes.sizes.map(width => {
            if (shouldDispatchJobs) {
              dispatchLocalImageServiceJob(
                {
                  url: source.url,
                  contentType: source.contentType,
                  width,
                  height: Math.round(width / imageSizes.aspectRatio),
                  format,
                  fit: args.fit,
                },
                store
              )
            }

            const src = `${generatePublicUrl(source)}/${generateImageArgs({
              width,
              height: Math.round(width / imageSizes.aspectRatio),
              format,
              fit: args.fit,
            })}`
            if (!fallbackSrc) {
              fallbackSrc = src
            }
            return {
              src,
              width,
            }
          })
          if (format === sourceMetadata.format && fallbackSrc) {
            result.fallback = {
              src: fallbackSrc,
              srcSet: createSrcSetFromImages(images),
              sizes,
            }
          } else {
            result.sources.push({
              srcSet: createSrcSetFromImages(images),
              type: `image/${format}`,
              sizes,
            })
          }
        }
        return {
          images: result as IGatsbyImageData,
          layout: args.layout,
          backgroundColor: args.backgroundColor,
        }
      },
    },
  }
}

let enums: IEnumArgs | undefined
export function addRemoteFilePolyfillInterface<
  T = ReturnType<SchemaBuilder["buildObjectType"]>
>(
  type: T,
  {
    schema,
    store,
  }: {
    schema: SchemaBuilder
    store: Store
  }
): T {
  // We only want to create the enums and interface once
  if (!enums) {
    const composer = new SchemaComposer()
    enums = getRemoteFileEnums(composer.createEnumTC.bind(composer))

    const types: Array<
      | string
      | ReturnType<SchemaBuilder["buildObjectType"]>
      | ReturnType<SchemaBuilder["buildInterfaceType"]>
      | ReturnType<SchemaBuilder["buildEnumType"]>
    > = [
      schema.buildEnumType({
        name: enums.fit.getTypeName(),
        values: enums.fit.getFields(),
      }),
      schema.buildEnumType({
        name: enums.format.getTypeName(),
        values: enums.format.getFields(),
      }),
      schema.buildEnumType({
        name: enums.layout.getTypeName(),
        values: enums.layout.getFields(),
      }),
      schema.buildEnumType({
        name: enums.placeholder.getTypeName(),
        values: enums.placeholder.getFields(),
      }),
    ]

    types.push(
      schema.buildInterfaceType({
        name: `RemoteFile`,
        interfaces: [`Node`],
        fields: getRemoteFileFields(
          enums,
          store
        ) as InterfaceTypeComposerAsObjectDefinition<
          IRemoteFileNode,
          unknown
        >["fields"],
      })
    )

    store.dispatch(
      actions.createTypes(types, {
        name: `gatsby`,
        version: getGatsbyVersion(),
        resolve: path.join(__dirname, `../`),
      })
    )
  }

  // @ts-ignore - wrong typing by typecomposer
  type.config.interfaces = type.config.interfaces || []
  // @ts-ignore - wrong typing by typecomposer
  type.config.interfaces.push(`RemoteFile`)
  // @ts-ignore - wrong typing by typecomposer
  type.config.fields = {
    // @ts-ignore - wrong typing by typecomposer
    ...type.config.fields,
    ...getRemoteFileFields(enums, store),
  }

  return type
}

// TODO add persistent cache
export function polyfillImageServiceDevRoutes(
  app: Application,
  remoteFileCache: Map<string, Buffer> = new Map()
): void {
  // TODO find a way if image-service is supported so we don't polyfill

  app.get(`/_gatsby/file/:url`, (req, res) => {
    import(`got`).then(got => {
      // @ts-ignore ddd
      got.stream(Buffer.from(req.params.url, `base64`).toString()).pipe(res)
    })
  })

  app.get(`/_gatsby/image/:url/:params`, async (req, res) => {
    const { url, params } = req.params

    const searchParams = new URLSearchParams(
      Buffer.from(params, `base64`).toString()
    )

    const resizeParams: { width: number; height: number; format: string } = {
      width: 0,
      height: 0,
      format: ``,
    }
    for (const [key, value] of searchParams) {
      switch (key) {
        case `w`: {
          resizeParams.width = Number(value)
          break
        }
        case `h`: {
          resizeParams.height = Number(value)
          break
        }
        case `fm`: {
          resizeParams.format = value
          break
        }
      }
    }

    const remoteUrl = Buffer.from(url, `base64`).toString()
    let buffer: Buffer
    if (remoteFileCache.has(remoteUrl)) {
      buffer = remoteFileCache.get(remoteUrl) as Buffer
    } else {
      buffer = await import(`got`).then(got =>
        // @ts-ignore ddd
        got(Buffer.from(url, `base64`).toString()).buffer()
      )
      remoteFileCache.set(remoteUrl, buffer)
    }

    res.setHeader(`content-type`, `image/${resizeParams.format}`)

    res.send(await resize(buffer, resizeParams))
  })
}

let GATSBY_VERSION: string
function getGatsbyVersion(): string {
  if (!GATSBY_VERSION) {
    const gatsbyJSON = require(`gatsby/package.json`)
    GATSBY_VERSION = gatsbyJSON.version
  }

  return GATSBY_VERSION
}

function stripIndent(
  tpl: ReadonlyArray<string>,
  ...expressions: ReadonlyArray<string>
): string {
  let str = ``

  tpl.forEach((chunk, index) => {
    str +=
      chunk.replace(/^(\\n)*[ ]+/gm, `$1`) +
      (expressions[index] ? expressions[index] : ``)
  })

  return str
}

function generatePublicUrl({
  url,
  contentType,
}: {
  url: string
  contentType: string
}): string {
  const publicUrl = Buffer.from(url).toString(`base64`)

  if (isImage({ contentType })) {
    return `/_gatsby/image/${publicUrl}`
  }

  return `/_gatsby/file/${publicUrl}`
}

function generateImageArgs({
  width,
  height,
  format,
  fit,
}: WidthOrHeight & { format: string; fit: ImageFit }): string {
  const args: Array<string> = []
  if (width) {
    args.push(`w=${width}`)
  }
  if (height) {
    args.push(`h=${height}`)
  }
  if (fit) {
    args.push(`fit=${fit}`)
  }
  if (format) {
    args.push(`fm=${format}`)
  }

  return Buffer.from(args.join(`&`)).toString(`base64`)
}

function isImage(node: {
  contentType: IRemoteFileNode["contentType"]
}): node is IRemoteImageNode {
  if (!node.contentType) {
    throw new Error(
      `RemoteFileNode does not have a contentType. The field is required.`
    )
  }

  return (
    node.contentType.startsWith(`image/`) &&
    node.contentType !== `image/svg+xml`
  )
}

function getImageFormatFromContentType(contentType: string): ImageFormat {
  return contentType
    .replace(`image/jpeg`, `image/jpg`)
    .replace(`image/`, ``) as ImageFormat
}

function dispatchLocalFileServiceJob(
  { url, contentType }: { url: string; contentType: string },
  store: Store
): void {
  const GATSBY_VERSION = getGatsbyVersion()
  const publicUrl = generatePublicUrl({ url, contentType }).split(`/`)
  const filename = publicUrl.pop()
  publicUrl.unshift(`public`)

  actions.createJobV2(
    {
      name: `FILE_SERVICE`,
      inputPaths: [],
      // we know it's an image so we just mimic an image
      outputDir: path.join(
        global.__GATSBY.root,
        publicUrl.filter(Boolean).join(`/`)
      ),
      args: {
        url,
        filename,
      },
    },
    {
      name: `gatsby`,
      version: GATSBY_VERSION,
      resolve: path.join(__dirname, `polyfill-jobs/remote-file`),
    }
  )(store.dispatch, store.getState)
}

function dispatchLocalImageServiceJob(
  {
    url,
    contentType,
    width,
    height,
    format,
    fit,
  }: {
    url: string
    contentType: string
    width: number
    height: number
    format: string
    fit: ImageFit
  },
  store: Store
): void {
  const GATSBY_VERSION = getGatsbyVersion()
  const publicUrl = generatePublicUrl({ url, contentType }).split(`/`)
  publicUrl.unshift(`public`)

  actions.createJobV2(
    {
      name: `IMAGE_SERVICE`,
      inputPaths: [],
      outputDir: path.join(
        global.__GATSBY.root,
        publicUrl.filter(Boolean).join(`/`)
      ),
      args: {
        url,
        filename: generateImageArgs({ width, height, format, fit }),
        width,
        height,
        format,
        fit,
      },
    },
    {
      name: `gatsby`,
      version: GATSBY_VERSION,
      resolve: path.join(__dirname, `polyfill-jobs/remote-file`),
    }
  )(store.dispatch, store.getState)
}

function createSrcSetFromImages(
  images: Array<{ src: string; width: number }>
): string {
  return images.map(image => `${image.src} ${image.width}w`).join(`,`)
}

function sortNumeric(a: number, b: number): number {
  return a - b
}

function validateAndNormalizeFormats(
  formats: Array<ImageFormat>,
  sourceFormat: ImageFormat
): Set<ImageFormat> {
  const formatSet = new Set<ImageFormat>(formats)

  // convert auto in format of source image
  if (formatSet.has(`auto`)) {
    formatSet.delete(`auto`)
    formatSet.add(sourceFormat)
  }

  if (formatSet.has(`jpg`) && formatSet.has(`png`)) {
    throw new Error(`Cannot specify both JPG and PNG formats`)
  }

  return formatSet
}

// eslint-disable-next-line consistent-return
function calculateImageSizes(
  sourceMetadata: ISourceMetadata,
  {
    width,
    height,
    layout,
    fit,
    outputPixelDensities,
    breakpoints,
  }: CalculateImageSizesArgs
): IImageSizes {
  if (Number(width) <= 0) {
    throw new Error(
      `The provided width of "${width}" is incorrect. Dimensions should be a positive number.`
    )
  }

  if (Number(height) <= 0) {
    throw new Error(
      `The provided height of "${height}" is incorrect. Dimensions should be a positive number.`
    )
  }

  switch (layout) {
    case `fixed`: {
      return calculateFixedImageSizes({
        width,
        height,
        fit,
        sourceMetadata,
        outputPixelDensities,
      })
    }
    case `constrained`: {
      return calculateResponsiveImageSizes({
        sourceMetadata,
        width,
        height,
        fit,
        outputPixelDensities,
        layout,
      })
    }
    case `fullWidth`: {
      return calculateResponsiveImageSizes({
        sourceMetadata,
        width,
        height,
        fit,
        outputPixelDensities,
        layout,
        breakpoints,
      })
    }
  }
}

function calculateFixedImageSizes({
  sourceMetadata,
  width,
  height,
  fit = `cover`,
  outputPixelDensities,
}: Omit<ImageSizeArgs, "layout" | "breakpoints">): IImageSizes {
  let aspectRatio = sourceMetadata.width / sourceMetadata.height

  // make sure output outputPixelDensities has a value of 1
  outputPixelDensities.push(1)
  const densities = new Set<number>(
    outputPixelDensities.sort(sortNumeric).filter(Boolean)
  )

  // If both are provided then we need to check the fit
  if (width && height) {
    const calculated = calculateImageDimensions(sourceMetadata, {
      width,
      height,
      fit,
    })
    width = calculated.width
    height = calculated.height
    aspectRatio = calculated.aspectRatio
  } else {
    // if we only get one value calculate the other value based on aspectRatio
    if (!width) {
      width = Math.round(height * aspectRatio)
    } else {
      height = Math.round(width / aspectRatio)
    }
  }

  const presentationWidth = width // will use this for presentationWidth, don't want to lose it
  const isRequestedSizeLargerThanOriginal =
    sourceMetadata.width < width || sourceMetadata.height < (height as number)

  // If the image is smaller than requested, warn the user that it's being processed as such
  // print out this message with the necessary information before we overwrite it for sizing
  if (isRequestedSizeLargerThanOriginal) {
    const invalidDimension = sourceMetadata.width < width ? `width` : `height`
    reporter.warn(`
    The requested ${invalidDimension} "${
      invalidDimension === `width` ? width : height
    }px" for the image ${
      sourceMetadata.filename
    } was larger than the actual image ${invalidDimension} of ${
      sourceMetadata[invalidDimension]
    }px. If possible, replace the current image with a larger one.`)

    if (invalidDimension === `width`) {
      width = sourceMetadata.width
      height = width / aspectRatio
    } else {
      height = sourceMetadata.height
      width = height * aspectRatio
    }
  }

  const sizes = new Set<number>()
  for (const density of densities) {
    // Screen densities can only be higher or equal to 1
    if (density >= 1) {
      const widthFromDensity = density * width
      sizes.add(Math.min(widthFromDensity, sourceMetadata.width))
    }
  }

  return {
    sizes: Array.from(sizes),
    aspectRatio,
    presentationWidth,
    presentationHeight: Math.round(presentationWidth / aspectRatio),
    unscaledWidth: width,
  }
}

function calculateResponsiveImageSizes({
  sourceMetadata,
  width,
  height,
  fit = `cover`,
  outputPixelDensities,
  breakpoints,
  layout,
}: ImageSizeArgs): IImageSizes {
  let sizes
  let aspectRatio = sourceMetadata.width / sourceMetadata.height
  // Sort, dedupe and ensure there's a 1
  const densities = new Set<number>(
    outputPixelDensities.sort(sortNumeric).filter(Boolean)
  )

  // If both are provided then we need to check the fit
  if (width && height) {
    const calculated = calculateImageDimensions(sourceMetadata, {
      width,
      height,
      fit,
    })
    width = calculated.width
    height = calculated.height
    aspectRatio = calculated.aspectRatio
  }

  // Case 1: width of height were passed in, make sure it isn't larger than the actual image
  width = width && Math.round(Math.min(width, sourceMetadata.width))
  height = height && Math.min(height, sourceMetadata.height)

  const originalWidth = width

  if (breakpoints && breakpoints.length > 0) {
    sizes = breakpoints.filter(size => size <= sourceMetadata.width)

    // If a larger breakpoint has been filtered-out, add the actual image width instead
    if (
      sizes.length < breakpoints.length &&
      !sizes.includes(sourceMetadata.width)
    ) {
      sizes.push(sourceMetadata.width)
    }
  } else {
    sizes = Array.from(densities).map(density =>
      Math.round(density * (width as number))
    )
    sizes = sizes.filter(size => size <= sourceMetadata.width)
  }

  // ensure that the size passed in is included in the final output
  if (layout === `constrained` && !sizes.includes(width)) {
    sizes.push(width)
  }

  sizes = sizes.sort(sortNumeric)

  return {
    sizes,
    aspectRatio,
    presentationWidth: originalWidth,
    presentationHeight: Math.round(originalWidth / aspectRatio),
    unscaledWidth: width,
  }
}

// eslint-disable-next-line consistent-return
function getSizesAttrFromLayout(layout: ImageLayout, width: number): string {
  switch (layout) {
    // If screen is wider than the max size, image width is the max size,
    // otherwise it's the width of the screen
    case `constrained`:
      return `(min-width: ${width}px) ${width}px, 100vw`

    // Image is always the same width, whatever the size of the screen
    case `fixed`:
      return `${width}px`

    // Image is always the width of the screen
    case `fullWidth`:
      return `100vw`
  }
}

export function calculateImageDimensions(
  originalDimensions: { width: number; height: number },
  {
    fit,
    width: requestedWidth,
    height: requestedHeight,
  }: { fit: ImageFit; width: number; height: number }
): { width: number; height: number; aspectRatio: number } {
  // Calculate the eventual width/height of the image.
  const imageAspectRatio = originalDimensions.width / originalDimensions.height

  let width = requestedWidth
  let height = requestedHeight
  switch (fit) {
    case `cover`: {
      width = requestedWidth ?? originalDimensions.width
      height = requestedHeight ?? originalDimensions.height
      break
    }
    case `inside`: {
      const widthOption = requestedWidth ?? Number.MAX_SAFE_INTEGER
      const heightOption = requestedHeight ?? Number.MAX_SAFE_INTEGER

      width = Math.min(widthOption, Math.round(heightOption * imageAspectRatio))
      height = Math.min(
        heightOption,
        Math.round(widthOption / imageAspectRatio)
      )
      break
    }
    case `outside`: {
      const widthOption = requestedWidth ?? 0
      const heightOption = requestedHeight ?? 0

      width = Math.max(widthOption, Math.round(heightOption * imageAspectRatio))
      height = Math.max(
        heightOption,
        Math.round(widthOption / imageAspectRatio)
      )
      break
    }

    default: {
      if (requestedWidth && !requestedHeight) {
        width = requestedWidth
        height = Math.round(requestedHeight / imageAspectRatio)
      }

      if (requestedHeight && !requestedWidth) {
        width = Math.round(requestedHeight * imageAspectRatio)
        height = requestedHeight
      }
    }
  }

  return {
    width,
    height,
    aspectRatio: width / height,
  }
}
