import { Span } from "opentracing"
import { emitter, store } from "./index"
import apiRunnerNode from "../utils/api-runner-node"
import { ActivityTracker } from "../../"
import { ICreateNodeAction, ICreateNodeStagingAction } from "./types"

type Plugin = any // TODO

// This might make sense to live somewhere else
interface ICreatePageAction {
  graphql<TData, TVariables = any>(
    query: string,
    variables?: TVariables
  ): Promise<{
    errors?: any
    data?: TData
  }>
  traceId: "initial-createPages"
  waitForCascadingActions: boolean
  parentSpan: Span
  activity: ActivityTracker
  type: `CREATE_PAGE`
  contextModified: boolean
  plugin: Plugin
  payload: {
    internalComponentName: string
    path: string
    matchPath: string | undefined
    component: string
    componentChunkName: string
    isCreatedByStatefulCreatePages: boolean
    context: {
      slug: string
      id: string
    }
    updatedAt: number
    // eslint-disable-next-line @typescript-eslint/naming-convention
    pluginCreator___NODE: string
    pluginCreatorId: string
    componentPath: string
  }
  transactionId?: string
}

let hasOnCreatePage = false
let hasOnCreateNode = false

export const startPluginRunner = (): void => {
  const plugins = store.getState().flattenedPlugins
  const pluginsImplementingOnCreatePage = plugins.filter(plugin =>
    plugin.nodeAPIs.includes(`onCreatePage`)
  )
  const pluginsImplementingOnCreateNode = plugins.filter(plugin =>
    plugin.nodeAPIs.includes(`onCreateNode`)
  )

  hasOnCreatePage = pluginsImplementingOnCreatePage.length > 0
  hasOnCreateNode = pluginsImplementingOnCreateNode.length > 0

  if (hasOnCreatePage) {
    emitter.on(`CREATE_PAGE`, (action: ICreatePageAction) => {
      const page = action.payload
      apiRunnerNode(
        `onCreatePage`,
        {
          page,
          traceId: action.traceId,
          parentSpan: action.parentSpan,
          transactionId: action.transactionId,
        },
        { pluginSource: action.plugin.name, activity: action.activity }
      )
    })
  }

  // We make page nodes outside of the normal action for speed so we manually
  // call onCreateNode here for SitePage nodes.
  if (hasOnCreateNode) {
    const createNodeMiddleware = (
      action: ICreateNodeStagingAction | ICreateNodeAction
    ): void => {
      const node = action.payload
      if (node.internal.type === `SitePage`) {
        const transactionId =
          action.type === `CREATE_NODE` ? undefined : action.transactionId
        apiRunnerNode(`onCreateNode`, {
          node,
          parentSpan: action.parentSpan,
          traceTags: { nodeId: node.id, nodeType: node.internal.type },
          traceId: transactionId,
          transactionId,
          waitForCascadingActions: true,
        })
      }
    }
    emitter.on(`CREATE_NODE`, createNodeMiddleware)
    emitter.on(`CREATE_NODE_STAGING`, createNodeMiddleware)
  }
}

export const shouldRunOnCreateNode = (): boolean => hasOnCreateNode

export const shouldRunOnCreatePage = (): boolean => hasOnCreatePage
