import path from "path"
import { Store } from "redux"
import { Compiler, NormalModule } from "webpack"
import { isEqual, cloneDeep } from "lodash"
import { enqueueFlush } from "../../page-data"
import type { IGatsbyState, IGatsbyPageComponent } from "../../../redux/types"
import {
  ICollectedSlices,
  mergePreviouslyCollectedSlices,
} from "../../babel/find-slices"
import { slash } from "gatsby-core-utils/path"
import { websocketManager } from "../../websocket-manager"

/**
 * Remove the export query param from a path that can
 * a) contain only the ?export= query param
 * b) but also contain ?__contentFilePath&export=
 */
export const removeExportQueryParam = (
  path: string | undefined
): string | undefined => {
  if (!path?.includes(`?`)) {
    return path
  }
  const [filePath, queryParams] = path?.split(`?`)
  const params = new URLSearchParams(queryParams)
  params.delete(`export`)

  const paramsString = params.toString()

  return `${filePath}${
    paramsString ? `?${decodeURIComponent(paramsString)}` : ``
  }`
}

/**
 * Checks if a module matches a resourcePath
 */
function doesModuleMatchResourcePath(
  resourcePath: string,
  webpackModule: NormalModule
): boolean {
  return (
    removeExportQueryParam((webpackModule as NormalModule).resource) ===
    resourcePath
  )
}

/**
 * A helper to set/get path resolving
 */
function getRealPath(
  cache: Map<string, string>,
  componentPath: string
): string {
  if (!cache.has(componentPath)) {
    cache.set(componentPath, path.resolve(componentPath))
  }

  return cache.get(componentPath) as string
}

export class StaticQueryMapper {
  private store: Store<IGatsbyState>
  private name: string

  constructor(store) {
    this.store = store
    this.name = `StaticQueryMapper`
  }

