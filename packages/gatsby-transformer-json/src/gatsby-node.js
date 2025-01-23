const _ = require(`lodash`)
const path = require(`path`)

function shouldOnCreateNode({ node }) {
  // We only care about JSON content.
  return node.internal.mediaType === `application/json`
}

const typeCache = new Map()

async function onCreateNode(
  { node, actions, loadNodeContent, createNodeId, createContentDigest },
  pluginOptions
) {
  function getType({ node, object, isArray }) {
    if (pluginOptions && _.isFunction(pluginOptions.typeName)) {
      return pluginOptions.typeName({ node, object, isArray })
    } else if (pluginOptions && _.isString(pluginOptions.typeName)) {
      return pluginOptions.typeName
    } else if (node.internal.type !== `File`) {
      if (typeCache.has(node.internal.type)) {
        return typeCache.get(node.internal.type)
      } else {
        const type = _.upperFirst(_.camelCase(`${node.internal.type} Json`))
        typeCache.set(node.internal.type, type)
        return type
      }
    } else if (isArray) {
      if (typeCache.has(node.name)) {
        return typeCache.get(node.name)
      } else {
        const type = _.upperFirst(_.camelCase(`${node.name} Json`))
        typeCache.set(node.name, type)
        return type
      }
    } else {
      if (typeCache.has(node.dir)) {
        return typeCache.get(node.dir)
      } else {
        const type = _.upperFirst(
          _.camelCase(`${path.basename(node.dir)} Json`)
        )
        typeCache.set(node.dir, type)
        return type
      }
    }
  }

  function transformObject(obj, id, type) {
    const jsonNode = {
      ...obj,
      id,
      children: [],
      parent: node.id,
      internal: {
        contentDigest: createContentDigest(obj),
        type,
      },
    }
    if (obj.id) {
      jsonNode[`jsonId`] = obj.id
    }
    createNode(jsonNode)
    createParentChildLink({ parent: node, child: jsonNode })
  }

  const { createNode, createParentChildLink } = actions

  const content = await loadNodeContent(node)
  let parsedContent
  try {
    parsedContent = JSON.parse(content)
  } catch {
    const hint = node.absolutePath
      ? `file ${node.absolutePath}`
      : `in node ${node.id}`
    throw new Error(`Unable to parse JSON: ${hint}`)
  }

  async function transformArrayChunk({ chunk, startCount }) {
    for (let i = 0, l = chunk.length; i < l; i++) {
      const obj = chunk[i]
      transformObject(
        obj,
        createNodeId(`${node.id} [${i + startCount}] >>> JSON`),
        getType({
          node,
          object: obj,
          isArray: true,
        })
      )
      await new Promise(resolve =>
        setImmediate(() => {
          resolve()
        })
      )
    }
  }

  if (_.isArray(parsedContent)) {
    const chunks = _.chunk(parsedContent, 100)
    let count = 0
    for (const chunk of chunks) {
      await transformArrayChunk({ chunk, startCount: count })
      count += chunk.length
    }
  } else if (_.isPlainObject(parsedContent)) {
    transformObject(
      parsedContent,
      createNodeId(`${node.id} >>> JSON`),
      getType({ node, object: parsedContent, isArray: false })
    )
  }
}

exports.shouldOnCreateNode = shouldOnCreateNode
exports.onCreateNode = onCreateNode
