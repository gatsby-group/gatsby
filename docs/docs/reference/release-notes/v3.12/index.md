---
date: "2021-08-17"
version: "3.12.0"
title: "v3.12 Release Notes"
---

Welcome to `gatsby@3.12.0` release (August 2021 #2)

Key highlights of this release:

- [Improvements to `gatsby-source-shopify`](#improvements-to-gatsby-source-shopify) - Add compat for breaking change in Shopify's API
- [Improvements to `gatsby-source-wordpress`](#improvements-to-gatsby-source-wordpress) - Support for generating WebP images in HTML fields

Also check out [notable bugfixes](#notable-bugfixes--improvements).

**Bleeding Edge:** Want to try new features as soon as possible? Install `gatsby@next` and let us know
if you have any [issues](https://github.com/gatsbyjs/gatsby/issues).

[Previous release notes](/docs/reference/release-notes/v3.11)

[Full changelog](https://github.com/gatsbyjs/gatsby/compare/gatsby@3.12.0-next.0...gatsby@3.12.0)

---

## Improvements to `gatsby-source-shopify`

Our `gatsby-source-shopify` plugin received mulitple bug fixes and improvements in this release. If you use Sales Channels you might have gotten wrong results in the past. The filter for it was fixed in [PR #32674](https://github.com/gatsbyjs/gatsby/pull/32674). With [PR #32710](https://github.com/gatsbyjs/gatsby/pull/32710) the plugin will also only query location fields when you activate locations since it requires additional permissions. If you're using [Gatsby Cloud](https://www.gatsbyjs.com/products/cloud/) production builds will now be prioritized over content previews and branch previews (via [PR #32144](https://github.com/gatsbyjs/gatsby/pull/32144)).

Shopify recently deprecated the `valueType` field on metafields. We've updated the API version to `2021-07`, added the new `type` field and aliased the old `valueType` to this new field. So the breaking change is backwards compatible, see [PR #32774](https://github.com/gatsbyjs/gatsby/pull/32774) for all details.

## Improvements to `gatsby-source-wordpress`

- Make support for the upcoming Gatsby Cloud Preview Loader feature more scaleable, via [PR #32723](https://github.com/gatsbyjs/gatsby/pull/32723)
- Fix accessing property on `undefined` in Preview Loader code, via [PR #32488](https://github.com/gatsbyjs/gatsby/pull/32488)
- Add the option to generate WebP images in HTML fields while transforming WP images to static Gatsby images, via [PR #30896](https://github.com/gatsbyjs/gatsby/pull/30896)
- Fix bug where a low perPage option value could prevent some MediaItem nodes from being fetched, via [PR #32679](https://github.com/gatsbyjs/gatsby/pull/32679)
- Fix accessing property on `undefined` when processing nodes. The code assumed all nodes being processed were the same type but occasionally that wasn't the case, via [PR #32752](https://github.com/gatsbyjs/gatsby/pull/32752)

## Notable bugfixes & improvements

- Dependency Updates: The Renovate bot updated a bunch of dependencies (see [full changelog](https://github.com/gatsbyjs/gatsby/compare/gatsby@3.12.0-next.0...gatsby@3.12.0) for more details), most notably: `eslint` (7.28.0 to 7.32.0), `styletron-react` (5.2.7 to 6.0.1)
- `gatsby-plugin-sitemap`: Add warning that old `exclude` option is obsolete, via [PR #32509](https://github.com/gatsbyjs/gatsby/pull/32509)
- `gatsby`: Worker support for `gatsby develop`, via [PR #32432](https://github.com/gatsbyjs/gatsby/pull/32432)
- `gatsby-source-contentful`: base64 previews now reflect all query options, via [PR #32709](https://github.com/gatsbyjs/gatsby/pull/32709)
- `gatsby-remark-image-contentful`: Show useful error message for files that can not be rendered as image, via [PR #32530](https://github.com/gatsbyjs/gatsby/pull/32530)
- `gatsby`: Speed up "Writing page-data" step by ~10%, via [PR #32763](https://github.com/gatsbyjs/gatsby/pull/32763)

## Contributors

A big **Thank You** to [our community who contributed](https://github.com/gatsbyjs/gatsby/compare/gatsby@3.12.0-next.0...gatsby@3.12.0) to this release 💜

TODO
