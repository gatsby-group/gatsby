import reporter from "gatsby-cli/lib/reporter"
import _ from "lodash"

import {
  IGatsbyConfig,
  IGatsbyPlugin,
  ProgramStatus,
  ICreatePageDependencyAction,
  IDeleteComponentDependenciesAction,
  IReplaceComponentQueryAction,
  IReplaceStaticQueryAction,
  IQueryExtractedAction,
  IQueryExtractionGraphQLErrorAction,
  IQueryExtractedBabelSuccessAction,
  IQueryExtractionBabelErrorAction,
  ISetProgramStatusAction,
  IPageQueryRunAction,
  IRemoveStaleJobAction,
  ISetSiteConfig,
  ISetSiteFunctions,
  IGatsbyState,
  IDefinitionMeta,
  ISetGraphQLDefinitionsAction,
  IQueryStartAction,
  IApiFinishedAction,
  IQueryClearDirtyQueriesListToEmitViaWebsocket,
  ICreateJobV2FromInternalAction,
  ICreatePageDependencyActionPayloadType,
  IDeleteNodeManifests,
  IClearGatsbyImageSourceUrlAction,
  ActionsUnion,
  IGatsbyNode,
  IDeleteNodeAction,
} from "../types"

import { store } from "../index"
import { gatsbyConfigSchema } from "../../joi-schemas/joi"
import { didYouMean } from "../../utils/did-you-mean"
import {
  enqueueJob,
  InternalJob,
  removeInProgressJob,
  getInProcessJobPromise,
} from "../../utils/jobs/manager"
import { getEngineContext } from "../../utils/engine-context"
import { getNode } from "../../datastore"
import { hasNodeChanged } from "../../utils/nodes"

/**
 * Create a dependency between a page and data. Probably for
 * internal use only.
 * @private
 */
export const createPageDependencies = (
  payload: Array<ICreatePageDependencyActionPayloadType>,
  plugin = ``
): ICreatePageDependencyAction => {
  return {
    type: `CREATE_COMPONENT_DEPENDENCY`,
    plugin,
    payload: payload.map(({ path, nodeId, connection }) => {
      return {
        path,
        nodeId,
        connection,
      }
    }),
  }
}

/**
 * Create a dependency between a page and data. Probably for
 * internal use only.
 *
 * Shorthand for createPageDependencies.
 * @private
 */
export const createPageDependency = (
  payload: ICreatePageDependencyActionPayloadType,
  plugin = ``
): ICreatePageDependencyAction => createPageDependencies([payload], plugin)

/**
 * Delete dependencies between an array of pages and data. Probably for
 * internal use only. Used when deleting pages.
 * @private
 */
export const deleteComponentsDependencies = (
  paths: Array<string>
): IDeleteComponentDependenciesAction => {
  return {
    type: `DELETE_COMPONENTS_DEPENDENCIES`,
    payload: {
      paths,
    },
  }
}

/**
 * When the query watcher extracts a GraphQL query, it calls
 * this to store the query with its component.
 * @private
 */
export const replaceComponentQuery = ({
  query,
  componentPath,
}: {
  query: string
  componentPath: string
}): IReplaceComponentQueryAction => {
  return {
    type: `REPLACE_COMPONENT_QUERY`,
    payload: {
      query,
      componentPath,
    },
  }
}

export const apiFinished = (
  payload: IApiFinishedAction["payload"]
): IApiFinishedAction => {
  return {
    type: `API_FINISHED`,
    payload,
  }
}

/**
 * When the query watcher extracts a "static" GraphQL query from useStaticQuery
 * it calls this to store the query with its component.
 * @private
 */
export const replaceStaticQuery = (
  args: {
    name: string
    componentPath: string
    id: string
    query: string
    hash: string
  },
  plugin: IGatsbyPlugin | null | undefined = null
): IReplaceStaticQueryAction => {
  return {
    type: `REPLACE_STATIC_QUERY`,
    plugin,
    payload: args,
  }
}

/**
 *
 * Report that a query has been extracted from a component. Used by
 * query-compiler.js.
 * @private
 */
export const queryExtracted = (
  { componentPath, query }: { componentPath: string; query: string },
  plugin: IGatsbyPlugin,
  traceId?: string
): IQueryExtractedAction => {
  return {
    type: `QUERY_EXTRACTED`,
    plugin,
    traceId,
    payload: { componentPath, query },
  }
}

/**
 * Set Definitions for fragment extraction, etc.
 *
 * Used by developer tools such as vscode-graphql & graphiql
 *
 * query-compiler.js.
 * @private
 */
export const setGraphQLDefinitions = (
  definitionsByName: Map<string, IDefinitionMeta>
): ISetGraphQLDefinitionsAction => {
  return {
    type: `SET_GRAPHQL_DEFINITIONS`,
    payload: definitionsByName,
  }
}

