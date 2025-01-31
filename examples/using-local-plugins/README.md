# Using a local plugin

This example demonstrates usage of a local plugin -- in this case a source plugin.

You might also be interested in the docs section on [local plugins](/docs/creating-a-local-plugin/), or the [source plugin tutorial](/tutorial/source-plugin-tutorial/).

## Using Gatsby's GraphQL integration layer

This example site is also intended as a direct comparison to the [using-gatsby-without-graphql](../using-gatsby-without-graphql), which illustrates how to use an "unstructured data" approach (or, without making use of the GraphQL integration layer).

## Sourcing data using a local plugin

This example uses a [local plugin](/docs/loading-plugins-from-your-local-plugins-folder/) to:

1. Load data from the PokéAPI’s REST endpoints
2. Process that data into Gatsby's node format
3. Use the [`createNode` action](/docs/reference/config-files/actions/#createNode) to add the data to Gatsby’s GraphQL layer

The [`gatsby-node.js` file](./plugins/gatsby-source-pokeapi/gatsby-node.js) of the local plugin includes detailed comments on the process.

## Examples loading multiple local plugins outside the plugins folder

To see how to load multiple plugins from outside the plugins folder, refer to the [`using-multiple-local-plugins` example repository](https://github.com/gatsbyjs/gatsby/tree/master/examples/using-multiple-local-plugins).
