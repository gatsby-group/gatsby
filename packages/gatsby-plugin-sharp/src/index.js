const sharp = require(`./safe-sharp`)
const { generateImageData } = require(`./image-data`)
const imageSize = require(`probe-image-size`)
const { isCI } = require(`gatsby-core-utils/ci`)

const _ = require(`lodash`)
const fs = require(`fs-extra`)
const path = require(`path`)

const { createArgsDigest } = require(`./process-file`)
const { reportError } = require(`./report-error`)
const {
  getPluginOptions,
  healOptions,
  createTransformObject,
  removeDefaultValues,
} = require(`./plugin-options`)
const duotone = require(`./duotone`)
const { IMAGE_PROCESSING_JOB_NAME } = require(`./gatsby-worker`)
const { getDimensionsAndAspectRatio } = require(`./utils`)
const { getDominantColor } = require(`./utils`)

const imageSizeCache = new Map()

const getImageSizeAsync = async file => {
  if (
    process.env.NODE_ENV !== `test` &&
    imageSizeCache.has(file.internal.contentDigest)
  ) {
    return imageSizeCache.get(file.internal.contentDigest)
  }
  const input = fs.createReadStream(file.absolutePath)
  const dimensions = await imageSize(input)

  if (!dimensions) {
    reportError(
      `gatsby-plugin-sharp couldn't determine dimensions for file:\n${file.absolutePath}\nThis file is unusable and is most likely corrupt.`,
      ``
    )
  }

  imageSizeCache.set(file.internal.contentDigest, dimensions)
  return dimensions
}
// Remove in next major as it's really slow
const getImageSize = file => {
  if (
    process.env.NODE_ENV !== `test` &&
    imageSizeCache.has(file.internal.contentDigest)
  ) {
    return imageSizeCache.get(file.internal.contentDigest)
  } else {
    const dimensions = imageSize.sync(fs.readFileSync(file.absolutePath))

    if (!dimensions) {
      reportError(
        `gatsby-plugin-sharp couldn't determine dimensions for file:\n${file.absolutePath}\nThis file is unusable and is most likely corrupt.`,
        ``
      )
    }

    imageSizeCache.set(file.internal.contentDigest, dimensions)
    return dimensions
  }
}

// Actions should be set when passed to onPreInit in gatsby-node.
// ** It is NOT safe to just directly require the gatsby module **.
// There is no guarantee that the module resolved is the module executing!
// This can occur in mono repos depending on how dependencies have been hoisted.
// The direct require has been left only to avoid breaking changes.
let actions
exports.setActions = _actions => {
  actions = _actions
}

exports.generateImageData = generateImageData

function calculateImageDimensionsAndAspectRatio(file, options) {
  const dimensions = getImageSize(file)
  return getDimensionsAndAspectRatio(dimensions, options)
}

function prepareQueue({ file, args }) {
  const { pathPrefix, duotone, ...rest } = args
  // Duotone is a nested object inside transformOptions and has a [Object: Null Prototype]
  // So it's flattened into a new object so that createArgsDigest also takes duotone into account
  const digestArgs = Object.assign(rest, duotone)
  const argsDigestShort = createArgsDigest(digestArgs)
  const imgSrc = `/${file.name}.${args.toFormat}`
  const outputDir = path.join(
    process.cwd(),
    `public`,
    `static`,
    file.internal.contentDigest
  )
  const outputFilePath = path.join(argsDigestShort, imgSrc)

  // make sure outputDir is created
  fs.ensureDirSync(outputDir)

  const { width, height, aspectRatio } = calculateImageDimensionsAndAspectRatio(
    file,
    args
  )

  // encode the file name for URL
  const encodedImgSrc = `/${encodeURIComponent(file.name)}.${args.toFormat}`

  // Prefix the image src.
  const digestDirPrefix = `${file.internal.contentDigest}/${argsDigestShort}`
  const prefixedSrc =
    (pathPrefix ? pathPrefix : ``) +
    `/static/${digestDirPrefix}` +
    encodedImgSrc

  return {
    src: prefixedSrc,
    outputDir: outputDir,
    relativePath: outputFilePath,
    width,
    height,
    aspectRatio,
    options: removeDefaultValues(args, getPluginOptions()),
  }
}