/**
 *
 * Report that the Relay Compiler found a graphql error when attempting to extract a query
 * @private
 */
export const queryExtractionGraphQLError = (
  { componentPath, error }: { componentPath: string; error: string },
  plugin: IGatsbyPlugin,
  traceId?: string
): IQueryExtractionGraphQLErrorAction => {
  return {
    type: `QUERY_EXTRACTION_GRAPHQL_ERROR`,
    plugin,
    traceId,
    payload: { componentPath, error },
  }
}

/**
 *
 * Report that babel was able to extract the graphql query.
 * Indicates that the file is free of JS errors.
 * @private
 */
export const queryExtractedBabelSuccess = (
  { componentPath },
  plugin: IGatsbyPlugin,
  traceId?: string
): IQueryExtractedBabelSuccessAction => {
  return {
    type: `QUERY_EXTRACTION_BABEL_SUCCESS`,
    plugin,
    traceId,
    payload: { componentPath },
  }
}

/**
 *
 * Report that the Relay Compiler found a babel error when attempting to extract a query
 * @private
 */
export const queryExtractionBabelError = (
  { componentPath, error }: { componentPath: string; error: Error },
  plugin: IGatsbyPlugin,
  traceId?: string
): IQueryExtractionBabelErrorAction => {
  return {
    type: `QUERY_EXTRACTION_BABEL_ERROR`,
    plugin,
    traceId,
    payload: { componentPath, error },
  }
}

/**
 * Set overall program status e.g. `BOOTSTRAPING` or `BOOTSTRAP_FINISHED`.
 * @private
 */
export const setProgramStatus = (
  status: ProgramStatus,
  plugin: IGatsbyPlugin,
  traceId?: string
): ISetProgramStatusAction => {
  return {
    type: `SET_PROGRAM_STATUS`,
    plugin,
    traceId,
    payload: status,
  }
}

/**
 * Broadcast that a page's query was run.
 * @private
 */
export const pageQueryRun = (
  payload: IPageQueryRunAction["payload"],
  plugin: IGatsbyPlugin,
  traceId?: string
): IPageQueryRunAction => {
  return {
    type: `PAGE_QUERY_RUN`,
    plugin,
    traceId,
    payload,
  }
}

export const queryStart = (
  { path, componentPath, isPage },
  plugin: IGatsbyPlugin,
  traceId?: string
): IQueryStartAction => {
  return {
    type: `QUERY_START`,
    plugin,
    traceId,
    payload: { path, componentPath, isPage },
  }
}

export const clearDirtyQueriesListToEmitViaWebsocket =
  (): IQueryClearDirtyQueriesListToEmitViaWebsocket => {
    return {
      type: `QUERY_CLEAR_DIRTY_QUERIES_LIST_TO_EMIT_VIA_WEBSOCKET`,
    }
  }

/**
 * Remove jobs which are marked as stale (inputPath doesn't exists)
 * @private
 */
export const removeStaleJob = (
  contentDigest: string,
  plugin?: IGatsbyPlugin,
  traceId?: string
): IRemoveStaleJobAction => {
  return {
    type: `REMOVE_STALE_JOB_V2`,
    plugin,
    traceId,
    payload: {
      contentDigest,
    },
  }
}

/**
 * Set gatsby config
 * @private
 */
export const setSiteConfig = (config?: unknown): ISetSiteConfig => {
  const result = gatsbyConfigSchema.validate(config || {})
  const normalizedPayload = result.value as IGatsbyConfig

  if (result.error) {
    const hasUnknownKeys = result.error.details.filter(
      details => details.type === `object.unknown`
    )

    if (Array.isArray(hasUnknownKeys) && hasUnknownKeys.length) {
      const errorMessages = hasUnknownKeys.map(unknown => {
        const { context, message } = unknown
        const key = context?.key
        const suggestion = key && didYouMean(key)

        if (suggestion) {
          return `${message}. ${suggestion}`
        }

        return message
      })

      reporter.panic({
        id: `10122`,
        context: {
          sourceMessage: errorMessages.join(`\n`),
        },
      })
    }

    reporter.panic({
      id: `10122`,
      context: {
        sourceMessage: result.error.message,
      },
    })
  }

  return {
    type: `SET_SITE_CONFIG`,
    payload: normalizedPayload,
  }
}

/**
 * Set gatsby functions
 * @private
 */
export const setFunctions = (
  functions: IGatsbyState["functions"]
): ISetSiteFunctions => {
  return {
    type: `SET_SITE_FUNCTIONS`,
    payload: functions,
  }
}

export const deleteNodeManifests = (): IDeleteNodeManifests => {
  return {
    type: `DELETE_NODE_MANIFESTS`,
  }
}

