import reporter from "gatsby-cli/lib/reporter"
import { applyTrailingSlashOption, TrailingSlash } from "gatsby-page-utils"
import { generateHtmlPath } from "gatsby-core-utils/page-html"
import { slash } from "gatsby-core-utils/path"
import { generatePageDataPath } from "gatsby-core-utils/page-data"
import { posix } from "path"
import { sync as globSync } from "glob"
import { copy, pathExists, unlink } from "fs-extra"
import pathToRegexp from "path-to-regexp"
import type {
  FunctionsManifest,
  IAdaptContext,
  RoutesManifest,
  Route,
  IAdapterManager,
  IFunctionRoute,
  IAdapter,
  IAdapterFinalConfig,
  IAdapterConfig,
  HeaderRoutes,
  RemoteFileAllowedUrls,
} from "./types"
import { store, readState } from "../../redux"
import { getPageMode } from "../page-mode"
import { getStaticQueryPath } from "../static-query-utils"
import { getAdapterInit } from "./init"
import {
  getLmdbOnCdnPath,
  shouldBundleDatastore,
  shouldGenerateEngines,
} from "../engines-helpers"
import {
  BASE_HEADERS,
  MUST_REVALIDATE_HEADERS,
  PERMAMENT_CACHING_HEADERS,
  PERMANENT_CACHE_CONTROL_HEADER,
} from "./constants"
import { createHeadersMatcher } from "./create-headers"
import { HTTP_STATUS_CODE } from "../../redux/types"
import type { IHeader } from "../../redux/types"
import { rankRoute } from "../rank-route"
import {
  getRoutePathFromFunction,
  getRoutePathFromPage,
} from "./get-route-path"
import { noOpAdapterManager } from "./no-op-manager"
import { getDefaultDbPath } from "../../datastore/lmdb/lmdb-datastore"

async function setAdapter({
  instance,
  manager,
}: {
  instance?: IAdapter
  manager: IAdapterManager
}): Promise<void> {
  const configFromAdapter = await manager.config()

  store.dispatch({
    type: `SET_ADAPTER`,
    payload: {
      manager,
      instance,
      config: configFromAdapter,
    },
  })

  if (instance) {
    // if adapter reports that it doesn't support certain features, we need to fail the build
    // to avoid broken deploys

    const incompatibleFeatures: Array<string> = []

    // pathPrefix support
    if (
      configFromAdapter?.supports?.pathPrefix === false &&
      store.getState().program.prefixPaths &&
      store.getState().config.pathPrefix
    ) {
      incompatibleFeatures.push(`pathPrefix is not supported.`)
    }

    // trailingSlash support
    if (configFromAdapter?.supports?.trailingSlash) {
      const { trailingSlash } = store.getState().config

      if (
        !configFromAdapter.supports.trailingSlash.includes(
          trailingSlash ?? `always`
        )
      ) {
        incompatibleFeatures.push(
          `trailingSlash option "${trailingSlash}". Supported option${
            configFromAdapter.supports.trailingSlash.length > 1 ? `s` : ``
          }: ${configFromAdapter.supports.trailingSlash
            .map(option => `"${option}"`)
            .join(`, `)}`
        )
      }
    }

    if (incompatibleFeatures.length > 0) {
      reporter.warn(
        `Adapter "${
          instance.name
        }" is not compatible with following settings:\n${incompatibleFeatures
          .map(line => ` - ${line}`)
          .join(`\n`)}`
      )
    }

    if (configFromAdapter.pluginsToDisable.length > 0) {
      store.dispatch({
        type: `DISABLE_PLUGINS_BY_NAME`,
        payload: {
          pluginsToDisable: configFromAdapter.pluginsToDisable,
          reason: `Not compatible with the "${instance.name}" adapter. Please remove it from your gatsby-config.`,
        },
      })
    }
  }
}

