import * as React from "react"
import { Server as Styletron } from "styletron-engine-atomic"
import { Provider } from "styletron-react"

const instances = {}

export function wrapRootElement({ element }, options) {
  const instance = new Styletron({ prefix: options.prefix })
  instances[element.props.url] = instance

  return <Provider value={instance}>{element}</Provider>
}

export function onRenderBody({ pathname, setHeadComponents }) {
  const instance = instances[pathname]
  if (!instance) {
    return
  }

  const stylesheets = instance.getStylesheets()

  if (stylesheets.length) {
    const headComponents = stylesheets.map((sheet, index) => (
      <style
        className="_styletron_hydrate_"
        dangerouslySetInnerHTML={{
          __html: sheet.css,
        }}
        key={`styletron-${index}`}
        media={sheet.attrs.media}
        data-hydrate={sheet.attrs[`data-hydrate`]}
      />
    ))

    setHeadComponents(headComponents)
  }
}