export const createJobV2FromInternalJob =
  (internalJob: InternalJob): ICreateJobV2FromInternalAction =>
  (dispatch, getState): Promise<Record<string, unknown>> => {
    const jobContentDigest = internalJob.contentDigest
    const currentState = getState()

    // Check if we already ran this job before, if yes we return the result
    // We have an inflight (in progress) queue inside the jobs manager to make sure
    // we don't waste resources twice during the process
    if (
      currentState.jobsV2 &&
      currentState.jobsV2.complete.has(jobContentDigest)
    ) {
      return Promise.resolve(
        currentState.jobsV2.complete.get(jobContentDigest)!.result
      )
    }
    const engineContext = getEngineContext()

    // Always set context, even if engineContext is undefined.
    // We do this because the final list of jobs for a given engine request includes both:
    //  - jobs with the same requestId
    //  - jobs without requestId (technically with requestId === "")
    //
    // See https://nodejs.org/dist/latest-v16.x/docs/api/async_context.html#async_context_troubleshooting_context_loss
    // on cases when async context could be lost.
    dispatch({
      type: `SET_JOB_V2_CONTEXT`,
      payload: {
        job: internalJob,
        requestId: engineContext?.requestId ?? ``,
      },
    })

    const inProgressJobPromise = getInProcessJobPromise(jobContentDigest)
    if (inProgressJobPromise) {
      return inProgressJobPromise
    }

    dispatch({
      type: `CREATE_JOB_V2`,
      payload: {
        job: internalJob,
      },
      plugin: { name: internalJob.plugin.name },
    })

    const enqueuedJobPromise = enqueueJob(internalJob)
    return enqueuedJobPromise.then(result => {
      // store the result in redux so we have it for the next run
      dispatch({
        type: `END_JOB_V2`,
        plugin: { name: internalJob.plugin.name },
        payload: {
          jobContentDigest,
          result,
        },
      })

      // remove the job from our inProgressJobQueue as it's available in our done state.
      // this is a perf optimisations so we don't grow our memory too much when using gatsby preview
      removeInProgressJob(jobContentDigest)

      return result
    })
  }

export const clearGatsbyImageSourceUrls =
  (): IClearGatsbyImageSourceUrlAction => {
    return {
      type: `CLEAR_GATSBY_IMAGE_SOURCE_URL`,
    }
  }

// We add a counter to node.internal for fast comparisons/intersections
// of various node slices. The counter must increase even across builds.
export function getNextNodeCounter(): number {
  const lastNodeCounter = store.getState().status.LAST_NODE_COUNTER ?? 0
  if (lastNodeCounter >= Number.MAX_SAFE_INTEGER) {
    throw new Error(
      `Could not create more nodes. Maximum node count is reached: ${lastNodeCounter}`
    )
  }
  return lastNodeCounter + 1
}

export const findChildren = (initialChildren: Array<string>): Array<string> => {
  const children = [...initialChildren]
  const queue = [...initialChildren]
  const traversedNodes = new Set()

  while (queue.length > 0) {
    const currentChild = getNode(queue.pop()!)
    if (!currentChild || traversedNodes.has(currentChild.id)) {
      continue
    }
    traversedNodes.add(currentChild.id)
    const newChildren = currentChild.children
    if (_.isArray(newChildren) && newChildren.length > 0) {
      children.push(...newChildren)
      queue.push(...newChildren)
    }
  }
  return children
}

function isNode(node: any): node is IGatsbyNode {
  return Boolean(node)
}

export function internalCreateNodeWithoutValidation(
  node: IGatsbyNode,
  plugin?: IGatsbyPlugin,
  actionOptions?: any
): Array<ActionsUnion> {
  let deleteActions: Array<IDeleteNodeAction> | undefined
  let updateNodeAction

  const oldNode = getNode(node.id)

  // marking internal-data-bridge as owner of SitePage instead of plugin that calls createPage
  if (oldNode && !hasNodeChanged(node.id, node.internal.contentDigest)) {
    updateNodeAction = {
      ...actionOptions,
      plugin,
      type: `TOUCH_NODE`,
      typeName: node.internal.type,
      payload: node.id,
    }
  } else {
    // Remove any previously created descendant nodes as they're all due
    // to be recreated.
    if (oldNode) {
      const createDeleteAction = (node: IGatsbyNode): IDeleteNodeAction => {
        return {
          ...actionOptions,
          type: `DELETE_NODE`,
          plugin,
          payload: node,
          isRecursiveChildrenDelete: true,
        }
      }
      deleteActions = findChildren(oldNode.children)
        .map(getNode)
        .filter(isNode)
        .map(createDeleteAction)
    }

    node.internal.counter = getNextNodeCounter()

    updateNodeAction = {
      ...actionOptions,
      type: `CREATE_NODE`,
      plugin,
      oldNode,
      payload: node,
    }
  }

  const actions: Array<ActionsUnion> = []

  if (deleteActions && deleteActions.length) {
    actions.push(...deleteActions)
  }

  actions.push(updateNodeAction)

  return actions
}
