import { actions } from "../redux/actions"
import { store } from "../redux"
const { deletePage } = actions
import { isEqualWith } from "lodash"
import { IGatsbyPage } from "../redux/types"
import type { IsEqualCustomizer } from "lodash"

export function deleteUntouchedPages(
  currentPages: Map<string, IGatsbyPage>,
  timeBeforeApisRan: number,
  shouldRunCreatePagesStatefully: boolean
): Array<string> {
  const deletedPages: Array<string> = []

  // Delete pages that weren't updated when running createPages.
  currentPages.forEach(page => {
    if (
      (shouldRunCreatePagesStatefully ||
        !page.isCreatedByStatefulCreatePages) &&
      page.updatedAt < timeBeforeApisRan
    ) {
      store.dispatch(deletePage(page))
      deletedPages.push(page.path, `/page-data${page.path}`)
    }
  })
  return deletedPages
}

export function findChangedPages(
  oldPages: Map<string, IGatsbyPage>,
  currentPages: Map<string, IGatsbyPage>
): {
  changedPages: Array<string>
  deletedPages: Array<string>
} {
  const changedPages: Array<string> = []

  const compareWithoutUpdated: IsEqualCustomizer = (_left, _right, key) => {
    if ([`updatedAt`, `manifestId`].includes(key as string)) {
      return true
    } else {
      return undefined
    }
  }

  currentPages.forEach((newPage, path) => {
    const oldPage = oldPages.get(path)
    if (!oldPage || !isEqualWith(newPage, oldPage, compareWithoutUpdated)) {
      changedPages.push(path)
    }
  })
  const deletedPages: Array<string> = []
  oldPages.forEach((_page, key) => {
    if (!currentPages.has(key)) {
      deletedPages.push(key)
    }
  })

  return { changedPages, deletedPages }
}