function createJob(job, { reporter }) {
  if (!actions) {
    reporter.panic(
      `Gatsby-plugin-sharp wasn't setup correctly in gatsby-config.js. Make sure you add it to the plugins array.`
    )
  }

  // Jobs can be duplicates and usually are long running tasks.
  // Because of that we shouldn't use async/await and instead opt to use
  // .then() /.catch() handlers, because this allows V8 to release
  // duplicate jobs from memory quickly (as job is not referenced
  // in resolve / reject handlers). If we would use async/await
  // entire closure would keep duplicate job in memory until
  // initial job finish.
  const promise = actions.createJobV2(job).catch(err => {
    reporter.panic(`error converting image`, err)
  })

  return promise
}

function lazyJobsEnabled() {
  return (
    process.env.gatsby_executing_command === `develop` &&
    (!isCI() || process.env.GATSBY_ENABLE_LAZY_IMAGES_IN_CI) &&
    !(
      process.env.ENABLE_GATSBY_EXTERNAL_JOBS === `true` ||
      process.env.ENABLE_GATSBY_EXTERNAL_JOBS === `1`
    )
  )
}

function queueImageResizing({ file, args = {}, reporter }) {
  const fullOptions = healOptions(getPluginOptions(), args, file.extension)
  const { src, width, height, aspectRatio, relativePath, outputDir, options } =
    prepareQueue({ file, args: createTransformObject(fullOptions) })

  // Create job and add it to the queue, the queue will be processed inside gatsby-node.js
  const finishedPromise = createJob(
    {
      name: IMAGE_PROCESSING_JOB_NAME,
      inputPaths: [file.absolutePath],
      outputDir,
      args: {
        isLazy: lazyJobsEnabled(),
        operations: [
          {
            outputPath: relativePath,
            args: options,
          },
        ],
        pluginOptions: getPluginOptions(),
      },
    },
    { reporter }
  )

  return {
    src,
    absolutePath: path.join(outputDir, relativePath),
    width,
    height,
    aspectRatio,
    finishedPromise,
    originalName: file.base,
  }
}

function batchQueueImageResizing({ file, transforms = [], reporter }) {
  const operations = []
  const images = []

  // loop through all transforms to set correct variables
  transforms.forEach(transform => {
    const {
      src,
      width,
      height,
      aspectRatio,
      relativePath,
      outputDir,
      options,
    } = prepareQueue({ file, args: transform })
    // queue operations of an image
    operations.push({
      outputPath: relativePath,
      args: options,
    })

    // create output results
    images.push({
      src,
      absolutePath: path.join(outputDir, relativePath),
      width,
      height,
      aspectRatio,
      originalName: file.base,
      finishedPromise: null,
    })
  })

  const finishedPromise = createJob(
    {
      name: IMAGE_PROCESSING_JOB_NAME,
      inputPaths: [file.absolutePath],
      outputDir: path.join(
        process.cwd(),
        `public`,
        `static`,
        file.internal.contentDigest
      ),
      args: {
        isLazy: lazyJobsEnabled(),
        operations,
        pluginOptions: getPluginOptions(),
      },
    },
    { reporter }
  )

  return images.map(image => {
    image.finishedPromise = finishedPromise

    return image
  })
}

