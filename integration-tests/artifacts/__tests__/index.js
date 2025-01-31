const { spawn } = require(`child_process`)
const path = require(`path`)
const { murmurhash } = require(`gatsby-core-utils/murmurhash`)
const { readPageData } = require(`gatsby/dist/utils/page-data`)
const { stripIgnoredCharacters } = require(`gatsby/graphql`)
const fs = require(`fs-extra`)

jest.setTimeout(100000)

const publicDir = path.join(process.cwd(), `public`)

const gatsbyBin = path.join(`node_modules`, `gatsby`, `cli.js`)

const manifest = {}
const filesToRevert = {}

let exitCode

function runGatsbyWithRunTestSetup(runNumber = 1) {
  return function beforeAllImpl() {
    exitCode = `reset`
    return new Promise(resolve => {
      const gatsbyProcess = spawn(process.execPath, [gatsbyBin, `build`], {
        stdio: [`inherit`, `inherit`, `inherit`],
        env: {
          ...process.env,
          NODE_ENV: `production`,
          ARTIFACTS_RUN_SETUP: runNumber.toString(),
        },
      })

      gatsbyProcess.on(`exit`, code => {
        exitCode = code
        manifest[runNumber] = fs.readJSONSync(
          path.join(process.cwd(), `.cache`, `build-manifest-for-test-1.json`)
        )

        fs.outputJSONSync(
          path.join(__dirname, `__debug__`, `manifest-${runNumber}.json`),
          manifest[runNumber],
          {
            spaces: 2,
          }
        )

        fs.copySync(
          path.join(process.cwd(), `public`, `chunk-map.json`),
          path.join(__dirname, `__debug__`, `chunk-map-${runNumber}.json`)
        )

        fs.copySync(
          path.join(process.cwd(), `public`, `webpack.stats.json`),
          path.join(__dirname, `__debug__`, `webpack.stats-${runNumber}.json`)
        )

        resolve()
      })
    })
  }
}

const titleQuery = `
  {
    site {
      siteMetadata {
        title
      }
    }
  }
`

const authorQuery = `
  {
    site {
      siteMetadata {
        author
      }
    }
  }
`

const githubQuery = `
  {
    site {
      siteMetadata {
        github
      }
    }
  }
`

const moreInfoQuery = `
  {
    site {
      siteMetadata {
        moreInfo
      }
    }
  }
`

function hashQuery(query) {
  const text = stripIgnoredCharacters(query)
  const hash = murmurhash(text, `abc`)
  return String(hash)
}

const globalQueries = [githubQuery, moreInfoQuery]

const pagePathToFilePath = {
  html: pagePath => path.join(`public`, pagePath, `index.html`),
  "page-data": pagePath =>
    path.join(
      `public`,
      `page-data`,
      pagePath === `/` ? `index` : pagePath,
      `page-data.json`
    ),
}

function assertFileExistenceForPagePaths({ pagePaths, type, shouldExist }) {
  if (![`html`, `page-data`].includes(type)) {
    throw new Error(`Unexpected type`)
  }

  test.each(pagePaths)(
    `${type} file for "%s" ${shouldExist ? `exists` : `DOESN'T exist`}`,
    async pagePath => {
      const filePath = pagePathToFilePath[type](pagePath)
      const exists = await new Promise(resolve => {
        fs.stat(filePath, err => {
          resolve(err === null)
        })
      })

      expect(exists).toBe(shouldExist)
    }
  )
}

function assertWebpackBundleChanges({ browser, ssr, runNumber }) {
  describe(`webpack bundle invalidation`, () => {
    it(`browser bundle ${browser ? `DID` : `DIDN'T`} change`, () => {
      if (browser) {
        expect(manifest[runNumber].changedBrowserCompilationHash).not.toEqual(
          `not-changed`
        )
      } else {
        expect(manifest[runNumber].changedBrowserCompilationHash).toEqual(
          `not-changed`
        )
      }
    })

    it(`ssr bundle ${ssr ? `DID` : `DIDN'T`} change`, () => {
      if (ssr) {
        expect(manifest[runNumber].changedSsrCompilationHash).not.toEqual(
          `not-changed`
        )
      } else {
        expect(manifest[runNumber].changedSsrCompilationHash).toEqual(
          `not-changed`
        )
      }
    })
  })
}

