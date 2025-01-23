# gatsby-plugin-feed

Create an RSS feed (or multiple feeds) for your Gatsby site. **Please note**: This plugin only generates the `xml` file(s) when run in `production` mode! To test your feed, run: `gatsby build && gatsby serve`.

## Installation

```shell
npm install gatsby-plugin-feed
```

## Usage

`gatsby-plugin-feed` uses the [rss][rss] package to generate the RSS feed. We recommend using the [`siteMetadata`](https://www.gatsbyjs.com/docs/reference/config-files/gatsby-config/#sitemetadata) information inside your `gatsby-config` to define the `title`, `description`, and `site_url` of the RSS feed. Those keys directly get passed to the [rss feedOptions][feedOptions].

```js:title=gatsby-config.js
module.exports = {
  siteMetadata: {
    title: `Your site title`,
    description: `Your site desccription`,
    site_url: `https://your-site-url.com`,
  }
}
```

Afterwards, you should configure `gatsby-plugin-feed` inside your `gatsby-config` like so (this example assumes the site uses [Markdown pages](https://www.gatsbyjs.com/docs/how-to/routing/adding-markdown-pages/)):

```js:title=gatsby-config.js
module.exports = {
  siteMetadata: {
    title: `Your site title`,
    description: `Your site desccription`,
    site_url: `https://your-site-url.com`,
  },
  plugins: [
    {
      resolve: `gatsby-plugin-feed`,
      options: {
        feeds: [
          {
            serialize: ({ query: { site, allMarkdownRemark } }) => {
              return allMarkdownRemark.nodes.map(node => {
                return Object.assign({}, node.frontmatter, {
                  description: node.excerpt,
                  date: node.frontmatter.date,
                  url: site.siteMetadata.siteUrl + node.fields.slug,
                  guid: site.siteMetadata.siteUrl + node.fields.slug,
                  custom_elements: [{ "content:encoded": node.html }],
                })
              })
            },
            query: `
              {
                allMarkdownRemark(sort: { frontmatter: { date: DESC }}) {
                  nodes {
                    excerpt
                    html
                    fields {
                      slug
                    }
                    frontmatter {
                      title
                      date
                    }
                  }
                }
              }
            `,
            output: "/rss.xml",
            title: "Your Site's RSS Feed",
          },
        ],
      },
    },
  ],
}
```

`gatsby-plugin-feed` accepts two top-level plugin options:

- `query` (optional): A GraphQL query to fetch the `title`, `description`, and `site_url`. By default, the plugin queries for `siteMetadata`.
- `feeds` (required): One or multiple RSS feeds you want to define.

`feeds` itself has these required keys:

- `title`: Title of the RSS feed
- `output`: Output location of the `xml` file
- `serialize`: You get access to the GraphQL query inside the top-level `query` key and inside `feeds.query`. You have to return an array of objects containing keys of [rss `itemOptions`][itemOptions]
- `query`: GraphQL query to get contents for RSS items

**Need more help?** Check out the documentation [Adding an RSS Feed](https://www.gatsbyjs.com/docs/how-to/adding-common-features/adding-an-rss-feed/).

### Additional options

As mentioned above, `gatsby-plugin-feed` accepts optional additions.

`feeds` has these additional options:

- `match`: Configuration, indicating which pages will have feed reference included. The accepted types of `match` are `string` or `undefined`. By default, when `match` is not configured, all pages will have feed reference inserted. If `string` is provided, it will be used to build a RegExp and then to test whether `pathname` of current page satisfied this regular expression. Only pages that satisfied this rule will have feed reference included.
- `link`: Configuration that will override the default generated rss link from `output`.

All additional options are passed through to the [`feedOptions` section of the `rss` package][feedOptions]. Thus you could write something like this:

```js:title=gatsby-config.js
module.exports = {
  siteMetadata: {/* siteMetadata contents */},
  plugins: [
    {
      resolve: `gatsby-plugin-feed`,
      options: {
        feeds: [
          {
            serialize: ({ query: { site, allMarkdownRemark } }) => {
              /* contents go here */
            },
            query: `/* query goes here */`,
            output: "/rss.xml",
            title: "Your Site's RSS Feed",
            // Optional configuration specific for plugin:
            match: "^/blog/",
            link: "https://feeds.feedburner.com/gatsby/blog",
            // Optional configuration passed through to itemOptions
            custom_namespaces: {
              media: 'http://search.yahoo.com/mrss/',
            },
            language: `en-US`,
          },
        ],
      },
    },
  ],
}
```

The `serialize` function can return all keys of the [rss `itemOptions`][itemOptions] setup.

[rss]: https://www.npmjs.com/package/rss
[feedOptions]: https://www.npmjs.com/package/rss#feedoptions
[itemOptions]: https://www.npmjs.com/package/rss#itemoptions
