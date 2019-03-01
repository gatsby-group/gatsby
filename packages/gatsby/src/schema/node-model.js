// @flow

const _ = require(`lodash`)
const {
  isAbstractType,
  GraphQLOutputType,
  GraphQLUnionType,
} = require(`graphql`)
const invariant = require(`invariant`)

type IDOrNode = string | { id: string }
type TypeOrTypeName = string | GraphQLOutputType

interface ConnectionArgs {
  path: string;
  connectionType?: string;
}

export interface NodeModel {
  getNodeById(
    { id: IDOrNode, type?: TypeOrTypeName },
    ConnectionArgs
  ): any | null;
  getNodesByIds(
    { ids: Array<IDOrNode>, type?: TypeOrTypeName },
    ConnectionArgs
  ): Array<any>;
  getAllNodes({ type?: TypeOrTypeName }, ConnectionArgs): Array<any>;
  runQuery(args: any): Promise<any>;
  getTypes(): Array<string>;
}

class LocalNodeModel {
  constructor({ schema, nodeStore, createPageDependency, path }) {
    this.schema = schema
    this.nodeStore = nodeStore
    this.createPageDependency = createPageDependency
    this.path = path
  }

  getNodeById(args, pageDependencies) {
    const { id, type } = args || {}

    const node = getNodeById(this.nodeStore, id)

    let result
    if (!node) {
      result = null
    } else if (!type) {
      result = node
    } else {
      const nodeTypeNames = toNodeTypeNames(this.schema, type)
      result = nodeTypeNames.includes(node.internal.type) ? node : null
    }

    return trackPageDependencies(
      result,
      { path: this.path, ...pageDependencies },
      this.createPageDependency
    )
  }

  getNodesByIds(args, pageDependencies) {
    const { ids, type } = args || {}

    const nodes = Array.isArray(ids)
      ? ids.map(id => getNodeById(this.nodeStore, id)).filter(Boolean)
      : []

    let result
    if (!nodes.length || !type) {
      result = nodes
    } else {
      const nodeTypeNames = toNodeTypeNames(this.schema, type)
      result = nodes.filter(node => nodeTypeNames.includes(node.internal.type))
    }

    return trackPageDependencies(
      result,
      { path: this.path, ...pageDependencies },
      this.createPageDependency
    )
  }

  getAllNodes(args, pageDependencies) {
    const { type } = args || {}

    let result
    if (!type) {
      result = this.nodeStore.getNodes()
    } else {
      const nodeTypeNames = toNodeTypeNames(this.schema, type)
      const nodes = nodeTypeNames.reduce(
        (acc, typeName) => acc.concat(this.nodeStore.getNodesByType(typeName)),
        []
      )
      result = nodes.filter(Boolean)
    }

    return trackPageDependencies(
      result,
      { path: this.path, ...pageDependencies },
      this.createPageDependency
    )
  }

  async runQuery(args, pageDependencies) {
    const { query, firstOnly, type } = args || {}

    // We don't support querying union types (yet?), because the combined types
    // need not have any fields in common.
    const gqlType = typeof type === `string` ? this.schema.getType(type) : type
    invariant(
      !(gqlType instanceof GraphQLUnionType),
      `Querying GraphQLUnion types is not supported.`
    )

    // We provide nodes in case of abstract types, because `run-sift` should
    // only need to know about node types in the store.
    let nodes
    const nodeTypeNames = toNodeTypeNames(this.schema, gqlType)
    if (nodeTypeNames.length > 1) {
      nodes = nodeTypeNames.reduce(
        (acc, typeName) => acc.concat(this.nodeStore.getNodesByType(typeName)),
        []
      )
    }

    const queryResult = await this.nodeStore.runQuery({
      queryArgs: query,
      firstOnly,
      gqlType,
      nodes,
    })

    let result = queryResult
    if (args.firstOnly) {
      if (result && result.length > 0) {
        result = result[0]
      } else {
        result = null
      }
    }

    return trackPageDependencies(
      result,
      { path: this.path, ...pageDependencies },
      this.createPageDependency
    )
  }

  getTypes() {
    return this.nodeStore.getTypes()
  }

  findRootNodeAncestor(...args) {
    return this.nodeStore.findRootNodeAncestor(...args)
  }
}

const getNodeById = (nodeStore, id) => {
  // This is for cases when the `id` has already been resolved
  // to a full Node for the input filter, and is also in the selection
  // set. E.g. `{ foo(parent: { id: { eq: 1 } } ) { parent { id }} }`.
  if (_.isPlainObject(id) && id.id) {
    return id
  }
  return id != null ? nodeStore.getNode(id) : null
}

const toNodeTypeNames = (schema, gqlTypeName) => {
  const gqlType =
    typeof gqlTypeName === `string` ? schema.getType(gqlTypeName) : gqlTypeName

  if (!gqlType) return []

  const possibleTypes = isAbstractType(gqlType)
    ? schema.getPossibleTypes(gqlType)
    : [gqlType]

  return possibleTypes
    .filter(type => type.getInterfaces().some(iface => iface.name === `Node`))
    .map(type => type.name)
}

const trackPageDependencies = (
  result,
  pageDependencies,
  createPageDependency
) => {
  const { path, connectionType } = pageDependencies
  if (path) {
    if (connectionType) {
      createPageDependency({ path, connection: connectionType })
    } else {
      const nodes = Array.isArray(result) ? result : [result]
      nodes
        .filter(Boolean)
        .map(node => createPageDependency({ path, nodeId: node.id }))
    }
  }

  return result
}

module.exports = {
  LocalNodeModel,
}
