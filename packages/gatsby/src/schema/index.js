/* @flow */

const tracer = require(`opentracing`).globalTracer()
const { SchemaComposer } = require(`graphql-compose`)
const { store } = require(`../redux`)
const nodeStore = require(`../db/nodes`)
const { findRootNodeAncestor } = require(`../db/node-tracking`)
const nodeModel = require(`./node-model`)
const { buildSchema, rebuildSchemaWithSitePage } = require(`./schema`)
const { TypeConflictReporter } = require(`./infer/type-conflict-reporter`)

module.exports.build = async ({ parentSpan }) => {
  const spanArgs = parentSpan ? { childOf: parentSpan } : {}
  const span = tracer.startSpan(`build schema`, spanArgs)

  let {
    schemaCustomization: { thirdPartySchemas, typeDefs },
  } = store.getState()

  const typeConflictReporter = new TypeConflictReporter()

  const schemaComposer = new SchemaComposer()
  const schema = await buildSchema({
    schemaComposer,
    nodeStore,
    typeDefs,
    thirdPartySchemas,
    typeConflictReporter,
    parentSpan,
  })

  nodeModel._setSchema(schema)
  nodeModel._setNodeStore({ ...nodeStore, findRootNodeAncestor })

  typeConflictReporter.printConflicts()

  store.dispatch({
    type: `SET_SCHEMA_COMPOSER`,
    payload: schemaComposer,
  })
  store.dispatch({
    type: `SET_SCHEMA`,
    payload: schema,
  })

  span.finish()
}

module.exports.rebuildWithSitePage = async ({ parentSpan }) => {
  const spanArgs = parentSpan ? { childOf: parentSpan } : {}
  const span = tracer.startSpan(
    `rebuild schema with SitePage context`,
    spanArgs
  )
  let {
    schemaCustomization: { composer: schemaComposer },
  } = store.getState()

  const schema = await rebuildSchemaWithSitePage({
    schemaComposer,
    nodeStore,
    parentSpan,
  })

  store.dispatch({
    type: `SET_SCHEMA_COMPOSER`,
    payload: schemaComposer,
  })
  store.dispatch({
    type: `SET_SCHEMA`,
    payload: schema,
  })

  span.finish()
}
