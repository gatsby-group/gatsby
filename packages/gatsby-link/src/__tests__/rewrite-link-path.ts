import type { TrailingSlash } from "gatsby-page-utils"

import { rewriteLinkPath, type rewriteLinkPathType } from "../rewrite-link-path"

interface ICustomNodeJsGlobal extends NodeJS.Global {
  __TRAILING_SLASH__: TrailingSlash | undefined | string
  __PATH_PREFIX__: string | undefined
}

declare const global: ICustomNodeJsGlobal

beforeEach(() => {
  global.__TRAILING_SLASH__ = ``
  global.__PATH_PREFIX__ = undefined
})

const getRewriteLinkPath = (
  option: string = `legacy`,
  pathPrefix: string | undefined = undefined
): rewriteLinkPathType => {
  global.__TRAILING_SLASH__ = option
  global.__PATH_PREFIX__ = pathPrefix
  return rewriteLinkPath
}

describe(`rewriteLinkPath`, () => {
  it(`handles always option`, () => {
    expect(getRewriteLinkPath(`always`)(`/path`, `/`)).toBe(`/path/`)
    expect(getRewriteLinkPath(`always`)(`/path/`, `/`)).toBe(`/path/`)
    expect(getRewriteLinkPath(`always`)(`#hash`, `/`)).toBe(`/#hash`)
    expect(getRewriteLinkPath(`always`)(`?query_param=hello`, `/`)).toBe(
      `/?query_param=hello`
    )
    expect(getRewriteLinkPath(`always`)(`?query_param=hello#anchor`, `/`)).toBe(
      `/?query_param=hello#anchor`
    )
    expect(getRewriteLinkPath(`always`)(`/path#hash`, `/`)).toBe(`/path/#hash`)
    expect(getRewriteLinkPath(`always`)(`/path?query_param=hello`, `/`)).toBe(
      `/path/?query_param=hello`
    )
    expect(
      getRewriteLinkPath(`always`)(`/path?query_param=hello#anchor`, `/`)
    ).toBe(`/path/?query_param=hello#anchor`)
    expect(getRewriteLinkPath(`always`, `/prefix`)(`/`, `/`)).toBe(`/prefix/`)
  })
  it(`handles never option`, () => {
    expect(getRewriteLinkPath(`never`)(`/path`, `/`)).toBe(`/path`)
    expect(getRewriteLinkPath(`never`)(`/path/`, `/`)).toBe(`/path`)
    expect(getRewriteLinkPath(`always`)(`#hash`, `/`)).toBe(`/#hash`)
    expect(getRewriteLinkPath(`always`)(`?query_param=hello`, `/`)).toBe(
      `/?query_param=hello`
    )
    expect(getRewriteLinkPath(`always`)(`?query_param=hello#anchor`, `/`)).toBe(
      `/?query_param=hello#anchor`
    )
    expect(getRewriteLinkPath(`never`)(`/path/#hash`, `/`)).toBe(`/path#hash`)
    expect(getRewriteLinkPath(`never`)(`/path/?query_param=hello`, `/`)).toBe(
      `/path?query_param=hello`
    )
    expect(
      getRewriteLinkPath(`never`)(`/path/?query_param=hello#anchor`, `/`)
    ).toBe(`/path?query_param=hello#anchor`)
    expect(getRewriteLinkPath(`never`, `/prefix`)(`/`, `/`)).toBe(`/prefix`)
  })
  it(`handles ignore option`, () => {
    expect(getRewriteLinkPath(`ignore`)(`/path`, `/`)).toBe(`/path`)
    expect(getRewriteLinkPath(`ignore`)(`/path/`, `/`)).toBe(`/path/`)
    expect(getRewriteLinkPath(`always`)(`#hash`, `/`)).toBe(`/#hash`)
    expect(getRewriteLinkPath(`always`)(`?query_param=hello`, `/`)).toBe(
      `/?query_param=hello`
    )
    expect(getRewriteLinkPath(`always`)(`?query_param=hello#anchor`, `/`)).toBe(
      `/?query_param=hello#anchor`
    )
    expect(getRewriteLinkPath(`ignore`)(`/path#hash`, `/`)).toBe(`/path#hash`)
    expect(getRewriteLinkPath(`ignore`)(`/path?query_param=hello`, `/`)).toBe(
      `/path?query_param=hello`
    )
    expect(
      getRewriteLinkPath(`ignore`)(`/path?query_param=hello#anchor`, `/`)
    ).toBe(`/path?query_param=hello#anchor`)
    expect(getRewriteLinkPath(`ignore`, `/prefix`)(`/`, `/`)).toBe(`/prefix/`)
  })
})
