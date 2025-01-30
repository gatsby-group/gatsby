/**
 * @jest-environment jsdom
 */

import React from "react"
import { render, cleanup } from "@testing-library/react"
import {
  createMemorySource,
  createHistory,
  LocationProvider,
  NavigateOptions,
} from "@reach/router"
import { Link, navigate, withPrefix, withAssetPrefix } from "../"

type IntersectionObserverType = jest.Mock<
  {
    observe: (ref: Record<string, unknown>) => void
    unobserve: (ref: Record<string, unknown>) => void
    disconnect: () => void
    trigger: (ref: Record<string, unknown>) => void
  },
  [cb: any]
>

interface ICustomNodeJsGlobal extends NodeJS.Global {
  __BASE_PATH__: string | undefined
  __PATH_PREFIX__: string | undefined
  ___navigate: (
    to: string,
    options?: NavigateOptions<Record<string, unknown>>
  ) => void
  ___loader: {
    enqueue: (arg0: string) => Record<string, unknown>
    hovering?: (arg0: string) => Record<string, unknown>
  }
  IntersectionObserver: IntersectionObserverType
}

declare const global: ICustomNodeJsGlobal

beforeEach(() => {
  global.__BASE_PATH__ = ``
  global.__PATH_PREFIX__ = ``
})

