const { onRenderBody } = require(`../gatsby-ssr`)

describe(`gatsby-plugin-canonical-urls`, () => {
  it(`creates a canonical link if siteUrl is set`, async () => {
    const pluginOptions = {
      siteUrl: `http://someurl.com`,
    }
    const setHeadComponents = jest.fn()
    const pathname = `/somepost`

    await onRenderBody(
      {
        setHeadComponents,
        pathname,
      },
      pluginOptions
    )

    expect(setHeadComponents).toMatchSnapshot()
    expect(setHeadComponents).toHaveBeenCalledTimes(1)
  })

  it(`strips a trailing slash on the siteUrl and leaves search parameters`, async () => {
    const pluginOptions = {
      siteUrl: `http://someurl.com/`,
    }
    const setHeadComponents = jest.fn()
    const pathname = `/somepost?tag=foobar`

    await onRenderBody(
      {
        setHeadComponents,
        pathname,
      },
      pluginOptions
    )

    expect(setHeadComponents).toMatchSnapshot()
    expect(setHeadComponents).toHaveBeenCalledTimes(1)
  })

  it(`strips search parameters if option stripQueryString is true`, async () => {
    const pluginOptions = {
      siteUrl: `http://someurl.com`,
      stripQueryString: true,
    }
    const setHeadComponents = jest.fn()
    const pathname = `/somepost?tag=foobar`

    await onRenderBody(
      {
        setHeadComponents,
        pathname,
      },
      pluginOptions
    )

    expect(setHeadComponents).toMatchSnapshot()
    expect(setHeadComponents).toHaveBeenCalledTimes(1)
  })

  it(`does not create a canonical link if siteUrl is not set`, async () => {
    const pluginOptions = {}
    const setHeadComponents = jest.fn()
    const pathname = `/somepost`

    await onRenderBody(
      {
        setHeadComponents,
        pathname,
      },
      pluginOptions
    )

    expect(setHeadComponents).toMatchSnapshot()
    expect(setHeadComponents).toHaveBeenCalledTimes(0)
  })

  it(`does not create a canonical link if siteUrl is set but path is excluded`, async () => {
    const pluginOptions = {
      siteUrl: `http://someurl.com`,
      excludes: [`/somepost`, `/excluded-page-two`],
    }
    const setHeadComponents = jest.fn()
    const pathname = `/somepost`

    await onRenderBody(
      {
        setHeadComponents,
        pathname,
      },
      pluginOptions
    )

    expect(setHeadComponents).toMatchSnapshot()
    expect(setHeadComponents).toHaveBeenCalledTimes(0)
  })
})
