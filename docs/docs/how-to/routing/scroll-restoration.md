---
title: Scroll Restoration
---

Scroll restoration refers to the [`scrollRestoration`](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration) property on the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History) API. This property allows restoring a user's scroll position when navigating to a new page.

Gatsby will handle scroll restoration for you in most cases. However, when you render containers that have their own scroll values, those scroll positions are typically lost between page transitions. To solve that, users can use the `useScrollRestoration` hook in their code to tell Gatsby about scroll containers that we should track and restore.

Here is an example of using the `useScrollRestoration` hook to render a list of countries in an overflow `ul` element.

```jsx
import { useScrollRestoration } from "gatsby"
import countryList from "../utils/country-list"

export default function PageComponent() {
  const ulScrollRestoration = useScrollRestoration(`page-component-ul-list`)

  return (
    <ul style={{ height: 200, overflow: `auto` }} {...ulScrollRestoration}>
      {countryList.map(country => (
        <li>{country}</li>
      ))}
    </ul>
  )
}
```

The string `page-component-ul-list` is an arbitrary key. It should be unique for the page you are using it in. It is stored in the browser's Storage > Session Storage with a key consisting of `@@scroll/your-page-name/your-key`. You can access it in your Chrome developer tools and you will see that it simply records the y offset of the scroll bar for that widget, **for that page**. Therefore, if you navigate to another page, the scroll bar for the targeted component will return to where it was the last time you visited that page during the current session.

`useScrollRestoration` is part of the `gatsby-react-router-scroll` package.

## Saving scroll position for individual visits of the same page

In this example, the scroll position is restored only when navigating the browsing history.

```jsx
import { useScrollRestoration } from "gatsby"
import { useLocation } from "@gatsbyjs/reach-router" // highlight-line
import countryList from "../utils/country-list"

export default function PageComponent() {
  const location = useLocation() // highlight-line
  const ulScrollRestoration = useScrollRestoration(
    `${location.key}|page-component-ul-list` // highlight-line
  )

  return (
    <ul style={{ height: 200, overflow: `auto` }} {...ulScrollRestoration}>
      {countryList.map(country => (
        <li>{country}</li>
      ))}
    </ul>
  )
}
```
