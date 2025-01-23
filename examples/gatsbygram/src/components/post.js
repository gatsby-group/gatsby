import * as PropTypes from "prop-types"
import React from "react"
import { FaHeart } from "react-icons/fa6"
import { Link, graphql } from "gatsby"
import Img from "gatsby-image"

import { rhythm, scale } from "../utils/typography"
import presets from "../utils/presets"

let touched = false

class Post extends React.Component {
  static propTypes = {
    post: PropTypes.shape({
      smallImage: PropTypes.object,
      likes: PropTypes.number,
      id: PropTypes.string.isRequired,
    }).isRequired,
  }
  constructor() {
    super()
    this.state = {
      hovering: false,
    }
  }

  render() {
    const { smallImage, likes, id } = this.props.post
    const { small } = smallImage.childImageSharp
    return (
      <Link
        data-testid="post"
        to={`/${id}/`}
        onTouchStart={() => (touched = true)}
        onMouseEnter={() => {
          if (!touched) {
            this.setState({ hovering: true })
          }
        }}
        onMouseLeave={() => {
          if (!touched) {
            this.setState({ hovering: false })
          }
        }}
        css={{
          display: `block`,
          flex: `1 0 0%`,
          marginRight: rhythm(1 / 8),
          width: `100%`,
          maxWidth: 290.1,
          position: `relative`,
          [presets.Tablet]: {
            marginRight: rhythm(1),
          },
          ":last-child": {
            marginRight: 0,
          },
        }}
      >
        <div
          css={{
            flexDirection: `column`,
            flexShrink: 0,
            position: `relative`,
            overflow: `hidden`,
          }}
        >
          <Img
            fluid={{ ...small }}
            css={{
              margin: 0,
              height: `100%`,
              width: `100%`,
              verticalAlign: `baseline`,
              position: `absolute`,
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
          <div
            css={{
              flexDirection: `column`,
              flexShrink: 0,
              position: `absolute`,
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
        </div>
        {/* overlay */}
        {this.state.hovering && (
          <div
            data-testid="likes"
            css={{
              position: `absolute`,
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: `rgba(0,0,0,0.3)`,
              display: `flex`,
              justifyContent: `center`,
              alignItems: `center`,
              color: `white`,
              ...scale(2 / 5),
            }}
          >
            <FaHeart
              css={{
                fontSize: `90%`,
                marginRight: rhythm(1 / 4),
              }}
            />
            {` `}
            {likes}
          </div>
        )}
      </Link>
    )
  }
}

export default Post

export const postFragment = graphql`
  fragment Post_details on PostsJson {
    id
    likes
    smallImage: image {
      childImageSharp {
        small: fluid(maxWidth: 292, maxHeight: 292) {
          src
          srcSet
          aspectRatio
          sizes
          tracedSVG
        }
      }
    }
  }
`
