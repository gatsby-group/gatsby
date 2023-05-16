---
date: "2023-05-16"
version: "5.10.0"
title: "v5.10 Release Notes"
---

Welcome to `gatsby@5.10.0` release (May 2023 #1)

Check out [notable bugfixes](#notable-bugfixes--improvements).

**Bleeding Edge:** Want to try new features as soon as possible? Install `gatsby@next` and let us know if you have any [issues](https://github.com/gatsbyjs/gatsby/issues).

[Previous release notes](/docs/reference/release-notes/v5.9)

[Full changelog][full-changelog]

---

## Notable bugfixes & improvements

- We merged over 40 [renovate](https://www.mend.io/free-developer-tools/renovate/) PRs to update dependencies across various packages. If you're curious about the changes, you can use [this GitHub search](https://github.com/gatsbyjs/gatsby/pulls?q=is%3Apr+sort%3Aupdated-desc+author%3Aapp%2Frenovate+merged%3A2023-04-18..2023-05-16).
- `gatsby`:
  - Decrease size of produced SSR/DSG engine by deduplicating shared modules, via [PR #37961](https://github.com/gatsbyjs/gatsby/pull/37961)
  - Prevent infinite recursion when webpack chunk is parent of itself, via [PR #38052](https://github.com/gatsbyjs/gatsby/pull/38052)
  - Don't serve error overlay codeframes for files outside of compilation, via [PR #38059](https://github.com/gatsbyjs/gatsby/pull/38059)
- `gatsby-source-drupal`
  - Add support for setting type prefix, via [PR #37967](https://github.com/gatsbyjs/gatsby/pull/37967)
  - Find mimetype field, via [PR #38056](https://github.com/gatsbyjs/gatsby/pull/38056)
  - Add image cdn support for files type and typePrefix, via [PR #38057](https://github.com/gatsbyjs/gatsby/pull/38057)
- `gatsby-source-contentful`: Add support for setting type prefix, via [PR #37981](https://github.com/gatsbyjs/gatsby/pull/37981)

## Contributors

A big **Thank You** to [our community who contributed][full-changelog] to this release 💜

TODO

[full-changelog]: https://github.com/gatsbyjs/gatsby/compare/gatsby@5.10.0-next.0...gatsby@5.10.0
