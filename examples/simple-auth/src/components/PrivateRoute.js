import React, { useEffect } from "react"
import PropTypes from "prop-types"
import { navigate } from "gatsby"
import { isLoggedIn } from "../utils/auth"

const PrivateRoute = ({ component: Component, location, ...rest }) => {

  useEffect(() => {
    if (!isLoggedIn() && location.pathname !== `/app/login`) {
      // If we’re not logged in, redirect to the home page.
      navigate(`/app/login/`)
      // I had to comment this line as useEffect can't return null
      // return null
    }
  }, [location.pathname])

  return <Component {...rest} />
}

PrivateRoute.propTypes = {
  component: PropTypes.any.isRequired,
}

export default PrivateRoute
