const csv = require(`csvtojson`)
const _ = require(`lodash`)
const { typeNameFromFile } = require(`./index`)

const convertToJson = (data, options) =>
  csv(options)
    .fromString(data)
    .then(jsonData => jsonData, new Error(`CSV to JSON conversion failed!`))

function shouldOnCreateNode({ node }, pluginOptions = {}) {
  const { extension } = node
  const { extensions } = pluginOptions

  return extensions ? extensions.includes(extension) : extension === `csv`
}

const typeCache = new Map()

async function onCreateNode(
  { node, actions, loadNodeContent, createNodeId, createContentDigest },
  pluginOptions
) {
  const { createNode, createParentChildLink } = actions

  // Destructure out our custom options
  const { typeName, nodePerFile, ...options } = pluginOptions || {}

  // Load file contents
  const content = await loadNodeContent(node)

  // Parse
  const parsedContent = await convertToJson(content, options)

  // Generate the type
  function getType({ node, object }) {
    if (pluginOptions && _.isFunction(typeName)) {
      return pluginOptions.typeName({ node, object })
    } else if (pluginOptions && _.isString(typeName)) {
      if (typeCache.has(node.internal.type)) {
        return typeCache.get(node.internal.type)
      } else {
        const type = _.upperFirst(_.camelCase(typeName))
        typeCache.set(node.internal.type, type)
        return type
      }
    } else {
      return typeNameFromFile({ node })
    }
  }

  // Generate the new node
  function transformObject(obj, i) {
    const csvNode = {
      ...obj,
      id:
        obj.id ??
        createNodeId(`${node.id} [${i}] >>> ${node.extension.toUpperCase()}`),
      children: [],
      parent: node.id,
      internal: {
        contentDigest: createContentDigest(obj),
        // TODO make choosing the "type" a lot smarter. This assumes
        // the parent node is a file.
        // PascalCase
        type: getType({ node, object: parsedContent }),
      },
    }

    createNode(csvNode)
    createParentChildLink({ parent: node, child: csvNode })
  }

  async function transformArrayChunk({ chunk, startCount }) {
    for (let i = 0, l = chunk.length; i < l; i++) {
      const obj = chunk[i]
      transformObject(obj, i + startCount)
      await new Promise(resolve =>
        setImmediate(() => {
          resolve()
        })
      )
    }
  }

  if (_.isArray(parsedContent)) {
    if (pluginOptions && nodePerFile) {
      if (pluginOptions && _.isString(nodePerFile)) {
        transformObject({ [nodePerFile]: parsedContent }, 0)
      } else {
        transformObject({ items: parsedContent }, 0)
      }
    } else {
      const chunks = _.chunk(parsedContent, 100)
      let count = 0
      for (const chunk of chunks) {
        await transformArrayChunk({ chunk, startCount: count })
        count += chunk.length
      }
    }
  }

  return
}

exports.shouldOnCreateNode = shouldOnCreateNode
exports.onCreateNode = onCreateNode
