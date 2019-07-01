import React, { Fragment } from "react"
import { Link } from "gatsby"
import { Styled, css, Main } from "theme-ui"

import Layout from "../components/layout"
import SEO from "../components/seo"
import Footer from "../components/home-footer"

const Posts = ({ location, posts, siteTitle }) => (
  <Layout location={location} title={siteTitle}>
    <Main>
      {posts.map(({ node }) => {
        const title = node.frontmatter.title || node.fields.slug
        const keywords = node.frontmatter.keywords || []
        return (
          <Fragment key={node.fields.slug}>
            <SEO title="Home" keywords={keywords} />
            <div>
              <Styled.h2
                css={css({
                  mb: 1,
                })}
              >
                <Styled.a
                  as={Link}
                  css={{
                    textDecoration: `none`,
                  }}
                  to={node.fields.slug}
                >
                  {title}
                </Styled.a>
              </Styled.h2>
              <small>{node.frontmatter.date}</small>
              <Styled.p>{node.excerpt}</Styled.p>
            </div>
          </Fragment>
        )
      })}
    </Main>
    <Footer />
  </Layout>
)

export default Posts
