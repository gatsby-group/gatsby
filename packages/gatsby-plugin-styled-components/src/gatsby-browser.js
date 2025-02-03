import React from "react"
import { StyleSheetManager } from "styled-components"

// eslint-disable-next-line react/prop-types,react/display-name
exports.wrapRootElement = ({ element }, pluginOptions) => (
  <StyleSheetManager
    disableVendorPrefixes={pluginOptions?.disableVendorPrefixes === true}
    enableVendorPrefixes={pluginOptions?.disableVendorPrefixes === false}
  >
    {element}
  </StyleSheetManager>
)
