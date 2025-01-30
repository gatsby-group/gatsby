// Copied from https://github.com/sindresorhus/is-absolute-url/blob/3ab19cc2e599a03ea691bcb8a4c09fa3ebb5da4f/index.js
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/
const isAbsolute = (path: string): boolean => ABSOLUTE_URL_REGEX.test(path)

export const isLocalLink = (path: string): boolean | undefined => {
  if (typeof path !== `string`) {
    return undefined
    // TODO(v5): Re-Add TypeError
    // throw new TypeError(`Expected a \`string\`, got \`${typeof path}\``)
  }

  return !isAbsolute(path)
}