export async function initAdapterManager(): Promise<IAdapterManager> {
  let adapter: IAdapter

  const config = store.getState().config
  const { adapter: adapterFromGatsbyConfig, trailingSlash, pathPrefix } = config

  // If the user specified an adapter inside their gatsby-config, use that instead of trying to figure out an adapter for the current environment
  if (adapterFromGatsbyConfig) {
    adapter = adapterFromGatsbyConfig

    reporter.verbose(`Using adapter ${adapter.name} from gatsby-config`)
  } else {
    const adapterInit =
      adapterFromGatsbyConfig === false ? false : await getAdapterInit()

    // If we don't have adapter, use no-op adapter manager
    if (!adapterInit) {
      const manager = noOpAdapterManager()

      await setAdapter({ manager })

      return manager
    }

    adapter = adapterInit()
  }

  reporter.info(`Using ${adapter.name} adapter`)

  const directoriesToCache = [`.cache`, `public`]
  const manager: IAdapterManager = {
    restoreCache: async (): Promise<void> => {
      if (!adapter.cache) {
        return
      }

      const result = await adapter.cache.restore({
        directories: directoriesToCache,
        reporter,
      })
      if (result === false) {
        // if adapter reports `false`, we can skip trying to re-hydrate state
        return
      }

      const cachedState = readState()

      // readState() returns empty object if there is no cached state or it's corrupted etc
      // so we want to avoid dispatching RESTORE_CACHE action in that case
      if (Object.keys(cachedState).length > 0) {
        store.dispatch({
          type: `RESTORE_CACHE`,
          payload: cachedState,
        })
      }
    },
    storeCache: async (): Promise<void> => {
      if (!adapter.cache) {
        return
      }

      await adapter.cache.store({ directories: directoriesToCache, reporter })
    },
    adapt: async (): Promise<void> => {
      if (!adapter.adapt) {
        return
      }

      // handle lmdb file
      const mdbInPublicPath = `public/${getLmdbOnCdnPath()}`
      if (!shouldBundleDatastore()) {
        const mdbPath = getDefaultDbPath() + `/data.mdb`
        copy(mdbPath, mdbInPublicPath)
      } else {
        // ensure public dir doesn't have lmdb file
        if (await pathExists(mdbInPublicPath)) {
          await unlink(mdbInPublicPath)
        }
      }

      let _routesManifest: RoutesManifest | undefined = undefined
      let _functionsManifest: FunctionsManifest | undefined = undefined
      let _headerRoutes: HeaderRoutes | undefined = undefined
      let _imageCdnAllowedUrls: RemoteFileAllowedUrls | undefined = undefined
      const adaptContext: IAdaptContext = {
        get routesManifest(): RoutesManifest {
          if (!_routesManifest) {
            const { routes, headers } = getRoutesManifest()
            _routesManifest = routes
            _headerRoutes = headers
          }

          return _routesManifest
        },
        get functionsManifest(): FunctionsManifest {
          if (!_functionsManifest) {
            _functionsManifest = getFunctionsManifest()
          }

          return _functionsManifest
        },
        get headerRoutes(): HeaderRoutes {
          if (!_headerRoutes) {
            const { routes, headers } = getRoutesManifest()
            _routesManifest = routes
            _headerRoutes = headers
          }

          return _headerRoutes
        },
        get remoteFileAllowedUrls(): RemoteFileAllowedUrls {
          if (!_imageCdnAllowedUrls) {
            _imageCdnAllowedUrls = Array.from(
              store.getState().remoteFileAllowedUrls
            ).map(urlPattern => {
              return {
                urlPattern,
                regexSource: pathToRegexp(urlPattern).source,
              }
            })
          }

          return _imageCdnAllowedUrls
        },
        reporter,
        // Our internal Gatsby config allows this to be undefined but for the adapter we should always pass through the default values and correctly show this in the TypeScript types
        trailingSlash: trailingSlash as TrailingSlash,
        pathPrefix: pathPrefix as string,
      }

      await adapter.adapt(adaptContext)
    },
    config: async (): Promise<IAdapterFinalConfig> => {
      let configFromAdapter: undefined | IAdapterConfig = undefined
      if (adapter.config) {
        configFromAdapter = await adapter.config({ reporter })

        if (
          configFromAdapter?.excludeDatastoreFromEngineFunction &&
          !configFromAdapter?.deployURL
        ) {
          throw new Error(
            `Can't exclude datastore from engine function without adapter providing deployURL`
          )
        }

        if (configFromAdapter?.imageCDNUrlGeneratorModulePath) {
          global.__GATSBY.imageCDNUrlGeneratorModulePath =
            configFromAdapter.imageCDNUrlGeneratorModulePath
        }

        if (configFromAdapter?.fileCDNUrlGeneratorModulePath) {
          global.__GATSBY.fileCDNUrlGeneratorModulePath =
            configFromAdapter.fileCDNUrlGeneratorModulePath
        }
      }

      return {
        excludeDatastoreFromEngineFunction:
          configFromAdapter?.excludeDatastoreFromEngineFunction ?? false,
        deployURL: configFromAdapter?.deployURL,
        supports: configFromAdapter?.supports,
        pluginsToDisable: configFromAdapter?.pluginsToDisable ?? [],
        functionsArch: configFromAdapter?.functionsArch,
        functionsPlatform: configFromAdapter?.functionsPlatform,
      }
    },
  }

  await setAdapter({ manager, instance: adapter })

  return manager
}

