---
title: Porting an HTML Site to Gatsby
---

When introducing Gatsby into an existing static HTML site, it may or may not be feasible to rewrite the entire site at once. It's possible to port pieces of a site to Gatsby one at a time, while the rest of the site still uses HTML, might be preferable. This page will guide you through this process.

> **Note**: The aim of this guide is to take a shallow, focused path to porting part of a static HTML website to Gatsby. The full [Gatsby tutorial](/tutorial/) is more broad, with deeper dives on the core concepts and technologies.

## Why Gatsby?

There are a few particularly helpful Gatsby features for porting HTML websites:

- Defining the blocks that make up your site as reusable components that can take inputs.
- Options to accomodate serving your website at a path, such as `/docs`, and hosting your assets at a seperate domain.
- An open and ongoing conversation to join, with our vibrant community of contributors. Over 2500 people have worked on Gatsby and its wealth of documentation to date.
- A modular system to lift the content out of your code and into files or external services, when the time is right.

We're proud of the [Gatsby core philosophy](https://www.gatsbyjs.org/docs/gatsby-core-philosophy/), it sets out the overall vision, and philosophy on tooling and community. In short, as a member of the community, You belong here!

## Getting Started

### Which part to port?

Here is the structure of an example static HTML/CSS website that this guide will walk through:

```
website-domain
  ├── assets
  │   ├── favicon.ico
  │   ├── person.png
  │   ├── normalize.css
  │   └── style.css
  ├── index.html
  ├── 404.html
  ├── about.html
  ├── contact.html
  ├── services
  │   ├── index.html
  │   ├── growing.html
  │   ├── cleaning.html
  │   └── shrinking.html
  └── who
      ├── index.html
      ├── ellla-arborist.html
      ├── marin-leafer.html
      └── sam-surgeon.html
```

The `/who` section of the site is a great candidate for porting as it is all within a single folder. Through this guide, you will develop the ported Gatsby section in isolation before integrating into the site by telling Gatsby about the hosting path, `/who`.

### Assumptions

The example site uses global CSS files (`style.css` and `normalize.css`); more sophisticated styling structures like [Sass](/docs/sass/) architectures or [CSS-in-JS](/docs/css-in-js/) can be accommodated but will not be covered here.

