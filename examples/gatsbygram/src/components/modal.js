import React, { useCallback, useEffect } from "react"
import Modal from "react-modal"
import { FaCaretLeft, FaCaretRight } from "react-icons/fa6"
import { MdClose } from "react-icons/md"
import findIndex from "lodash/findIndex"
import mousetrap from "mousetrap"
import * as PropTypes from "prop-types"
import { navigate, useStaticQuery, graphql } from "gatsby"

import { rhythm } from "../utils/typography"

let posts

Modal.setAppElement(`#___gatsby`)

const propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired,
  isOpen: PropTypes.bool,
  location: PropTypes.object.isRequired,
}

const GatsbyGramModal = ({ children, isOpen, location }) => {

  const findCurrentIndex = useCallback(() => {
    let index
    index = findIndex(
      posts,
      post => post.gatsbyPath === location.pathname
    )

    return index
  }, [location.pathname])

  const next = useCallback((e) => {
    if (e) {
      e.stopPropagation()
    }
    const currentIndex = findCurrentIndex()
    if (currentIndex || currentIndex === 0) {
      let nextPost
      // Wrap around if at end.
      if (currentIndex + 1 === posts.length) {
        nextPost = posts[0]
      } else {
        nextPost = posts[currentIndex + 1]
      }
      navigate(nextPost.gatsbyPath)
    }
  }, [findCurrentIndex])

  const previous = useCallback((e) => {
    if (e) {
      e.stopPropagation()
    }
    const currentIndex = findCurrentIndex()
    if (currentIndex || currentIndex === 0) {
      let previousPost
      // Wrap around if at start.
      if (currentIndex === 0) {
        previousPost = posts.slice(-1)[0]
      } else {
        previousPost = posts[currentIndex - 1]
      }
      navigate(previousPost.gatsbyPath)
    }
  }, [findCurrentIndex])

  useEffect(() => {
    mousetrap.bind(`left`, previous)
    mousetrap.bind(`right`, next)
    mousetrap.bind(`space`, (e) => {
      e.preventDefault()
      next()
    })

    return () => {
      mousetrap.unbind(`left`)
      mousetrap.unbind(`right`)
      mousetrap.unbind(`space`)
    }
  }, [next, previous])

  const data = useStaticQuery(graphql`
    query {
      allPostsJson {
        edges {
          node {
            gatsbyPath(filePath: "/{PostsJson.id}")
          }
        }
      }
    }
  `)

  if (!posts) {
    posts = data.allPostsJson.edges.map(e => e.node)
  }

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => navigate(`/`)}
      style={{
        overlay: {
          position: `fixed`,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0, 0, 0, 0.75)`,
        },
        content: {
          position: `absolute`,
          border: `none`,
          background: `none`,
          padding: 0,
          top: 0,
          bottom: 0,
          right: 0,
          left: 0,
          overflow: `auto`,
          WebkitOverflowScrolling: `touch`,
        },
      }}
      contentLabel="Modal"
    >
      {/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={() => navigate(`/`)}
        css={{
          display: `flex`,
          position: `relative`,
          height: `100vh`,
        }}
      >
        <div
          css={{
            display: `flex`,
            alignItems: `center`,
            justifyItems: `center`,
            maxWidth: rhythm(40.25), // Gets it right around Instagram's maxWidth.
            margin: `auto`,
            width: `100%`,
          }}
        >
          <FaCaretLeft
            data-testid="previous-post"
            css={{
              cursor: `pointer`,
              fontSize: `50px`,
              color: `rgba(255,255,255,0.7)`,
              userSelect: `none`,
            }}
            onClick={e => previous(e)}
          />
          {children}
          <FaCaretRight
            data-testid="next-post"
            css={{
              cursor: `pointer`,
              fontSize: `50px`,
              color: `rgba(255,255,255,0.7)`,
              userSelect: `none`,
            }}
            onClick={e => next(e)}
          />
        </div>
        <MdClose
          data-testid="modal-close"
          onClick={() => navigate(`/`)}
          css={{
            cursor: `pointer`,
            color: `rgba(255,255,255,0.8)`,
            fontSize: `30px`,
            position: `absolute`,
            top: rhythm(1 / 4),
            right: rhythm(1 / 4),
          }}
        />
      </div>
    </Modal>
  )
}

GatsbyGramModal.propTypes = propTypes

export default GatsbyGramModal