afterEach(cleanup)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getWithPrefix = (pathPrefix = ``) => {
  global.__BASE_PATH__ = pathPrefix
  return withPrefix
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getInstance = (props, pathPrefix = ``) => {
  getWithPrefix()(pathPrefix)
  return <Link {...props} />
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getNavigate = () => {
  global.___navigate = jest.fn()
  return navigate
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getWithAssetPrefix = (prefix = ``) => {
  global.__PATH_PREFIX__ = prefix
  return withAssetPrefix
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const setup = ({ sourcePath = `/`, pathPrefix = ``, linkProps = {} } = {}) => {
  const intersectionInstances = new WeakMap()
  // mock intersectionObserver
  global.IntersectionObserver = jest.fn(cb => {
    const instance = {
      observe: (ref: Record<string, unknown>): void => {
        intersectionInstances.set(ref, instance)
      },
      unobserve: (ref: Record<string, unknown>): void => {
        intersectionInstances.delete(ref)
      },
      disconnect: (): void => {},
      trigger: (ref: Record<string, unknown>): void => {
        cb([
          {
            target: ref,
            isIntersecting: true,
          },
        ])
      },
    }

    return instance
  })

  global.__BASE_PATH__ = pathPrefix
  const source = createMemorySource(sourcePath)
  const history = createHistory(source)

  const utils = render(
    <LocationProvider history={history}>
      <Link
        {...linkProps}
        to="/"
        className="link"
        style={{ color: `black` }}
        activeClassName="is-active"
        activeStyle={{ textDecoration: `underline` }}
      >
        link
      </Link>
    </LocationProvider>
  )

  return Object.assign({}, utils, {
    link: utils.getByText(`link`),
    triggerInViewport: ref => {
      intersectionInstances.get(ref).trigger(ref)
    },
  })
}

describe(`<Link />`, () => {
  it(`matches basic snapshot`, () => {
    const { container } = setup({
      linkProps: { to: `/active` },
    })
    expect(container).toMatchSnapshot()
  })

  it(`matches active snapshot`, () => {
    const { container } = setup({
      sourcePath: `/active`,
      linkProps: { to: `/active` },
    })
    expect(container).toMatchSnapshot()
  })

  it(`matches partially active snapshot`, () => {
    const { container } = setup({
      sourcePath: `/active`,
      linkProps: { to: `/active/nested`, partiallyActive: true },
    })
    expect(container).toMatchSnapshot()
  })

  it(`does not fail to initialize without --prefix-paths`, () => {
    expect(() => {
      getInstance({})
    }).not.toThrow()
  })

  it(`does not fail with missing __BASE_PATH__`, () => {
    delete global.__PATH_PREFIX__
    delete global.__BASE_PATH__

    const source = createMemorySource(`/active`)

    expect(() =>
      render(
        <LocationProvider history={createHistory(source)}>
          <Link
            to="/"
            className="link"
            style={{ color: `black` }}
            activeClassName="is-active"
            activeStyle={{ textDecoration: `underline` }}
          >
            link
          </Link>
        </LocationProvider>
      )
    ).not.toThrow()
  })

  describe(`the location to link to`, () => {
    global.___loader = {
      enqueue: jest.fn(),
    }

    it(`accepts to as a string`, () => {
      const location = `/courses?sort=name`
      const { link } = setup({ linkProps: { to: location } })
      expect(link.getAttribute(`href`)).toEqual(location)
    })

    it(`includes the pathPrefix`, () => {
      const pathPrefix = `/prefixed`
      const location = `/courses?sort=name`
      const { link } = setup({ linkProps: { to: location }, pathPrefix })
      expect(link.getAttribute(`href`)).toEqual(`${pathPrefix}${location}`)
    })

    it(`correctly handles pathPrefix with trailing slash`, () => {
      const pathPrefix = `/prefixed/`
      const location = `/courses?sort=name`
      const { link } = setup({ linkProps: { to: location }, pathPrefix })
      expect(link.getAttribute(`href`)).toEqual(`/prefixed${location}`)
    })

    it(`ignores pathPrefix for external links`, () => {
      const pathPrefix = `/prefixed/`
      const location = `https://example.com`
      const { link } = setup({ linkProps: { to: location }, pathPrefix })
      expect(link.getAttribute(`href`)).toEqual(location)
    })

    it(`handles relative link with "./"`, () => {
      const location = `./courses?sort=name`
      const { link } = setup({
        sourcePath: `/active`,
        linkProps: { to: location },
      })
      expect(link.getAttribute(`href`)).toEqual(`/active/courses?sort=name`)
    })

    it(`handles relative link with "../"`, () => {
      const location = `../courses?sort=name`
      const { link } = setup({
        sourcePath: `/active`,
        linkProps: { to: location },
      })
      expect(link.getAttribute(`href`)).toEqual(`/courses?sort=name`)
    })

    it(`handles bare relative link`, () => {
      const location = `courses?sort=name`
      const { link } = setup({
        sourcePath: `/active`,
        linkProps: { to: location },
      })
      expect(link.getAttribute(`href`)).toEqual(`/active/courses?sort=name`)
    })

    it(`handles relative link with pathPrefix`, () => {
      const pathPrefix = `/prefixed`
      const sourcePath = `/prefixed/active/`
      const location = `./courses?sort=name`
      const { link } = setup({
        linkProps: { to: location },
        pathPrefix,
        sourcePath,
      })
      expect(link.getAttribute(`href`)).toEqual(
        `${pathPrefix}/active/courses?sort=name`
      )
    })

    it(`does not warn when internal`, () => {
      jest.spyOn(global.console, `warn`)
      const to = `/courses?sort=name`
      setup({ linkProps: { to } })
      expect(console.warn).not.toBeCalled()
    })

    it(`does not warn when relative`, () => {
      jest.spyOn(global.console, `warn`)
      const to = `./courses?sort=name`
      setup({ linkProps: { to } })
      expect(console.warn).not.toBeCalled()
    })

    it(`warns when not internal`, () => {
      jest.spyOn(global.console, `warn`)
      const to = `https://gatsby.org`
      setup({ linkProps: { to } })
      expect(console.warn).toBeCalled()
    })
  })

  describe(`uses push or replace adequately`, () => {
    it(`respects force disabling replace`, () => {
      const to = `/`
      getNavigate()
      const { link } = setup({ linkProps: { to, replace: false } })
      link.click()

      expect(global.___navigate).toHaveBeenCalledWith(
        `${global.__BASE_PATH__}${to}`,
        { replace: false }
      )
    })

    it(`respects force enabling replace`, () => {
      const to = `/courses`
      getNavigate()
      const { link } = setup({ linkProps: { to, replace: true } })
      link.click()

      expect(global.___navigate).toHaveBeenCalledWith(
        `${global.__BASE_PATH__}${to}`,
        { replace: true }
      )
    })

    it(`does not replace history when navigating away`, () => {
      const to = `/courses`
      getNavigate()
      const { link } = setup({ linkProps: { to } })
      link.click()

      expect(global.___navigate).toHaveBeenCalledWith(
        `${global.__BASE_PATH__}${to}`,
        {}
      )
    })

    it(`does replace history when navigating on the same page`, () => {
      const to = `/`
      getNavigate()
      const { link } = setup({ linkProps: { to } })
      link.click()

      expect(global.___navigate).toHaveBeenCalledWith(
        `${global.__BASE_PATH__}${to}`,
        { replace: true }
      )
    })
  })
})

describe(`withPrefix`, () => {
  describe(`works with default prefix`, () => {
    it(`default prefix does not return "//"`, () => {
      const to = `/`
      const root = getWithPrefix()(to)
      expect(root).toEqual(to)
    })

    it(`respects path prefix`, () => {
      const to = `/abc/`
      const pathPrefix = `/blog`
      const root = getWithPrefix(pathPrefix)(to)
      expect(root).toEqual(`${pathPrefix}${to}`)
    })

    it(`falls back to __PATH_PREFIX__ if __BASE_PATH__ is undefined`, () => {
      global.__BASE_PATH__ = undefined
      global.__PATH_PREFIX__ = `/blog`

      const to = `/abc/`

      expect(withPrefix(to)).toBe(`${global.__PATH_PREFIX__}${to}`)
    })
  })
})

describe(`withAssetPrefix`, () => {
  it(`default prefix does not return "//"`, () => {
    const to = `/`
    const root = getWithAssetPrefix()(to)
    expect(root).toEqual(to)
  })

  it(`respects pathPrefix`, () => {
    const to = `/abc/`
    const pathPrefix = `/blog`
    const root = getWithAssetPrefix(pathPrefix)(to)
    expect(root).toEqual(`${pathPrefix}${to}`)
  })

  it(`respects joined assetPrefix + pathPrefix`, () => {
    const to = `/itsdatboi/`
    const pathPrefix = `https://cdn.example.com/blog`
    const root = getWithAssetPrefix(pathPrefix)(to)
    expect(root).toEqual(`${pathPrefix}${to}`)
  })
})

describe(`navigate`, () => {
  it(`navigates to correct path`, () => {
    const to = `/some-path`
    getNavigate()(to)

    expect(global.___navigate).toHaveBeenCalledWith(to, undefined)
  })

  it(`respects pathPrefix`, () => {
    const to = `/some-path`
    global.__BASE_PATH__ = `/blog`
    getNavigate()(to)

    expect(global.___navigate).toHaveBeenCalledWith(
      `${global.__BASE_PATH__}${to}`,
      undefined
    )
  })

  it(`passes a state object`, () => {
    const to = `/some-path`
    const options = { state: { myStateKey: `a state value` } }

    getNavigate()(to, options)

    expect(global.___navigate).toHaveBeenCalledWith(
      `${global.__BASE_PATH__}${to}`,
      options
    )
  })
})

describe(`ref forwarding`, () => {
  it(`forwards ref`, () => {
    const ref = jest.fn()
    setup({ linkProps: { ref } })

    expect(ref).toHaveBeenCalledTimes(1)
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLElement))
  })

  it(`remains backwards compatible with innerRef`, () => {
    const innerRef = jest.fn()
    setup({ linkProps: { innerRef } })

    expect(innerRef).toHaveBeenCalledTimes(1)
    expect(innerRef).toHaveBeenCalledWith(expect.any(HTMLElement))
  })

  it(`handles a RefObject (React >=16.4)`, () => {
    const ref = React.createRef()
    setup({ linkProps: { ref } })

    expect(ref.current).toEqual(expect.any(HTMLElement))
  })
})

describe(`state`, () => {
  it(`passes a state object`, () => {
    const to = `/`
    const state = { myStateKey: `a state value` }
    getNavigate()

    const { link } = setup({ linkProps: { state } })
    link.click()

    expect(global.___navigate).toHaveBeenCalledWith(
      `${global.__BASE_PATH__}${to}`,
      {
        replace: true,
        state,
      }
    )
  })
})

describe(`prefetch`, () => {
  beforeEach(() => {
    global.___loader = {
      enqueue: jest.fn(),
    }
  })

  it(`it prefetches when in viewport`, () => {
    const to = `/active`

    const { link, triggerInViewport } = setup({
      linkProps: { to },
    })

    triggerInViewport(link)

    expect(global.___loader.enqueue).toHaveBeenCalledWith(
      `${global.__BASE_PATH__}${to}`
    )
  })

  it(`it does not prefetch if link is current page`, () => {
    const to = `/active`

    const { link, triggerInViewport } = setup({
      sourcePath: `/active`,
      linkProps: { to },
    })

    triggerInViewport(link)

    expect(global.___loader.enqueue).not.toHaveBeenCalledWith(
      `${global.__BASE_PATH__}${to}`
    )
  })
})
