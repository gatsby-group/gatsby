import React from "react"
import Link from "gatsby-link"

import typography, { rhythm, scale } from "../../utils/typography"
import presets from "../../utils/presets"
import Container from "../../components/container"

class BlogPostsIndex extends React.Component {
  render() {
    const blogPosts = this.props.data.allMarkdownRemark.edges.map(
      edge => edge.node
    )
    return (
      <Container>
        <h1 css={{ marginTop: 0 }}>Blog</h1>
        {blogPosts.map(post => {
          const avatar =
            post.frontmatter.author.avatar.childImageSharp.responsiveResolution
          return (
            <div key={post.fields.slug} css={{ marginBottom: rhythm(2) }}>
              <Link to={post.fields.slug}>
                <h2
                  css={{
                    marginBottom: rhythm(1 / 8),
                  }}
                >
                  {post.frontmatter.title}
                </h2>
                <p>
                  {post.frontmatter.excerpt
                    ? post.frontmatter.excerpt
                    : post.excerpt}
                </p>
              </Link>
              <div>
                <img
                  alt={`Avatar for ${post.frontmatter.author.id}`}
                  src={avatar.src}
                  srcSet={avatar.srcSet}
                  height={avatar.height}
                  width={avatar.width}
                  css={{
                    borderRadius: `100%`,
                    display: `inline-block`,
                    marginRight: rhythm(1 / 2),
                    marginBottom: 0,
                    verticalAlign: `top`,
                  }}
                />
                <div
                  css={{
                    display: `inline-block`,
                    fontFamily: typography.options.headerFontFamily.join(`,`),
                    color: `rgba(0,0,0,.44)`,
                    ...scale(-2 / 5),
                    lineHeight: 1.3,
                    [presets.Mobile]: {
                      ...scale(-1 / 5),
                      lineHeight: 1.3,
                    },
                  }}
                >
                  <div>
                    {post.frontmatter.author.id}
                  </div>
                  <div>
                    {post.frontmatter.date}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </Container>
    )
  }
}

export default BlogPostsIndex

export const pageQuery = graphql`
  query BlogPostsIndexQuery {
    allMarkdownRemark(
      sort: { order: DESC, fields: [frontmatter___date] }
      filter: {
        frontmatter: { draft: { ne: true } }
        fileAbsolutePath: { regex: "/blog/" }
      }
    ) {
      edges {
        node {
          excerpt
          fields {
            slug
          }
          frontmatter {
            excerpt
            title
            date(formatString: "DD MMMM, YYYY")
            author {
              id
              avatar {
                childImageSharp {
                  responsiveResolution(width: 36, height: 36) {
                    width
                    height
                    src
                    srcSet
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`
