import { GatsbyCLI } from "../test-helpers"

const MAX_TIMEOUT = 2147483647
jest.setTimeout(MAX_TIMEOUT)

describe(`gatsby repl`, () => {
  const cwd = `gatsby-sites/gatsby-repl`

  beforeAll(() => GatsbyCLI.from(cwd).invoke(`clean`))
  afterAll(() => GatsbyCLI.from(cwd).invoke(`clean`))

  it(`starts a gatsby site on port 8000`, async () => {
    // 1. Start the `gatsby develop` command
    const [childProcess, getLogs] = GatsbyCLI.from(cwd).invokeAsync(
      `repl`,
      log => log.includes("gatsby >")
    )

    // 2. Wait for the build process to finish
    await childProcess

    // 3. Make assertions
    const logs = getLogs()
    logs.should.contain(`success Load Gatsby config`)
    logs.should.contain(`success Load plugins`)
    logs.should.contain(`success onPreInit`)
    logs.should.contain(`success Initialize cache`)
    logs.should.contain(`success Copy Gatsby files`)
    logs.should.contain(`success onPreBootstrap`)
    logs.should.contain(`success createSchemaCustomization`)
    logs.should.contain(`success Source and transform nodes`)
    logs.should.contain(`success Building schema`)
    logs.should.contain(`success createPages`)
    logs.should.contain(`success createPagesStatefully`)
    logs.should.contain(`success onPreExtractQueries`)
    logs.should.contain(`success Extract queries from components`)
    logs.should.contain(`success Write out redirect data`)
    logs.should.contain(`success onPostBootstrap`)
    logs.should.contain(`info Bootstrap finished`)

    // This is the actual repl prompt
    logs.should.contain(`gatsby >`)
  })
})
