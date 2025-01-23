import { Joi } from "gatsby-plugin-utils"
import path from "path"
import sitemap from "sitemap"
import { onPostBuild } from "../gatsby-node"
import { pluginOptionsSchema } from "../options-validation"

jest.mock(`sitemap`, () => {
  return {
    simpleSitemapAndIndex: jest.fn(),
  }
})

const schema = pluginOptionsSchema({ Joi })

const pathPrefix = ``

const reporter = {
  verbose: jest.fn(),
  panic: jest.fn(),
}

beforeEach(() => {
  global.__PATH_PREFIX__ = ``

  sitemap.simpleSitemapAndIndex.mockReset()
})

describe(`gatsby-plugin-sitemap Node API`, () => {
  it(`should succeed with default options`, async () => {
    const graphql = jest.fn()
    graphql.mockResolvedValue({
      data: {
        site: {
          siteMetadata: {
            siteUrl: `http://dummy.url`,
          },
        },
        allSitePage: {
          nodes: [
            {
              path: `/page-1`,
            },
            {
              path: `/page-2`,
            },
          ],
        },
      },
    })
    await onPostBuild(
      { graphql, pathPrefix, reporter },
      await schema.validateAsync({})
    )
    const { destinationDir, sourceData } =
      sitemap.simpleSitemapAndIndex.mock.calls[0][0]
    expect(destinationDir).toEqual(path.join(`public`, `/`))
    expect(sourceData).toMatchSnapshot()
  })

  it(`should accept a custom query`, async () => {
    const graphql = jest.fn()
    const siteUrl = `http://dummy.url`
    graphql.mockResolvedValue({
      data: {
        allSitePage: {
          edges: [
            {
              node: {
                path: `/page-1`,
              },
            },
            {
              node: {
                path: `/post/exclude-page`,
              },
            },
          ],
        },
      },
    })
    const customQuery = `
      {
        allSitePage {
          edges {
            node {
              path
            }
          }
        }
    }`
    const options = {
      output: `custom-folder`,
      resolveSiteUrl: () => siteUrl,
      resolvePages: data => data.allSitePage.edges.map(edge => edge.node),
      serialize: (page, { resolvePagePath }) => {
        return {
          url: resolvePagePath(page),
          changefreq: `weekly`,
          priority: 0.8,
        }
      },
      excludes: [`/post/exclude-page`],
      query: customQuery,
    }

    await onPostBuild(
      { graphql, pathPrefix, reporter },
      await schema.validateAsync(options)
    )

    const { destinationDir, sourceData } =
      sitemap.simpleSitemapAndIndex.mock.calls[0][0]

    expect(destinationDir).toEqual(path.join(`public`, `custom-folder`))
    expect(sourceData).toMatchSnapshot()
    expect(graphql).toBeCalledWith(customQuery)
  })

  it(`should include path prefix when creating index sitemap`, async () => {
    const graphql = jest.fn()
    graphql.mockResolvedValue({
      data: {
        site: {
          siteMetadata: {
            siteUrl: `http://dummy.url`,
          },
        },
        allSitePage: {
          nodes: [
            {
              path: `/page-1`,
            },
            {
              path: `/page-2`,
            },
          ],
        },
      },
    })

    const options = {
      entryLimit: 1,
    }
    const assetPrefix = `https://cdn.example.com`
    const prefix = `/test`
    await onPostBuild(
      {
        graphql,
        basePath: prefix,
        pathPrefix: `${assetPrefix}${prefix}`,
        reporter,
      },
      await schema.validateAsync(options)
    )
    const { sourceData } = sitemap.simpleSitemapAndIndex.mock.calls[0][0]
    expect(sourceData).toMatchSnapshot()
  })

  it(`should ignore path prefix for sitemap public path when creating index sitemap with ignoreSitemapPathPrefix`, async () => {
    const graphql = jest.fn()
    graphql.mockResolvedValue({
      data: {
        site: {
          siteMetadata: {
            siteUrl: `http://dummy.url`,
          },
        },
        allSitePage: {
          nodes: [
            {
              path: `/page-1`,
            },
            {
              path: `/page-2`,
            },
          ],
        },
      },
    })
    const prefix = `/test`
    const subdir = `/subdir`
    const options = {
      output: subdir,
      ignoreSitemapPathPrefix: true,
    }
    const assetPrefix = `https://cdn.example.com`
    await onPostBuild(
      {
        graphql,
        basePath: prefix,
        pathPrefix: `${assetPrefix}${prefix}`,
        reporter,
      },
      await schema.validateAsync(options)
    )
    const { publicBasePath } = sitemap.simpleSitemapAndIndex.mock.calls[0][0]
    expect(publicBasePath).toEqual(`${prefix}${subdir}`)
  })

  it(`should output modified paths to sitemap`, async () => {
    const graphql = jest.fn()
    graphql.mockResolvedValue({
      data: {
        site: {
          siteMetadata: {
            siteUrl: `http://dummy.url`,
          },
        },
        allSitePage: {
          nodes: [
            {
              path: `/page-1`,
            },
            {
              path: `/page-2`,
            },
          ],
        },
      },
    })
    const prefix = `/test`
    const subdir = `/subdir`
    const options = {
      output: subdir,
    }
    await onPostBuild(
      {
        graphql,
        basePath: prefix,
        pathPrefix: prefix,
        reporter,
      },
      await schema.validateAsync(options)
    )
    expect(sitemap.simpleSitemapAndIndex.mock.calls[0][0].publicBasePath).toBe(
      path.posix.join(prefix, subdir)
    )
    expect(sitemap.simpleSitemapAndIndex.mock.calls[0][0].destinationDir).toBe(
      path.join(`public`, subdir)
    )
  })

  it(`should output modified paths to sitemap with asset prefix`, async () => {
    const graphql = jest.fn()
    graphql.mockResolvedValue({
      data: {
        site: {
          siteMetadata: {
            siteUrl: `http://dummy.url`,
          },
        },
        allSitePage: {
          nodes: [
            {
              path: `/page-1`,
            },
            {
              path: `/page-2`,
            },
          ],
        },
      },
    })
    const prefix = `/test`
    const subdir = `/subdir`
    const options = {
      output: subdir,
    }
    const assetPrefix = `https://cdn.example.com`
    await onPostBuild(
      {
        graphql,
        basePath: prefix,
        pathPrefix: `${assetPrefix}${prefix}`,
        reporter,
      },
      await schema.validateAsync(options)
    )
    expect(sitemap.simpleSitemapAndIndex.mock.calls[0][0].publicBasePath).toBe(
      path.posix.join(assetPrefix, prefix, subdir)
    )
    expect(sitemap.simpleSitemapAndIndex.mock.calls[0][0].destinationDir).toBe(
      path.join(`public`, subdir)
    )
  })
})
