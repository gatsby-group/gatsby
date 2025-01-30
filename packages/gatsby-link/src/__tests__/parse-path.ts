import { parsePath } from "../parse-path"

test(`it defaults to root if undefined`, () => {
  expect(parsePath()).toEqual({
    pathname: `/`,
    search: ``,
    hash: ``,
  })
})

test(`it uses passed path, if defined`, () => {
  const path = `/admin`
  expect(parsePath(path)).toEqual({
    pathname: path,
    search: ``,
    hash: ``,
  })
})

test(`it returns query string`, () => {
  const search = `?some-thing=true&other-thing=false`
  const pathname = `/admin`
  const path = `${pathname}${search}`

  expect(parsePath(path)).toEqual({
    pathname,
    search,
    hash: ``,
  })
})

test(`it returns hash`, () => {
  const hash = `#some-id`
  const pathname = `/admin`
  const path = `${pathname}${hash}`

  expect(parsePath(path)).toEqual({
    pathname,
    hash,
    search: ``,
  })
})

test(`it returns hash, search, and pathname if all defined`, () => {
  const hash = `#some-id`
  const pathname = `/admin`
  const search = `?this-thing=true&other-thing=false`
  const path = `${pathname}${search}${hash}`

  expect(parsePath(path)).toEqual({
    pathname,
    search,
    hash,
  })
})
