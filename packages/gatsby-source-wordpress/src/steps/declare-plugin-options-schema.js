/**
 * This file is intentionally not TS so it can be run in a yarn script without being transpiled.
 */
const prettier = require(`prettier`)

const wrapOptions = innerOptions =>
  prettier
    .format(
      `const something = {
  resolve: \`gatsby-source-wordpress\`, options: {
    ${innerOptions.trim()}
  },
}`,
      { parser: `babel` }
    )
    .replace(`const something = `, ``)
    .replace(`;`, ``)

const hasImageCDN =
  process.env.GATSBY_CLOUD_IMAGE_CDN === `1` ||
  process.env.GATSBY_CLOUD_IMAGE_CDN === `true`

const pluginOptionsSchema = ({ Joi }) => {
  const getTypeOptions = () =>
    Joi.object({
      where: Joi.string()
        .allow(null)
        .allow(false)
        .meta({
          example: wrapOptions(`
              type: {
                Page: {
                  where: \`language: \${process.env.GATSBY_ACTIVE_LANGUAGE}\`
                },
              }
            `),
        })
        .description(
          `This string is passed as the WPGraphQL "where" arguments in the GraphQL queries that are made while initially sourcing all data from WPGraphQL into Gatsby during an uncached build. A common use-case for this is only fetching posts of a specific language. It's often used in conjunction with the beforeChangeNode type option as "where" only affects the initial data sync from WP to Gatsby while beforeChangeNode will also run when syncing individual updates from WP to Gatsby.`
        ),
      exclude: Joi.boolean()
        .allow(null)
        .description(
          `Completely excludes a type from node sourcing and from the ingested schema.`
        )
        .meta({
          example: wrapOptions(`
              type: {
                Page: {
                  exclude: true,
                },
              },
            `),
        }),
      limit: Joi.number()
        .integer()
        .allow(null)
        .allow(false)
        .description(
          `The maximum amount of objects of this type to fetch from WordPress.`
        ),
      excludeFieldNames: Joi.array()
        .items(Joi.string())
        .allow(null)
        .allow(false)
        .description(`Excludes fields on a type by field name.`)
        .meta({
          example: wrapOptions(`
            type: {
              Page: {
                excludeFieldNames: [\`dateGmt\`, \`parent\`],
              },
            },
          `),
        }),
      nodeInterface: Joi.boolean()
        .allow(null)
        .allow(false)
        .description(
          `Determines whether or not this type will be treated as an interface comprised entirely of other Gatsby node types.`
        )
        .meta({
          example: wrapOptions(`
              type: {
                Page: {
                  nodeInterface: true
                }
              }
            `),
        }),
      beforeChangeNode: Joi.any()
        .allow(null)
        .allow(false)
        .meta({
          trueType: `string|function`,
        })
        .description(
          `A function which is invoked before a node is created, updated, or deleted. This is a hook in point to modify the node or perform side-effects related to it. This option should be a path to a JS file where the default export is the beforeChangeNode function. The path can be relative to your gatsby-node.js or absolute. Currently you can inline a function by writing it out directly in this option but starting from Gatsby v4 only a path to a function file will work.`
        ),
    })

  const joiSchema = Joi.object({
    verbose: Joi.boolean()
      .default(true)
      .description(
        `Enables verbose logging in the terminal. Set to \`false\` to turn it off.`
      )
      .meta({
        example: wrapOptions(`
        verbose: true,`),
      }),
    debug: Joi.object({
      preview: Joi.boolean()
        .default(false)
        .description(
          `When set to true, this option will display additional information in the terminal output about the running preview process.`
        )
        .meta({
          example: wrapOptions(`
            debug: {
              preview: true
            },
          `),
        }),
      timeBuildSteps: Joi.boolean()
        .default(false)
        .description(
          `When set to true, this option will display how long each internal step took during the build process.`
        )
        .meta({
          example: wrapOptions(`
              debug: {
                timeBuildSteps: true,
              },
            `),
        }),
      disableCompatibilityCheck: Joi.boolean()
        .default(false)
        .description(
          `This option disables the compatibility API check against the remote WPGraphQL and WPGatsby plugin versions. Note that it's highly recommended to not disable this setting. If you disable this setting you will receive no support until it's re-enabled. It's also highly likely that you'll run into major bugs without initially realizing that this was the cause.\n\nThis option should only be used for debugging.`
        )
        .meta({
          example: wrapOptions(`
              debug: {
                disableCompatibilityCheck: true,
              },
            `),
        }),
      throwRefetchErrors: Joi.boolean()
        .default(false)
        .description(
          `When this is set to true, errors thrown while updating data in gatsby develop will fail the build process instead of automatically attempting to recover.`
        )
        .meta({
          example: wrapOptions(`
              debug: {
                throwRefetchErrors: true
              }
          `),
        }),
      graphql: Joi.object({
        showQueryVarsOnError: Joi.boolean()
          .default(false)
          .description(
            `When a GraphQL error is returned and the process exits, this plugin option determines whether or not to log out the query vars that were used in the query that returned GraphQL errors.`
          )
          .meta({
            example: wrapOptions(`
                debug: {
                  graphql: {
                    showQueryVarsOnError: true,
                  },
                },
              `),
          }),
        showQueryOnError: Joi.boolean()
          .default(false)
          .description(
            `If enabled, GraphQL queries will be printed to the terminal output when the query returned errors.`
          )
          .meta({
            example: wrapOptions(`
              debug: {
                graphql: {
                  showQueryOnError: true
                }
              }
              `),
          }),
        copyQueryOnError: Joi.boolean()
          .default(false)
          .description(
            `If enabled, GraphQL queries will be copied to your OS clipboard (if supported) when the query returned errors.`
          )
          .meta({
            example: wrapOptions(`
              debug: {
                graphql: {
                  copyQueryOnError: true
                }
              }
            `),
          }),
        panicOnError: Joi.boolean()
          .default(false)
          .description(
            `Determines whether or not to panic when any GraphQL error is returned.

Default is false because sometimes non-critical errors are returned alongside valid data.`
          )
          .meta({
            example: wrapOptions(`
                debug: {
                  graphql: {
                    panicOnError: false,
                  },
                },
              `),
          }),
        onlyReportCriticalErrors: Joi.boolean()
          .default(true)
          .description(
            `Determines whether or not to log non-critical errors. A non-critical error is any error which is returned alongside valid data. In previous versions of WPGraphQL this was very noisy because trying to access an entity that was private returned errors.`
          )
          .meta({
            example: wrapOptions(`
                debug: {
                  graphql: {
                    onlyReportCriticalErrors: true,
                  },
                },
              `),
          }),
        copyNodeSourcingQueryAndExit: Joi.string()
          .allow(false)
          .default(false)
          .description(
            `When a type name from the remote schema is entered here, the node sourcing query will be copied to the clipboard, and the process will exit.`
          )
          .meta({
            example: wrapOptions(`
              debug: {
                graphql: {
                  copyNodeSourcingQueryAndExit: true
                }
              }
            `),
          }),
        writeQueriesToDisk: Joi.boolean()
          .default(false)
          .description(
            `When true, all internal GraphQL queries generated during node sourcing will be written out to \`./WordPress/GraphQL/[TypeName]/*.graphql\` for every type that is sourced. This is very useful for debugging GraphQL errors.`
          )
          .meta({
            example: wrapOptions(`
                debug: {
                  graphql: {
                    writeQueriesToDisk: true,
                  },
                },
              `),
          }),
        printIntrospectionDiff: Joi.boolean()
          .default(false)
          .description(
            `When this is set to true it will print out the diff between types in the previous and new schema when the schema changes. This is enabled by default when debug.preview is enabled.`
          )
          .meta({
            example: wrapOptions(`
                debug: {
                  graphql: {
                    printIntrospectionDiff: true,
                  },
                },
              `),
          }),
      })
        .description(
          `An object which contains GraphQL debugging options. See below for options.`
        )
        .meta({
          example: wrapOptions(`
              debug: {
                graphql: {
                  // Add your options here :)
                },
              },
            `),
        }),
    })
      .description(
        `An object which contains options related to debugging. See below for options.`
      )
      .meta({
        example: wrapOptions(`
            debug: {
              // Add your options here :)
            },
          `),
      }),
    production: Joi.object({
      hardCacheMediaFiles: Joi.boolean()
        .default(false)
        .description(
          `This option is experimental. When set to true, media files will be hard-cached outside the Gatsby cache at ./.wordpress-cache/path/to/media/file.jpeg. This is useful for preventing media files from being re-downloaded when the Gatsby cache automatically clears. When using this option, be sure to gitignore the wordpress-cache directory in the root of your project.`
        )
        .meta({
          example: wrapOptions(`
              production: {
                hardCacheMediaFiles: true
              }
            `),
        }),
      allow404Images: Joi.boolean()
        .default(false)
        .description(
          `This option allows image urls that return a 404 to not fail production builds.`
        )
        .meta({
          example: wrapOptions(`
              production: {
                allow404Images: true
              }
            `),
        }),
      allow401Images: Joi.boolean()
        .default(false)
        .description(
          `This option allows image urls that return a 401 to not fail production builds. 401s are sometimes returned in place of 404s for protected content to hide whether the content exists.`
        )
        .meta({
          example: wrapOptions(`
              production: {
                allow401Images: true
              }
            `),
        }),
    }),
    develop: Joi.object({
      nodeUpdateInterval: Joi.number()
        .integer()
        .default(5000)
        .description(
          `Specifies in milliseconds how often Gatsby will ask WP if data has changed during development. If you want to see data update in near-realtime while you're developing, set this low. Your server may have trouble responding to too many requests over a long period of time and in that case, set this high. Setting it higher saves electricity too ⚡️🌲`
        )
        .meta({
          example: wrapOptions(`
              develop: {
                nodeUpdateInterval: 300
              },
            `),
        }),
      hardCacheMediaFiles: Joi.boolean()
        .default(false)
        .description(
          `This option is experimental. When set to true, media files will be hard-cached outside the Gatsby cache at \`./.wordpress-cache/path/to/media/file.jpeg\`. This is useful for preventing media files from being re-downloaded when the Gatsby cache automatically clears. When using this option, be sure to gitignore the wordpress-cache directory in the root of your project.`
        )
        .meta({
          example: wrapOptions(`
              develop: {
                hardCacheMediaFiles: true,
              },
            `),
        }),
      hardCacheData: Joi.boolean()
        .default(false)
        .description(
          `This option is experimental. When set to true, WordPress data will be hard-cached outside the Gatsby cache in \`./.wordpress-cache/caches\`. This is useful for preventing the need to re-fetch all data when the Gatsby cache automatically clears. This hard cache will automatically clear itself when your remote WPGraphQL schema changes, or when you change your plugin options.

When using this option, be sure to gitignore the wordpress-cache directory in the root of your project.`
        )
        .meta({
          example: wrapOptions(`
              develop: {
                hardCacheData: false,
              },
            `),
        }),
    })
      .description(`Options related to the gatsby develop process.`)
      .meta({
        example: wrapOptions(`
            develop: {
              // options related to \`gatsby develop\`
            },
          `),
      }),
    auth: Joi.object({
      htaccess: Joi.object({
        username: Joi.string()
          .allow(null)
          .default(null)
          .description(`The username for your .htpassword protected site.`)
          .meta({
            example: wrapOptions(`
                auth: {
                  htaccess: {
                    username: \`admin\`,
                  },
                },
              `),
          }),
        password: Joi.string()
          .allow(null)
          .default(null)
          .description(`The password for your .htpassword protected site.`)
          .meta({
            example: wrapOptions(`
                auth: {
                  htaccess: {
                    password: \`1234strong_password\`,
                  },
                },
              `),
          }),
      })
        .description(`Options related to htaccess authentication.`)
        .meta({
          example: wrapOptions(`
              auth: {
                htaccess: {
                  // Add your options here :)
                },
              },
            `),
        }),
    })
      .description(`Options related to authentication. See below for options.`)
      .meta({
        example: wrapOptions(`
            auth: {
              // Add your options here :)
            },
          `),
      }),
    schema: Joi.object({
      queryDepth: Joi.number()
        .integer()
        .positive()
        .default(15)
        .description(
          `The maximum field depth the remote schema will be queried to.`
        )
        .meta({
          example: wrapOptions(`
              schema: {
                queryDepth: 15
              }
            `),
        }),
      circularQueryLimit: Joi.number()
        .integer()
        .positive()
        .default(5)
        .description(
          `The maximum number times a type can appear as its own descendant.`
        )
        .meta({
          example: wrapOptions(`
              schema: {
                circularQueryLimit: 5
              }
            `),
        }),
      typePrefix: Joi.string()
        .default(`Wp`)
        .description(
          `The prefix for all ingested types from the remote schema. For example Post becomes WpPost.`
        )
        .meta({
          example: wrapOptions(`
              schema: {
                typePrefix: \`Wp\`,
              },
            `),
        }),
      timeout: Joi.number()
        .integer()
        .default(30 * 1000)
        .description(
          `The amount of time in ms before GraphQL requests will time out.`
        )
        .meta({
          example: wrapOptions(`
            schema: {
              timeout: 30000,
            },
          `),
        }),
      perPage: Joi.number()
        .integer()
        .default(100)
        .description(
          `The number of nodes to fetch per page during node sourcing.`
        )
        .meta({
          example: wrapOptions(`
              schema: {
                perPage: 100,
              },
            `),
        }),
      requestConcurrency: Joi.number()
        .integer()
        .default(15)
        .description(
          `The number of concurrent GraphQL requests to make at any time during node sourcing. Try lowering this if your WordPress server crashes while sourcing data.`
        )
        .meta({
          example: wrapOptions(`
              schema: {
                requestConcurrency: 50,
              },
            `),
        }),
      previewRequestConcurrency: Joi.number()
        .integer()
        .default(5)
        .description(
          `The number of concurrent GraphQL requests to make at any time during preview sourcing. Try lowering this if your WordPress server crashes during previews. Normally this wont be needed and only comes into effect when multiple users are previewing simultaneously.`
        )
        .meta({
          example: wrapOptions(`
              schema: {
                previewRequestConcurrency: 50,
              },
            `),
        }),
    })
      .description(
        `Options related to fetching and ingesting the remote schema.`
      )
      .meta({
        example: wrapOptions(`
            schema: {
              // Add your options here :)
            },
          `),
      }),
    excludeFieldNames: Joi.array()
      .items(Joi.string())
      .allow(null)
      .description(
        `A list of field names to globally exclude from the ingested schema.`
      )
      .meta({
        example: wrapOptions(`
            excludeFieldNames: [\`viewer\`],
          `),
      }),
    searchAndReplace: Joi.array()
      .description(
        `An array of options to search and replace strings in nodes. See below for options.`
      )
      .allow(null)
      .items(
        Joi.object({
          search: Joi.string()
            .description(
              `The regex rule used to search when replacing strings in node data. It will search the stringified JSON of each node to capture strings at any nested depth.`
            )
            .meta({
              example: wrapOptions(`
                searchAndReplace: [
                  {
                    search: "https://some-url.com"
                  },
                ],
              `),
            }),
          replace: Joi.string()
            .description(`The replacement string for each regex match.`)
            .meta({
              example: wrapOptions(`
                searchAndReplace: [
                  {
                    replace: "https://some-new-url.com",
                  },
                ],
              `),
            }),
        })
      )
      .meta({
        example: wrapOptions(`
          searchAndReplace: [
            {
              search:  "https://some-url.com",
              replace: "https://some-new-url.com",
            },
          ],
        `),
      }),
    catchLinks: Joi.boolean()
      .default(true)
      .allow(null)
      .description(
        `Turns on/off an automatically included copy of gatsby-plugin-catch-links which is used to catch anchor tags in html fields to perform client-side routing instead of full page refreshes.`
      )
      .meta({
        example: wrapOptions(`
          catchLinks: false,
        `),
      }),
    html: Joi.object({
      useGatsbyImage: Joi.boolean()
        .default(true)
        .allow(null)
        .description(
          `Causes the source plugin to find/replace images in html with Gatsby images.`
        )
        .meta({
          example: wrapOptions(`
              html: {
                useGatsbyImage: true,
              },
            `),
        }),
      gatsbyImageOptions: Joi.object()
        .allow(null)
        .description(`Set custom options for your Gatsby Images`)
        .meta({
          example: wrapOptions(`
              html: {
                gatsbyImageOptions: {
                  [your-option-key]: "your-option-value",
                  [your-option-key-2]: "your-option-value-2",
                },
              },
            `),
        }),
      imageMaxWidth: Joi.number()
        .integer()
        .allow(null)
        .default(null)
        .description(
          `Adds a limit to the max width an image can be. If the image size selected in WP is smaller or the image file width is smaller than this those values will be used instead.`
        )
        .meta({
          example: wrapOptions(`
              html: {
                imageMaxWidth: 1024,
              },
            `),
        }),
      fallbackImageMaxWidth: Joi.number()
        .integer()
        .allow(null)
        .default(1024)
        .description(
          `If a max width can't be inferred from html this value will be passed to Sharp. If the image is smaller than this, the image file's width will be used instead.`
        )
        .meta({
          example: wrapOptions(`
              html: {
                fallbackImageMaxWidth: 800,
              },
            `),
        }),
      imageQuality: Joi.number()
        .integer()
        .default(70)
        .allow(null)
        .description(
          `Determines the image quality that Sharp will use when generating inline html image thumbnails.`
        )
        .meta({
          example: wrapOptions(`
              html: {
                imageQuality: 90,
              },
            `),
        }),
      createStaticFiles: Joi.boolean()
        .default(true)
        .allow(null)
        .description(
          `When this is true, any urls which are wrapped in "", '', or () and which contain /wp-content/uploads will be transformed into static files and the urls will be rewritten. This adds support for video, audio, and anchor tags which point at WP media item uploads as well as inline-html css like background-image: url().`
        )
        .meta({
          example: wrapOptions(`
              html: {
                createStaticFiles: true,
              },
            `),
        }),
      generateWebpImages: Joi.boolean()
        .default(true)
        .allow(null)
        .description(
          `When this is true, .webp images will be generated for images in html fields in addition to the images gatsby-image normally generates.`
        )
        .meta({
          example: wrapOptions(`
              html: {
                generateWebpImages: false,
              },
            `),
        }),
      generateAvifImages: Joi.boolean()
        .default(hasImageCDN)
        .allow(null)
        .description(
          `When this is true, .avif images will be generated for images in html fields in addition to the images gatsby-image normally generates.`
        )
        .meta({
          example: wrapOptions(`
                html: {
                  generateAvifImages: false,
                },
              `),
        }),
      placeholderType: Joi.string()
        .default(`dominantColor`)
        .description(
          `This can be either "blurred" or "dominantColor". This is the type of placeholder image to be used in Gatsby Images in HTML fields.`
        )
        .example(
          wrapOptions(`
          html: {
            placeholderType: \`dominantColor\`
          }
        `)
        ),
      createStaticFilesForImageIds: Joi.string()
        .allow(null)
        .default(null)
        .description(
          `This option is experimental. Set this to a regex that matches Media Item Ids in the content of your posts or page, to always create static files for them so they can be queried in GraphQL (even if the createStaticFiles option is false)`
        )
        .meta({
          example: wrapOptions(`
              html: {
                createStaticFilesForImageIds: '"gatsby_image_source_[^"]*":(\\d*)',
              },
            `),
        }),
    })
      .description(`Options related to html field processing.`)
      .meta({
        example: wrapOptions(`
            html: {
              // Add your options here :)
            },
          `),
      }),
    type: Joi.object({
      __all: getTypeOptions()
        .description(
          `A special type setting which is applied to all types in the ingested schema.`
        )
        .meta({
          example: wrapOptions(`
              type: {
                __all: {
                  limit: 10,
                },
              },
            `),
        }),
      RootQuery: getTypeOptions()
        .append({
          excludeFieldNames: Joi.array()
            .items(Joi.string())
            .allow(null)
            .default([`viewer`, `node`, `schemaMd5`])
            .description(`Excludes fields on a type by field name.`),
        })
        .default(`{ excludeFieldNames: ['viewer', 'node', 'schemaMd5'], },`)
        .description(
          `A special type which is applied to any non-node root fields that are ingested and stored under the root \`wp\` field. It accepts the same options as other types.`
        )
        .meta({
          example: wrapOptions(`
              RootQuery: {
                excludeFieldNames: [\`viewer\`]
              },
            `),
        }),
      MediaItem: Joi.object({
        excludeFieldNames: Joi.array()
          .items(Joi.string())
          .allow(null)
          .allow(false)
          .description(`Excludes fields on the MediaItem type by field name.`)
          .meta({
            example: wrapOptions(`
            type: {
              MediaItem: {
                excludeFieldNames: [\`dateGmt\`, \`parent\`],
              },
            },
          `),
          }),
        placeholderSizeName: Joi.string()
          .default(`gatsby-image-placeholder`)
          .description(
            `This option allows you to choose the placeholder size used in the new Gatsby image service (currently in ALPHA/BETA) for the small placeholder image. Please make this image size very small for better performance. 20px or smaller width is recommended. To use, create a new image size in WP and name it "gatsby-image-placeholder" (or the name that you pass to this option) and that new size will be used automatically for placeholder images in the Gatsby build.`
          ),
        createFileNodes: Joi.boolean()
          .default(true)
          .description(
            `This option controls whether or not a File node will be automatically created for each MediaItem node (available on MediaItem.localFile). Set this to false if you don't want Gatsby to download the corresponding file for each media item.`
          ),
        lazyNodes: Joi.boolean()
          .default(false)
          .description(
            `Enables a different media item sourcing strategy. Instead of fetching Media Items that are referenced by other nodes, Media Items will be fetched in connection resolvers from other nodes. This may be desirable if you're not using all of the connected images in your WP instance. This is not currently recommended because it messes up cli output and can be slow due to query running concurrency.\n\nThis option no longer works starting in Gatsby v4+. If you want to prevent this plugin from creating File nodes for each MediaItem node, set the type.MediaItem.createFileNodes option to false instead.`
          )
          .meta({
            example: wrapOptions(`
                type: {
                  MediaItem: {
                    lazyNodes: true,
                  },
                },
              `),
          }),
        localFile: Joi.object({
          excludeByMimeTypes: Joi.array()
            .items(Joi.string())
            .default([])
            .description(
              `Allows preventing the download of files associated with MediaItem nodes by their mime types.`
            )
            .meta({
              example: wrapOptions(`
                  type: {
                    MediaItem: {
                      localFile: {
                        excludeByMimeTypes: [\`video/mp4\`]
                      },
                    },
                  },
                `),
            }),
          maxFileSizeBytes: Joi.number()
            .integer()
            .default(15728640)
            .description(
              `Allows preventing the download of files that are above a certain file size (in bytes). Default is 15mb.`
            )
            .meta({
              example: wrapOptions(`
                  type: {
                    MediaItem: {
                      localFile: {
                        maxFileSizeBytes: 10485760 // 10Mb
                      },
                    },
                  },
                `),
            }),
          requestConcurrency: Joi.number()
            .integer()
            .default(100)
            .description(
              `Amount of images to download concurrently. Try lowering this if wordpress server crashes on import`
            )
            .meta({
              example: wrapOptions(`
                  type: {
                    MediaItem: {
                      localFile: {
                        requestConcurrency: 50
                      },
                    },
                  },
                `),
            }),
        })
          .description(
            `Options related to File nodes that are attached to MediaItem nodes`
          )
          .meta({
            example: wrapOptions(`
          type: {
            MediaItem: {
              localFile: {
                // Add your options here :)
              }
            }
          }`),
          }),
        exclude: Joi.boolean()
          .allow(null)
          .description(
            `Completely excludes MediaItem nodes from node sourcing and from the ingested schema. Setting this to true also disables the html.createStaticFiles, html.useGatsbyImage, and type.MediaItem.createFileNodes options.`
          )
          .meta({
            example: wrapOptions(`
              type: {
                MediaItem: {
                  exclude: true,
                },
              },
            `),
          }),
      }),
    })
      .pattern(Joi.string(), getTypeOptions())
      .description(`Options related to specific types in the remote schema.`)
      .meta({
        example: wrapOptions(`
            type: {
              // Add your options here :)
            },
          `),
      }),
  }).meta({
    // This is used in generating docs from this schema
    // so that we can prevent generating all options
    // nested inside themselves
    portableOptions: true,
  })

  return Joi.object({
    url: Joi.string()
      .required()
      .description(
        `This is the only plugin option which is required for the plugin to work properly.

This should be the full url of your GraphQL endpoint.`
      )
      .meta({
        example: wrapOptions(`
            url: \`https://yoursite.com/graphql\`
          `),
      }),
  })
    .concat(joiSchema)
    .append({
      presets: Joi.array()
        .items(
          Joi.object({
            presetName: Joi.string()
              .description(`The name of the plugin options preset.`)
              .meta({
                example: wrapOptions(`
                    presets: [
                      {
                        presetName: \`DEVELOP\`
                      }
                    ]
                  `),
              }),
            useIf: Joi.any()
              .description(
                `A function used to determine whether or not to apply this plugin options preset. It should return a boolean value. True will cause the preset to apply, false will disclude it.`
              )
              .default(`() => false`)
              .meta({
                trueType: `function`,
                example: wrapOptions(`
                    presets: [
                      {
                        useIf: () => process.env.NODE_ENV === \`development\`
                      }
                    ]
                  `),
              }),
            options: joiSchema
              .description(
                `Any valid options except for \`url\` and \`presets\``
              )
              .meta({
                example: wrapOptions(`
                    presets: [
                      {
                        presetName: \`DEVELOP\`,
                        useIf: () => process.env.NODE_ENV === \`development\`,
                        options: {
                          type: {
                            __all: {
                              limit: 1
                            }
                          }
                        }
                      }
                    ]
                  `),
              }),
          })
        )
        .meta({
          default: `[{
            presetName: \`PREVIEW_OPTIMIZATION\`,
            useIf: (): boolean => process.env.NODE_ENV === \`development\` &&
            !!process.env.ENABLE_GATSBY_REFRESH_ENDPOINT || process.env.RUNNER_TYPE === \`PREVIEW\`,
            options: {
              html: {
                useGatsbyImage: false,
                createStaticFiles: false,
              },
              type: {
                __all: {
                  limit: 50,
                },
                Comment: {
                  limit: 0,
                },
                Menu: {
                  limit: null,
                },
                MenuItem: {
                  limit: null,
                },
                User: {
                  limit: null,
                },
              },
            },
          }]`,
        })
        .description(
          `An array of plugin options presets that are applied if the useIf function on each returns true. The default includes an optimization for when in Gatsby Preview mode.`
        )
        .allow(null),
    })
}

module.exports = {
  pluginOptionsSchema,
}
