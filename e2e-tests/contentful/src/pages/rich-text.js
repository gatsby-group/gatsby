import { graphql } from "gatsby"
import { GatsbyImage } from "gatsby-plugin-image"
import * as React from "react"
import slugify from "slugify"

import { BLOCKS, MARKS, INLINES } from "@contentful/rich-text-types"
import { renderRichText } from "gatsby-source-contentful"

import Layout from "../components/layout"

import * as components from "../components/references"

function renderReferencedComponent(ref) {
  const Component = components[ref.__typename]
  if (!Component) {
    throw new Error(
      `Unable to render referenced component of type ${ref.__typename}`
    )
  }
  return <Component {...ref} />
}

const makeOptions = ({ assetBlockMap, entryBlockMap, entryInlineMap }) => ({
  renderMark: {
    [MARKS.BOLD]: text => <strong data-cy-strong>{text}</strong>,
  },
  renderNode: {
    [BLOCKS.EMBEDDED_ASSET]: node => {
      const asset = assetBlockMap.get(node?.data?.target?.sys.id)
      if (asset.gatsbyImageData) {
        return <GatsbyImage image={asset.gatsbyImageData} />
      }
      return (
        <>
          <h2>Embedded NON-Image Asset</h2>
          <pre>
            <code>{JSON.stringify(asset, null, 2)}</code>
          </pre>
        </>
      )
    },
    [BLOCKS.EMBEDDED_ENTRY]: node => {
      const entry = entryBlockMap.get(node?.data?.target?.sys.id)
      if (!entry) {
        throw new Error(
          `Entity not available for node:\n${JSON.stringify(node, null, 2)}`
        )
      }
      return renderReferencedComponent(entry)
    },
    [INLINES.EMBEDDED_ENTRY]: node => {
      const entry = entryInlineMap.get(node?.data?.target?.sys.id)
      if (entry.__typename === "ContentfulContentTypeText") {
        return (
          <span data-cy-id="inline-text">
            [Inline-ContentfulContentTypeText] {entry.short}
          </span>
        )
      }
      return (
        <span>
          [Inline-{entry.__typename}] {entry.title}
        </span>
      )
    },
  },
})

const RichTextPage = ({ data }) => {
  const defaultEntries = data.default.nodes
  const englishEntries = data.english.nodes
  const germanEntries = data.german.nodes
  return (
    <Layout>
      {defaultEntries.map(({ id, title, richText }) => {
        const slug = slugify(title, { strict: true, lower: true })
        return (
          <div data-cy-id={slug} key={id}>
            <h2>{title}</h2>
            {renderRichText(richText, makeOptions)}
            <hr />
          </div>
        )
      })}

      <h1>English Locale</h1>
      {englishEntries.map(({ id, title, richTextLocalized }) => {
        const slug = slugify(title, { strict: true, lower: true })
        return (
          <div data-cy-id={`english-${slug}`} key={id}>
            <h2>{title}</h2>
            {renderRichText(richTextLocalized, makeOptions)}
            <hr />
          </div>
        )
      })}

      <h1>German Locale</h1>
      {germanEntries.map(({ id, title, richTextLocalized }) => {
        const slug = slugify(title, { strict: true, lower: true })
        return (
          <div data-cy-id={`german-${slug}`} key={id}>
            <h2>{title}</h2>
            {renderRichText(richTextLocalized, makeOptions)}
            <hr />
          </div>
        )
      })}
    </Layout>
  )
}

export default RichTextPage

export const pageQuery = graphql`
  query RichTextQuery {
    default: allContentfulContentTypeRichText(
      sort: { title: ASC }
      filter: {
        title: { glob: "!*Localized*|*Validated*" }
        sys: { locale: { eq: "en-US" } }
      }
    ) {
      nodes {
        id
        title
        richText {
          json
          links {
            assets {
              block {
                sys {
                  id
                }
                gatsbyImageData(width: 200)
              }
            }
            entries {
              block {
                __typename
                sys {
                  id
                  type
                }
                ... on ContentfulContentTypeText {
                  title
                  short
                }
                ... on ContentfulContentTypeLocation {
                  location {
                    lat
                    lon
                  }
                }
                ... on ContentfulContentTypeContentReference {
                  title
                  one {
                    __typename
                    ... on ContentfulEntry {
                      sys {
                        id
                      }
                    }
                    ... on ContentfulContentTypeText {
                      title
                      short
                    }
                    ... on ContentfulContentTypeContentReference {
                      title
                      one {
                        ... on ContentfulContentTypeContentReference {
                          title
                        }
                      }
                      many {
                        ... on ContentfulContentTypeContentReference {
                          title
                        }
                      }
                    }
                  }
                  many {
                    __typename
                    ... on ContentfulEntry {
                      sys {
                        id
                      }
                    }
                    ... on ContentfulContentTypeText {
                      title
                      short
                    }
                    ... on ContentfulContentTypeNumber {
                      title
                      integer
                    }
                    ... on ContentfulContentTypeContentReference {
                      title
                      one {
                        ... on ContentfulContentTypeContentReference {
                          title
                        }
                      }
                      many {
                        ... on ContentfulContentTypeContentReference {
                          title
                        }
                      }
                    }
                  }
                }
              }
              inline {
                __typename
                sys {
                  id
                  type
                }
                ... on ContentfulContentTypeText {
                  title
                  short
                }
              }
            }
          }
        }
      }
    }
    english: allContentfulContentTypeRichText(
      sort: { title: ASC }
      filter: {
        title: { glob: "*Localized*" }
        sys: { locale: { eq: "en-US" } }
      }
    ) {
      nodes {
        id
        title
        richTextLocalized {
          json
        }
      }
    }
    german: allContentfulContentTypeRichText(
      sort: { title: ASC }
      filter: {
        title: { glob: "*Localized*" }
        sys: { locale: { eq: "de-DE" } }
      }
    ) {
      nodes {
        id
        title
        richTextLocalized {
          json
        }
      }
    }
  }
`