function assertHTMLCorrectness(runNumber) {
  describe(`/page-query-template-change/`, () => {
    const expectedComponentChunkName =
      runNumber <= 1
        ? `component---src-templates-deps-page-query-js`
        : `component---src-templates-deps-page-query-alternative-js`

    const expectedBackground =
      runNumber < 8 ? `white` : runNumber === 8 ? `yellow` : `green`

    let pageDataContent
    let htmlContent
    beforeAll(() => {
      pageDataContent = fs.readJsonSync(
        path.join(
          process.cwd(),
          `public`,
          `page-data`,
          `page-query-template-change`,
          `page-data.json`
        )
      )

      htmlContent = fs.readFileSync(
        path.join(
          process.cwd(),
          `public`,
          `page-query-template-change`,
          `index.html`
        ),
        `utf-8`
      )
    })

    it(`correct css is inlined in html file (${expectedBackground})`, () => {
      expect(htmlContent).toMatch(
        new RegExp(
          `<style>\\s*body\\s*{\\s*background:\\s*${expectedBackground};\\s*}\\s*<\\/style>`,
          `gm`
        )
      )
    })

    it(`html built is using correct template (${
      runNumber <= 1 ? `default` : `alternative`
    })`, () => {
      expect(htmlContent).toContain(
        runNumber <= 1
          ? `<h1>Default template for depPageQuery</h1>`
          : `<h1>Alternative template for depPageQuery</h1>`
      )
    })

    it(`page data use correct componentChunkName (${expectedComponentChunkName})`, () => {
      expect(pageDataContent.componentChunkName).toEqual(
        expectedComponentChunkName
      )
    })

    it(`page query result is the same in every build`, () => {
      // this test is only to assert that page query result doesn't change and something else
      // cause this html file to rebuild
      expect(pageDataContent.result).toEqual({
        data: { depPageQuery: { label: `Stable (always created)` } },
        pageContext: { id: `page-query-template-change`, manifestId: `` },
      })
    })
  })

  describe(`/changing-context/`, () => {
    let pageDataContent
    let htmlContent
    beforeAll(() => {
      pageDataContent = fs.readJsonSync(
        path.join(
          process.cwd(),
          `public`,
          `page-data`,
          `changing-context`,
          `page-data.json`
        )
      )

      htmlContent = fs.readFileSync(
        path.join(process.cwd(), `public`, `changing-context`, `index.html`),
        `utf-8`
      )
    })

    it(`html is correctly generated using fresh page context`, () => {
      // remove <!-- --> from html content string as that's impl details of react ssr
      expect(htmlContent.replace(/<!-- -->/g, ``)).toContain(
        `Dummy page for runNumber: ${runNumber}`
      )
    })

    it(`page-data is correctly generated using fresh page context`, () => {
      expect(pageDataContent.result.pageContext).toEqual({
        dummyId: `runNumber: ${runNumber}`,
        manifestId: ``,
      })
    })
  })

  describe(`/webpack/local-plugin-1/`, () => {
    let htmlContent
    beforeAll(() => {
      htmlContent = fs.readFileSync(
        path.join(
          process.cwd(),
          `public`,
          `webpack`,
          `local-plugin-1`,
          `index.html`
        ),
        `utf-8`
      )
    })

    it(`webpack plugin is used correctly (webpack cache gets invalidate on plugin change)`, () => {
      expect(htmlContent).toContain(
        runNumber < 6 ? `localWebpackPlugin1_1` : `localWebpackPlugin1_2`
      )
    })
  })

  describe(`/webpack/local-plugin-2/`, () => {
    let htmlContent
    beforeAll(() => {
      htmlContent = fs.readFileSync(
        path.join(
          process.cwd(),
          `public`,
          `webpack`,
          `local-plugin-2`,
          `index.html`
        ),
        `utf-8`
      )
    })

    it(`webpack plugin is used correctly (webpack cache gets invalidate on plugin change)`, () => {
      expect(htmlContent).toContain(
        runNumber < 7 ? `localWebpackPlugin2_1` : `localWebpackPlugin2_2`
      )
    })
  })

  describe(`/extension-change/`, () => {
    let htmlContent
    beforeAll(() => {
      htmlContent = fs.readFileSync(
        path.join(process.cwd(), `public`, `extension-change`, `index.html`),
        `utf-8`
      )
    })

    it(`html is correctly generated using up to date code of file that changed extension`, () => {
      // remove <!-- --> from html content string as that's impl details of react ssr
      expect(htmlContent.replace(/<!-- -->/g, ``)).toContain(
        `extension of imported file: ${runNumber === 10 ? `.ts` : `.js`}`
      )
    })
  })

  describe(`/slices/`, () => {
    let htmlContent
    beforeAll(() => {
      htmlContent = fs.readFileSync(
        path.join(process.cwd(), `public`, `slices`, `index.html`),
        `utf-8`
      )
    })

    it(`html stitched correctly and slice is up to date`, () => {
      expect(htmlContent).toContain(
        runNumber < 2
          ? `Gatsby Slice Test (before edit)`
          : `Gatsby Slice Test (after edit)`
      )
    })

    it(`has correct html when prop is passed to slice component`, () => {
      expect(htmlContent).toContain(`a-large-header`)
    })
  })

  describe(`/slices/blog-1/`, () => {
    let htmlContent
    beforeAll(() => {
      htmlContent = fs.readFileSync(
        path.join(process.cwd(), `public`, `slices`, `blog-1`, `index.html`),
        `utf-8`
      )
    })

    it(`html stitched correctly and slice is up to date`, () => {
      expect(htmlContent).toContain(
        runNumber < 2
          ? `Gatsby Slice Test (before edit)`
          : `Gatsby Slice Test (after edit)`
      )
    })

    it("node change results in correct HTML for slice", () => {
      expect(htmlContent).toContain(
        runNumber < 2
          ? `who lives and works in San Francisco building useful things(before edit)`
          : `who lives and works in San Francisco building useful things(after edit)`
      )
    })
  })

  describe(`/slices/blog-2/`, () => {
    let htmlContent
    beforeAll(() => {
      htmlContent = fs.readFileSync(
        path.join(process.cwd(), `public`, `slices`, `blog-2`, `index.html`),
        `utf-8`
      )
    })

    it(`uses correct slice when a slice is changed in createPage mappping`, () => {
      expect(htmlContent).toContain(
        runNumber < 2 ? `Josh Johnson` : `Kyle Mathews`
      )
    })
  })

  describe(`/react-lazy/`, () => {
    let htmlContent
    beforeAll(() => {
      htmlContent = fs.readFileSync(
        path.join(process.cwd(), `public`, `react-lazy`, `index.html`),
        `utf-8`
      )
    })

    it(`changing lazily imported component result in correct regeneration of html file`, () => {
      expect(htmlContent).toContain(
        runNumber < 3 ? `before edit` : `after edit`
      )
    })
  })
}

