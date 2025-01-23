const { build } = require(`../..`)
const { store } = require(`../../../redux`)
const { actions } = require(`../../../redux/actions`)
const { dispatch } = store
const { createTypes } = actions

const report = require(`gatsby-cli/lib/reporter`)
report.error = jest.fn()
report.panic = jest.fn()
report.warn = jest.fn()
report.log = jest.fn()
report.activityTimer = jest.fn(() => {
  return {
    start: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn(),
  }
})

const buildSchema = async () => {
  await build({})
  const {
    schemaCustomization: { composer: schemaComposer },
    schema,
  } = store.getState()
  return { schema, schemaComposer }
}

afterEach(() => {
  report.error.mockClear()
  report.panic.mockClear()
  report.warn.mockClear()
  report.log.mockClear()
})
describe(`authorization extension`, () => {
  beforeEach(() => {
    dispatch({ type: `DELETE_CACHE` })
  })

  it(`adds authorization extension to type and field`, async () => {
    dispatch(
      createTypes(`
      type Auth implements Node @dontInfer @authorization(labels: ["ADMIN"]) {
        authField: ID! @authorization(labels: ["USER"])
      }
    `)
    )
    const { schema } = await buildSchema()
    const authType = schema.getType(`Auth`)
    const authTypeFields = authType.getFields()

    const authTypeDirective = authType.astNode?.directives?.find(
      dir => dir.name.value === `authorization`
    )
    const authTypeDirectiveValue = authTypeDirective?.arguments?.[0].value
    const authFieldDirective =
      authTypeFields.authField.astNode?.directives?.find(
        dir => dir.name.value === `authorization`
      )
    const authFieldDirectiveValue = authFieldDirective?.arguments?.[0].value

    expect(authFieldDirectiveValue).toMatchObject({
      kind: `ListValue`,
      values: [
        {
          kind: `StringValue`,
          value: `USER`,
        },
      ],
    })

    expect(authTypeDirectiveValue).toMatchObject({
      kind: `ListValue`,
      values: [
        {
          kind: `StringValue`,
          value: `ADMIN`,
        },
      ],
    })
  })
})
