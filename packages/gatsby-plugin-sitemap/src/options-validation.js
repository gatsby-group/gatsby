import { parse as parseGraphql } from "gatsby/graphql"
import { stripIndent, oneLine } from "common-tags"

import {
  resolveSiteUrl,
  resolvePagePath,
  resolvePages,
  serialize,
  defaultFilterPages,
} from "./internals"

export const pluginOptionsSchema = ({ Joi }) =>
  Joi.object({
    plugins: Joi.array().strip(),
    output: Joi.string()
      .default(`/`)
      .description(`Folder path where sitemaps are stored in \`public\`.`),
    createLinkInHead: Joi.boolean()
      .default(true)
      .description(
        `Whether to populate the \`<head>\` of your site with a link to the sitemap.`
      ),
    entryLimit: Joi.number()
      .default(45000) // default based on upstream "sitemap" plugin default, may need optimization
      .description(
        `Number of entries per sitemap file, a sitemap index and multiple sitemaps are created if you have more entries.`
      ),
    query: Joi.string()
      .default(
        oneLine`{
          site {
            siteMetadata {
              siteUrl
            }
          }

          allSitePage {
            nodes {
              path
            }
          }
        }`
      )
      .external(pluginOptions => {
        const query = pluginOptions?.query
        if (query) {
          try {
            parseGraphql(query)
          } catch (e) {
            throw new Error(
              stripIndent`
        Invalid plugin options for "gatsby-plugin-sitemap":
        "query" must be a valid GraphQL query. Received the error "${e.message}"`
            )
          }
        }
      })
      .description(
        stripIndent`
        (GraphQL Query) The query for the data you need to generate the sitemap.
        It's required to get the site's URL, if you are not fetching it from \`site.siteMetadata.siteUrl\`,
        you will need to set a custom \`resolveSiteUrl\` function.
        If you override the query, you may need to pass in a custom \`resolvePagePath\` or
        \`resolvePages\` to keep everything working.
        If you fetch pages without using \`allSitePage.nodes\` query structure
        you will definately need to customize the \`resolvePages\` function.`
      ),
    excludes: Joi.array()
      .items(Joi.any())
      .default([])
      .description(
        stripIndent`
        An array of paths to exclude from the sitemap.
        While this is usually an array of strings it is possible to
        enter other data types into this array for custom filtering.
        Doing so will require customization of the \`filterPages\` function.`
      ),
    resolveSiteUrl: Joi.function()
      .default(() => resolveSiteUrl)
      .description(
        `Takes the output of the data query and lets you return the site URL.`
      ),
    resolvePagePath: Joi.function()
      .default(() => resolvePagePath)
      .description(
        `Takes a page object and returns the uri of the page (no domain or protocol).`
      ),
    resolvePages: Joi.function()
      .default(() => resolvePages)
      .description(
        `Takes the output of the data query and expects an array of page objects to be returned.`
      ),
    filterPages: Joi.function()
      .default(() => defaultFilterPages)
      .description(
        stripIndent`Takes the current page a string (or other object)
        from the \`exclude\` array and expects a boolean to be returned.
        \`true\` excludes the path, \`false\` keeps it.`
      ),
    serialize: Joi.function()
      .default(() => serialize)
      .description(
        `Takes the output of \`filterPages\` and lets you return a sitemap entry.`
      ),
    ignoreSitemapPathPrefix: Joi.boolean()
      .default(false)
      .description(
        `Whether to ignores the path prefix when setting the sitemap public path.`
      ),
  })
