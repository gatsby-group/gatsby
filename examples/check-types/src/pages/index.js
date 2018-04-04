import React from "react"
import PropTypes from "prop-types"
import isChildOfType from "gatsby-is-child-of-type"

const Bar = props => <div>bar: {props.hello}</div>

Bar.propTypes = {
  hello: PropTypes.string,
}

const Foo = props => {
  const newChildren = React.Children.map(
    props.children,
    child =>
      isChildOfType(child, Bar) ? (
        React.cloneElement(child, { hello: `world` })
      ) : (
        <div>not same</div>
      )
  )
  return <div>{newChildren}</div>
}

const IndexComponent = () => (
  <Foo>
    <Bar />
  </Foo>
)

export default IndexComponent
