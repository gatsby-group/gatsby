# gatsby-plugin-styled-components

A [Gatsby](https://github.com/gatsbyjs/gatsby) plugin for
[styled-components](https://github.com/styled-components/styled-components) with
built-in server-side rendering support.

## Install

```shell
npm install gatsby-plugin-styled-components styled-components babel-plugin-styled-components
```

## How to use

Edit `gatsby-config.js`

```javascript
module.exports = {
  plugins: [
    {
      resolve: `gatsby-plugin-styled-components`,
      options: {
        // Add any options here
      },
    },
  ],
}
```

## Options

You can pass options to the plugin, see the [Styled Components docs](https://styled-components.com/docs/tooling#babel-plugin) for a full list of options.

For example, to disable the `displayName` option:

```js
options: {
  displayName: false
}
```

Note: The `ssr` option will be ignored. Gatsby will apply it automatically when needed.

### Disabling vendor prefixing

If you require vendor prefixes for adding legacy CSS properties then this can be enabled by supplying the `enableVendorPrefixes` option:

```js
options: {
  enableVendorPrefixes: true
}
```
