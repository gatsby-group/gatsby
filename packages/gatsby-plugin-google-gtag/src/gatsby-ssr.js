import React from "react"
import { Minimatch } from "minimatch"

exports.onRenderBody = (
  { setHeadComponents, setPostBodyComponents },
  pluginOptions
) => {
  const pluginConfig = pluginOptions.pluginConfig || {}

  if (
    pluginConfig.disabled ||
    (process.env.NODE_ENV !== `production` && process.env.NODE_ENV !== `test`)
  )
    return null

  const gtagConfig = pluginOptions.gtagConfig || {}

  const origin = pluginConfig.origin || `https://www.googletagmanager.com`

  // Lighthouse recommends pre-connecting to google tag manager
  setHeadComponents([
    <link rel="preconnect" key="preconnect-google-gtag" href={origin} />,
    <link rel="dns-prefetch" key="dns-prefetch-google-gtag" href={origin} />,
  ])

  // Prevent duplicate or excluded pageview events being emitted on initial load of page by the `config` command
  // https://developers.google.com/analytics/devguides/collection/gtagjs/#disable_pageview_tracking

  gtagConfig.send_page_view = false

  const firstTrackingId =
    pluginOptions.trackingIds && pluginOptions.trackingIds.length
      ? pluginOptions.trackingIds[0]
      : ``

  const excludeGtagPaths = []
  if (typeof pluginConfig.exclude !== `undefined`) {
    pluginConfig.exclude.map(exclude => {
      const mm = new Minimatch(exclude)
      excludeGtagPaths.push(mm.makeRe())
    })
  }

  const setComponents = pluginConfig.head
    ? setHeadComponents
    : setPostBodyComponents

  const renderHtml = () => `
      ${
        excludeGtagPaths.length
          ? `window.excludeGtagPaths=[${excludeGtagPaths.join(`,`)}];`
          : ``
      }
      ${
        typeof gtagConfig.anonymize_ip !== `undefined` &&
        gtagConfig.anonymize_ip === true
          ? `function gaOptout(){document.cookie=disableStr+'=true; expires=Thu, 31 Dec 2099 23:59:59 UTC;path=/',window[disableStr]=!0}var gaProperty='${firstTrackingId}',disableStr='ga-disable-'+gaProperty;document.cookie.indexOf(disableStr+'=true')>-1&&(window[disableStr]=!0);`
          : ``
      }
      if(${
        pluginConfig.respectDNT
          ? `!(navigator.doNotTrack == "1" || window.doNotTrack == "1")`
          : `true`
      }) {
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        ${pluginOptions.trackingIds
          .map(
            trackingId =>
              `gtag('config', '${trackingId}', ${JSON.stringify(gtagConfig)});`
          )
          .join(``)}
      }
      `

  return setComponents([
    <script
      key={`gatsby-plugin-google-gtag`}
      async
      src={`${origin}/gtag/js?id=${firstTrackingId}`}
    />,
    <script
      key={`gatsby-plugin-google-gtag-config`}
      dangerouslySetInnerHTML={{ __html: renderHtml() }}
    />,
  ])
}
