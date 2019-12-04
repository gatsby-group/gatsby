import { parse } from "url"
import execall from "execall"
import store from "../../store"

const remoteFileRegex = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[A-Z0-9+&@#/%=~_|$])\.(?:jpeg|jpg|png|gif|ico|pdf|doc|docx|ppt|pptx|pps|ppsx|odt|xls|psd|mp3|m4a|ogg|wav|mp4|m4v|mov|wmv|avi|mpg|ogv|3gp|3g2|svg|bmp|tif|tiff|asf|asx|wm|wmx|divx|flv|qt|mpe|webm|mkv|txt|asc|c|cc|h|csv|tsv|ics|rtx|css|htm|html|m4b|ra|ram|mid|midi|wax|mka|rtf|js|swf|class|tar|zip|gz|gzip|rar|7z|exe|pot|wri|xla|xlt|xlw|mdb|mpp|docm|dotx|dotm|xlsm|xlsb|xltx|xltm|xlam|pptm|ppsm|potx|potm|ppam|sldx|sldm|onetoc|onetoc2|onetmp|onepkg|odp|ods|odg|odc|odb|odf|wp|wpd|key|numbers|pages)(?=")/gi

export const createGatsbyNodesFromWPGQLContentNodes = async (
  { wpgqlNodesByContentType },
  { actions, createContentDigest }
) => {
  const createdNodeIds = []

  for (const wpgqlNodesGroup of wpgqlNodesByContentType) {
    const wpgqlNodes = wpgqlNodesGroup.allNodesOfContentType

    for (const node of wpgqlNodes.values()) {
      if (node.link) {
        // create a pathname for the node using the WP permalink
        node.path = parse(node.link).pathname
      }

      // here we're searching for file strings in our node
      // we use this to download only the media items
      // that are being used in posts
      // this is important not only for downloading only used images
      // but also for downloading images in post content
      if (wpgqlNodesGroup.singular !== `mediaItems`) {
        const nodeString = JSON.stringify(node)

        const matches = execall(remoteFileRegex, nodeString)

        if (matches.length) {
          store.dispatch.imageNodes.addUrlMatches(matches)
        }
      }

      await actions.createNode({
        ...node,
        id: node.id,
        parent: null,
        internal: {
          contentDigest: createContentDigest(node),
          // @todo allow namespacing types with a plugin option. Default to `Wp`
          type: `Wp${node.type}`,
        },
      })

      createdNodeIds.push(node.id)
    }
  }

  return createdNodeIds
}
