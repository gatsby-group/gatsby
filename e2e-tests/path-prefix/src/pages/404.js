import * as React from "react"
import Layout from "../components/layout"
import Seo from "../components/seo"

const NotFoundPage = () => {
  const [company, setCompany ] = React.useState("")

  return (
    <Layout>
      <h1>NOT FOUND</h1>
      <h2>{company}</h2>
      <p>You just hit a route that doesn&#39;t exist... the sadness.</p>
      <button data-testid="page-404-click" onClick={() => { setCompany("gatsby") }}>Click</button>
    </Layout>
  )
}

export const Head = () => <Seo />

export default NotFoundPage
