import { Path } from "history"

export function parsePath(path?: string): Path {
  let pathname = path || `/`
  let search = ``
  let hash = ``

  const hashIndex = pathname.indexOf(`#`)
  if (hashIndex !== -1) {
    hash = pathname.slice(hashIndex)
    pathname = pathname.slice(0, hashIndex)
  }

  const searchIndex = pathname.indexOf(`?`)
  if (searchIndex !== -1) {
    search = pathname.slice(searchIndex)
    pathname = pathname.slice(0, searchIndex)
  }

  return {
    pathname: pathname,
    search: search === `?` ? `` : search,
    hash: hash === `#` ? `` : hash,
  }
}
