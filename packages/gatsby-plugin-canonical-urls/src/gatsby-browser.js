export const onRouteUpdate = (
  { location },
  pluginOptions = { stripQueryString: false, excludes: [] }
) => {
  if (pluginOptions.excludes?.includes(location.pathname)) {
    return
  }
  const domElem = document.querySelector(`link[rel='canonical']`)
  const existingValue = domElem.getAttribute(`href`)
  const baseProtocol = domElem.getAttribute(`data-baseProtocol`)
  const baseHost = domElem.getAttribute(`data-baseHost`)
  if (existingValue && baseProtocol && baseHost) {
    let value = `${baseProtocol}//${baseHost}${location.pathname}`

    const { stripQueryString } = pluginOptions

    if (!stripQueryString) {
      value += location.search
    }

    value += location.hash

    domElem.setAttribute(`href`, `${value}`)
  }
}
