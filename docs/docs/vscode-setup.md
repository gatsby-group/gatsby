---
title: "Setting up Visual Studio Code for Gatsby development"
---

VS Code is a wonderful tool that can require some initial setup to get everything working. Here are some recommendations to get code flowing smoothly. 

## Initial Setup

### .gitignore

You should add the `.vscode` folder to your `.gitignore`, as your workspace settings and perferences should not be committed to a git repository. Consider setting up an `.editorconfig` file if you need to sync different settings like linting preferences across editors.

### Correcting IntelliSense

You should add the `typescript` package as a global or dev dependency for your project so that you can benefit from the TypeScript-driven refactoring and other development goodies.

`yarn global add typescript` will add it globally.

The following `jsconfig.json` is recommended for getting better IntelliSense on your `.js` files while working.

```json5
{
  "compilerOptions": {
    "target": "es2016",
    "jsx": "react",
    // "baseUrl": "src", if you are using gatsby-plugin-resolve-src
    "moduleResolution": "node"
  },
  "include": ["src"] // Don't pickup on .cache or public by accident!
}
```

## Debugging

### Chrome

In order to get started you need to install the [Debugger for Chrome extension](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome), and [add a custom Webpack config](/docs/add-custom-webpack-config).

The extra webpack config is as follows, and it is simply just adding the following lines to your `gatsby-node.js`.

```js
exports.onCreateWebpackConfig = ({ actions, stage }) => {
  switch (stage) {
    case `develop`:
      // Improve sourcemaps for Chrome Debugging
      actions.setWebpackConfig({
        devtool: `inline-module-source-map`,
      })
      break
  }
}
```

Afterwards in the `.vscode/launch.json` file, the following config will launch a new window that attaches to your website after you have started `gatsby develop`. It includes a `userDataDir` so that a seperate Chrome instance pops up with no extra user settings or plugins. Plugins like React Developer Tools are still available from the store, and chrome settings are persisted between runs.

```json5
// launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome for Gatsby site",
      "url": "http://localhost:8000",
      "webRoot": "${workspaceFolder}",
      "userDataDir": "${workspaceFolder}/.vscode/chromeUserDataDir"
    }
  ]
} 
```
