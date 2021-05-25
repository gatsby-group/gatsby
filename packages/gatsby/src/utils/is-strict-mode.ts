const isEnabled =
  Boolean(process.env.GATSBY_EXPERIMENTAL_STRICT_MODE) &&
  process.env.GATSBY_EXPERIMENTAL_STRICT_MODE !== `false` &&
  process.env.GATSBY_EXPERIMENTAL_STRICT_MODE !== `0`

export function isStrictMode(): boolean {
  return isEnabled
}
