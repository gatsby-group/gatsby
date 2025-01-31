import { ActionsUnion } from "../types"
import { internalCreateNodeWithoutValidation } from "./internal"
import { actions as publicActions } from "./public"
import { getNode } from "../../datastore"

import { store } from "../index"

export const commitStagingNodes = (
  transactionId: string
): Array<ActionsUnion> => {
  const transaction = store
    .getState()
    .nodesStaging.transactions.get(transactionId)
  if (!transaction) {
    return []
  }

  const actions: Array<ActionsUnion> = [
    {
      type: `COMMIT_STAGING_NODES`,
      payload: {
        transactionId,
      },
    },
  ]

  const nodesState = new Map()
  for (const action of transaction) {
    if (action.type === `CREATE_NODE_STAGING`) {
      nodesState.set(action.payload.id, action)
    } else if (action.type === `DELETE_NODE_STAGING` && action.payload?.id) {
      nodesState.set(action.payload.id, undefined)
    }
  }
  for (const [id, actionOrDelete] of nodesState.entries()) {
    if (actionOrDelete) {
      actions.push(
        ...internalCreateNodeWithoutValidation(
          actionOrDelete.payload,
          actionOrDelete.plugin,
          actionOrDelete
        )
      )
    } else {
      // delete case
      actions.push(publicActions.deleteNode(getNode(id)))
    }
  }

  return actions
}
