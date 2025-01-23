# gatsby-plugin-sitemap

Create a sitemap for your Gatsby site.

**Please note:** This plugin only generates output when run in `production` mode! To test your sitemap, run: `gatsby build && gatsby serve`.

## Install

```shell
npm install gatsby-plugin-sitemap
```

## How to Use

```javascript:title=gatsby-config.js
module.exports = {
  siteMetadata: {
    // If you didn't use the resolveSiteUrl option this needs to be set
    siteUrl: `https://www.example.com`,
  },
  plugins: [`gatsby-plugin-sitemap`]
}
```

Above is the minimal configuration required to have it work. By default, the generated sitemap will include all of your site's pages, except the ones you exclude. It will generate a `sitemap-index.xml` file at the root of your site and for every 45000 URLs a new `sitemap-X.xml` file. The `sitemap-index.xml` file will point at the generated `.xml` files.

You then can point your service (e.g. Google Search Console) at `https://www.example.com/sitemap-index.xml`.

## Recommended usage

You probably do not want to use the defaults in this plugin. Here's an example of the default output:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.net/blog/</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://example.net/</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

See the `changefreq` and `priority` fields? Those will be the same for every page, no matter how important or how often it gets updated. They will most likely be wrong. In addition, all entries are missing a `lastmod` date.