let webpackAssets: Set<string> | undefined
export function setWebpackAssets(assets: Set<string>): void {
  webpackAssets = assets
}

type RouteWithScore = { score: number } & Route

const headersAreEqual = (a, b): boolean =>
  a.key === b.key && a.value === b.value

const getDefaultHeaderRoutes = (pathPrefix: string): HeaderRoutes => [
  {
    path: `${pathPrefix}/*`,
    headers: MUST_REVALIDATE_HEADERS,
  },
  {
    path: `${pathPrefix}/static/*`,
    headers: PERMANENT_CACHE_CONTROL_HEADER,
  },
]

const customHeaderFilter =
  (route: Route, pathPrefix: string) =>
  (h: IHeader["headers"][0]): boolean => {
    for (const baseHeader of MUST_REVALIDATE_HEADERS) {
      if (headersAreEqual(baseHeader, h)) {
        return false
      }
    }
    if (route.path.startsWith(`${pathPrefix}/static/`)) {
      for (const cachingHeader of PERMAMENT_CACHING_HEADERS) {
        if (headersAreEqual(cachingHeader, h)) {
          return false
        }
      }
    }
    return true
  }

function getRoutesManifest(): {
  routes: RoutesManifest
  headers: HeaderRoutes
} {
  const routes: Array<RouteWithScore> = []
  const state = store.getState()
  const pathPrefix = state.program.prefixPaths
    ? state.config.pathPrefix ?? ``
    : ``
  const createHeaders = createHeadersMatcher(state.config.headers, pathPrefix)

  const headerRoutes: HeaderRoutes = [...getDefaultHeaderRoutes(pathPrefix)]

  const fileAssets = new Set(
    globSync(`**/**`, {
      cwd: posix.join(process.cwd(), `public`),
      nodir: true,
      dot: true,
    }).map(filePath => slash(filePath))
  )

  // TODO: This could be a "addSortedRoute" function that would add route to the list in sorted order. TBD if necessary performance-wise
  function addRoute(route: Route): void {
    if (
      !(route.path.startsWith(`https://`) || route.path.startsWith(`http://`))
    ) {
      if (!route.path.startsWith(`/`)) {
        route.path = `/${route.path}`
      }

      if (pathPrefix && !route.path.startsWith(pathPrefix)) {
        route.path = posix.join(pathPrefix, route.path)
      }
    }

    // Apply trailing slash behavior unless it's a redirect. Redirects should always be exact matches
    if (route.type !== `redirect`) {
      route.path = applyTrailingSlashOption(
        route.path,
        state.config.trailingSlash
      )
    }

    if (route.type !== `function`) {
      route.headers = createHeaders(route.path, route.headers)
      const customHeaders = route.headers.filter(
        customHeaderFilter(route, pathPrefix)
      )
      if (customHeaders.length > 0) {
        headerRoutes.push({ path: route.path, headers: customHeaders })
      }
    }

    const routeWithScore: RouteWithScore = {
      ...route,
      score: rankRoute(route.path),
    }

    routes.push(routeWithScore)
  }

  function addStaticRoute({
    path,
    pathToFillInPublicDir,
    headers,
  }: {
    path: string
    pathToFillInPublicDir: string
    headers: IHeader["headers"]
  }): void {
    addRoute({
      path,
      type: `static`,
      filePath: posix.join(`public`, pathToFillInPublicDir),
      headers,
    })

    if (fileAssets.has(pathToFillInPublicDir)) {
      fileAssets.delete(pathToFillInPublicDir)
    } else {
      reporter.verbose(
        `[Adapters] Tried to remove "${pathToFillInPublicDir}" from fileAssets but it wasn't there`
      )
    }
  }

  // routes - pages - static (SSG) or function (DSG/SSR)
  for (const page of state.pages.values()) {
    const htmlRoutePath = slash(getRoutePathFromPage(page))
    const pageDataRoutePath = slash(generatePageDataPath(``, htmlRoutePath))

    const pageMode = getPageMode(page)

    if (pageMode === `SSG`) {
      const htmlFilePath = slash(generateHtmlPath(``, page.path))
      const pageDataFilePath = slash(generatePageDataPath(``, page.path))

      addStaticRoute({
        path: htmlRoutePath,
        pathToFillInPublicDir: htmlFilePath,
        headers: MUST_REVALIDATE_HEADERS,
      })
      addStaticRoute({
        path: pageDataRoutePath,
        pathToFillInPublicDir: pageDataFilePath,
        headers: MUST_REVALIDATE_HEADERS,
      })
    } else {
      const commonFields: Omit<IFunctionRoute, "path"> = {
        type: `function`,
        functionId: `ssr-engine`,
      }

      if (pageMode === `DSG`) {
        commonFields.cache = true
      }

      addRoute({
        path: htmlRoutePath,
        ...commonFields,
      })

      addRoute({
        path: pageDataRoutePath,
        ...commonFields,
      })
    }
  }

  // static query json assets
  for (const staticQueryComponent of state.staticQueryComponents.values()) {
    const staticQueryResultPath = getStaticQueryPath(staticQueryComponent.hash)
    addStaticRoute({
      path: staticQueryResultPath,
      pathToFillInPublicDir: staticQueryResultPath,
      headers: MUST_REVALIDATE_HEADERS,
    })
  }

  // app-data.json
  {
    const appDataFilePath = posix.join(`page-data`, `app-data.json`)
    addStaticRoute({
      path: appDataFilePath,
      pathToFillInPublicDir: appDataFilePath,
      headers: MUST_REVALIDATE_HEADERS,
    })
  }

  // webpack assets
  if (!webpackAssets) {
    reporter.panic({
      id: `12200`,
      context: {},
    })
  }

  for (const asset of webpackAssets) {
    addStaticRoute({
      path: asset,
      pathToFillInPublicDir: asset,
      headers: PERMAMENT_CACHING_HEADERS,
    })
  }

  // chunk-map.json
  {
    const chunkMapFilePath = posix.join(`chunk-map.json`)
    addStaticRoute({
      path: chunkMapFilePath,
      pathToFillInPublicDir: chunkMapFilePath,
      headers: MUST_REVALIDATE_HEADERS,
    })
  }

  // webpack.stats.json
  {
    const webpackStatsFilePath = posix.join(`webpack.stats.json`)
    addStaticRoute({
      path: webpackStatsFilePath,
      pathToFillInPublicDir: webpackStatsFilePath,
      headers: MUST_REVALIDATE_HEADERS,
    })
  }

  for (const slice of state.slices.values()) {
    const sliceDataPath = posix.join(`slice-data`, `${slice.name}.json`)

    addStaticRoute({
      path: sliceDataPath,
      pathToFillInPublicDir: sliceDataPath,
      headers: MUST_REVALIDATE_HEADERS,
    })
  }

  function addSliceHtmlRoute(name: string, hasChildren: boolean): void {
    const sliceHtml1Path = posix.join(`_gatsby`, `slices`, `${name}-1.html`)
    addStaticRoute({
      path: sliceHtml1Path,
      pathToFillInPublicDir: sliceHtml1Path,
      headers: MUST_REVALIDATE_HEADERS,
    })
    if (hasChildren) {
      const sliceHtml2Path = posix.join(`_gatsby`, `slices`, `${name}-2.html`)
      addStaticRoute({
        path: sliceHtml2Path,
        pathToFillInPublicDir: sliceHtml2Path,
        headers: MUST_REVALIDATE_HEADERS,
      })
    }
  }

  addSliceHtmlRoute(`_gatsby-scripts`, false)
  for (const [
    name,
    { hasChildren },
  ] of state.html.slicesProps.bySliceId.entries()) {
    addSliceHtmlRoute(name, hasChildren)
  }

  // redirect routes
  for (const redirect of state.redirects.values()) {
    const {
      fromPath,
      toPath,
      statusCode,
      isPermanent,
      ignoreCase,
      redirectInBrowser,
      ...platformSpecificFields
    } = redirect

    addRoute({
      path: fromPath,
      type: `redirect`,
      toPath: toPath,
      status:
        statusCode ??
        (isPermanent
          ? HTTP_STATUS_CODE.MOVED_PERMANENTLY_301
          : HTTP_STATUS_CODE.FOUND_302),
      ignoreCase: ignoreCase,
      headers: BASE_HEADERS,
      ...platformSpecificFields,
    })
  }

  // function routes
  for (const functionInfo of state.functions.values()) {
    addRoute({
      path: `/api/${getRoutePathFromFunction(functionInfo)}`,
      type: `function`,
      functionId: functionInfo.functionId,
    })
  }

  for (const fileAsset of fileAssets) {
    // try to classify remaining assets
    let headers: IHeader["headers"] | undefined = undefined

    if (fileAsset.startsWith(`~partytown`)) {
      // no hashes, must revalidate
      headers = MUST_REVALIDATE_HEADERS
    } else if (
      fileAsset.startsWith(`_gatsby/image`) ||
      fileAsset.startsWith(`_gatsby/file`)
    ) {
      headers = PERMAMENT_CACHING_HEADERS
    }

    if (!headers) {
      headers = BASE_HEADERS
    }

    addStaticRoute({
      path: fileAsset,
      pathToFillInPublicDir: fileAsset,
      headers,
    })
  }

  const sortedRoutes = routes
    .sort((a, b) => {
      // The higher the score, the higher the specificity of our path
      const order = b.score - a.score
      if (order !== 0) {
        return order
      }

      // if specificity is the same we do lexigraphic comparison of path to ensure
      // deterministic order regardless of order pages where created
      return a.path.localeCompare(b.path)
    })
    // The score should be internal only, so we remove it from the final manifest
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ score, ...rest }): Route => {
      return { ...rest }
    })
  return {
    routes: sortedRoutes,
    headers: headerRoutes,
  }
}

