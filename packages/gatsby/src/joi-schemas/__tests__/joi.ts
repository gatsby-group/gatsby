import { gatsbyConfigSchema, nodeSchema } from "../joi"

describe(`gatsby config`, () => {
  it(`returns empty pathPrefix when not set`, () => {
    const config = {}

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        pathPrefix: ``,
      })
    )
  })

  it(`throws when linkPrefix is set`, () => {
    const config = {
      linkPrefix: `/blog/`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.error).toMatchInlineSnapshot(
      `[Error: "linkPrefix" should be changed to "pathPrefix"]`
    )
  })

  it(`strips trailing slashes from url fields`, () => {
    const config = {
      pathPrefix: `/blog///`,
      assetPrefix: `https://cdn.example.com/`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        pathPrefix: `/blog`,
        assetPrefix: `https://cdn.example.com`,
      })
    )
  })

  it(`allows assetPrefix to be full URL`, () => {
    const config = {
      assetPrefix: `https://cdn.example.com/`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        assetPrefix: `https://cdn.example.com`,
      })
    )
  })

  it(`allows assetPrefix to be a URL with nested paths`, () => {
    const config = {
      assetPrefix: `https://cdn.example.com/some/nested/path`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(expect.objectContaining(config))
  })

  it(`allows relative paths for url fields`, () => {
    const config = {
      pathPrefix: `/blog`,
      assetPrefix: `https://cdn.example.com`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(expect.objectContaining(config))
  })

  it(`strips trailing slash and add leading slash to pathPrefix`, () => {
    const config = {
      pathPrefix: `blog/`,
      assetPrefix: `https://cdn.example.com/`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        pathPrefix: `/blog`,
        assetPrefix: `https://cdn.example.com`,
      })
    )
  })

  it(`does not allow pathPrefix to be full URL`, () => {
    const config = {
      pathPrefix: `https://google.com`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.error).toMatchInlineSnapshot(
      `[ValidationError: "pathPrefix" must be a valid relative uri]`
    )
  })

  it(`throws when relative path used for both assetPrefix and pathPrefix`, () => {
    const config = {
      assetPrefix: `/assets`,
      pathPrefix: `/blog`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.error).toMatchInlineSnapshot(
      `[Error: assetPrefix must be an absolute URI when used with pathPrefix]`
    )
  })

  it(`returns "always" for trailingSlash when not set`, () => {
    const config = {}

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        trailingSlash: `always`,
      })
    )
  })

  it(`throws when trailingSlash is not valid string`, () => {
    const config = {
      trailingSlash: `arrakis`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.error).toMatchInlineSnapshot(
      `[ValidationError: "trailingSlash" must be one of [always, never, ignore]]`
    )
  })

  it(`throws when trailingSlash is not a string`, () => {
    const config = {
      trailingSlash: true,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.error).toMatchInlineSnapshot(
      `[ValidationError: "trailingSlash" must be one of [always, never, ignore]]`
    )
  })

  it(`return false for graphqlTypegen when not set`, () => {
    const config = {}

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        graphqlTypegen: false,
      })
    )
  })

  it(`throws when graphqlTypegen is not valid option`, () => {
    const config = {
      graphqlTypegen: `foo-bar`,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.error).toMatchInlineSnapshot(
      `[ValidationError: "graphqlTypegen" must be one of [boolean, object]]`
    )
  })

  it(`throws when graphqlTypegen has invalid keys`, () => {
    const config = {
      graphqlTypegen: {
        invalid: true,
      },
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.error).toMatchInlineSnapshot(
      `[ValidationError: "graphqlTypegen.invalid" is not allowed]`
    )
  })

  it(`return defaults for graphqlTypegen when empty object is set`, () => {
    const config = {
      graphqlTypegen: {},
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        graphqlTypegen: {
          typesOutputPath: `src/gatsby-types.d.ts`,
          documentSearchPaths: [
            `./gatsby-node.ts`,
            `./plugins/**/gatsby-node.ts`,
          ],
          generateOnBuild: false,
        },
      })
    )
  })

  it(`return defaults for graphqlTypegen when true is set`, () => {
    const config = {
      graphqlTypegen: true,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        graphqlTypegen: {
          typesOutputPath: `src/gatsby-types.d.ts`,
          documentSearchPaths: [
            `./gatsby-node.ts`,
            `./plugins/**/gatsby-node.ts`,
          ],
          generateOnBuild: false,
        },
      })
    )
  })

  it(`graphqlTypegen config object can be overwritten`, () => {
    const config = {
      graphqlTypegen: {
        typesOutputPath: `gatsby-types.d.ts`,
        documentSearchPaths: [
          `./gatsby-node.ts`,
          `./plugins/**/gatsby-node.ts`,
          `./src/gatsby/generatePage.ts`,
        ],
      },
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        graphqlTypegen: {
          typesOutputPath: `gatsby-types.d.ts`,
          documentSearchPaths: [
            `./gatsby-node.ts`,
            `./plugins/**/gatsby-node.ts`,
            `./src/gatsby/generatePage.ts`,
          ],
          generateOnBuild: false,
        },
      })
    )
  })

  it(`returns partial defaults for graphqlTypegen when partial options object is set`, () => {
    const config = {
      graphqlTypegen: {
        generateOnBuild: true,
      },
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value).toEqual(
      expect.objectContaining({
        graphqlTypegen: {
          typesOutputPath: `src/gatsby-types.d.ts`,
          documentSearchPaths: [
            `./gatsby-node.ts`,
            `./plugins/**/gatsby-node.ts`,
          ],
          generateOnBuild: true,
        },
      })
    )
  })

  it(`returns empty array when headers are not set`, () => {
    const config = {}

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value?.headers).toEqual([])
  })

  it(`lets you create custom HTTP headers for a path`, () => {
    const config = {
      headers: [
        {
          source: `*`,
          headers: [
            {
              key: `x-custom-header`,
              value: `some value`,
            },
          ],
        },
      ],
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value?.headers).toEqual(config.headers)
  })

  it(`throws on incorrect headers definitions`, () => {
    const configOne = {
      headers: {
        source: `*`,
        headers: [
          {
            key: `x-custom-header`,
            value: `some value`,
          },
        ],
      },
    }

    const resultOne = gatsbyConfigSchema.validate(configOne)
    expect(resultOne.error).toMatchInlineSnapshot(
      `[ValidationError: "headers" must be an array]`
    )

    const configTwo = {
      headers: [
        {
          source: `*`,
          headers: {
            key: `x-custom-header`,
            value: `some value`,
          },
        },
      ],
    }

    const resultTwo = gatsbyConfigSchema.validate(configTwo)
    expect(resultTwo.error).toMatchInlineSnapshot(
      `[ValidationError: "headers[0].headers" must be an array]`
    )
  })

  it(`lets you add an adapter`, () => {
    const config = {
      adapter: {
        name: `gatsby-adapter-name`,
        cache: {
          restore: (): Promise<void> => Promise.resolve(),
          store: (): Promise<void> => Promise.resolve(),
        },
        adapt: (): Promise<void> => Promise.resolve(),
      },
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.value?.adapter).toEqual(config.adapter)
  })

  it(`lets you disable adapters`, () => {
    const config = {
      adapter: false,
    }

    const result = gatsbyConfigSchema.validate(config)
    expect(result.error).toBeNil()
    expect(result.value?.adapter).toEqual(config.adapter)
  })

  it(`throws on incorrect adapter setting`, () => {
    const configOne = {
      adapter: `gatsby-adapter-name`,
    }

    const resultOne = gatsbyConfigSchema.validate(configOne)
    expect(resultOne.error).toMatchInlineSnapshot(
      `[ValidationError: "adapter" must be one of [false, object]]`
    )

    const configTwo = {
      adapter: {
        name: `gatsby-adapter-name`,
      },
    }

    const resultTwo = gatsbyConfigSchema.validate(configTwo)
    expect(resultTwo.error).toMatchInlineSnapshot(
      `[ValidationError: "adapter.adapt" is required]`
    )

    const configThree = {
      adapter: true,
    }

    const resultThree = gatsbyConfigSchema.validate(configThree)
    expect(resultThree.error).toMatchInlineSnapshot(
      `[ValidationError: "adapter" must be one of [false, object]]`
    )
  })
})

describe(`node schema`, () => {
  it(`allows correct nodes`, () => {
    const node = {
      id: `foo`,
      internal: {
        type: `Type`,
        contentDigest: `bar`,

        // this is added by gatsby
        owner: `gatsby-source-foo`,
      },
    }

    const { error } = nodeSchema.validate(node)
    expect(error).toBeFalsy()
  })

  it(`force id type`, () => {
    const node = {
      id: 5,
      internal: {
        type: `Type`,
        contentDigest: `bar`,

        // this is added by gatsby
        owner: `gatsby-source-foo`,
      },
    }

    const { error } = nodeSchema.validate(node)
    expect(error).toBeTruthy()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(error!.message).toMatchInlineSnapshot(`"\\"id\\" must be a string"`)
  })

  it(`doesn't allow unknown internal fields`, () => {
    const node = {
      id: `foo`,
      internal: {
        type: `Type`,
        contentDigest: `bar`,

        customField: `this should cause failure`,

        // this is added by gatsby
        owner: `gatsby-source-foo`,
      },
    }

    const { error } = nodeSchema.validate(node)
    expect(error).toBeTruthy()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(error!.message).toMatchInlineSnapshot(
      `"\\"internal.customField\\" is not allowed"`
    )
  })
})
