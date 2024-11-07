import path from "path"
import openurl from "better-opn"
import fs from "fs-extra"
import compression from "compression"
import express from "express"
import chalk from "chalk"
import { match as reachMatch } from "@gatsbyjs/reach-router"
import report from "gatsby-cli/lib/reporter"

import { detectPortInUseAndPrompt } from "../utils/detect-port-in-use-and-prompt"
import { getConfigFile } from "../bootstrap/get-config-file"
import { preferDefault } from "../bootstrap/prefer-default"
import { IProgram } from "./types"
import { IPreparedUrls, prepareUrls } from "../utils/prepare-urls"
import {
  IGatsbyConfig,
  IGatsbyFunction,
  IGatsbyPage,
  IGatsbyState,
} from "../redux/types"
import { reverseFixedPagePath } from "../utils/page-data"
import { initTracer } from "../utils/tracer"
import { configureTrailingSlash } from "../utils/express-middlewares"
import { getDataStore } from "../datastore"
import { functionMiddlewares } from "../internal-plugins/functions/middleware"
import {
  thirdPartyProxyPath,
  partytownProxy,
} from "../internal-plugins/partytown/proxy"
import { slash } from "gatsby-core-utils/path"

interface IMatchPath {
  path: string
  matchPath: string
}

interface IServeProgram extends IProgram {
  prefixPaths: boolean
}

const readMatchPaths = async (
  program: IServeProgram
): Promise<Array<IMatchPath>> => {
  const filePath = path.join(program.directory, `.cache`, `match-paths.json`)
  let rawJSON = `[]`
  try {
    rawJSON = await fs.readFile(filePath, `utf8`)
  } catch (error) {
    report.warn(error)
    report.warn(
      `Could not read ${chalk.bold(
        `match-paths.json`
      )} from the .cache directory`
    )
    report.warn(
      `Client-side routing will not work correctly. Maybe you need to re-run ${chalk.bold(
        `gatsby build`
      )}?`
    )
  }
  return JSON.parse(rawJSON) as Array<IMatchPath>
}

interface IMatchPathMiddlewareOptions {
  root: string
  enableLogging?: boolean
}

const sanitizeUrl = (url: string): string => {
  try {
    // Decode URL and normalize slashes
    const decoded = decodeURIComponent(url)
    return decoded.replace(/\/+/g, `/`).replace(/\/$/, ``) || `/`
  } catch (e) {
    report.warn(`Failed to decode URL: ${url}`)
    return url
  }
}

const createMatchPathMiddleware = (
  matchPaths: Array<IMatchPath>,
  options: IMatchPathMiddlewareOptions
): express.RequestHandler => {
  // Cache commonly accessed paths
  const pathCache = new Map<string, string | null>()
  const { root, enableLogging = false } = options

  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    if (!req.accepts(`html`)) {
      return next()
    }

    const startTime = enableLogging ? process.hrtime() : null
    const originalUrl = req.url

    try {
      // Check cache first
      if (pathCache.has(originalUrl)) {
        const cachedPath = pathCache.get(originalUrl)
        if (!cachedPath) return next()
        return res.sendFile(path.join(cachedPath, `index.html`), { root })
      }

      const sanitizedUrl = sanitizeUrl(originalUrl)

      const matchPath = matchPaths.find(({ matchPath }) => {
        try {
          return reachMatch(matchPath, sanitizedUrl) !== null
        } catch (e) {
          report.error(`Match path error for ${matchPath}: ${e.message}`)
          return false
        }
      })

      if (matchPath) {
        pathCache.set(originalUrl, matchPath.path)

        if (enableLogging && startTime) {
          // Remove non-null assertion
          const [seconds, nanoseconds] = process.hrtime(startTime)
          const duration = seconds * 1000 + nanoseconds / 1e6
          report.info(
            `Matched ${originalUrl} to ${matchPath.path} (${duration.toFixed(
              2
            )}ms)`
          )
        }

        return res.sendFile(
          path.join(matchPath.path, `index.html`),
          { root },
          (err: Error) => {
            if (err) {
              pathCache.set(originalUrl, null)
              res.status(404)
              next()
            }
          }
        )
      }

      pathCache.set(originalUrl, null)
      return next()
    } catch (error) {
      report.error(`Error processing ${originalUrl}: ${error.message}`)
      res.status(500)
      return next(error)
    }
  }
}

