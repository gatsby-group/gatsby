import onPreBootstrap from "./gatsby-node/on-pre-bootstrap"
import sourceNodes from "./gatsby-node/source-nodes"
import createSchemaCustomization from "./gatsby-node/create-schema-customization"
import createResolvers from "./gatsby-node/create-resolvers"
import createPages from "./gatsby-node/create-pages"
import onPostBuild from "./gatsby-node/on-post-build"
import onCreateDevServer from "./gatsby-node/on-create-dev-server"

module.exports = {
  // 1. check plugin requirements
  // 2. do introspection on the WPGQL schema
  // 3. build gql queries and add to rematch/redux store
  onPreBootstrap,

  // 1. pull queries from redux store
  // 2. fetch all data from WPGQL or just fetch changed data since the last build
  sourceNodes,

  // 1. introspect WPGQL types
  // 2. normalize the WPGQL schema and add to the Gatsby schema
  createSchemaCustomization,

  // 1. fetch and create image file nodes when they're queried for
  // 2. set the file node id of each image in our redux store for cacheing
  createResolvers,

  // in production, cache the image nodes we've collected up into our redux store
  // so we can touch them on the next build
  onPostBuild,

  // this will be moved into our theme, but lives here for now
  // this builds out a Gatsby page for each WordPress page/post using
  // the path from the WordPress permalink
  createPages,

  // 1. in development, cache the image nodes we've collected up into our redux store
  // so we can touch them on the next build
  // 2. start the interval refetcher in development mode for real-time data updates
  onCreateDevServer,
}