function getFunctionsManifest(): FunctionsManifest {
  const functions = [] as FunctionsManifest

  for (const functionInfo of store.getState().functions.values()) {
    const pathToEntryPoint = posix.join(
      `.cache`,
      `functions`,
      functionInfo.relativeCompiledFilePath
    )
    const relativePathWithoutFileExtension = posix.join(
      posix.parse(functionInfo.originalRelativeFilePath).dir,
      posix.parse(functionInfo.originalRelativeFilePath).name
    )

    functions.push({
      functionId: functionInfo.functionId,
      name: `/api/${relativePathWithoutFileExtension}`,
      pathToEntryPoint,
      requiredFiles: [pathToEntryPoint],
    })
  }

  if (shouldGenerateEngines()) {
    function getFilesFrom(dir: string): Array<string> {
      return globSync(`**/**`, {
        cwd: posix.join(process.cwd(), dir),
        nodir: true,
        dot: true,
      }).map(file => posix.join(dir, file))
    }

    functions.push({
      functionId: `ssr-engine`,
      pathToEntryPoint: posix.join(`.cache`, `page-ssr`, `lambda.js`),
      name: `SSR & DSG`,
      requiredFiles: [
        `public/404.html`,
        `public/500.html`,
        ...(shouldBundleDatastore()
          ? getFilesFrom(posix.join(`.cache`, `data`, `datastore`))
          : []),
        ...getFilesFrom(posix.join(`.cache`, `page-ssr`)),
        ...getFilesFrom(posix.join(`.cache`, `query-engine`)),
      ],
    })
  }

  return functions
}

export { getRoutesManifest, getFunctionsManifest }
