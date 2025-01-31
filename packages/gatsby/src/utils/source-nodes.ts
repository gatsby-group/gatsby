import report from "gatsby-cli/lib/reporter"
import { Span } from "opentracing"
import { sourceNodesApiRunner } from "./source-nodes-api-runner"
import { store } from "../redux"
import { getDataStore, getNode } from "../datastore"
import { actions } from "../redux/actions"
import { IGatsbyState, IGatsbyNode } from "../redux/types"
import type { GatsbyIterable } from "../datastore/common/iterable"

const { deleteNode } = actions

/**
 * Finds the name of all plugins which implement Gatsby APIs that
 * may create nodes, but which have not actually created any nodes.
 */
function discoverPluginNamesWithoutNodes(): Array<string> {
  const { typeOwners, flattenedPlugins } = store.getState()

  // Find out which plugins own already created nodes
  const pluginNamesThatCreatedNodes = new Set([
    `default-site-plugin`,
    // each plugin that owns node types created a node at some point
    ...Array.from(typeOwners.pluginsToTypes.keys()),
  ])

  return flattenedPlugins
    .filter(
      plugin =>
        // "Can generate nodes"
        plugin.nodeAPIs.includes(`sourceNodes`) &&
        // "Has not generated nodes"
        !pluginNamesThatCreatedNodes.has(plugin.name)
    )
    .map(plugin => plugin.name)
}

/**
 * Warn about plugins that should have created nodes but didn't.
 */
function warnForPluginsWithoutNodes(): void {
  const pluginNamesWithNoNodes = discoverPluginNamesWithoutNodes()

  pluginNamesWithNoNodes.map(name =>
    report.warn(
      `The ${name} plugin has generated no Gatsby nodes. Do you need it? This could also suggest the plugin is misconfigured.`
    )
  )
}

/**
 * Return the set of nodes for which its root node has not been touched
 */
function getStaleNodes(
  state: IGatsbyState,
  nodes: GatsbyIterable<IGatsbyNode>
): GatsbyIterable<IGatsbyNode> {
  return nodes.filter(node => {
    let rootNode = node
    let next: IGatsbyNode | undefined = undefined

    let whileCount = 0
    do {
      next = rootNode.parent ? getNode(rootNode.parent) : undefined
      if (next) {
        rootNode = next
      }
    } while (next && ++whileCount < 101)

    if (whileCount > 100) {
      console.log(
        `It looks like you have a node that's set its parent as itself`,
        rootNode
      )
    }

    if (state.statefulSourcePlugins.has(rootNode.internal.owner)) {
      return false
    }

    return !state.nodesTouched.has(rootNode.id)
  })
}

const GatsbyManagedStatefulNodeTypes = new Set([
  // Gatsby will create and delete SitePage nodes as pages are created and deleted.
  // Additionally this node type is not even created at the time we delete stale nodes
  // so cleanup would happen too early resulting in deleting each nodes from previous run
  // and potentially recreating all of them on `createPages` that happens later.
  `SitePage`,
])

/**
 * Find all stale nodes and delete them unless the node type has been opted out of stale node garbage collection.
 */
async function deleteStaleNodes(
  previouslyExistingNodeTypeNames: Array<string>
): Promise<void> {
  const state = store.getState()

  let deleteCount = 0

  const cleanupStaleNodesActivity =
    report.createProgress(`Clean up stale nodes`)

  cleanupStaleNodesActivity.start()

  const { typeOwners, statefulSourcePlugins } = state

  for (const typeName of previouslyExistingNodeTypeNames) {
    if (GatsbyManagedStatefulNodeTypes.has(typeName)) {
      // skip any stateful node types that are managed by Gatsby
      continue
    }

    const pluginName = typeOwners.typesToPlugins.get(typeName)

    // no need to check this type if its owner has declared its a stateful source plugin
    if (pluginName && statefulSourcePlugins.has(pluginName)) {
      continue
    }

    report.verbose(`Checking for stale ${typeName} nodes`)

    const nodes = getDataStore().iterateNodesByType(typeName)
    const staleNodes = getStaleNodes(state, nodes)

    for (const node of staleNodes) {
      store.dispatch(deleteNode(node))
      cleanupStaleNodesActivity.tick()

      if (++deleteCount % 5000) {
        // dont block event loop
        await new Promise(res => {
          setImmediate(() => {
            res(null)
          })
        })
      }
    }
  }

  cleanupStaleNodesActivity.end()
}

// exported for unit tests purposes only to allow internal module state resets
export const is = {
  initialSourceNodesOfCurrentNodeProcess: true,
}

let sourcingCount = 0
export default async ({
  webhookBody,
  pluginName,
  parentSpan,
  deferNodeMutation = false,
}: {
  webhookBody: unknown
  pluginName?: string
  parentSpan?: Span
  deferNodeMutation?: boolean
}): Promise<void> => {
  const traceId = is.initialSourceNodesOfCurrentNodeProcess
    ? `initial-sourceNodes`
    : `sourceNodes #${sourcingCount}`

  // this is persisted to cache between builds, so it will always have an up to date list of previously created types by plugin name
  const { typeOwners } = store.getState()

  const previouslyExistingNodeTypeNames: Array<string> = Array.from(
    typeOwners.typesToPlugins.keys() || []
  )

  await sourceNodesApiRunner({
    traceId,
    deferNodeMutation,
    parentSpan,
    webhookBody,
    pluginName,
  })

  await getDataStore().ready()

  // We only warn for plugins w/o nodes and delete stale nodes on the first sourceNodes call of the current process.
  if (is.initialSourceNodesOfCurrentNodeProcess) {
    is.initialSourceNodesOfCurrentNodeProcess = false

    warnForPluginsWithoutNodes()

    if (
      // if this is the very first source and no types existed before this sourceNodes run, there's no need to check for stale nodes. They wont be stale because they were just created. Only check for stale nodes in node types that never existed before.
      previouslyExistingNodeTypeNames.length > 0
    ) {
      await deleteStaleNodes(previouslyExistingNodeTypeNames)
    }
  }

  store.dispatch(actions.apiFinished({ apiName: `sourceNodes` }))

  sourcingCount += 1
}