function assertNodeCorrectness(runNumber) {
  describe(`node correctness`, () => {
    it(`nodes do not have repeating counters`, () => {
      const seenCounters = new Map()
      const duplicates = []
      // Just a convenience step to display node ids with duplicate counters
      manifest[runNumber].allNodeCounters.forEach(([id, counter]) => {
        if (seenCounters.has(counter)) {
          duplicates.push({ counter, nodeIds: [id, seenCounters.get(counter)] })
        }
        seenCounters.set(counter, id)
      })
      expect(manifest[runNumber].allNodeCounters.length).toBeGreaterThan(0)
      expect(duplicates).toEqual([])
    })
  })
}

function assertExitCode(runNumber) {
  it(`Build was successful`, () => {
    expect(exitCode).toEqual(0)
  })
}

beforeAll(done => {
  fs.removeSync(path.join(__dirname, `__debug__`))

  const gatsbyCleanProcess = spawn(process.execPath, [gatsbyBin, `clean`], {
    stdio: [`inherit`, `inherit`, `inherit`],
    env: {
      ...process.env,
      NODE_ENV: `production`,
    },
  })

  gatsbyCleanProcess.on(`exit`, () => {
    done()
  })
})

const teardownFns = []

afterAll(async () => {
  Object.entries(filesToRevert).forEach(([filePath, fileContent]) => {
    fs.writeFileSync(filePath, fileContent)
  })

  for (const teardownFn of teardownFns) {
    await teardownFn()
  }
})

