# gatsby-plugin-google-gtag

Easily add Google Global Site Tag to your Gatsby site.

> The global site tag (gtag.js) is a JavaScript tagging framework and API that allows you to send event data to Google Analytics, Google Ads, Campaign Manager, Display & Video 360, and Search Ads 360.

Global site tag (gtag.js) is meant to combine multiple Google tagging systems and can replace older ones such as [analytics.js](https://developers.google.com/analytics/devguides/collection/analyticsjs/) ([gatsby-plugin-google-analytics](https://www.gatsbyjs.com/plugins/gatsby-plugin-google-analytics/)).

For more general information on gtag you can read Google's official documentation on the subject: https://developers.google.com/gtagjs/.

If you're migrating from analytics.js (gatsby-plugin-google-analytics) you can read about the subtle API differences in more depth at: https://developers.google.com/analytics/devguides/migration/ua/analyticsjs-to-gtagjs.

**Please note:** This plugin only works in production mode! To test that your Global Site Tag is installed and firing events correctly run: `gatsby build && gatsby serve.`

## Install

```shell
npm install gatsby-plugin-google-gtag
```

## How to use

The `trackingIds` option is **required** for this plugin to work correctly.

```js:title=gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: `gatsby-plugin-google-gtag`,
      options: {
        // You can add multiple tracking ids and a pageview event will be fired for all of them.
        trackingIds: [
          "GA-TRACKING_ID", // Google Analytics / GA
          "AW-CONVERSION_ID", // Google Ads / Adwords / AW
          "DC-FLOODIGHT_ID", // Marketing Platform advertising products (Display & Video 360, Search Ads 360, and Campaign Manager)
        ],
        // This object gets passed directly to the gtag config command
        // This config will be shared across all trackingIds
        gtagConfig: {
          optimize_id: "OPT_CONTAINER_ID",
          anonymize_ip: true,
          cookie_expires: 0,
        },
        // This object is used for configuration specific to this plugin
        pluginConfig: {
          // Puts tracking script in the head instead of the body
          head: false,
          // Setting this parameter is also optional
          respectDNT: true,
          // Avoids sending pageview hits from custom paths
          exclude: ["/preview/**", "/do-not-track/me/too/"],
          // Defaults to https://www.googletagmanager.com
          origin: "YOUR_SELF_HOSTED_ORIGIN",
          // Delays processing pageview events on route update (in milliseconds)
          delayOnRouteUpdate: 0,
          // Prevents the tag to appear
          disabled: false,
        },
      },
    },
  ],
}
```

### `gtagConfig.anonymize_ip` option

Some countries (such as Germany) require you to use the
[\_anonymizeIP](https://support.google.com/analytics/answer/2763052) function for
Google Site Tag. Otherwise you are not allowed to use it. The option adds the
block of code below:

```js
function gaOptout() {
  ;(document.cookie =
    disableStr + "=true; expires=Thu, 31 Dec 2099 23:59:59 UTC;path=/"),
    (window[disableStr] = !0)
}

var gaProperty = "UA-XXXXXXXX-X",
  disableStr = "ga-disable-" + gaProperty
document.cookie.indexOf(disableStr + "=true") > -1 && (window[disableStr] = !0)
```

If your visitors should be able to set an Opt-Out-Cookie (No future tracking)
you can set a link e.g. in your imprint as follows:

`<a href="javascript:gaOptout();">Deactivate Google Tracking</a>`

### `gtagConfig.optimize_id` option

If you need to use Google Optimize for A/B testing, you can add this optional Optimize container id to allow Google Optimize to load the correct test parameters for your site.

### Other `gtagConfig` options

The `gtagConfig` is passed directly to the gtag config command, so you can specify everything it supports, e.g. `gtagConfig.cookie_name`, `gtagConfig.sample_rate`. If you're migrating from the analytics.js plugin, this means that all Create Only Fields should be snake_cased.

### `pluginConfig.respectDNT` option

If you enable this optional option, Google Global Site Tag will not be loaded at all for visitors that have "Do Not Track" enabled. While using Google Global Site Tag does not necessarily constitute Tracking, you might still want to do this to cater to more privacy oriented users.

### `pluginConfig.exclude` option

If you need to exclude any path from the tracking system, you can add it (one or more) to this optional array as glob expressions.

### `pluginConfig.delayOnRouteUpdate` option

If you need to delay processing pageview events on route update (e.g. to wait for page transitions with [`gatsby-plugin-transition-link`](https://www.gatsbyjs.com/plugins/gatsby-plugin-transition-link/)), then this option adds a delay before generating the pageview event.

## Custom Events

This plugin automatically sends a "pageview" event to all products given as "trackingIds" on every Gatsbys route change.

If you want to call a custom event you have access to `window.gtag` where you can call an event for all products:

```js
window.gtag("event", "click", { ...data })
```

or you can target a specific product:

```js
window.gtag("event", "click", { send_to: "AW-CONVERSION_ID", ...data })
```

In either case don't forget to guard against SSR:

```js
typeof window !== "undefined" && window.gtag("event", "click", { ...data })
```

## `<OutboundLink>` component

To make it easy to track clicks on outbound links the plugin provides a component.

To use it, simply import it and use it like you would the `<a>` element e.g.

```jsx
import React from "react"
import { OutboundLink } from "gatsby-plugin-google-gtag"

export default () => (
  <div>
    <OutboundLink href="https://www.gatsbyjs.com/plugins/gatsby-plugin-google-gtag/">
      Visit the Google Global Site Tag plugin page!
    </OutboundLink>
  </div>
)
```