No [client-side](/docs/glossary#client-side) JavaScript (e.g jQuery etc.) is on the example site. If your site includes client-side JavaScript libraries and functionality, Gatsby may conflict with it if not handled or removed when porting. Learn more about [Debugging HTML Builds](/docs/debugging-html-builds/).

### Development environment

Gatsby generates websites and web applications for production through a compilation and build process, and it also has tools optimized for local development. To set up the Gatsby [CLI](/docs/glossary#cli) and development environment (if you haven't already) check out [Part Zero of the Gatsby tutorial](/tutorial/part-zero/).

### Gatsby Project

Now that you are set up, you can use the Gatsby and npm CLI tools in your terminal to get this site section ported!
Make a new project using the Gatsby hello world starter with the following command:

```shell
gatsby new gatsby-site-section https://github.com/gatsbyjs/gatsby-starter-hello-world
```

You should now have a folder called `gatsby-site-section` containing a basic Gatsby website. Open the new folder in your code editor and `cd` (change directory) into the folder in your terminal to continue:

```shell
cd gatsby-site-section
```

The `/src` folder contains most of the front-end code for the Gatsby site. In the Gatsby [build](/docs/glossary#build) process, [every component file in the `/src/pages` folder will automatically create an HTML page](/docs/recipes/#creating-pages-automatically). Currently, the only page created is from the index page component in `/src/pages/index.js`:

```jsx:title=/gatsby-site-section/src/pages/index.js
import React from "react"

export default () => <div>Hello world!</div>
```

[Run the development server](/docs/quick-start/#start-development-server) with `gatsby develop` in the command line to see the website in your browser.

```sh
gatsby develop
```

You can now visit the page running in your browser at `http://localhost:8000`. Hello Gatsby! 👋

## Porting index.html

Here is `/who/index.html` from the example site structure above:

```html:title=/website-domain/who/index.html
<html lang="en">
  <head>
    <title>Taylor's Tidy Trees - Who We Are</title>
    <link href="/assets/favicon.ico" rel="shortcut icon" type="image/x-icon" />
    <link rel="stylesheet" type="text/css" href="/assets/normalize.css" />
    <link rel="stylesheet" type="text/css" href="/assets/style.css" />
  </head>
  <body>
    <header>
      <a href="/" class="brand-color logo-text">Taylor's Tidy Trees</a>
      <nav>
        <ul>
          <li><a href="/about.html">About</a></li>
          <li><a href="/services/index.html">Services</a></li>
          <li><a href="/index.html">Who We Are</a></li>
          <li><a href="/contact.html">Contact</a></li>
        </ul>
      </nav>
    </header>
    <main>
      <h1>Who We Are</h1>
      <h2>These are our staff:</h2>
      <ul>
        <li><a href="/who/ella-arborist.html">Ella (Arborist)</a></li>
        <li><a href="/who/sam-surgeon.html">Sam (Tree Surgeon)</a></li>
        <li><a href="/who/marin-leafer.html">Marin (Leafer)</a></li>
      </ul>
    </main>
  </body>
</html>
```

In the following sections, you'll convert this block of HTML into its equivalent code in Gatsby.

### Head elements

You might have noticed that the component in `/src/pages/index.js` doesn't include `<html>`, `<head>` or `<body>`. Gatsby makes a default HTML structure for each page and places the output from `/src/pages/index.js` into its body. More `<head>` child elements and HTML attributes are added to the output page with a module called [React Helmet](https://github.com/nfl/react-helmet). React Helmet is added to a Gatsby project in the command line with npm and then to the Gatsby config file:

```shell
npm install --save react-helmet gatsby-plugin-react-helmet
```

Gatsby projects have a config file at `/gatsby-config.js` where site metadata and options can be specified and plugins added. Add a plugin line with `gatsby-plugin-react-helmet` to your config file:

```js:title=/gatsby-site-section/gatsby-config.js
/**
 * Configure your Gatsby site with this file.
 *
 * See: https://www.gatsbyjs.org/docs/gatsby-config/
 */

module.exports = {
  plugins: ["gatsby-plugin-react-helmet"], // highlight-line
}
```

Now you can import the `<Helmet>` component to the `index.js` file and place `<header>` & `<main>` elements for the existing HTML. Gatsby components must have a single root parent in their code structure so one technique is to add a [React Fragment component](https://reactjs.org/docs/fragments.html) around them:

```jsx:title=/src/pages/index.js
import React from "react"
import Helmet from "react-helmet"

export default () => (
  <>
    <Helmet></Helmet>
    <header></header>
    <main>
      <div>Hello world!</div>
    </main>
  </>
)
```

Note the mix of components and native HTML elements in the React markup here: this is the [JSX](https://reactjs.org/docs/introducing-jsx.html) templating language, which Gatsby compiles into HTML that browsers can parse and render to users. Further sections of this guide will explain it even more.

### Page content

Copy in the contents of each of the 3 sections from the `/who/index.html` file above:

```jsx:title=/gatsby-site-section/src/pages/index.js
import React from "react"
import Helmet from "react-helmet"

export default () => (
  <>
    <Helmet>
      {/* highlight-start */}
      <title>Taylor's Tidy Trees - Who We Are</title>
      <link
        href="/assets/favicon.ico"
        rel="shortcut icon"
        type="image/x-icon"
      />
      <link rel="stylesheet" type="text/css" href="/assets/normalize.css" />
      <link rel="stylesheet" type="text/css" href="/assets/style.css" />
      {/* highlight-end */}
    </Helmet>
    <header>
      {/* highlight-start */}
      <a href="/" className="brand-color logo-text">
        Taylor's Tidy Trees
      </a>
      <nav>
        <ul>
          <li>
            <a href="/about.html">About</a>
          </li>
          <li>
            <a href="/services/index.html">Services</a>
          </li>
          <li>
            <a href="/index.html">Who We Are</a>
          </li>
          <li>
            <a href="/contact.html">Contact</a>
          </li>
        </ul>
      </nav>
      {/* highlight-end */}
    </header>
    <main>
      {/* highlight-start */}
      <h1>Who We Are</h1>
      <h2>These are our staff:</h2>
      <ul>
        <li>
          <a href="/who/ella-arborist.html">Ella (Arborist)</a>
        </li>
        <li>
          <a href="/who/sam-surgeon.html">Sam (Tree Surgeon)</a>
        </li>
        <li>
          <a href="/who/marin-leafer.html">Marin (Leafer)</a>
        </li>
      </ul>
      {/* highlight-end */}
    </main>
  </>
)
```

Opening the site in a browser again at `http://localhost:8000`, you should have a functional website! Next, this guide will explore how HTML and JavaScript combine in a Gatsby application.

### HTML and JavaScript

The code for Gatsby pages looks like a hybrid of JavaScript and HTML. The code for each page is typically a JavaScript function describing a block of HTML given a set of inputs, or "props". Gatsby runs each page's JavaScript function during the build process to produce a static HTML file.

The appearance of a Gatsby component depends on how dynamic the content and behavior is. The code for a very static page will include mostly all HTML markup wrapped in a bit of JavaScript for Gatsby to assemble. The code for a component with props (a.k.a. "inputs"), and logic applied to those props, will interweave more JavaScript through JSX: examples could include data [sourced with GraphQL](/docs/graphql-api/) or [imported from a file](/docs/sourcing-content-from-json-or-yaml/) to produce dynamic markup, such as a list of related links.

This guide will stay on the HTML side of the balance to suit a more static site. Using Gatsby to arrange the necessary client-side JavaScript with React early can open many future possibilities though. While Gatsby produces static pages from your components, it can also deliver dynamic client-side JavaScript after the page loads and the site [hydrates](/docs/glossary#hydration) into a full React web application.

Your pasted HTML in `/gatsby-site-section/src/pages/index.js` needs a small change to be valid: `class` attributes [must be renamed to `className`](https://reactjs.org/docs/dom-elements.html#classname) for usage with React, as `class` is a reserved word in JavaScript.

### Layout component

There are 3 pages in the `/who` section of Taylor's Tidy Trees for members of the team. Here is the one for Ella:

```html:title=/website-domain/who/ella-arborist.html
<html lang="en">
  <head>
    <title>Taylor's Tidy Trees - Who We Are - Ella</title>
    <link href="/assets/favicon.ico" rel="shortcut icon" type="image/x-icon" />
    <link rel="stylesheet" type="text/css" href="/assets/normalize.css" />
    <link rel="stylesheet" type="text/css" href="/assets/style.css" />
  </head>
  <body>
    <header>
      <a href="/" class="brand-color logo-text">Taylor's Tidy Trees</a>
      <nav>
        <ul>
          <li><a href="/about.html">About</a></li>
          <li><a href="/services/index.html">Services</a></li>
          <li><a href="/who/index.html">Who We Are</a></li>
          <li><a href="/contact.html">Contact</a></li>
        </ul>
      </nav>
    </header>
    <main>
      <h1>Ella - Arborist</h1>
      <h2>Ella is an excellent Arborist. We guarantee it.</h2>
      <div class="bio-card">
        <img
          alt="Comically crude stick person sketch"
          src="/assets/person.png"
        />
        <p>Ella</p>
      </div>
    </main>
  </body>
</html>
```

The foundational building block for building and styling pages in Gatsby is [the `<Layout>` component](/docs/layout-components/). The `<Layout>` component wraps around page content, providing the common structure that appears on all pages. Looking at the `/index.html` and `/who/ella-arborist.html` you can see that most of the page is identical. Other than the title of the page, everything except for the contents of the main block is repeated.

Create a folder inside `/src`, next to `/src/pages` called `components`. Inside `components` make a file called `Layout.js`. Here is a basic structure to use for the file:

```jsx:title=/gatsby-site-section/src/components/Layout.js
import React from "react"
import Helmet from "react-helmet"

export default ({ children }) => (
  <>
    <Helmet></Helmet>
    <header></header>
    <main>{children}</main>
  </>
)
```

Like in `/src/pages/index.js` the file exports a JavaScript function that returns an HTML-like JSX structure, but this time the function takes an argument. The first argument provided to a component function is always an object for the props. On the props object, the children of the component are available to be passed in. Within the JSX markup, the curly braces wrap a JavaScript expression whose result will be placed there. In this case it is an expression that results in the contents of the `children` variable.

The common elements from the `/index.html` and `/who/ella-arborist.html` files can now copied into the `<Layout>` component. A second prop is also added and used in a second JavaScript expression in the `<title>` element. The added expression results in the title with the `staffName` prop added conditionally if it is provided. You'll see the prop used again later on when porting the `/who/ella-arborist.html` page.

```jsx:title=/gatsby-site-section/src/components/Layout.js
import React from "react"
import Helmet from "react-helmet"
import { Link } from "gatsby"

export default ({ children, staffName }) => (
  <>
    <Helmet>
      <title>
        Taylor's Tidy Trees - Who We Are{staffName ? ` - ${staffName}` : ""}
      </title>
      <link
        href="/assets/favicon.ico"
        rel="shortcut icon"
        type="image/x-icon"
      />
      <link rel="stylesheet" type="text/css" href="/assets/normalize.css" />
      <link rel="stylesheet" type="text/css" href="/assets/style.css" />
    </Helmet>
    <header>
      <a href="/" className="brand-color logo-text">
        Taylor's Tidy Trees
      </a>
      <nav>
        <ul>
          <li>
            <a href="/about.html">About</a>
          </li>
          <li>
            <a href="/services/index.html">Services</a>
          </li>
          <li>
            <Link to="/">Who We Are</Link>
          </li>
          <li>
            <a href="/contact.html">Contact</a>
          </li>
        </ul>
      </nav>
    </header>
    <main>{children}</main>
  </>
)
```

The next step is to use that `<Layout>` component in the `index.js` page file. Gatsby itself provides a number of core building blocks: `<Link>` is one of them. The `<Link>` component is imported at the top of the file to use in place of `<a>` tags for on-site links, with a `to` prop instead of the `href` attribute. When the site builds, `<Link>` produces native HTML anchors with added performance optimizations like prefetching page content before a user activates a link.

```jsx:title=/gatsby-site-section/src/pages/index.js
import React from "react"
import Layout from "../components/Layout"
import { Link } from "gatsby"

export default () => (
  <Layout>
    <h1>Who We Are</h1>
    <h2>These are our staff:</h2>
    <ul>
      <li>
        <Link to="/ella-arborist">Ella (Arborist)</Link>
      </li>
      <li>
        <Link to="/sam-surgeon">Sam (Tree Surgeon)</Link>
      </li>
      <li>
        <Link to="/marin-leafer">Marin (Leafer)</Link>
      </li>
    </ul>
  </Layout>
)
```

### Porting other section pages

Now it's time for the work to really pay off! Ella's page is a matter of using your `<Layout>` component again and copying in the main content. Don't forget to change `class` to `className`! A `staffName` prop can be passed to `<Layout>` this time to change the dynamic page title. Passing props is similar to an attribute on an HTML element:

```jsx:title=/gatsby-site-section/src/pages/ella-arborist.js
import React from "react"
import Layout from "../components/Layout"
import { Link } from "gatsby"

export default () => (
  {/* highlight-start */}
  <Layout staffName="Ella">
  {/* highlight-end */}
    <h1>Ella - Arborist</h1>
    <h2>Ella is an excellent Arborist. We guarantee it.</h2>
    <div className="bio-card">
      <img
        alt="Comically crude stick person sketch"
        src="/assets/person.png"
      />
      <p>Ella</p>
    </div>
  </Layout>
)
```

The other 2 pages for Marin and Sam can now be made with a similar structure. Maybe you are even thinking about another component for the Bio Card!

## Build

With your new Gatsby application taking shape, it's time to integrate it into your existing HTML website. If you were to build the Gatsby application into static files now and upload them in the place of the existing HTML files, the paths of the links made by Gatsby would not be correct. There are a couple of Gatsby configuration options to fix this.

### Path Prefix

The `pathPrefix` option in `/gatsby-config.js` tells Gatsby the path at which the build output will be served from. For example, links to other pages within your Gatsby site will be prefixed with the `pathPrefix` value. Here is some config code to tell Gatsby it should only handle and care about the `/who` path for now:

```js:title=/gatsby-config.js
module.exports = {
  plugins: [`gatsby-plugin-react-helmet`],
  pathPrefix: `/who`, // highlight-line
}
```

> **Note**: If you want to host non-HTML resources on a dedicated CDN, Gatsby can accomodate this with the [Asset Prefix](https://www.gatsbyjs.org/docs/asset-prefix/) option.

### Build step

You now have a site that mirrors the existing HTML site section. Stop the development server if it's still running; it's time to run the production build! 🎉

```shell
gatsby build --prefix-paths
```

> **Note**: The `--prefix-paths` option _must_ be used for path prefix to be applied

Once a build is complete, the compiled set of files can be found in `/public`. It's all in there and ready to replace the existing files! In the case of the example site, the folder contents are deployed directly to the `/who` path of the website domain in place of the existing HTML files.

### Integrated site file structure

Here is the structure of the HTML & non-JavaScript asset files after the built Gatsby `/who` section is added to website domain:

```
website-domain
  ├── assets
  │   ├── favicon.ico
  │   ├── person.png
  │   ├── normalize.css
  │   └── style.css
  ├── index.html
  ├── 404.html
  ├── about.html
  ├── contact.html
  ├── services
  │   ├── index.html
  │   ├── growing.html
  │   ├── cleaning.html
  │   ├── shrinking.html
  └── who
{/* highlight-start */}
      ├── index.html
      ├── ellla-arborist
      │   └── index.html
      ├── marin-leafer
      │   └── index.html
      └── sam-surgeon
          └── index.html
{/* highlight-end */}
```

## Porting more parts

To replace multiple parts of a website with a single Gatsby application there are a few additional steps:

1. Mirror the website structure within the Gatsby `/src/pages` folder.

2. Adjust the `pathPrefix` Gatsby configuration option to reflect the new root path at which the Gatsby application will be served.

3. Ensure the `to` props on all Gatsby `<Link>` components are correct relative to `/src/pages/` as the application root.

For the example website covered in this guide, here is what each step involves for also migrating the `services` part of the site:

1. Create a `/src/pages/who` folder, and move into it all the files currently in `/src/pages`. Create a new `/src/pages/services` folder and follow the html migration steps above for the `/services/` HTML files. The already completed Layout component will save a lot of the work!

```
gatsby-site-sections/src/pages

├── who
│   ├── index.js
│   ├── ellla-arborist.js
│   ├── marin-leafer.js
│   └── sam-surgeon.js
└── services
    ├── index.js
    ├── growing.js
    ├── cleaning.js
    └── shrinking.js
```

2. The `pathPrefix` configuration option is no longer needed as the Gatsby application will now be served at the root of the site alongside the remaining HTML files.

3. Update `<Link>` tag `to` props to be relative to the new serving location; the root of the domain. This should be done in `/src/pages/who/index.js`, `/src/pages/services/index.js`, and `/src/components/Layout.js`. Here's the updated `index.js` for `/who`:

```jsx:title=/gatsby-site-section/src/pages/who/index.js
import React from "react"
import Layout from "../components/Layout"
import { Link } from "gatsby"

export default () => (
  <Layout>
    <h1>Who We Are</h1>
    <h2>These are our staff:</h2>
    <ul>
      <li>
        <Link to="/who/ella-arborist">Ella (Arborist)</Link>
      </li>
      <li>
        <Link to="/who/sam-surgeon">Sam (Tree Surgeon)</Link>
      </li>
      <li>
        <Link to="/who/marin-leafer">Marin (Leafer)</Link>
      </li>
    </ul>
  </Layout>
)
```

After following those steps for the example site it is pretty much entirely Gatsby! Migrating the rest of the HTML files, `/about.html`, `/contact.html`, `/404.html` and `/index.html` to Gatsby pages would enable pre-fetching links between all the pages in the site. The complete Gatsby application is ready to take full advantage of Gatsby and it's community.

## Next steps

Gatsby can handle assets through direct imports to page and component files; the [asset import documentation](/docs/importing-assets-into-files/) covers imports as well as the less-optimized `static` folder. Once assets are handled through Gatsby, plugins can be used to optimize their processing and delivery.

The [building with components doc](/docs/building-with-components/) has information about why Gatsby uses React component architecture and how it fits into a Gatsby application.

[Sourcing content and data](/docs/content-and-data/) is a great next step if you are interested in separating your content from your website code, such as sourcing the site title from `gatsby-config.js` with GraphQL.

Short guides can be found at the [recipes section](/docs/recipes) for adding functionality such as optimizing and querying local images, adding Markdown support and integrating various modern CSS tools. The [adding website functionality page](/docs/adding-website-functionality/) has longer guides for larger tasks such as making your site accessible, adding authentication, and fetching data with client-side JavaScript.

Gatsby is dedicated to making you feel welcome! Learn more and engage with the community by starting a conversation or contributing yourself. The [community page](/contributing/community/) has further information and channels where you can get support.
