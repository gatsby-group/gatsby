import React from "react"
import moment from "moment"
import PostPublished from "../components/PostPublished"
import HelmetBlock from "../components/HelmetBlock"

class mdBlogPostTemplate extends React.Component {
  render() {
    const {html, frontmatter} = this.props.data.markdownRemark

    return (
      <div className="markdownPost">
        <HelmetBlock {...frontmatter} />
        <div className="content">
          <div className="markdown section">
            <div className="container content">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        </div>
        <PostPublished {...frontmatter} />
      </div>
    )
  }
}

export default mdBlogPostTemplate

export const pageQuery = graphql`
  query markdownTemplateBySlug($slug: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      html
      frontmatter {
        title
        path
        layoutType
        written
        updated
        what
        category
        description
      }
    }
  }
`