async function generateBase64({ file, args = {}, reporter }) {
  const pluginOptions = getPluginOptions()
  const options = healOptions(pluginOptions, args, file.extension, {
    // Should already be set to base64Width by `fluid()`/`fixed()` methods
    // calling `generateBase64()`. Useful in Jest tests still.
    width: args.base64Width || pluginOptions.base64Width,
  })
  let pipeline
  try {
    pipeline = sharp({ failOn: pluginOptions.failOn })

    if (!options.rotate) {
      pipeline.rotate()
    }
    fs.createReadStream(file.absolutePath).pipe(pipeline)
  } catch (err) {
    reportError(`Failed to process image ${file.absolutePath}`, err, reporter)
    return null
  }

  if (options.trim) {
    pipeline = pipeline.trim(options.trim)
  }

  const changedBase64Format =
    options.toFormatBase64 || pluginOptions.forceBase64Format
  if (changedBase64Format) {
    options.toFormat = changedBase64Format
  }

  pipeline
    .resize({
      width: options.width,
      height: options.height,
      position: options.cropFocus,
      fit: options.fit,
      background: options.background,
    })
    .png({
      compressionLevel: options.pngCompressionLevel,
      adaptiveFiltering: false,
      force: options.toFormat === `png`,
    })
    .jpeg({
      quality: options.jpegQuality || options.quality,
      progressive: options.jpegProgressive,
      force: options.toFormat === `jpg`,
    })
    .webp({
      quality: options.webpQuality || options.quality,
      force: options.toFormat === `webp`,
    })

  // grayscale
  if (options.grayscale) {
    pipeline = pipeline.grayscale()
  }

  // rotate
  if (options.rotate && options.rotate !== 0) {
    pipeline = pipeline.rotate(options.rotate)
  }

  // duotone
  if (options.duotone) {
    if (options.duotone.highlight && options.duotone.shadow) {
      pipeline = await duotone(options.duotone, options.toFormat, pipeline)
    } else {
      reporter.warn(
        `Invalid duotone option specified for ${file.absolutePath}, ignoring. Please pass an object to duotone with the keys "highlight" and "shadow" set to the corresponding hex values you want to use.`
      )
    }
  }
  let buffer
  let info
  try {
    const result = await pipeline.toBuffer({
      resolveWithObject: true,
    })
    buffer = result.data
    info = result.info
  } catch (err) {
    reportError(
      `Failed to process image ${file.absolutePath}.
It is probably corrupt, so please try replacing it.  If it still fails, please open an issue with the image attached.`,
      err,
      reporter
    )
    return null
  }

  const base64output = {
    src: `data:image/${info.format};base64,${buffer.toString(`base64`)}`,
    width: info.width,
    height: info.height,
    aspectRatio: info.width / info.height,
    originalName: file.base,
  }
  return base64output
}

const generateCacheKey = ({ file, args }) =>
  `${file.internal.contentDigest}${JSON.stringify(args)}`

const memoizedBase64 = _.memoize(generateBase64, generateCacheKey)

const cachifiedProcess = async ({ cache, ...arg }, genKey, processFn) => {
  const cachedKey = genKey(arg)
  const cached = await cache.get(cachedKey)

  if (cached) {
    return cached
  }

  const result = await processFn(arg)
  await cache.set(cachedKey, result)

  return result
}

async function base64(arg) {
  if (arg.cache) {
    // Not all transformer plugins are going to provide cache
    return await cachifiedProcess(arg, generateCacheKey, generateBase64)
  }

  return await memoizedBase64(arg)
}

let didShowTraceSVGRemovalWarning = false
async function traceSVG(args) {
  if (!didShowTraceSVGRemovalWarning) {
    console.warn(
      `traceSVG placeholder generation is no longer supported, falling back to blurred. See https://gatsby.dev/tracesvg-removal/`
    )
    didShowTraceSVGRemovalWarning = true
  }

  const { src } = await base64(args)
  return src
}

async function stats({ file, reporter }) {
  const pluginOptions = getPluginOptions()
  let imgStats
  try {
    const pipeline = sharp({ failOn: pluginOptions.failOn })
    fs.createReadStream(file.absolutePath).pipe(pipeline)

    imgStats = await pipeline.stats()
  } catch (err) {
    reportError(
      `Failed to get stats for image ${file.absolutePath}`,
      err,
      reporter
    )
    return null
  }

  return {
    isTransparent: !imgStats.isOpaque,
  }
}

