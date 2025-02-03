import React from "react"
import { ServerStyleSheet, StyleSheetManager } from "styled-components"

const sheetByPathname = new Map()

// eslint-disable-next-line react/prop-types,react/display-name
exports.wrapRootElement = ({ element, pathname }, pluginOptions) => {
  const sheet = new ServerStyleSheet()
  sheetByPathname.set(pathname, sheet)
  return (
    <StyleSheetManager
      sheet={sheet.instance}
      disableVendorPrefixes={pluginOptions?.disableVendorPrefixes}
      enableVendorPrefixes={!pluginOptions?.disableVendorPrefixes}
    >
      {element}
    </StyleSheetManager>
  )
}

exports.onRenderBody = ({ setHeadComponents, pathname }) => {
  const sheet = sheetByPathname.get(pathname)
  if (sheet) {
    setHeadComponents([sheet.getStyleElement()])
    sheetByPathname.delete(pathname)
  }
}