  apply(compiler: Compiler): void {
    const {
      components,
      staticQueryComponents,
      componentsUsingSlices,
      program,
    } = this.store.getState()

    compiler.hooks.done.tap(this.name, stats => {
      console.log(`[webpack hook] compiler.hooks.done`)
      // In dev mode we want to write page-data when compilation succeeds
      if (!stats.hasErrors() && compiler.watchMode) {
        enqueueFlush()
      }
    })

    compiler.hooks.finishMake.tapPromise(
      {
        name: this.name,
        before: `PartialHydrationPlugin`,
      },
      async compilation => {
        if (compilation.compiler.parentCompilation) {
          return
        }

        console.log(`[webpack hook] compiler.hooks.finishMake`)

        const entryModules = new Set()
        const gatsbyBrowserPlugins = slash(
          path.join(
            program.directory,
            `.cache`,
            `api-runner-browser-plugins.js`
          )
        )
        const asyncRequiresPath = slash(
          path.join(
            program.directory,
            `.cache`,
            `_this_is_virtual_fs_path_`,
            `$virtual`,
            `async-requires.js`
          )
        )
        for (const entry of compilation.entries.values()) {
          for (const dependency of entry.dependencies) {
            const mod = compilation.moduleGraph.getModule(dependency)
            entryModules.add(mod)
          }
        }

        const realPathCache = new Map<string, string>()

        const webpackModulesByStaticQueryId = new Map<
          string,
          Set<NormalModule>
        >()
        const webpackModulesByUsedSlicePlaceholderAlias = new Map<
          NormalModule,
          ICollectedSlices
        >()
        const componentModules = new Map<NormalModule, IGatsbyPageComponent>()
        let asyncRequiresModule: NormalModule | undefined

        for (const webpackModule of compilation.modules) {
          if (!(webpackModule instanceof NormalModule)) {
            // the only other type can be CssModule at this stage, which we don't care about
            // this also acts as a type guard, providing fuller typeing for webpackModule
            continue
          }

          if (doesModuleMatchResourcePath(asyncRequiresPath, webpackModule)) {
            asyncRequiresModule = webpackModule
            continue
          }

          if (
            doesModuleMatchResourcePath(gatsbyBrowserPlugins, webpackModule)
          ) {
            entryModules.add(webpackModule)
            continue
          }

          for (const staticQuery of staticQueryComponents.values()) {
            const staticQueryComponentPath = getRealPath(
              realPathCache,
              staticQuery.componentPath
            )

            if (
              !doesModuleMatchResourcePath(
                staticQueryComponentPath,
                webpackModule
              )
            ) {
              continue
            }

            let set = webpackModulesByStaticQueryId.get(staticQuery.hash)

            if (!set) {
              set = new Set()
              webpackModulesByStaticQueryId.set(staticQuery.hash, set)
            }

            set.add(webpackModule)
          }

          for (const [filePath, slices] of componentsUsingSlices) {
            const componentComponentPath = getRealPath(realPathCache, filePath)

            if (
              !doesModuleMatchResourcePath(
                componentComponentPath,
                webpackModule
              )
            ) {
              continue
            }

            webpackModulesByUsedSlicePlaceholderAlias.set(webpackModule, slices)
          }

          for (const component of components.values()) {
            const componentComponentPath = getRealPath(
              realPathCache,
              component.componentPath
            )

            if (
              !doesModuleMatchResourcePath(
                componentComponentPath,
                webpackModule
              )
            ) {
              continue
            }

            componentModules.set(webpackModule, component)
          }
        }

        function traverseModule(
          module: NormalModule,
          config: {
            onComponent(component: IGatsbyPageComponent): void
            onRoot(): void
          },
          visitedModules = new Set<NormalModule>()
        ): void {
          if (visitedModules.has(module)) {
            return
          }
          visitedModules.add(module)

          if (module === asyncRequiresModule) {
            return
          }

          const component = componentModules.get(module)
          if (component) {
            config.onComponent(component)
            // don't return here yet, as component might be imported by another one, and we want to traverse up until we reach async-requires
          }

          if (entryModules.has(module)) {
            config.onRoot()
            return
          }

          const incomingConnections =
            compilation.moduleGraph.getIncomingConnections(module)
          for (const connection of incomingConnections) {
            if (
              connection.originModule instanceof NormalModule ||
              // @ts-ignore __proto__ is a hack. LazyCompilationProxyModule class is not
              // exported from webpack at all, so we can't use instanceof for it
              connection.originModule?.__proto__?.constructor?.name ===
                `LazyCompilationProxyModule`
            ) {
              traverseModule(
                connection.originModule as NormalModule,
                config,
                visitedModules
              )
            }
          }
        }

        const globalStaticQueries = new Set<string>()
        const staticQueriesByComponents = new Map<string, Set<string>>()
        for (const [
          staticQueryId,
          modules,
        ] of webpackModulesByStaticQueryId.entries()) {
          for (const module of modules) {
            traverseModule(module, {
              onComponent(component: IGatsbyPageComponent) {
                let staticQueriesForComponent = staticQueriesByComponents.get(
                  component.componentPath
                )
                if (!staticQueriesForComponent) {
                  staticQueriesForComponent = new Set()
                  staticQueriesByComponents.set(
                    component.componentPath,
                    staticQueriesForComponent
                  )
                }

                staticQueriesForComponent.add(staticQueryId)
              },
              onRoot() {
                globalStaticQueries.add(staticQueryId)
              },
            })
          }
        }

        let globalSliceUsage: ICollectedSlices = {}
        const slicesByComponents = new Map<string, ICollectedSlices>()
        for (const [
          module,
          slices,
        ] of webpackModulesByUsedSlicePlaceholderAlias.entries()) {
          traverseModule(module, {
            onComponent(component: IGatsbyPageComponent) {
              slicesByComponents.set(
                component.componentPath,
                mergePreviouslyCollectedSlices(
                  slices,
                  slicesByComponents.get(component.componentPath)
                )
              )
            },
            onRoot() {
              globalSliceUsage = mergePreviouslyCollectedSlices(
                slices,
                globalSliceUsage
              )
            },
          })
        }

        let mappingWillChange = false

        for (const component of components.values()) {
          const allStaticQueries = new Set([
            ...globalStaticQueries,
            ...(staticQueriesByComponents.get(component.componentPath) ?? []),
          ])
          const staticQueryHashes = Array.from(allStaticQueries).sort()

          const allSlices = mergePreviouslyCollectedSlices(
            slicesByComponents.get(component.componentPath) ?? {},
            component.isSlice ? {} : cloneDeep(globalSliceUsage)
          )

          const slices = Object.keys(allSlices)
            .sort()
            .reduce((obj, key) => {
              obj[key] = allSlices[key]
              return obj
            }, {})

          const didSlicesChange = !isEqual(
            this.store.getState().slicesByTemplate.get(component.componentPath),
            slices
          )
          const didStaticQueriesChange = !isEqual(
            this.store
              .getState()
              .staticQueriesByTemplate.get(component.componentPath),
            staticQueryHashes
          )

          if (didStaticQueriesChange || didSlicesChange) {
            mappingWillChange = true

            if (component.isSlice) {
              this.store.dispatch({
                type: `ADD_PENDING_SLICE_TEMPLATE_DATA_WRITE`,
                payload: {
                  componentPath: component.componentPath,
                  sliceNames: component.pages,
                },
              })
            } else {
              this.store.dispatch({
                type: `ADD_PENDING_TEMPLATE_DATA_WRITE`,
                payload: {
                  componentPath: component.componentPath,
                  pages: component.pages,
                },
              })
            }
          }

          if (didSlicesChange) {
            this.store.dispatch({
              type: `SET_SLICES_BY_TEMPLATE`,
              payload: {
                componentPath: component.componentPath,
                slices,
              },
            })
          }

          if (didStaticQueriesChange) {
            this.store.dispatch({
              type: `SET_STATIC_QUERIES_BY_TEMPLATE`,
              payload: {
                componentPath: component.componentPath,
                staticQueryHashes,
              },
            })
          }
        }

        if (process.env.NODE_ENV !== `production`) {
          websocketManager.emitDataFilesWillRegenerate(mappingWillChange)
        }
      }
    )
  }
}