let didShowTraceSVGRemovalWarningFluid = false
async function fluid({ file, args = {}, reporter, cache }) {
  const pluginOptions = getPluginOptions()
  const options = healOptions(pluginOptions, args, file.extension)

  let metadata
  try {
    const pipeline = sharp({ failOn: pluginOptions.failOn })
    fs.createReadStream(file.absolutePath).pipe(pipeline)

    metadata = await pipeline.metadata()
  } catch (err) {
    reportError(
      `Failed to retrieve metadata from image ${file.absolutePath}`,
      err,
      reporter
    )
    return null
  }

  const { width, height, density, format } = metadata

  // if no maxWidth is passed, we need to resize the image based on the passed maxHeight
  const fixedDimension =
    options.maxWidth === undefined ? `maxHeight` : `maxWidth`
  const maxWidth = options.maxWidth
    ? Math.min(options.maxWidth, width)
    : undefined
  const maxHeight = options.maxHeight
    ? Math.min(options.maxHeight, height)
    : undefined

  if (options[fixedDimension] < 1) {
    throw new Error(
      `${fixedDimension} has to be a positive int larger than zero (> 0), now it's ${options[fixedDimension]}`
    )
  }

  // Create sizes (in width) for the image if no custom breakpoints are
  // provided. If the max width of the container for the rendered markdown file
  // is 800px, the sizes would then be: 200, 400, 800, 1200, 1600.
  //
  // This is enough sizes to provide close to the optimal image size for every
  // device size / screen resolution while (hopefully) not requiring too much
  // image processing time (Sharp has optimizations thankfully for creating
  // multiple sizes of the same input file)
  const fluidSizes = [
    options[fixedDimension], // ensure maxWidth (or maxHeight) is added
  ]
  // use standard breakpoints if no custom breakpoints are specified
  if (!options.srcSetBreakpoints || !options.srcSetBreakpoints.length) {
    fluidSizes.push(options[fixedDimension] / 4)
    fluidSizes.push(options[fixedDimension] / 2)
    fluidSizes.push(options[fixedDimension] * 1.5)
    fluidSizes.push(options[fixedDimension] * 2)
  } else {
    options.srcSetBreakpoints.forEach(breakpoint => {
      if (breakpoint < 1) {
        throw new Error(
          `All ints in srcSetBreakpoints should be positive ints larger than zero (> 0), found ${breakpoint}`
        )
      }
      // ensure no duplicates are added
      if (fluidSizes.includes(breakpoint)) {
        return
      }
      fluidSizes.push(breakpoint)
    })
  }
  let filteredSizes = fluidSizes.filter(
    size => size < (fixedDimension === `maxWidth` ? width : height)
  )

  // Add the original image to ensure the largest image possible
  // is available for small images. Also so we can link to
  // the original image.
  filteredSizes.push(fixedDimension === `maxWidth` ? width : height)
  filteredSizes = _.sortBy(filteredSizes)

  // Queue sizes for processing.
  const dimensionAttr = fixedDimension === `maxWidth` ? `width` : `height`
  const otherDimensionAttr = fixedDimension === `maxWidth` ? `height` : `width`

  const imageWithDensityOneIndex = filteredSizes.findIndex(
    size => size === (fixedDimension === `maxWidth` ? maxWidth : maxHeight)
  )

  // Sort sizes for prettiness.
  const transforms = filteredSizes.map(size => {
    const arrrgs = createTransformObject(options)
    if (arrrgs[otherDimensionAttr]) {
      arrrgs[otherDimensionAttr] = undefined
    }
    arrrgs[dimensionAttr] = Math.round(size)

    // we need pathPrefix to calculate the correct outputPath
    if (options.pathPrefix) {
      arrrgs.pathPrefix = options.pathPrefix
    }

    if (options.maxWidth !== undefined && options.maxHeight !== undefined) {
      if (options.fit === sharp.fit.inside) {
        arrrgs.height = Math.round(size * (maxHeight / maxWidth))
      } else {
        arrrgs.height = Math.round(
          size * (options.maxHeight / options.maxWidth)
        )
      }
    }

    return arrrgs
  })

  const images = batchQueueImageResizing({
    file,
    transforms,
    reporter,
  })

  if (options.generateTracedSVG && options.tracedSVG) {
    if (!didShowTraceSVGRemovalWarningFluid) {
      console.warn(
        `tracedSVG placeholder generation for fluid images is no longer supported, falling back to blurred. See https://gatsby.dev/tracesvg-removal/`
      )
      didShowTraceSVGRemovalWarningFluid = true
    }
  }

  const aspectRatio = images[images.length - 1].aspectRatio

  let base64Image
  if (options.base64 || (options.generateTracedSVG && options.tracedSVG)) {
    const base64Width = options.base64Width
    const base64Height = Math.max(1, Math.round(base64Width / aspectRatio))
    const base64Args = {
      background: options.background,
      duotone: options.duotone,
      grayscale: options.grayscale,
      rotate: options.rotate,
      trim: options.trim,
      toFormat: options.toFormat,
      toFormatBase64: options.toFormatBase64,
      cropFocus: options.cropFocus,
      fit: options.fit,
      width: base64Width,
      height: base64Height,
    }
    // Get base64 version
    base64Image = await base64({ file, args: base64Args, reporter, cache })
  }

  // Construct src and srcSet strings.
  const originalImg = _.maxBy(images, image => image.width).src
  const fallbackSrc = _.minBy(images, image =>
    Math.abs(options[fixedDimension] - image[dimensionAttr])
  ).src

  const srcSet = images
    .map(image => `${image.src} ${Math.round(image.width)}w`)
    .join(`,\n`)
  const originalName = file.base

  // figure out the srcSet format
  let srcSetType = `image/${format}`

  if (options.toFormat) {
    switch (options.toFormat) {
      case `png`:
        srcSetType = `image/png`
        break
      case `jpg`:
        srcSetType = `image/jpeg`
        break
      case `webp`:
        srcSetType = `image/webp`
        break
      case `avif`:
        srcSetType = `image/avif`
        break
      case ``:
      case `no_change`:
      default:
        break
    }
  }

  // calculate presentationSizes
  const imageWithDensityOne = images[imageWithDensityOneIndex]
  const presentationWidth = imageWithDensityOne.width
  const presentationHeight = imageWithDensityOne.height

  // If the users didn't set default sizes, we'll make one.
  const sizes =
    options.sizes ||
    `(max-width: ${presentationWidth}px) 100vw, ${presentationWidth}px`

  return {
    base64: (options.base64 && base64Image && base64Image.src) || undefined,
    aspectRatio,
    src: fallbackSrc,
    srcSet,
    srcSetType,
    sizes,
    originalImg,
    originalName,
    density,
    presentationWidth,
    presentationHeight,
    tracedSVG:
      (options.generateTracedSVG &&
        options.tracedSVG &&
        base64Image &&
        base64Image.src) ||
      undefined,
  }
}

