---
date: "2021-03-16"
version: "3.1.0"
---

# [v3.1](https://github.com/gatsbyjs/gatsby/compare/gatsby@3.1.0-next.0...gatsby@3.1.0) (March 2021 #1)

Welcome to `gatsby@3.1.0` release (March 2021 #1)

Key highlights of this release:

- [Fast Refresh Dark Mode](#fast-refresh-dark-mode)
- [Improved Error Messages](#improved-error-messages)
- [Contentful `gatsbyImageData` is stable](#contentful-gatsbyimagedata-is-stable)

Also check out [notable bugfixes](#notable-bugfixes).

**Bleeding Edge:** Want to try new features as soon as possible? Install `gatsby@next` and let us know
if you have any [issues](https://github.com/gatsbyjs/gatsby/issues).

[Previous release notes](/docs/reference/release-notes/v3.0)

[Full changelog](https://github.com/gatsbyjs/gatsby/compare/gatsby@3.1.0-next.0...gatsby@3.1.0)

## Fast Refresh Dark Mode

Gatsby's Fast Refresh modal now respects the [`prefers-color-scheme` setting](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) from your operating system. Depending on your setting you'll see the overlay in light or dark mode -- which is great because it makes the modal more accessible!

![Showing a toggle between light and dark mode](https://user-images.githubusercontent.com/16143594/111284667-9faee400-8640-11eb-87c3-0015d439d894.gif)

## Improved Error Messages

We've seen many complaints about the unspecific error `"Error page resources for <path> not found. Not rendering React"`. There are many reasons why this could happen so we improved our error logging to output the original error. As usual you'll see the error in DevTools console or in your error tracker.

Consider the following example, it now shows the actual error.

```js
if (typeof window === "undefined") {
  throw new Error("GATSBY")
}

export default function MyPage() {}
```

![Browser console showing the actual error](https://user-images.githubusercontent.com/1120926/109872417-afa3ec80-7c6c-11eb-83dc-1d061fd4cd97.png)

In development mode we also now show the original error when it occurs in `gatsby-browser.js` or outside of React components.

![Fast Refresh overlay showing an error that happened outside of React](https://user-images.githubusercontent.com/1120926/110111666-fe5a9f00-7db0-11eb-8d2a-d9a7f2709f24.png)

## Contentful `gatsbyImageData` is stable

Contentful now fully supports `gatsby-plugin-image` out of the box. TODO: What does that mean?

You can find more information on how to switch to [`gatsby-plugin-image`](https://www.gatsbyjs.com/plugins/gatsby-plugin-image/#dynamic-images) by going to our [`gatsby-image` to `gatsby-plugin-image` migration guide](https://www.gatsbyjs.com/docs/reference/release-notes/image-migration-guide/)

---

## Notable bugfixes

- gatsby: Fix routing when path starts with @ symbol, via [PR #29935](https://github.com/gatsbyjs/gatsby/pull/29935)
- gatsby: Fix incremental builds when remove trailing slashes is used, via [PR #29953](https://github.com/gatsbyjs/gatsby/pull/29953)
- gatsby: Add build stage to custom babel-preset-gatsby configurations, via [PR #30047](https://github.com/gatsbyjs/gatsby/pull/30047)
- gatsby: Fix hanging Gatsby process between webpack rebuilds in development, via [PR 30127](https://github.com/gatsbyjs/gatsby/pull/30127)
- gatsby: fix SitePage schema, via [PR #30132](https://github.com/gatsbyjs/gatsby/pull/30132)
- gatsby: fix double save during gatsby develop, via [PR #30193](https://github.com/gatsbyjs/gatsby/pull/30193)
- gatsby-plugin-image: Handle placeholder in plugin toolkit correclty, via [PR #30141](https://github.com/gatsbyjs/gatsby/pull/30141)
- gatsby-source-contentful: fix deprecation warnings, via [PR #29675](https://github.com/gatsbyjs/gatsby/pull/29675)

## Contributors
