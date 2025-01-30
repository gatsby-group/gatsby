import { isLocalLink } from "./is-local-link"

declare const __BASE_PATH__: string
declare const __PATH_PREFIX__: string

export const getGlobalBasePrefix = (): string | undefined =>
  process.env.NODE_ENV !== `production`
    ? typeof __BASE_PATH__ !== `undefined`
      ? __BASE_PATH__
      : undefined
    : __BASE_PATH__

// These global values are wrapped in typeof clauses to ensure the values exist.
// This is especially problematic in unit testing of this component.
export const getGlobalPathPrefix = (): string | undefined =>
  process.env.NODE_ENV !== `production`
    ? typeof __PATH_PREFIX__ !== `undefined`
      ? __PATH_PREFIX__
      : undefined
    : __PATH_PREFIX__

export function withPrefix(
  path: string,
  prefix = getGlobalBasePrefix()
): string {
  if (!isLocalLink(path)) {
    return path
  }

  if (path.startsWith(`./`) || path.startsWith(`../`)) {
    return path
  }
  const base = prefix ?? getGlobalPathPrefix() ?? `/`

  return `${base?.endsWith(`/`) ? base.slice(0, -1) : base}${
    path.startsWith(`/`) ? path : `/${path}`
  }`
}
