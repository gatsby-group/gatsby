import { isLocalLink } from "../is-local-link"

describe(`isLocalLink`, () => {
  it(`returns true on relative link`, () => {
    expect(isLocalLink(`/docs/some-doc`)).toBe(true)
  })
  it(`returns false on absolute link`, () => {
    expect(isLocalLink(`https://www.gatsbyjs.com`)).toBe(false)
  })
  it(`returns undefined if input is undefined or not a string`, () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore purposefully wrong
    expect(isLocalLink(undefined)).toBeUndefined()
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore purposefully wrong
    expect(isLocalLink(-1)).toBeUndefined()
  })
  // TODO(v5): Unskip Tests
  it.skip(`throws TypeError if input is undefined`, () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore error case
    expect(() => isLocalLink(undefined)).toThrowError(
      `Expected a \`string\`, got \`undefined\``
    )
  })
  it.skip(`throws TypeError if input is not a string`, () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore error case
    expect(() => isLocalLink(-1)).toThrowError(
      `Expected a \`string\`, got \`number\``
    )
  })
})
