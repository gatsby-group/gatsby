---
title: Enhance your Styles with CSS-in-JS
overview: true
---

CSS-in-JS refers to an approach where styles are written in JavaScript instead of in external CSS files to easily scope styles in components, eliminate dead code, encourage faster performance and dynamic styling, and more.

CSS-in-JS bridges the gap between CSS and JavaScript:

1. **Components**: you'll style your site with components, which integrates well with React's "everything is a component" philosophy
2. **Scoped**: this is a side effect of the first. Just like [CSS Modules](/docs/css-modules/), CSS-in-JS is scoped by default
3. **Dynamic**: style your site dynamically based on component state by integrating JavaScript variables
4. **Bonuses**: many CSS-in-JS libraries generate unique class names which can help with caching, automatic vendor prefixes, timely loading of critical CSS, and implementing many other features, depending on the library you choose

_Note_: adding a stable CSS class to your JSX markup along with your CSS-in-JS can make it easier to users to include [User Stylesheets](https://www.viget.com/articles/inline-styles-user-style-sheets-and-accessibility/) for accessibility.

CSS-in-JS, while not required in Gatsby, is very popular among JavaScript developers for the reasons listed above. For more context, read Max Stoiber's (creator of CSS-in-JS library [styled-components](/docs/styled-components/)) article [_Why I write CSS in JavaScript_](https://mxstbr.com/thoughts/css-in-js/). However, you should also consider whether CSS-in-JS is necessary, as not relying on it can encourage more inclusive front-end skill-sets.

_Note that this functionality is not a part of React or Gatsby, and requires using any of the many [third-party CSS-in-JS libraries](https://github.com/MicheleBertoli/css-in-js#css-in-js)._

This section contains guides for styling your site with some of the most popular CSS-in-JS libraries.

[[guidelist]]
