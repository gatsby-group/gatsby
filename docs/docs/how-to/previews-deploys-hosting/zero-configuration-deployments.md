---
title: Zero-Configuration Deployments
---

## Introduction

Zero-configuration deployments are powered by [adapters](/docs/how-to/previews-deploys-hosting/adapters/). If you use one of the [supported deployment platforms](#supported-deployment-platforms), Gatsby automatically installs and uses the correct adapter when you deploy your project.

This feature was added in `gatsby@5.12.0`.

## Supported deployment platforms

Gatsby currently supports these platforms for zero-configuration deployments:

- [gatsby-adapter-netlify](https://github.com/gatsbyjs/gatsby/tree/master/packages/gatsby-adapter-netlify) for [Netlify](https://www.netlify.com/)

### Manually installing the adapter

If your adapter provides options that you can set, you must manually install the adapter to your `dependencies` to change any of the values. Read the [adapters guide](/docs/how-to/previews-deploys-hosting/adapters/) to learn how to use an adapter.

If you plan on using a specific deployment platform for a long period of time, you may also want to install the adapter to your `dependencies`. This will give you faster and more robust installs.

### Disabling adapters

Zero-configuration deployments are intended to simplify and improve the build and deploy experience. However, if you find that you need more control over your process, you can [disable adapters](/docs/how-to/previews-deploys-hosting/adapters/#disabling-adapters).

## Adding additional adapters

Gatsby's zero-configuration deployment setup is controlled through an [`adapters.js`](https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby/adapters.js) file. If you followed the [Creating an Adapter guide](/docs/how-to/previews-deploys-hosting/creating-an-adapter/) and want to add your adapter to this manifest, you can open a pull request.

**Please note:** While we welcome all pull requests, there is no guarantee that all adapters will be added to the official manifest. The Gatsby team will review your adapter and provide feedback as appropriate.

## Additional resources

- [Adapters](/docs/how-to/previews-deploys-hosting/adapters/)
- [Creating an Adapter](/docs/how-to/previews-deploys-hosting/creating-an-adapter/)
