import { resolve } from "@gatsbyjs/reach-router"
// Specific import to treeshake Node.js stuff
import { applyTrailingSlashOption, type TrailingSlash } from "gatsby-page-utils"
import { parsePath } from "./parse-path"
import { isLocalLink } from "./is-local-link"
import { withPrefix } from "./prefix-helpers"

declare const __TRAILING_SLASH__: TrailingSlash | undefined

const isAbsolutePath = (path: string): boolean => path?.startsWith(`/`)

const getGlobalTrailingSlash = (): TrailingSlash | undefined =>
  typeof __TRAILING_SLASH__ !== `undefined` ? __TRAILING_SLASH__ : undefined

function applyTrailingSlashOptionOnPathnameOnly(
  path: string,
  option: TrailingSlash
): string {
  const { pathname, search, hash } = parsePath(path)
  const output = applyTrailingSlashOption(pathname, option)

  return `${output}${search}${hash}`
}

function absolutify(path: string, current: string): string {
  // If it's already absolute, return as-is
  if (isAbsolutePath(path)) {
    return path
  }

  const option = getGlobalTrailingSlash()
  const absolutePath = resolve(path, current)

  if (option === `always` || option === `never`) {
    return applyTrailingSlashOptionOnPathnameOnly(absolutePath, option)
  }

  return absolutePath
}

function applyPrefix(path: string): string {
  const prefixed = withPrefix(path)
  const option = getGlobalTrailingSlash()

  if (option === `always` || option === `never`) {
    return applyTrailingSlashOptionOnPathnameOnly(prefixed, option)
  }

  return prefixed
}

export type rewriteLinkPathType = (path: string, relativeTo: string) => string

export const rewriteLinkPath: rewriteLinkPathType = (path, relativeTo) => {
  if (typeof path === `number`) {
    return path
  }
  if (!isLocalLink(path)) {
    return path
  }

  return isAbsolutePath(path) ? applyPrefix(path) : absolutify(path, relativeTo)
}
