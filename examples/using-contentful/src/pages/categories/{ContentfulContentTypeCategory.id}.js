import React from "react"
import * as PropTypes from "prop-types"

import { Link, graphql } from "gatsby"
import { GatsbyImage } from "gatsby-plugin-image"

import Layout from "../../layouts"
import { rhythm } from "../../utils/typography"

const propTypes = {
  data: PropTypes.object.isRequired,
}

class CategoryTemplate extends React.Component {
  render() {
    const category = this.props.data.contentfulContentTypeCategory
    const {
      title: { raw: title },
      linkedFrom: { ContentfulContentTypeProduct },
      icon,
    } = category
    const iconImg = icon.gatsbyImageData
    return (
      <Layout>
        <div
          style={{
            display: `flex`,
            alignItems: `center`,
            marginBottom: rhythm(1),
          }}
        >
          {iconImg && (
            <GatsbyImage
              style={{
                marginRight: rhythm(1 / 2),
              }}
              image={iconImg}
            />
          )}
          <h1 style={{ marginBottom: 0 }}>Category: {title}</h1>
        </div>
        <div>
          <h2>Products</h2>
          <ul>
            {ContentfulContentTypeProduct.length &&
              ContentfulContentTypeProduct.map((p, i) => (
                <li key={i}>
                  <Link to={p.gatsbyPath}>{p.productName.raw}</Link>
                </li>
              ))}
          </ul>
        </div>
      </Layout>
    )
  }
}

CategoryTemplate.propTypes = propTypes

export default CategoryTemplate

export const pageQuery = graphql`
  query ($id: String!) {
    contentfulContentTypeCategory(id: { eq: $id }) {
      title {
        raw
      }
      icon {
        gatsbyImageData(layout: FIXED, width: 75)
      }
      linkedFrom {
        ContentfulContentTypeProduct {
          gatsbyPath(filePath: "/products/{ContentfulContentTypeProduct.id}")
          id
          productName {
            raw
          }
        }
      }
    }
  }
`