module.exports = async (program: IServeProgram): Promise<void> => {
  await initTracer(
    process.env.GATSBY_OPEN_TRACING_CONFIG_FILE || program.openTracingConfigFile
  )
  let { prefixPaths, port, open, host } = program
  port = typeof port === `string` ? parseInt(port, 10) : port

  const { configModule } = await getConfigFile(
    program.directory,
    `gatsby-config`
  )
  const config: IGatsbyConfig = preferDefault(configModule)

  const { pathPrefix: configPathPrefix, trailingSlash } = config || {}

  const pathPrefix = prefixPaths && configPathPrefix ? configPathPrefix : `/`

  const root = path.join(program.directory, `public`)

  const app = express()

  // Proxy gatsby-script using off-main-thread strategy
  const { partytownProxiedURLs = [] } = config || {}

  app.use(thirdPartyProxyPath, partytownProxy(partytownProxiedURLs))

  // eslint-disable-next-line new-cap
  const router = express.Router()

  router.use(compression())

  router.use(
    configureTrailingSlash(
      () =>
        ({
          pages: {
            get(pathName: string): IGatsbyPage | undefined {
              return getDataStore().getNode(`SitePage ${pathName}`) as
                | IGatsbyPage
                | undefined
            },
            values(): Iterable<IGatsbyPage> {
              return getDataStore().iterateNodesByType(
                `SitePage`
              ) as Iterable<IGatsbyPage>
            },
          },
        } as unknown as IGatsbyState),
      trailingSlash
    )
  )

  router.use(express.static(`public`, { dotfiles: `allow` }))

  const compiledFunctionsDir = path.join(
    program.directory,
    `.cache`,
    `functions`
  )

  let functions: Array<IGatsbyFunction> = []
  try {
    functions = JSON.parse(
      fs.readFileSync(path.join(compiledFunctionsDir, `manifest.json`), `utf-8`)
    )
  } catch (e) {
    // ignore
  }

  if (functions) {
    const functionMiddlewaresInstances = functionMiddlewares({
      getFunctions(): Array<IGatsbyFunction> {
        return functions
      },
    })

    router.use(`/api/*`, ...functionMiddlewaresInstances)
    // TODO(v6) remove handler from app and only keep it on router (router is setup on pathPrefix, while app is always root)
    app.use(`/api/*`, ...functionMiddlewaresInstances)
  }

  // Handle SSR & DSG Pages
  let graphqlEnginePath: string | undefined
  let pageSSRModule: string | undefined
  try {
    graphqlEnginePath = require.resolve(
      path.posix.join(slash(program.directory), `.cache`, `query-engine`)
    )
    pageSSRModule = require.resolve(
      path.posix.join(slash(program.directory), `.cache`, `page-ssr`)
    )
  } catch (error) {
    // TODO: Handle case of engine not being generated
  }

  if (graphqlEnginePath && pageSSRModule) {
    try {
      const { GraphQLEngine } =
        require(graphqlEnginePath) as typeof import("../schema/graphql-engine/entry")
      const { getData, renderPageData, renderHTML, findEnginePageByPath } =
        require(pageSSRModule) as typeof import("../utils/page-ssr-module/entry")
      const graphqlEngine = new GraphQLEngine({
        dbPath: path.posix.join(
          slash(program.directory),
          `.cache`,
          `data`,
          `datastore`
        ),
      })

      router.get(
        `/page-data/:pagePath(*)/page-data.json`,
        async (req, res, next) => {
          const requestedPagePath = req.params.pagePath
          if (!requestedPagePath) {
            return void next()
          }

          const potentialPagePath = reverseFixedPagePath(requestedPagePath)
          const page = findEnginePageByPath(potentialPagePath)

          if (page && (page.mode === `DSG` || page.mode === `SSR`)) {
            const requestActivity = report.phantomActivity(
              `request for "${req.path}"`
            )
            requestActivity.start()
            try {
              const spanContext = requestActivity.span.context()
              const data = await getData({
                pathName: req.path,
                graphqlEngine,
                req,
                spanContext,
              })
              const results = await renderPageData({ data, spanContext })
              if (data.serverDataHeaders) {
                for (const [name, value] of Object.entries(
                  data.serverDataHeaders
                )) {
                  res.setHeader(name, value)
                }
              }

              if (page.mode === `SSR` && data.serverDataStatus) {
                return void res.status(data.serverDataStatus).send(results)
              } else {
                return void res.send(results)
              }
            } catch (e) {
              report.error(
                `Generating page-data for "${requestedPagePath}" / "${potentialPagePath}" failed.`,
                e
              )
              return res
                .status(500)
                .contentType(`text/plain`)
                .send(`Internal server error.`)
            } finally {
              requestActivity.end()
            }
          }

          return void next()
        }
      )

      router.use(async (req, res, next) => {
        if (req.accepts(`html`)) {
          const potentialPagePath = req.path
          const page = findEnginePageByPath(potentialPagePath)
          if (page && (page.mode === `DSG` || page.mode === `SSR`)) {
            const requestActivity = report.phantomActivity(
              `request for "${req.path}"`
            )
            requestActivity.start()

            try {
              const spanContext = requestActivity.span.context()
              const data = await getData({
                pathName: potentialPagePath,
                graphqlEngine,
                req,
                spanContext,
              })
              const results = await renderHTML({ data, spanContext })
              if (data.serverDataHeaders) {
                for (const [name, value] of Object.entries(
                  data.serverDataHeaders
                )) {
                  res.setHeader(name, value)
                }
              }

              if (page.mode === `SSR` && data.serverDataStatus) {
                return void res.status(data.serverDataStatus).send(results)
              } else {
                return void res.send(results)
              }
            } catch (e) {
              report.error(
                `Rendering html for "${potentialPagePath}" failed.`,
                e
              )
              return res.status(500).sendFile(`500.html`, { root }, err => {
                if (err) {
                  res.contentType(`text/plain`).send(`Internal server error.`)
                }
              })
            } finally {
              requestActivity.end()
            }
          }
        }
        return next()
      })
    } catch (error) {
      report.panic({
        id: `98051`,
        error,
        context: {},
      })
    }
  }

  const matchPaths = await readMatchPaths(program)
  router.use(
    createMatchPathMiddleware(matchPaths, {
      root,
      enableLogging: process.env.NODE_ENV !== `production`,
    })
  )

  // TODO: Remove/merge with above same block
  router.use((req, res, next) => {
    if (req.accepts(`html`)) {
      return res.status(404).sendFile(`404.html`, { root })
    }
    return next()
  })
  app.use(function (
    _: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    res.header(`Access-Control-Allow-Origin`, `*`)
    res.header(
      `Access-Control-Allow-Headers`,
      `Origin, X-Requested-With, Content-Type, Accept`
    )
    next()
  })
  app.use(pathPrefix, router)

  function printInstructions(appName: string, urls: IPreparedUrls): void {
    console.log()
    console.log(`You can now view ${chalk.bold(appName)} in the browser.`)
    console.log()

    if (urls.lanUrlForTerminal) {
      console.log(
        `  ${chalk.bold(`Local:`)}            ${urls.localUrlForTerminal}`
      )
      console.log(
        `  ${chalk.bold(`On Your Network:`)}  ${urls.lanUrlForTerminal}`
      )
    } else {
      console.log(`  ${urls.localUrlForTerminal}`)
    }
  }

  const startListening = (): void => {
    app.listen(port, host, () => {
      const urls = prepareUrls(
        program.ssl ? `https` : `http`,
        program.host,
        port
      )
      printInstructions(
        program.sitePackageJson.name || `(Unnamed package)`,
        urls
      )
      if (open) {
        report.info(`Opening browser...`)
        Promise.resolve(openurl(urls.localUrlForBrowser)).catch(() =>
          report.warn(`Browser not opened because no browser was found`)
        )
      }
    })
  }

  try {
    port = await detectPortInUseAndPrompt(port, program.host)
    startListening()
  } catch (e) {
    if (e.message === `USER_REJECTED`) {
      return
    }

    throw e
  }
}
