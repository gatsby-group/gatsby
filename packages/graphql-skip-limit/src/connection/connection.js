import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList,
  GraphQLObjectType,
} from "graphql"

/**
 * @typedef {Object} ConnectionConfig
 * @param {string | null} [name]
 * @param {GraphQLObjectType} nodeType
 * @param {GraphQLFieldResolver<any, any> | null} [resolveNode]
 * @param {Thunk<GraphQLFieldConfigMap<any, any>> | null} [edgeFields]
 * @param {Thunk<GraphQLFieldConfigMap<any, any>> | null} connectionFields
 */

/**
 * @typedef {Object} GraphQLConnectionDefinitions
 * @param {GraphQLObjectType} edgeType
 * @param {GraphQLObjectType} connectionType
 */

/**
 * Returns a GraphQLFieldConfigArgumentMap appropriate to include on a field
 * whose return type is a connection type with backward pagination.
 * @type {GraphQLFieldConfigArgumentMap}
 */
export const connectionArgs = {
  skip: {
    type: GraphQLInt,
  },
  limit: {
    type: GraphQLInt,
  },
}

/**
 * The common page info type used by all connections.
 */
const pageInfoType = new GraphQLObjectType({
  name: `PageInfo`,
  description: `Information about pagination in a connection.`,
  fields: () => {
    return {
      hasNextPage: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description: `When paginating, are there more items?`,
      },
    }
  },
})

/**
 * @param {Thunk<T>>} thingOrThunk
 * @returns {T}
 */
function resolveMaybeThunk(thingOrThunk) {
  return typeof thingOrThunk === `function` ? thingOrThunk() : thingOrThunk
}

/**
 * Returns a GraphQLObjectType for a connection with the given name,
 * and whose nodes are of the specified type.
 * @param {ConnectionConfig} config
 * @returns GraphQLConnectionDefinitions
 */
export function connectionDefinitions(config) {
  const { nodeType } = config
  const name = config.name || nodeType.name
  const edgeFields = config.edgeFields || {}
  const connectionFields = config.connectionFields || {}
  const resolveNode = config.resolveNode
  const edgeType = new GraphQLObjectType({
    name: `${name}Edge`,
    description: `An edge in a connection.`,
    fields: () => {
      return {
        node: {
          type: nodeType,
          resolve: resolveNode,
          description: `The item at the end of the edge`,
        },
        next: {
          type: nodeType,
          resolve: resolveNode,
          description: `The next edge in the connection`,
        },
        previous: {
          type: nodeType,
          resolve: resolveNode,
          description: `The previous edge in the connection`,
        },
        ...(resolveMaybeThunk(edgeFields): any),
      }
    },
  })

  const connectionType = new GraphQLObjectType({
    name: `${name}Connection`,
    description: `A connection to a list of items.`,
    fields: () => {
      return {
        pageInfo: {
          type: new GraphQLNonNull(pageInfoType),
          description: `Information to aid in pagination.`,
        },
        edges: {
          type: new GraphQLList(edgeType),
          description: `A list of edges.`,
        },
        ...(resolveMaybeThunk(connectionFields): any),
      }
    },
  })

  return { edgeType, connectionType }
}
