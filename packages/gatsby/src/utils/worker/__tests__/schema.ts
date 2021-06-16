import * as path from "path"
import fs from "fs-extra"
import { DocumentNode } from "graphql"
import { build } from "../../../schema"
import sourceNodesAndRemoveStaleNodes from "../../source-nodes"
import { saveStateForWorkers, store } from "../../../redux"
import { loadConfigAndPlugins } from "../../../bootstrap/load-config-and-plugins"
import {
  createTestWorker,
  describeWhenLMDB,
  GatsbyTestWorkerPool,
} from "./test-helpers"
import { getDataStore } from "../../../datastore"
import { CombinedState } from "redux"
import { IGatsbyState } from "../../../redux/types"

let worker: GatsbyTestWorkerPool | undefined

describeWhenLMDB(`worker (schema)`, () => {
  let state: CombinedState<IGatsbyState>

  beforeAll(async () => {
    store.dispatch({ type: `DELETE_CACHE` })
    const fileDir = path.join(process.cwd(), `.cache/redux`)
    await fs.emptyDir(fileDir)

    worker = createTestWorker()

    const siteDirectory = path.join(__dirname, `fixtures`, `sample-site`)
    await loadConfigAndPlugins({ siteDirectory })
    await worker.loadConfigAndPlugins({ siteDirectory })
    await sourceNodesAndRemoveStaleNodes({ webhookBody: {} })
    await getDataStore().ready()

    await build({ parentSpan: {} })

    saveStateForWorkers([`inferenceMetadata`])
    await worker.buildSchema()

    state = await worker.getState()
  })

  afterAll(() => {
    if (worker) {
      worker.end()
      worker = undefined
    }
  })

  it(`should have functioning createSchemaCustomization`, async () => {
    const typeDefinitions = (state.schemaCustomization.types[0] as {
      typeOrTypeDef: DocumentNode
    }).typeOrTypeDef.definitions

    expect(typeDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: expect.objectContaining({
                value: `thisIsANumber`,
              }),
              type: expect.objectContaining({
                name: expect.objectContaining({
                  value: `Int`,
                }),
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: expect.objectContaining({
                value: `overriddenString`,
              }),
              type: expect.objectContaining({
                name: expect.objectContaining({
                  value: `Int`,
                }),
              }),
            }),
          ]),
        }),
      ])
    )
  })

  it(`should have NodeTypeOne & NodeTypeTwo in schema`, async () => {
    expect(state.schema[`_typeMap`]).toEqual(
      expect.objectContaining({
        NodeTypeOne: `NodeTypeOne`,
        NodeTypeTwo: `NodeTypeTwo`,
      })
    )
  })

  it(`should have inferenceMetadata`, async () => {
    expect(state.inferenceMetadata).toEqual(
      expect.objectContaining({
        typeMap: expect.objectContaining({
          NodeTypeOne: expect.anything(),
        }),
      })
    )
  })

  it(`should have resolverField from createResolvers`, async () => {
    // @ts-ignore - it exists
    const { data } = await worker?.getRunQueryResult()

    expect(data.one.number).toBe(123)
    expect(data.two).toBe(null)
    expect(data.three.resolverField).toBe(`Custom String`)
  })

  it(`should have fieldsOnGraphQL from setFieldsOnGraphQLNodeType`, async () => {
    // @ts-ignore - it exists
    const { data } = await worker?.getRunQueryResult()

    expect(data.four.fieldsOnGraphQL).toBe(`Another Custom String`)
  })
})