describe(`First run (baseline)`, () => {
  const runNumber = 1

  beforeAll(runGatsbyWithRunTestSetup(runNumber))

  assertExitCode(runNumber)

  describe(`Static Queries`, () => {
    test(`are written correctly when inline`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/inline/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly when imported`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/import/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly when a re-exported query is imported`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/import-re-export/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly when dynamically imported`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/dynamic/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly in jsx`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/jsx/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly in tsx`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/tsx/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly in typescript`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/typescript/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly when nesting imports`, async () => {
      const queries = [titleQuery, authorQuery, ...globalQueries]
      const pagePath = `/import-import/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly when nesting dynamic imports`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/dynamic-dynamic/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly when nesting a dynamic import in a regular import`, async () => {
      const queries = [titleQuery, authorQuery, ...globalQueries]
      const pagePath = `/import-dynamic/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly when nesting a regular import in a dynamic import`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/dynamic-import/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly with circular dependency`, async () => {
      const queries = [titleQuery, ...globalQueries]
      const pagePath = `/circular-dep/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })

    test(`are written correctly when using gatsby-browser`, async () => {
      const queries = [...globalQueries]
      const pagePath = `/gatsby-browser/`

      const { staticQueryHashes } = await readPageData(publicDir, pagePath)

      expect(staticQueryHashes.sort()).toEqual(queries.map(hashQuery).sort())
    })
  })

  const expectedPages = [
    `stale-pages/stable`,
    `stale-pages/only-in-first`,
    `page-that-will-have-trailing-slash-removed`,
    `/stale-pages/sometimes-i-have-trailing-slash-sometimes-i-dont/`,
  ]
  const unexpectedPages = [`stale-pages/only-not-in-first`]

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should create all html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })

    describe(`should add <link> for webpack's magic comments inside "app" bundle`, () => {
      let htmlContent
      beforeAll(() => {
        htmlContent = fs.readFileSync(
          path.join(
            process.cwd(),
            `public`,
            `dynamic-imports-magic-comments`,
            `index.html`
          ),
          `utf-8`
        )
      })

      it(`has prefetch link (imported in "app")`, () => {
        expect(htmlContent).toMatch(
          /<link\s+as="script"\s+rel="prefetch"\s+href="\/magic-comment-app-prefetch-\w+.js"\s*\/>/g
        )
      })

      it(`has preload link (imported in "app")`, () => {
        expect(htmlContent).toMatch(
          /<link\s+as="script"\s+rel="preload"\s+href="\/magic-comment-app-preload-\w+.js"\s*\/>/g
        )
      })

      it(`doesn't have prefetch link (imported in template)`, () => {
        expect(htmlContent).not.toMatch(
          /<link\s+as="script"\s+rel="prefetch"\s+href="\/magic-comment-prefetch-\w+.js"\s*\/>/g
        )
      })

      it(`doesn't have preload link (imported in template)`, () => {
        expect(htmlContent).not.toMatch(
          /<link\s+as="script"\s+rel="preload"\s+href="\/magic-comment-preload-\w+.js"\s*\/>/g
        )
      })
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // first run - this means bundles changed (from nothing to something)
  assertWebpackBundleChanges({ browser: true, ssr: true, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Second run (different pages created, data changed)`, () => {
  const runNumber = 2

  const expectedPagesToBeGenerated = [
    `/stale-pages/only-not-in-first/`,
    `/page-query-changing-data-but-not-id/`,
    `/page-query-dynamic-2/`,
    `/static-query-result-tracking/should-invalidate/`,
    `/page-query-template-change/`,
    `/stale-pages/sometimes-i-have-trailing-slash-sometimes-i-dont/`,
    `/changing-context/`,
    "/slices/blog-2/",
    "/slices/",
  ]

  const expectedPagesToRemainFromPreviousBuild = [
    `/stale-pages/stable/`,
    `/page-query-stable/`,
    `/page-query-changing-but-not-invalidating-html/`,
    `/static-query-result-tracking/stable/`,
    `/static-query-result-tracking/rerun-query-but-dont-recreate-html/`,
    `/page-that-will-have-trailing-slash-removed`,
    `/stateful-page-not-recreated-in-third-run/`,
  ]

  const expectedPages = [
    // this page should remain from first build
    ...expectedPagesToRemainFromPreviousBuild,
    // those pages should have been (re)created
    ...expectedPagesToBeGenerated,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
  ]

  beforeAll(runGatsbyWithRunTestSetup(runNumber))

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate only some html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        expectedPagesToBeGenerated.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // second run - only data changed and no bundle should have changed
  assertWebpackBundleChanges({ browser: false, ssr: false, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Third run (js template change, just pages of that template are recreated, all pages are stitched)`, () => {
  const runNumber = 3

  const expectedPagesToRemainFromPreviousBuild = [
    `/stale-pages/stable/`,
    `/page-query-stable/`,
    `/page-query-changing-but-not-invalidating-html/`,
    `/static-query-result-tracking/stable/`,
    `/static-query-result-tracking/rerun-query-but-dont-recreate-html/`,
    `/page-that-will-have-trailing-slash-removed`,
  ]

  const expectedPagesToBeGenerated = [
    // this is page that gets template change
    `/gatsby-browser/`,
    // this is page that lazily imports file that gets changed
    `/react-lazy/`,
    // those change happen on every build
    `/page-query-dynamic-3/`,
    `/stale-pages/sometimes-i-have-trailing-slash-sometimes-i-dont/`,
    `/changing-context/`,
  ]

  const expectedPages = [
    // this page should remain from first build
    ...expectedPagesToRemainFromPreviousBuild,
    // those pages should have been (re)created
    ...expectedPagesToBeGenerated,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
    `/page-query-dynamic-2/`,
    `/stateful-page-not-recreated-in-third-run/`,
  ]

  let changedTemplateFileOriginalContent
  const changedTemplateFileAbspath = path.join(
    process.cwd(),
    `src`,
    `pages`,
    `gatsby-browser.js`
  )

  let changedLazilyImportedFileOriginalContent
  const changedLazilyImportedFileAbspath = path.join(
    process.cwd(),
    `src`,
    `components`,
    `react-lazily-imported.js`
  )

  beforeAll(async () => {
    // make change to some .js files

    // page template
    changedTemplateFileOriginalContent = fs.readFileSync(
      changedTemplateFileAbspath,
      `utf-8`
    )
    filesToRevert[changedTemplateFileAbspath] =
      changedTemplateFileOriginalContent

    const newTemplateContent = changedTemplateFileOriginalContent.replace(
      /sad/g,
      `not happy`
    )

    if (newTemplateContent === changedTemplateFileOriginalContent) {
      throw new Error(`Test setup failed 1`)
    }

    fs.writeFileSync(changedTemplateFileAbspath, newTemplateContent)

    // lazily imported component
    changedLazilyImportedFileOriginalContent = fs.readFileSync(
      changedLazilyImportedFileAbspath,
      `utf-8`
    )
    filesToRevert[changedLazilyImportedFileAbspath] =
      changedLazilyImportedFileOriginalContent

    const newLazilyImportedContent =
      changedLazilyImportedFileOriginalContent.replace(
        `before edit`,
        `after edit`
      )

    if (newLazilyImportedContent === changedLazilyImportedFileOriginalContent) {
      throw new Error(`Test setup failed 2`)
    }

    fs.writeFileSync(changedLazilyImportedFileAbspath, newLazilyImportedContent)

    await runGatsbyWithRunTestSetup(runNumber)()
  })

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate only some html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        expectedPagesToBeGenerated.sort()
      )
    })

    it(`should stitch fragments back in all html files (browser bundle changed)`, () => {
      expect(manifest[runNumber].stitched.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // third run - we modify template used by both ssr and browser bundle - global, shared SSR won't change
  // as the change is localized in just one of templates, which in Gatsby 5 doesn't invalidate all html
  // files anymore
  assertWebpackBundleChanges({ browser: true, ssr: false, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Fourth run (gatsby-browser change - cache get invalidated)`, () => {
  const runNumber = 4

  const expectedPages = [
    `/stale-pages/only-not-in-first`,
    `/page-query-dynamic-4/`,
    `/stateful-page-not-recreated-in-third-run/`,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
    `/page-query-dynamic-2/`,
    `/page-query-dynamic-3/`,
  ]

  let changedFileOriginalContent
  const changedFileAbspath = path.join(process.cwd(), `gatsby-browser.js`)

  beforeAll(async () => {
    // make change to some .js
    changedFileOriginalContent = fs.readFileSync(changedFileAbspath, `utf-8`)
    filesToRevert[changedFileAbspath] = changedFileOriginalContent

    const newContent = changedFileOriginalContent.replace(/h1>/g, `h2>`)

    if (newContent === changedFileOriginalContent) {
      throw new Error(`Test setup failed`)
    }

    fs.writeFileSync(changedFileAbspath, newContent)
    await runGatsbyWithRunTestSetup(runNumber)()
  })

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate all html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // Fourth run - we change gatsby-browser, so browser bundle change,
  // but ssr bundle also change because chunk-map file is changed due to browser bundle change
  assertWebpackBundleChanges({ browser: true, ssr: true, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Fifth run (.cache is deleted but public isn't)`, () => {
  const runNumber = 5

  const expectedPages = [
    `/stale-pages/only-not-in-first`,
    `/page-query-dynamic-5/`,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
    `/page-query-dynamic-2/`,
    `/page-query-dynamic-3/`,
    `/page-query-dynamic-4/`,
  ]

  beforeAll(async () => {
    // delete .cache, but keep public
    fs.removeSync(path.join(process.cwd(), `.cache`))
    await runGatsbyWithRunTestSetup(runNumber)()
  })

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate all html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // Fifth run - because cache was deleted before run - both browser and ssr bundles were "invalidated" (because there was nothing before)
  assertWebpackBundleChanges({ browser: true, ssr: true, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Sixth run (change webpack plugin variant 1 - invalidate webpack cache)`, () => {
  const runNumber = 6

  const expectedPages = [
    `/stale-pages/only-not-in-first`,
    `/page-query-dynamic-6/`,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
    `/page-query-dynamic-2/`,
    `/page-query-dynamic-3/`,
    `/page-query-dynamic-4/`,
    `/page-query-dynamic-5/`,
  ]

  let changedFileOriginalContent
  const changedFileAbspath = path.join(
    process.cwd(),
    `plugins`,
    `gatsby-plugin-webpack-1`,
    `local-webpack-plugin.js`
  )

  beforeAll(async () => {
    // make change to used webpack plugin
    changedFileOriginalContent = fs.readFileSync(changedFileAbspath, `utf-8`)
    filesToRevert[changedFileAbspath] = changedFileOriginalContent

    const newContent = changedFileOriginalContent.replace(
      `localWebpackPlugin1_1`,
      `localWebpackPlugin1_2`
    )

    if (newContent === changedFileOriginalContent) {
      throw new Error(`Test setup failed`)
    }

    fs.writeFileSync(changedFileAbspath, newContent)
    await runGatsbyWithRunTestSetup(runNumber)()
  })

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate all html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // Sixth run - webpack plugin changed - both ssr and browser bundles should be invalidated
  assertWebpackBundleChanges({ browser: true, ssr: true, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Seventh run (change webpack plugin variant 2 - invalidate webpack cache)`, () => {
  const runNumber = 7

  const expectedPages = [
    `/stale-pages/only-not-in-first`,
    `/page-query-dynamic-7/`,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
    `/page-query-dynamic-2/`,
    `/page-query-dynamic-3/`,
    `/page-query-dynamic-4/`,
    `/page-query-dynamic-5/`,
    `/page-query-dynamic-6/`,
  ]

  let changedFileOriginalContent
  const changedFileAbspath = path.join(
    process.cwd(),
    `plugins`,
    `gatsby-plugin-webpack-2`,
    `on-create-webpack-config.js`
  )

  beforeAll(async () => {
    // make change to used webpack plugin
    changedFileOriginalContent = fs.readFileSync(changedFileAbspath, `utf-8`)
    filesToRevert[changedFileAbspath] = changedFileOriginalContent

    const newContent = changedFileOriginalContent.replace(
      `localWebpackPlugin2_1`,
      `localWebpackPlugin2_2`
    )

    if (newContent === changedFileOriginalContent) {
      throw new Error(`Test setup failed`)
    }

    fs.writeFileSync(changedFileAbspath, newContent)
    await runGatsbyWithRunTestSetup(runNumber)()
  })

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate all html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // Seventh run - webpack plugin changed - both ssr and browser bundles should be invalidated
  assertWebpackBundleChanges({ browser: true, ssr: true, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Eight run (ssr-only change - only ssr compilation hash changes)`, () => {
  const runNumber = 8

  const expectedPages = [
    `/stale-pages/only-not-in-first`,
    `/page-query-dynamic-8/`,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
    `/page-query-dynamic-2/`,
    `/page-query-dynamic-3/`,
    `/page-query-dynamic-4/`,
    `/page-query-dynamic-5/`,
    `/page-query-dynamic-6/`,
    `/page-query-dynamic-7/`,
  ]

  let changedFileOriginalContent
  const changedFileAbspath = path.join(process.cwd(), `gatsby-ssr.js`)

  beforeAll(async () => {
    // make change to gatsby-ssr
    changedFileOriginalContent = fs.readFileSync(changedFileAbspath, `utf-8`)
    filesToRevert[changedFileAbspath] = changedFileOriginalContent

    const newContent = changedFileOriginalContent.replace(
      `\`body {\\nbackground: white;\\n}\``,
      `fs.readFileSync(\`./css-to-inline.css\`, \`utf-8\`)`
    )

    if (newContent === changedFileOriginalContent) {
      throw new Error(`Test setup failed`)
    }

    fs.writeFileSync(changedFileAbspath, newContent)
    await runGatsbyWithRunTestSetup(runNumber)()
  })

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate all html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // Eight run - only ssr bundle should change as only file used by ssr was changed
  assertWebpackBundleChanges({ browser: false, ssr: true, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Ninth run (no change in any file that is bundled, we change untracked file, but previous build used unsafe method so all should rebuild)`, () => {
  const runNumber = 9

  const expectedPages = [
    `/stale-pages/only-not-in-first`,
    `/page-query-dynamic-9/`,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
    `/page-query-dynamic-2/`,
    `/page-query-dynamic-3/`,
    `/page-query-dynamic-4/`,
    `/page-query-dynamic-5/`,
    `/page-query-dynamic-6/`,
    `/page-query-dynamic-7/`,
    `/page-query-dynamic-8/`,
  ]

  let changedFileOriginalContent
  const changedFileAbspath = path.join(process.cwd(), `css-to-inline.css`)

  beforeAll(async () => {
    // make change to gatsby-ssr
    changedFileOriginalContent = fs.readFileSync(changedFileAbspath, `utf-8`)
    filesToRevert[changedFileAbspath] = changedFileOriginalContent

    const newContent = changedFileOriginalContent.replace(/yellow/g, `green`)

    if (newContent === changedFileOriginalContent) {
      throw new Error(`Test setup failed`)
    }

    fs.writeFileSync(changedFileAbspath, newContent)
    await runGatsbyWithRunTestSetup(runNumber)()
  })

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate all html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // Ninth run - no bundle should change as we don't change anything that IS bundled
  assertWebpackBundleChanges({ browser: false, ssr: false, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})

describe(`Tenth run (changing extension and content of imported file - making sure webpack cache handles this well)`, () => {
  const runNumber = 10

  const expectedPages = [
    `/stale-pages/only-not-in-first`,
    `/page-query-dynamic-10/`,
  ]

  const unexpectedPages = [
    `/stale-pages/only-in-first/`,
    `/page-query-dynamic-1/`,
    `/page-query-dynamic-2/`,
    `/page-query-dynamic-3/`,
    `/page-query-dynamic-4/`,
    `/page-query-dynamic-5/`,
    `/page-query-dynamic-6/`,
    `/page-query-dynamic-7/`,
    `/page-query-dynamic-8/`,
    `/page-query-dynamic-9/`,
  ]

  beforeAll(async () => {
    // make change to gatsby-ssr
    const changedFileAbspath = path.join(
      process.cwd(),
      `src`,
      `components`,
      `file-that-will-change-extension.js`
    )

    const newFileAbspath = changedFileAbspath.replace(`.js`, `.ts`)

    if (changedFileAbspath === newFileAbspath) {
      throw new Error(`Test setup failed`)
    }

    const changedFileOriginalContent = fs.readFileSync(
      changedFileAbspath,
      `utf-8`
    )
    filesToRevert[changedFileAbspath] = changedFileOriginalContent

    const newContent = changedFileOriginalContent.replace(`.js`, `.ts`)

    if (newContent === changedFileOriginalContent) {
      throw new Error(`Test setup failed`)
    }

    fs.writeFileSync(newFileAbspath, newContent)
    fs.removeSync(changedFileAbspath)

    teardownFns.unshift(() => {
      fs.removeSync(newFileAbspath)
    })

    await runGatsbyWithRunTestSetup(runNumber)()
  })

  assertExitCode(runNumber)

  describe(`html files`, () => {
    const type = `html`

    describe(`should have expected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected html files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })

    it(`should recreate all html files`, () => {
      expect(manifest[runNumber].generated.sort()).toEqual(
        manifest[runNumber].allPages.sort()
      )
    })
  })

  describe(`page-data files`, () => {
    const type = `page-data`

    describe(`should have expected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: expectedPages,
        type,
        shouldExist: true,
      })
    })

    describe(`shouldn't have unexpected page-data files`, () => {
      assertFileExistenceForPagePaths({
        pagePaths: unexpectedPages,
        type,
        shouldExist: false,
      })
    })
  })

  // Tenth run - we change extension and content of imported file so compilation hashes should change
  assertWebpackBundleChanges({ browser: true, ssr: true, runNumber })

  assertHTMLCorrectness(runNumber)

  assertNodeCorrectness(runNumber)
})
