import type { IGatsbyNode, IAddChildNodeToParentNodeAction } from "../types"
import Batcher from "../../utils/batcher"
import { store } from "../"
import { getNode } from "../../datastore"

const isTestEnv = process.env.NODE_ENV === `test`
const batchCount = isTestEnv ? 1 : 1000

type CreateParentChildLinkFn = (
  payload: {
    parent: IGatsbyNode
    child: IGatsbyNode
  },
  plugin?: string
) => IAddChildNodeToParentNodeAction

export const createParentChildLinkBatcher =
  new Batcher<CreateParentChildLinkFn>(batchCount)

createParentChildLinkBatcher.bulkCall(createCalls => {
  const nodesMap = new Map()

  // Add children to parent node(s) and dispatch.
  createCalls.forEach(call => {
    const { parent, child } = call[0]
    const parentId = parent.id

    let parentNode
    if (nodesMap.has(parentId)) {
      parentNode = nodesMap.get(parentId)
    } else {
      parentNode = getNode(parentId)

      if (!parentNode.children.includes(child.id)) {
        parentNode.children.push(child.id)
      }

      nodesMap.set(parentId, parentNode)
    }
  })

  nodesMap.forEach(parentNode => {
    const payload: IAddChildNodeToParentNodeAction = {
      type: `ADD_CHILD_NODE_TO_PARENT_NODE`,
      payload: parentNode,
    }
    store.dispatch(payload)
  })
})
