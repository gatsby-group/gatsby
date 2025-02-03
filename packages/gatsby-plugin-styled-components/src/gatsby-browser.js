import React from "react"
import { StyleSheetManager } from "styled-components"

// eslint-disable-next-line react/prop-types,react/display-name
exports.wrapRootElement = ({ element }, pluginOptions) => (
  <StyleSheetManager
    enableVendorPrefixes={pluginOptions?.enableVendorPrefixes === true}
  >
    {element}
  </StyleSheetManager>
)
