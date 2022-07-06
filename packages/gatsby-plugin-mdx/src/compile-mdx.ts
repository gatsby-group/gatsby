import deepmerge from "deepmerge"
import type { NodePluginArgs, PluginOptions } from "gatsby"
import type { ProcessorOptions } from "@mdx-js/mdx"
import type { IFileNode, IMdxMetadata, IMdxNode } from "./types"
import { enhanceMdxOptions, IMdxPluginOptions } from "./plugin-options"
import { ERROR_CODES } from "./error-utils"

// Compiles MDX into JS
// Differences to original @mdx-js/loader:
// * We pass the MDX node and a metadata object to the processor
// * We inject the path to the original mdx file into the VFile which is used by the processor
export async function compileMDX(
  mdxNode: IMdxNode,
  fileNode: IFileNode,
  options: ProcessorOptions,
  reporter: NodePluginArgs["reporter"]
): Promise<{ processedMDX: string; metadata: IMdxMetadata } | null> {
  try {
    const { createProcessor } = await import(`@mdx-js/mdx`)
    const { VFile } = await import(`vfile`)

    const processor = createProcessor(options)

    // Pass required custom data into the processor
    const metadata: IMdxMetadata = {}
    processor.data(`mdxNode`, mdxNode)
    processor.data(`mdxMetadata`, metadata)

    const result = await processor.process(
      // Inject path to original file for remark plugins. See: https://github.com/gatsbyjs/gatsby/issues/26914
      new VFile({ value: mdxNode.body, path: fileNode.absolutePath })
    )

    // Clone metadata so ensure it won't be overridden by later processings
    const clonedMetadata = Object.assign(
      {},
      processor.data(`mdxMetadata`) as IMdxMetadata
    )
    const processedMDX = result.toString()

    return { processedMDX, metadata: clonedMetadata }
  } catch (err) {
    const errorMeta = [
      mdxNode.title && `Title: ${mdxNode.title}`,
      mdxNode.slug && `Slug: ${mdxNode.slug}`,
      fileNode.relativePath && `Path: ${fileNode.relativePath}`,
    ]
      .filter(Boolean)
      .join(`\n`)

    reporter.panicOnBuild(
      {
        id: ERROR_CODES.MdxCompilation,
        context: {
          errorMeta,
        },
      },
      err
    )
    return null
  }
}

/**
 * This helper function allows you to inject additional plugins and configuration into the MDX
 * compilation pipeline. Very useful to create your own resolvers that return custom metadata.
 * Internally used to generate the tables of contents and the excerpts.
 */
export const compileMDXWithCustomOptions = async ({
  pluginOptions,
  customOptions,
  getNode,
  getNodesByType,
  pathPrefix,
  reporter,
  cache,
  mdxNode,
}: {
  pluginOptions: PluginOptions
  customOptions: Partial<IMdxPluginOptions>
  getNode: NodePluginArgs["getNode"]
  getNodesByType: NodePluginArgs["getNodesByType"]
  pathPrefix: string
  reporter: NodePluginArgs["reporter"]
  cache: NodePluginArgs["cache"]
  mdxNode: IMdxNode
}): Promise<{
  processedMDX: string
  metadata: IMdxMetadata
} | null> => {
  const customPluginOptions = deepmerge(
    Object.assign({}, pluginOptions),
    customOptions
  )

  // Prepare MDX compile
  const mdxOptions = await enhanceMdxOptions(customPluginOptions, {
    getNode,
    getNodesByType,
    pathPrefix,
    reporter,
    cache,
  })
  if (!mdxNode.parent) {
    return null
  }
  const fileNode = getNode(mdxNode.parent)
  if (!fileNode) {
    return null
  }

  // Compile MDX and extract metadata
  return compileMDX(mdxNode, fileNode, mdxOptions, reporter)
}
