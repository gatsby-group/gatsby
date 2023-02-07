---
date: "2023-02-07"
version: "5.6.0"
title: "v5.6 Release Notes"
---

Welcome to `gatsby@5.6.0` release (February 2023 #1)

Key highlights of this release:

- [Gatsby is joining Netlify](#gatsby-is-joining-netlify)
- [Head API supports context providers from `wrapRootElement`](#head-api-supports-context-providers-from-wraprootelement)

Also check out [notable bugfixes](#notable-bugfixes--improvements).

**Bleeding Edge:** Want to try new features as soon as possible? Install `gatsby@next` and let us know if you have any [issues](https://github.com/gatsbyjs/gatsby/issues).

[Previous release notes](/docs/reference/release-notes/v5.5)

[Full changelog][full-changelog]

---

## Gatsby is joining Netlify

In case you have missed the news, [Gatsby is joining Netlify](https://www.gatsbyjs.com/blog/gatsby-is-joining-netlify/) 🎉

**Gatsby as a framework will continue to evolve and grow.** We’ve always shared with Netlify a mutual commitment to open-source and have never been more excited about Gatsby’s future. Many of Gatsby’s core contributors will join Netlify and continue to maintain the Gatsby framework.

Be sure to join [our Discord](https://gatsby.dev/discord), follow [Gatsby](https://twitter.com/gatsbyjs) and [Netlify](https://twitter.com/Netlify) on Twitter or continue to read these release notes to know when we share our plans for the future.

## Head API supports context providers from `wrapRootElement`

`Head` now has access to React context provided by [`wrapRootElement` API](/docs/reference/config-files/gatsby-browser/#wrapRootElement)`. Example setup:

```jsx:title=gatsby-ssr/browser.js
import * as React from "react";
import { AppProviders } from "./src/components/app-providers";

export const wrapRootElement = ({ element }) => (
  <AppProviders>{element}</AppProviders>
);
```

```jsx:title=src/components/app-providers.js
import React from "react";
import { useStaticQuery, graphql } from "gatsby";

const SiteMetadataContext = React.createContext();

export const AppProviders = ({ children }) => {
  const data = useStaticQuery(graphql`
    {
      site {
        siteMetadata {
          title
        }
      }
    }
  `);

  return (
    <SiteMetadataContext.Provider value={data.site.siteMetadata}>
      {children}
    </SiteMetadataContext.Provider>
  );
};

export function useSiteMetadataContext() {
  return React.useContext(SiteMetadataContext);
}

```

```jsx:title=src/templates/default.js
import * as React from "react";
// highlight-next-line
import { useSiteMetadataContext } from "../components/app-providers";

export function Head() {
  // highlight-next-line
  const { title } = useSiteMetadataContext();

  return (
    <>
      <title>{title}</title>
    </>
  );
}

export default function DefaultPageTemplate() {
  // template details.
}
```

If [`wrapRootElement` API](/docs/reference/config-files/gatsby-browser/#wrapRootElement) is used to wrap templates with UI components those will be skipped and you will see warnings in browser console about invalid head elements. In this case it's recommended to move UI elements to [`wrapPageElement` API](/docs/reference/config-files/gatsby-browser/#wrapPageElement).

## Notable bugfixes & improvements

- `gatsby`:
  - Fix static query mapping when contentFilePath contains a space, via [PR #37544](https://github.com/gatsbyjs/gatsby/pull/37544)
  - Bump `@gatsbyjs/reach-router` to fix `husky` install issue, via [PR #37547](https://github.com/gatsbyjs/gatsby/pull/37547)
  - Support Slices in `DEV_SSR`, via [PR #37542](https://github.com/gatsbyjs/gatsby/pull/37542)
  - Move `react-dom-server` out of `framework` chunks, via [PR #37508](https://github.com/gatsbyjs/gatsby/pull/37508)
- `gatsby-plugin-utils`: Export two `IRemoteFile` utility types, via [PR #37532](https://github.com/gatsbyjs/gatsby/pull/37532)

## Contributors

A big **Thank You** to [our community who contributed][full-changelog] to this release 💜

TODO

[full-changelog]: https://github.com/gatsbyjs/gatsby/compare/gatsby@5.6.0-next.0...gatsby@5.6.0
