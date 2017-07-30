const Db = require(`mongodb`).Db,
      MongoClient = require(`mongodb`).MongoClient,
      ObjectID = require(`mongodb`).ObjectID,
      crypto = require(`crypto`),
      _ = require(`lodash`)

exports.sourceNodes = (
  { boundActionCreators, getNode, hasNodeChanged },
  pluginOptions,
  done
) => {
  const { createNode, deleteNode } = boundActionCreators

  let serverOptions = pluginOptions.server || {
    address: `localhost`,
    port: 27017,
  }
  let dbName = pluginOptions.dbName || `local`,
    authUrlPart = ``
  if (pluginOptions.auth)
    authUrlPart = `${pluginOptions.auth.user}:${pluginOptions.auth.password}@`

  MongoClient.connect(
    `mongodb://${authUrlPart}${serverOptions.address}:${serverOptions.port}/${dbName}`,
    function(err, db) {
      // Establish connection to db
      if (err) {
        console.warn(err)
        return
      }

      createNodes(db, pluginOptions, dbName, createNode, done)
    }
  )
}

function createNodes(db, pluginOptions, dbName, createNode, done) {
  console.log(`create nodes for mongoDB ...`)
  let collectionName = pluginOptions.collection || `documents`
  let collection = db.collection(collectionName)
  let cursor = collection.find()

  // Execute the each command, triggers for each document
  cursor.each(function(err, item) {
    // If the item is null then the cursor is exhausted/empty and closed
    if (item == null) {
      // Let's close the db
      db.close()
      done()
    } else {
      var node = {
        // Data for the node.
        ...item,
        id: `${item._id}`,
        parent: `__${collectionName}__`,
        children: [],
        internal: {
          type: `mongodb${caps(dbName)}${caps(collectionName)}`,
          content: JSON.stringify(item),
          contentDigest: crypto
            .createHash(`md5`)
            .update(JSON.stringify(item))
            .digest(`hex`),
        },
      }
      if (pluginOptions.map) {
        // We need to map certain fields to a contenttype.
        var keys = Object.keys(pluginOptions.map).forEach(mediaItemFieldKey => {
            console.log(mediaItemFieldKey + " " + item[mediaItemFieldKey], item);
            createMappingChildNodes(node, mediaItemFieldKey, item[mediaItemFieldKey], createNode);

            delete item[mediaItemFieldKey];
        });
      }
      createNode(node);
    }
  })
}

function createMappingChildNodes(node, key, text, createNode) { 
  const str = _.isString(text) ? text : ` `
  const mappingNode = {
    id: `${node.id}${key}MappingNode`,
    parent: node.id,
    children: [],
    [key]: str,
    internal: {
      type: _.camelCase(`${node.internal.type} ${key} MappingNode`),
      mediaType: `text/x-markdown`,
      content: str,
      contentDigest: crypto
            .createHash(`md5`)
            .update(JSON.stringify(text))
            .digest(`hex`),
    }, 
  }

  node.children = node.children.concat([mappingNode.id])
  createNode(mappingNode)

  return mappingNode.id
}

function caps(s) {
  return s.replace(/\b\w/g, l => l.toUpperCase())
}
