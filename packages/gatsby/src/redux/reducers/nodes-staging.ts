import { ActionsUnion, IGatsbyState, TransactionActionsUnion } from "../types"

function getInitialState(): IGatsbyState["nodesStaging"] {
  return { transactions: new Map() }
}

function addActionToTransaction(
  state: IGatsbyState["nodesStaging"],
  action: TransactionActionsUnion
): void {
  if (!action.transactionId) {
    return
  }

  const transaction = state.transactions.get(action.transactionId)
  if (!transaction) {
    state.transactions.set(action.transactionId, [action])
  } else {
    transaction.push(action)
  }
}

export const nodesStagingReducer = (
  state: IGatsbyState["nodesStaging"] = getInitialState(),
  action: ActionsUnion
): IGatsbyState["nodesStaging"] => {
  switch (action.type) {
    case `DELETE_CACHE`:
      return getInitialState()

    case `CREATE_NODE_STAGING`: {
      if (action.transactionId) {
        addActionToTransaction(state, action)
      }

      return state
    }

    case `DELETE_NODE_STAGING`: {
      if (action.payload && action.transactionId) {
        addActionToTransaction(state, action)
      }
      return state
    }
    case `COMMIT_STAGING_NODES`: {
      state.transactions.delete(action.payload.transactionId)
      return state
    }

    default:
      return state
  }
}