In their [docs](https://support.google.com/webmasters/answer/183668?hl=en) Google says:

> - Google ignores `<priority>` and `<changefreq>` values, so don't bother adding them.
> - Google reads the `<lastmod>` value, but if you misrepresent this value, Google will stop reading it.

You will really want to customize this plugin config! At minimum, you need a custom `query` and a custom `serialize` to include an accurate `lastmod` date. Check out the [example](#example) for an example of how to do this.

## Options

The [`default config`](https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-plugin-sitemap/src/options-validation.js) can be overridden.

The options are as follows:

- `output` (string = `'/'`) Folder path where sitemaps are stored.
- `createLinkInHead` (boolean = `true`) Whether to populate the `<head>` of your site with a link to the sitemap.
- `entryLimit` (number = `45000`) Number of entries per sitemap file. A sitemap index (as `sitemap-index.xml`) will always be created and multiple sitemaps are created for every `entryLimit` increment (e.g under 45000 entries only `sitemap-0.xml` will be created).
- `excludes` (string[] = `[]`) An array of paths to exclude from the sitemap. You can use glob matching using [minimatch](https://github.com/isaacs/minimatch). While `excludes` is usually an array of strings it is possible to enter other data types into this array for custom filtering, but doing so will require customization of the [`filterPages`](#filterPages) function.
- `query` (GraphQL Query) The query for the data you need to generate the sitemap. By default this will fetch all pages at `allSitePage.nodes`; write a custom query to fetch specific pages as well as the site URL (unless that URL is defined in another scope, such as an environment variable in your project). If you write a custom query which has a different structure from the example below, you will likely need to also write a custom [`resolveSiteUrl`](#resolveSiteUrl) function, [`resolvePagePath`](#resolvePagePath) function, and [`resolvePages`](#resolvePages) function to prevent errors, as they all rely on the default query structure. In addition, the shape of the `queryData` and `pageData` types seen below will depend on the shape of your custom query.
- [`resolveSiteUrl`](#resolveSiteUrl) (function = `(queryData: { site: { siteMetadata: { siteUrl: string } } }) => string`) Takes the output of the data [`query`](#query) and returns the site URL as a string.
- [`resolvePagePath`](#resolvePagePath) (function = `(page: { path: string }) => string`) Takes a single page-data object and returns the path of the page (no domain or protocol).
- [`resolvePages`](#resolvePages) (function = `({ data: { allSitePage: { nodes: PageData[] }) => PageData[]`) Takes the output of the data query and returns an array of page-data objects.
- [`filterPages`](#filterPages) (function = `(page: PageData, exclude: string) => boolean`) Takes the current page and a string (or other object) from the `excludes` array and returns a boolean.
- [`serialize`](#serialize) (function = `(page: pageData) => { path: string }`) Takes the output of `filterPages` (or `resolvePages` if `filterPages` is not called) and returns a sitemap entry.

The following pages are **always** excluded: `/dev-404-page`,`/404` &`/offline-plugin-app-shell-fallback`, this cannot be changed even by customizing the [`filterPages`](#filterPages) function.

## Example:

```javascript
const siteUrl = process.env.URL || `https://fallback.net`

// In your gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: "gatsby-plugin-sitemap",
      options: {
        query: `
        {
          allSitePage {
            nodes {
              path
            }
          }
          allWpContentNode(filter: {nodeType: {in: ["Post", "Page"]}}) {
            nodes {
              ... on WpPost {
                uri
                modifiedGmt
              }
              ... on WpPage {
                uri
                modifiedGmt
              }
            }
          }
        }
      `,
        resolveSiteUrl: () => siteUrl,
        resolvePages: ({
          allSitePage: { nodes: allPages },
          allWpContentNode: { nodes: allWpNodes },
        }) => {
          const wpNodeMap = allWpNodes.reduce((acc, node) => {
            const { uri } = node
            acc[uri] = node

            return acc
          }, {})

          return allPages.map(page => {
            return { ...page, ...wpNodeMap[page.path] }
          })
        },
        serialize: ({ path, modifiedGmt }) => {
          return {
            url: path,
            lastmod: modifiedGmt,
          }
        },
      },
    },
  ],
}
```

## API Reference

<a id=resolveSiteUrl></a>

## resolveSiteUrl: `(QueryData) => string`

Takes the output of the data query and returns the site URL as a string.

If you are not using the default query or retrieving your site URL from `site.siteMetadata.siteUrl` in your custom query, you must define a custom `resolveSiteUrl` function which returns your site URL (perhaps from another part of your query data, from environment variables in your project, etc.).

Sync or async functions allowed.

| Param | Type                | Description                  |
| ----- | ------------------- | ---------------------------- |
| data  | `object`            | Results of the GraphQL query |

| Return Value | Type                | Description                  |
| ----- | ------------------- | ---------------------------- |
| siteUrl  | `string`         | site URL, this can come from the graphql query or another scope. |

<a id=resolvePagePath></a>

## resolvePagePath: `(PageData) => string`

Takes a single page object and returns the path of the page (no domain or protocol). If your page object does not contain a `path` key you must define a custom `resolvePagePath` function (for example, if you are fetching pages with a `uri` property instead of a `path` property in your query).

| Param | Type                | Description                           |
| ----- | ------------------- | ------------------------------------- |
| page  | `object`            | Page Data array item returned from resolvePages |

| Return Value | Type                | Description                           |
| ----- | ------------------- | ------------------------------------- |
| pagePath  | `string`            |  uri of the page without domain or protocol |

<a id=resolvePages></a>

## resolvePages: `(QueryData) => PageData[]`

This allows customizing the array of page objects.

This also where users should merge multiple sources into a single array if needed.

Sync or async functions allowed.

| Param | Type                | Description                  |
| ----- | ------------------- | ---------------------------- |
| data  | `object`            | Query Data object returned by the GraphQL query |

| Return Value | Type         | Description                  |
| ----- | ------------------- | ---------------------------- |
| AllPages  | `PageData[]`    | Array of page data objects. These can be modified from the results of the GraphQL query. |

<a id="filterPages"></a>

## filterPages: `(PageData, string) => boolean`

This allows filtering pages in any way.

Note that when the `excludes` array is undefined or empty this function will not be called.

This function is executed via:

```javascript
allPages.filter(
  page => !excludes.some(excludedRoute => thisFunc(page, excludedRoute, tools))
)
```

`allPages` is the return value of the [`resolvePages`](#resolvePages) function.

| Param         | Type                | Description                                                                         |
| ------------- | ------------------- | ----------------------------------------------------------------------------------- |
| page          | `object`            | PageData object, contains the path key `{ path }`                                   |
| excludedRoute | `string`            | Element from `excludes` Array in plugin config                                      |
| tools         | `object`            | contains tools for filtering `{ minimatch, withoutTrailingSlash, resolvePagePath }` |

| Return Value | Type         | Description                  |
| ----- | ------------------- | ---------------------------- |
| isExcluded  | `boolean`    | `true` excludes the path, `false` keeps it. |

<a id="serialize"></a>

## serialize: `(PageData, ToolsObject) => SitemapEntry`

Takes the output of `filterPages` (or `resolvePages` if `filterPages` is not called) and returns a sitemap entry. Note that the sitemap entry must contain a `url` property at minimum, and that the value of `url` should only be a *path* string, not a complete URL. Domain and protocol will be prepended later automatically.

It is **highly recommended** to overwrite this function, as the default return values contain useless `changefreq` and `priority` properties
and do not contain the `lastmod` property which is important to SEO.

Sync or async functions allowed.

This function is executed by:

```javascript
allPages.map(page => thisFunc(page, tools))
```

`allPages` is the return value of the [`filterPages`](#filterPages) function (or the [`resolvePages`](#resolvePages) function if filterPages is not called).

| Param | Type                | Description                                                      |
| ----- | ------------------- | ---------------------------------------------------------------- |
| page  | `object`            | A single PageData element from the results of the `resolvePages` function |
| tools | `object`            | (opt) contains tools for serializing, such as `{ resolvePagePath }` by default |

| Return Value | Type         | Description                  |
| ----- | ------------------- | ---------------------------- |
| sitemapEntry  | `object`    | should contain a `url` string and a `lastmod` string at least |