let didShowTraceSVGRemovalWarningFixed = false
async function fixed({ file, args = {}, reporter, cache }) {
  const options = healOptions(getPluginOptions(), args, file.extension)

  // if no width is passed, we need to resize the image based on the passed height
  const fixedDimension = options.width === undefined ? `height` : `width`

  // Create sizes for different resolutions — we do 1x, 1.5x, and 2x.
  const sizes = []
  sizes.push(options[fixedDimension])
  sizes.push(options[fixedDimension] * 1.5)
  sizes.push(options[fixedDimension] * 2)
  const dimensions = await getImageSizeAsync(file)

  const filteredSizes = sizes.filter(size => size <= dimensions[fixedDimension])

  // If there's no fluid images after filtering (e.g. image is smaller than what's
  // requested, add back the original so there's at least something)
  if (filteredSizes.length === 0) {
    filteredSizes.push(dimensions[fixedDimension])
    console.warn(
      `
                 The requested ${fixedDimension} "${options[fixedDimension]}px" for a resolutions field for
                 the file ${file.absolutePath}
                 was larger than the actual image ${fixedDimension} of ${dimensions[fixedDimension]}px!
                 If possible, replace the current image with a larger one.
                 `
    )
  }

  // Sort images for prettiness.
  const transforms = _.sortBy(filteredSizes).map(size => {
    const arrrgs = createTransformObject(options)
    arrrgs[fixedDimension] = Math.round(size)

    // Queue images for processing.
    if (options.width !== undefined && options.height !== undefined) {
      arrrgs.height = Math.round(size * (options.height / options.width))
    }
    // we need pathPrefix to calculate the correct outputPath
    if (options.pathPrefix) {
      arrrgs.pathPrefix = options.pathPrefix
    }

    return arrrgs
  })

  const images = batchQueueImageResizing({
    file,
    transforms,
    reporter,
  })

  if (options.generateTracedSVG && options.tracedSVG) {
    if (!didShowTraceSVGRemovalWarningFixed) {
      console.warn(
        `tracedSVG placeholder generation for fixed images is no longer supported, falling back to blurred. See https://gatsby.dev/tracesvg-removal/`
      )
      didShowTraceSVGRemovalWarningFixed = true
    }
  }

  const aspectRatio = images[images.length - 1].aspectRatio

  let base64Image
  if (options.base64 || (options.generateTracedSVG && options.tracedSVG)) {
    const base64Width = options.base64Width
    const base64Height = Math.max(1, Math.round(base64Width / aspectRatio))
    const base64Args = {
      background: options.background,
      duotone: options.duotone,
      grayscale: options.grayscale,
      rotate: options.rotate,
      trim: options.trim,
      toFormat: options.toFormat,
      toFormatBase64: options.toFormatBase64,
      cropFocus: options.cropFocus,
      fit: options.fit,
      width: base64Width,
      height: base64Height,
    }
    // Get base64 version
    base64Image = await base64({
      file,
      args: base64Args,
      reporter,
      cache,
    })
  }

  const fallbackSrc = images[0].src
  const srcSet = images
    .map((image, i) => {
      let resolution
      switch (i) {
        case 0:
          resolution = `1x`
          break
        case 1:
          resolution = `1.5x`
          break
        case 2:
          resolution = `2x`
          break
        default:
      }
      return `${image.src} ${resolution}`
    })
    .join(`,\n`)

  const originalName = file.base

  return {
    base64: (options.base64 && base64Image && base64Image.src) || undefined,
    aspectRatio,
    width: images[0].width,
    height: images[0].height,
    src: fallbackSrc,
    srcSet,
    originalName: originalName,
    tracedSVG:
      (options.generateTracedSVG &&
        options.tracedSVG &&
        base64Image &&
        base64Image.src) ||
      undefined,
  }
}

exports.queueImageResizing = queueImageResizing
exports.batchQueueImageResizing = batchQueueImageResizing
exports.resize = queueImageResizing
exports.base64 = base64
exports.generateBase64 = generateBase64
exports.traceSVG = traceSVG
exports.sizes = fluid
exports.resolutions = fixed
exports.fluid = fluid
exports.fixed = fixed
exports.getImageSize = getImageSize
exports.getImageSizeAsync = getImageSizeAsync
exports.getDominantColor = getDominantColor
exports.stats = stats
exports._unstable_createJob = createJob
exports._lazyJobsEnabled = lazyJobsEnabled
