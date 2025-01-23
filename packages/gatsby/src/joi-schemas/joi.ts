import Joi from "joi"
import { IGatsbyConfig, IGatsbyPage, IGatsbyNode } from "../redux/types"
import {
  DEFAULT_DOCUMENT_SEARCH_PATHS,
  DEFAULT_TYPES_OUTPUT_PATH,
} from "../utils/graphql-typegen/ts-codegen"

const stripTrailingSlash = (chain: Joi.StringSchema): Joi.StringSchema =>
  chain.replace(/(\w)\/+$/, `$1`)

// only add leading slash on relative urls
const addLeadingSlash = (chain: Joi.StringSchema): Joi.StringSchema =>
  chain.when(Joi.string().uri({ relativeOnly: true }), {
    then: chain.replace(/^([^/])/, `/$1`),
  })

export const gatsbyConfigSchema: Joi.ObjectSchema<IGatsbyConfig> = Joi.object()
  .keys({
    flags: Joi.object(),
    polyfill: Joi.boolean().default(true),
    assetPrefix: stripTrailingSlash(
      Joi.string().uri({
        allowRelative: true,
      })
    ),
    pathPrefix: addLeadingSlash(
      stripTrailingSlash(
        Joi.string()
          .uri({
            allowRelative: true,
            relativeOnly: true,
          })
          .default(``)
          // removes single / value
          .allow(``)
          .replace(/^\/$/, ``)
      )
    ),
    linkPrefix: Joi.forbidden().error(
      new Error(`"linkPrefix" should be changed to "pathPrefix"`)
    ),
    siteMetadata: Joi.object({
      siteUrl: stripTrailingSlash(Joi.string()).uri(),
    }).unknown(),
    mapping: Joi.object(),
    plugins: Joi.array(),
    proxy: Joi.array()
      .items(
        Joi.object().keys({
          prefix: Joi.string().required(),
          url: Joi.string().required(),
        })
      )
      .single(),
    partytownProxiedURLs: Joi.array().items(Joi.string()),
    developMiddleware: Joi.func(),
    jsxRuntime: Joi.string().valid(`automatic`, `classic`).default(`classic`),
    jsxImportSource: Joi.string(),
    trailingSlash: Joi.string()
      .valid(`always`, `never`, `ignore`)
      .default(`always`),
    graphqlTypegen: Joi.alternatives(
      Joi.boolean(),
      Joi.object()
        .keys({
          typesOutputPath: Joi.string().default(DEFAULT_TYPES_OUTPUT_PATH),
          documentSearchPaths: Joi.array()
            .items(Joi.string())
            .default(DEFAULT_DOCUMENT_SEARCH_PATHS),
          generateOnBuild: Joi.boolean().default(false),
        })
        .unknown(false)
    )
      .default(false)
      .custom(value => {
        if (value === true) {
          return {
            typesOutputPath: DEFAULT_TYPES_OUTPUT_PATH,
            documentSearchPaths: DEFAULT_DOCUMENT_SEARCH_PATHS,
            generateOnBuild: false,
          }
        }

        return value
      }),
    headers: Joi.array()
      .items(
        Joi.object()
          .keys({
            source: Joi.string().required(),
            headers: Joi.array()
              .items(
                Joi.object()
                  .keys({
                    key: Joi.string().required(),
                    value: Joi.string().required(),
                  })
                  .required()
                  .unknown(false)
              )
              .required(),
          })
          .unknown(false)
      )
      .default([]),
    adapter: Joi.alternatives(
      Joi.boolean().valid(false),
      Joi.object()
        .keys({
          name: Joi.string().required(),
          cache: Joi.object()
            .keys({
              restore: Joi.func(),
              store: Joi.func(),
            })
            .unknown(false),
          adapt: Joi.func().required(),
          config: Joi.func(),
        })
        .unknown(false)
    ),
  })
  // throws when both assetPrefix and pathPrefix are defined
  .when(
    Joi.object({
      assetPrefix: Joi.string().uri({
        allowRelative: true,
        relativeOnly: true,
      }),
      pathPrefix: Joi.string()
        .uri({
          allowRelative: true,
          relativeOnly: true,
        })
        .default(``),
    }),
    {
      then: Joi.object({
        assetPrefix: Joi.string()
          .uri({
            allowRelative: false,
          })
          .error(
            new Error(
              `assetPrefix must be an absolute URI when used with pathPrefix`
            )
          ),
      }),
    }
  )

export const pageSchema: Joi.ObjectSchema<IGatsbyPage> = Joi.object()
  .keys({
    path: Joi.string().required(),
    matchPath: Joi.string(),
    component: Joi.string().required(),
    componentChunkName: Joi.string().required(),
    context: Joi.object(),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    pluginCreator___NODE: Joi.string(),
    pluginCreatorId: Joi.string(),
  })
  .unknown()

export const nodeSchema: Joi.ObjectSchema<IGatsbyNode> = Joi.object()
  .keys({
    id: Joi.string().required(),
    children: Joi.array().items(Joi.string(), Joi.object().forbidden()),
    parent: Joi.string().allow(null),
    fields: Joi.object(),
    internal: Joi.object()
      .keys({
        contentDigest: Joi.string().required(),
        mediaType: Joi.string(),
        type: Joi.string().required(),
        owner: Joi.string().required(),
        fieldOwners: Joi.object(),
        content: Joi.string().allow(``),
        description: Joi.string(),
        ignoreType: Joi.boolean(),
        counter: Joi.number(),
        contentFilePath: Joi.string(),
      })
      .unknown(false), // Don't allow non-standard fields
  })
  .unknown()
