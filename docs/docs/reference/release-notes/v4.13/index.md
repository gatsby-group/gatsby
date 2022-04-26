---
date: "2022-04-26"
version: "4.13.0"
title: "v4.13 Release Notes"
---

Welcome to `gatsby@4.13.0` release (April 2022 #2)

Key highlights of this release:

- [Traced SVG option for Image CDN](#traced-svg-option-for-image-cdn)

Also check out [notable bugfixes](#notable-bugfixes--improvements).

**Bleeding Edge:** Want to try new features as soon as possible? Install `gatsby@next` and let us know
if you have any [issues](https://github.com/gatsbyjs/gatsby/issues).

[Previous release notes](/docs/reference/release-notes/v4.12)

[Full changelog][full-changelog]

---

## Traced SVG option for Image CDN

The popular traced SVG option is now available for use with [Image CDN on Gatsby Cloud](https://www.gatsbyjs.com/blog/image-cdn-lightning-fast-image-processing-for-gatsby-cloud/).

The change spans four separate packages:

- `gatsby-plugin-sharp`
- `gatsby-transformer-sharp`
- `gatsby-plugin-utils`
- `gatsby-remark-images`

See [PR #35328](https://github.com/gatsbyjs/gatsby/pull/35328) for full details.

## Notable bugfixes & improvements

- `gatsby`
  - Limit node manifest file creation via [PR #35359](https://github.com/gatsbyjs/gatsby/pull/35359)
- `gatsby-plugin-gatsby-cloud`
  - Include `assetPrefix` in link headers via [PR #35338](https://github.com/gatsbyjs/gatsby/pull/35338) and [PR #35400](https://github.com/gatsbyjs/gatsby/pull/35400)
- `gatsby-plugin-netlify-cms`
  - Fix compatibility with React 18 via [PR #35365](https://github.com/gatsbyjs/gatsby/pull/35365)
- `gatsby-source-wordpress`
  - Fix static file creation when assets have no id in `localFile` via [PR #35423](https://github.com/gatsbyjs/gatsby/pull/35423)
  - Opt out of AVIF image generation when not using Gatsby Cloud image service via [PR #35370](https://github.com/gatsbyjs/gatsby/pull/35370)
- `gatsby-link`
  - Modify relative links based on trailing slash option via [PR #35444](https://github.com/gatsbyjs/gatsby/pull/35444)
- `gatsby-transformer-screenshot`
  - Complete migration from better-queue to fastq via [PR #35425](https://github.com/gatsbyjs/gatsby/pull/35425)

## Contributors

A big **Thank You** to [our community who contributed][full-changelog] to this release 💜

TBD

[full-changelog]: https://github.com/gatsbyjs/gatsby/compare/gatsby@4.13.0-next.0...gatsby@4.13.0
