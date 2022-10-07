---
title: Using Slices
---

> Support for the Gatsby Slice API was added in `gatsby@5.0.0`.

To further the improvements seen by [Incremental Builds](/blog/2020-04-22-announcing-incremental-builds/), Gatsby includes the [Slice API](/docs/reference/built-in-components/gatsby-slice) that allows you to split pages into individual parts.

By using the `<Slice>` React component in combination with the [`createSlice`](/docs/reference/config-files/actions/#createSlice) API for common UI features, Gatsby will be able to build and deploy individual pieces of your site that had content changes, not just entire pages.

## Faster builds in Gatsby Cloud

With the introduction of Incremental Builds, Gatsby Cloud has been able to reduce build times signficantly by only building the pages that changed. The `<Slice>` component helps reduce those builds times further.

Common components that are shared across the majority of pages on your site might include a navigation bar, footer, or contact form. In today's frameworks, when you re-order the navigation bar items, the entire site needs to be rebuilt. However, if the navigation bar was created as a Gatsby Slice, the new navigation items only need to be built once and all pages will pull the new navigation bar when it's needed.

## Using Gatsby Slice in your site

For this example, let's use the same scenario as described above - a large site that has a shared navigation bar.

```javascript:title=src/layouts/default-layout.jsx
import { NavigationBar, Footer } from "../components"

export const DefaultLayout = ({ children, navigationBarClassName }) => {
  return (
    <div>
      <NavigationBar className={navigationBarClassName} />
      {content}
      <Footer />
    </div>
  )
}
```

### Creating the Slice in `gatsby-node`

Creating a Gatsby Slice is done by using the [`createSlice`](/docs/reference/config-files/actions/#createSlice) action from the [`createPages`](/docs/reference/config-files/gatsby-node/#createPages) API in your `gatsby-node`.

```javascript:title=gatsby-node.js
exports.createPages = async ({ actions }) => {
  actions.createSlice({
    id: `navigation-bar`,
    component: require.resolve(`./src/components/navigation-bar.js`),
  })
}
```

Now that you have a `navigation-bar` Slice created, let's go use it!

### Using created Slices

Now you need to convert the `DefaultLayout` component to actually use the new Slice you created.

```diff
+import { Slice } from "gatsby"
-import { NavigationBar, Footer } from "../components"
+import { Footer } from "../components"

export const DefaultLayout = ({ children, navigationBarClassName }) => {
  return (
    <div className={styles.defaultLayout} />
-     <NavigationBar className={navigationBarClassName} />
+     <Slice alias="navigation-bar" className={navigationBarClassName} />
      {content}
      <Footer />
    </div>
  )
}
```

That's it! After a successful `gatsby build`, you should see a list of `Slices` that were built for your site.

### Using Context

Similar to the context that can be passed to pages in [`createPages`](/docs/reference/config-files/gatsby-node/#createPages), [`createSlice`](/docs/reference/config-files/actions/#createSlice) can also pass context to individual slices.

```javascript:title=gatsby-node.js
exports.createPages = async ({ actions }) => {
  actions.createSlice({
    id: `navigation-bar`,
    context: {
      jokeOfTheDay: `What's blue and not heavy? Light blue.`,
    },
    component: require.resolve(`./src/components/navigation-bar.js`),
  })
}
```

The data passed to `context` here will be handed down to the `NavigationBar` component with the key `sliceContext`.

```javascript:title=src/components/navigation-bar.jsx
// highlight-next-line
export const NavigationBar = ({ className, sliceContext }) => {
  return (
    <div className={className}>
      <Link to="/">Home</Link>
      // highlight-next-line
      <Link to="/jokes">{sliceContext.jokeOfTheDay}</Link>
    </div>
  )
}
```

### Using Aliases

There will be times where a single Slice will either need to be handed different context or swapped entirely depending on which page it's being rendered on.

This is where you can utilize the `alias` prop that is given to the `<Slice>` component. When you converted the `<NavigationBar>` component to a slice, you created the slice with an `id` of `navigation-bar`, but passed that value to the `alias` prop of `<Slice>`. Why is there a difference in key names?

An `alias` is not a 1-to-1 mapping of string-to-slice. When you create a page using [`createPages`](/docs/reference/config-files/gatsby-node/#createPages), you can pass a key-value map of alias-to-id to tell Gatsby which Slice to use throughout the page.

One common use case for this is localization. It's common to iterate over languages to create a page for each one. You can create a slice for each language by passing `context`. The `id` that a Slice is created with will be passed to [`createPage`](/docs/reference/config-files/actions/#createPage) to tell each page which slice to use.

In this example, you create a slice of `<NavigationBar>` for each supported language. When you create each page, Gatsby will tell the page which `navigation-bar` to use based on the language of the page Gatsby is creating.

```javascript:title=gatsby-node.js
const SUPPORTED_LANGUAGES = ['en', 'de', 'es']

exports.createPages = async ({ actions }) => {
  // create a slice with a unique ID for each language
  SUPPORTED_LANGUAGES.forEach(language => {
    actions.createSlice({
      // highlight-next-line
      id: `navigation-bar-${language}`,
      context: { language },
      component: require.resolve(`./src/components/navigation-bar.js`),
    })
  })

  // Query for all pages
  const pagesResult = await graphql('...')

  // Create a page for each page node + language
  pagesResult.data.edges.forEach(({ node }) => {
    SUPPORTED_LANGUAGES.forEach(language => {
      createPage({
        path: node.path,
        // a page component that utilizes DefaultLayout
        component: require.resolve(`./src/templates/page.js`),
        context: {
          pagePath: node.path,
          language,
        },
        slices: {
          // Any time `<Slice alias="navigation-bar">` is seen on this page,
          // use the `navigation-bar-${language}` id
          // highlight-next-line
          'navigation-bar': `navigation-bar-${language}`
        }
      })
    })
  })
}
```

## Additional Resources

- [Gatsby Slice API Reference](/docs/reference/built-in-components/gatsby-slice/)
- [Enable Slices API Optimizations](/docs/how-to/cloud/slices-optimization/)
