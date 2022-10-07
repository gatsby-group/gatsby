---
title: Migrating from v4 to v5
---

Looking for the [v4 docs](https://v4.gatsbyjs.com)?

> Have you run into something that's not covered here? [Add your changes to GitHub](https://github.com/gatsbyjs/gatsby/tree/master/docs/docs/reference/release-notes/migrating-from-v4-to-v5.md)!

## Introduction

This is a reference for upgrading your site from Gatsby 4 to Gatsby 5. Version 5 introduces the Slices API and Partial Hydration. Slices unlock up to 90% reduction in build duration for content changes in highly shared components, Partial Hydration allows you to ship only the necessary JavaScript to the browser. If you're curious what's new, head over to the [v5.0 release notes](/docs/reference/release-notes/v5.0/).

## Table of Contents

- [Handling Deprecations](#handling-deprecations)
- [Updating Your Dependencies](#updating-your-dependencies)
- [Handling Breaking Changes](#handling-breaking-changes)
- [Future Breaking Changes](#future-breaking-changes)
- [For Plugin Maintainers](#for-plugin-maintainers)
- [Known Issues](#known-issues)

## Handling Deprecations

Before upgrading to v5 we highly recommend upgrading `gatsby` (and all plugins) to the latest v4 version.
Some changes required for Gatsby 5 could be applied incrementally to the latest v4 which should contribute to smoother upgrade experience.

> Use `npm outdated` or `yarn upgrade-interactive` for automatic upgrade to the latest v4 release.

After upgrading, run `gatsby build` and look for deprecation messages in the build log.
Follow instructions to fix those deprecations.

## Updating Your Dependencies

Next, you need to update your dependencies to v5.

### Update Gatsby version

You need to update your `package.json` to use the `latest` version of Gatsby.

```json:title=package.json
{
  "dependencies": {
    "gatsby": "^5.0.0"
  }
}
```

Or run

```shell
npm install gatsby@latest
```

Please note: If you use npm 7 you'll want to use the `--legacy-peer-deps` option when following the instructions in this guide. For example, the above command would be:

```shell
npm install gatsby@latest --legacy-peer-deps
```

### Update Gatsby related packages

Update your `package.json` to use the `latest` version of Gatsby related packages. You should upgrade any package name that starts with `gatsby-*`. Note, this only applies to plugins managed in the [gatsbyjs/gatsby](https://github.com/gatsbyjs/gatsby) repository. If you're using community plugins, they might not be upgraded yet. Please check their repository for the current status.

#### Updating community plugins

Using community plugins, you might see warnings like these in your terminal:

```shell
warning Plugin gatsby-plugin-acme is not compatible with your gatsby version 5.0.0 - It requires gatsby@^4.10.0
```

If you are using npm 7, the warning may instead be an error:

```shell
npm ERR! ERESOLVE unable to resolve dependency tree
```

This is because the plugin needs to update its `peerDependencies` to include the new version of Gatsby (see section [for plugin maintainers](#for-plugin-maintainers)). While this might indicate that the plugin has incompatibilities, in most cases they should continue to work. When using npm 7, you can pass the `--legacy-peer-deps` to ignore the warning and install anyway. Please look for already opened issues or PRs on the plugin's repository to see the status. If you don't see any, help the maintainers by opening an issue or PR yourself! :)

## Handling Breaking Changes

This section explains breaking changes that were made for Gatsby 5. Some of those changes had a deprecation message in v4. In order to successfully update, you'll need to resolve these changes.

### Minimal Node.js version 18.0.0

We are dropping support for Node 14 and 16 as a new underlying dependency is requiring `>=18.0.0`. See the main changes in [Node 18 release notes](https://nodejs.org/en/blog/release/v18.0.0/).

Check [Node’s releases document](https://github.com/nodejs/Release#nodejs-release-working-group) for version statuses.

### Minimal required React version is 18

The minimal required React version is now 18. This is a requirement for the new Partial Hydration feature.

### Non-ESM browsers are not polyfilled by default

Default support for non-esm browsers has been removed.

### GraphQL schema: Changes to sort and aggregation fields

As per the [RFC: Change to sort and aggregation fields API](https://github.com/gatsbyjs/gatsby/discussions/36242) the `sort` argument and aggregation's `field` argument were changed from enums to nested input objects. This change enabled lower resource usage and faster "building schema" step. Below you can find two examples (before/after):

**Sort:**

Before:

```graphql
{
  allMarkdownRemark(sort: { fields: [frontmatter___date], order: DESC }) {
    nodes {
      ...fields
    }
  }
}
```

After:

```jsx
{
  allMarkdownRemark(sort: { frontmatter: { date: DESC } }) {
    nodes {
      ...fields
    }
  }
}
```

**Aggregation:**

Before:

```graphql
{
  allMarkdownRemark {
    distinct(field: frontmatter___category)
  }
}
```

After:

```graphql
{
  allMarkdownRemark {
    distinct(field: { frontmatter: { category: SELECT } })
  }
}
```

### Gatsby related packages

Breaking Changes in plugins that we own and maintain.

## Future Breaking Changes

This section explains deprecations that were made for Gatsby 5. These old behaviors will be removed in v6, at which point they will no longer work. For now, you can still use the old behaviors in v4, but we recommend updating to the new signatures to make future updates easier.

### `<StaticQuery />` is deprecated

The `<StaticQuery />` component has been deprecated. Please use `useStaticQuery` instead. For more information, see the [useStaticQuery documentation](docs/how-to/querying-data/use-static-query/#composing-custom-usestaticquery-hooks). The component will be removed in v6.

## For Plugin Maintainers

In most cases, you won't have to do anything to be v5 compatible. The underlying changes mostly affect source plugins. But one thing you can do to be certain your plugin won't throw any warnings or errors is to set the proper peer dependencies.

Please also note that some of the items inside "Handling Breaking Changes" may also apply to your plugin.

`gatsby` should be included under `peerDependencies` of your plugin and it should specify the proper versions of support.

```diff:title=package.json
{
  "peerDependencies": {
-   "gatsby": "^4.0.0",
+   "gatsby": "^5.0.0",
  }
}
```

If your plugin supports both versions:

```diff:title=package.json
{
  "peerDependencies": {
-   "gatsby": "^4.0.0",
+   "gatsby": "^4.0.0 || ^5.0.0",
  }
}
```

If you defined the `engines` key you'll also need to update the minimum version:

```json:title=package.json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Known Issues

This section is a work in progress and will be expanded when necessary. It's a list of known issues you might run into while upgrading Gatsby to v5 and how to solve them.

If you encounter any problem, please let us know in this [GitHub discussion](https://github.com/gatsbyjs/gatsby/discussions/36609).
