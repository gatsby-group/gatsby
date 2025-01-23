import { Joi, testPluginOptionsSchema } from "gatsby-plugin-utils"
import { pluginOptionsSchema } from "../options-validation"

describe(`pluginOptionsSchema`, () => {
  it(`should provide meaningful errors when fields are invalid`, async () => {
    const expectedErrors = [`"output" must be a string`]

    const { isValid, errors } = await testPluginOptionsSchema(
      pluginOptionsSchema,
      {
        output: 123,
      }
    )

    expect(isValid).toBe(false)
    expect(errors).toEqual(expectedErrors)
  })

  it(`should provide warning for deprecated "exclude" option`, async () => {
    const expectedWarnings = [`"exclude" is not allowed`]

    const { warnings, hasWarnings } = await testPluginOptionsSchema(
      pluginOptionsSchema,
      {
        exclude: [`test`],
      }
    )

    expect(hasWarnings).toBe(true)
    expect(warnings).toEqual(expectedWarnings)
  })

  it(`creates correct defaults`, async () => {
    const pluginOptions = await pluginOptionsSchema({ Joi }).validateAsync({})

    expect(pluginOptions).toMatchInlineSnapshot(`
      Object {
        "createLinkInHead": true,
        "entryLimit": 45000,
        "excludes": Array [],
        "filterPages": [Function],
        "ignoreSitemapPathPrefix": false,
        "output": "/",
        "query": "{ site { siteMetadata { siteUrl } } allSitePage { nodes { path } } }",
        "resolvePagePath": [Function],
        "resolvePages": [Function],
        "resolveSiteUrl": [Function],
        "serialize": [Function],
      }
    `)
  })

  it.each`
    options
    ${undefined}
    ${{}}
  `(`should validate the schema: $options`, async ({ options }) => {
    const { isValid, errors } = await testPluginOptionsSchema(
      pluginOptionsSchema,
      options
    )

    expect(isValid).toBe(true)
  })
})
