import React from "react"
import Helmet from "react-helmet"
// import { OutboundLink } from "gatsby-plugin-google-analytics"

import hex2rgba from "hex2rgba"
import Layout from "../components/layout"
import ShareMenu from "../components/share-menu-starters"
import presets, { colors } from "../utils/presets"
import /*typography, */ { rhythm, scale, options } from "../utils/typography"
import MdLaunch from "react-icons/lib/md/launch"
import GithubIcon from "react-icons/lib/fa/github"


const gutter = rhythm(3 / 4)
const gutterDesktop = rhythm(6 / 4)

class StarterTemplate extends React.Component {
  state = {
    showAllDeps: false
  }
  render() {

    const { data } = this.props
    const { markdownRemark } = data
    const { fields: { starterShowcase },
      frontmatter
    } = markdownRemark

    // preprocessing of dependencies
    const { miscDependencies = [], gatsbyDependencies = [] } = starterShowcase
    const allDeps = [...gatsbyDependencies.map(([name, ver]) => name), ...miscDependencies.map(([name, ver]) => name)]
    const shownDeps = this.state.showAllDeps ? allDeps : allDeps.slice(0, 15)
    const showMore = !this.state.showAllDeps && allDeps.length - shownDeps.length > 0

    // plug for now
    const isModal = false
    return (
      <Layout
        location={this.props.location}
        isModal={isModal}
        modalBackgroundPath="/showcase"
      >
        <div
          css={{
            alignItems: `center`,
            display: `flex`,
            flexDirection: `column`,
            maxWidth: isModal ? false : 1080,
            margin: isModal ? false : `0 auto`,
          }}
        >
          <div
            css={{
              width: `100%`,
            }}
          >
            <Helmet>
              <title>{`Gatsby Starter: ${starterShowcase.githubData.repoMetadata.name}`}</title>
              <meta
                name="og:image"
                content={`https://next.gatsbyjs.org/StarterShowcase/generatedScreenshots/${starterShowcase.stub}.png`}
              />
              <meta
                name="twitter:image"
                content={`https://next.gatsbyjs.org/StarterShowcase/generatedScreenshots/${starterShowcase.stub}.png`}
              />
            </Helmet>
            <div
              css={{
                fontFamily: options.headerFontFamily.join(`,`),
                padding: gutter,
                paddingBottom: rhythm(1.5 / 4),
                [presets.Desktop]: {
                  padding: gutterDesktop,
                  paddingBottom: rhythm(3 / 4),
                },
              }}
            >
              <a
                href={frontmatter.repo}
                css={{
                  ...styles.link,
                  fontWeight: `bold`,
                  [presets.Desktop]: {
                    ...scale(-1 / 6),
                  },
                }}
              >
                {starterShowcase.owner.login}
              </a> <span>/</span>
              <div>
                <h1 css={{ margin: 0, display: 'inline-block' }}>
                  {starterShowcase.stub}
                </h1>
                <span css={{ marginLeft: 20 }}><span role="img" aria-label="star">⭐</span> {starterShowcase.stars}</span>
              </div>
            </div>
            <div
              css={{
                display: `flex`,
                borderTop: `1px solid ${colors.ui.light}`,
                fontFamily: options.headerFontFamily.join(`,`),
                margin: `0 ${gutter}`,
                [presets.Desktop]: {
                  margin: `0 ${gutterDesktop}`,
                },
              }}
            >
              {frontmatter.repo && (
                <div
                  css={{
                    padding: 20,
                    paddingLeft: markdownRemark.featured ? false : 0,
                    display: `flex`,
                    borderRight: `1px solid ${colors.ui.light}`,
                    [presets.Desktop]: {
                      ...scale(-1 / 6),
                    },
                    alignItems: 'center'
                  }}
                >
                  <GithubIcon
                    css={{ marginBottom: 0, marginRight: 10, height: 26, width: 20 }}
                  />
                  <a href={frontmatter.repo} css={{ ...styles.link }}>
                    Source
                  </a>
                </div>
              )}

              <div
                css={{
                  padding: 20,
                  paddingLeft: 0,
                  flex: 1,
                  justifyContent: 'center',
                  display: `flex`,
                  borderRight: `1px solid ${colors.ui.light}`,
                  [presets.Desktop]: {
                    ...scale(-1 / 6),
                  },
                  alignItems: 'center'
                }}
              >
                <span css={{ marginRight: 20 }}>Try this starter</span>
                <a href={`https://app.netlify.com/start/deploy?repository=${frontmatter.repo}`}
                  style={{
                    borderBottom: 'none',
                    boxShadow: 'none',
                  }}>
                  <img src="https://www.netlify.com/img/deploy/button.svg"
                    alt="Deploy to Netlify"
                    css={{ marginBottom: 0 }}
                  />
                </a>

              </div>
              <div
                css={{
                  padding: 20,
                  paddingLeft: 0,
                  flex: 1,
                  display: `flex`,
                  [presets.Desktop]: {
                    ...scale(-1 / 6),
                  },
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <span
                  css={{ color: colors.gray.calm, fontFamily: options.headerFontFamily.join(`,`), paddingRight: 20 }}
                >Added/updated</span>
                {showDate(starterShowcase.date)} /{" "}
                {showDate(starterShowcase.githubData.repoMetadata.updated_at)}
              </div>
            </div>
            <div
              css={{
                borderTop: `1px solid ${colors.ui.light}`,
                position: `relative`,
              }}
            >
              <div
                css={{
                  position: `absolute`,
                  right: gutter,
                  top: gutter,
                  left: `auto`,
                  zIndex: 1,
                  display: `flex`,
                }}
              >
                <a
                  href={frontmatter.repo}
                  css={{
                    border: 0,
                    borderRadius: presets.radius,
                    color: colors.gatsby,
                    fontFamily: options.headerFontFamily.join(`,`),
                    fontWeight: `bold`,
                    marginRight: rhythm(1.5 / 4),
                    padding: `${rhythm(1 / 5)} ${rhythm(2 / 3)}`,
                    textDecoration: `none`,
                    WebkitFontSmoothing: `antialiased`,
                    "&&": {
                      backgroundColor: colors.gatsby,
                      borderBottom: `none`,
                      boxShadow: `none`,
                      color: `white`,
                      "&:hover": {
                        backgroundColor: colors.gatsby,
                      },
                    },
                  }}
                >
                  <MdLaunch style={{ verticalAlign: `sub` }} /> Visit site
                </a>
                <ShareMenu
                  url={markdownRemark.main_url}
                  title={markdownRemark.title}
                  image={`https://next.gatsbyjs.org/StarterShowcase/generatedScreenshots/${starterShowcase.stub}.png`}
                />
              </div>
              {/* <Img
                sizes={
                  markdownRemark.childScreenshot.screenshotFile.childImageSharp
                    .sizes
                }
                alt={`Screenshot of ${markdownRemark.title}`}
                css={{
                  boxShadow: isModal
                    ? false
                    : `0 4px 10px ${hex2rgba(colors.gatsby, 0.1)}`,
                }}
              /> */}

              <img
                alt={`Screenshot of ${starterShowcase.githubFullName}`}
                src={`/StarterShowcase/generatedScreenshots/${starterShowcase.stub}.png`}
                css={{
                  boxShadow: isModal
                    ? false
                    : `0 4px 10px ${hex2rgba(colors.gatsby, 0.1)}`,
                }}
              />
            </div>
            <div
              css={{
                padding: gutter,
                [presets.Desktop]: {
                  padding: gutterDesktop,
                },
                display: `grid`,
                gridTemplateColumns: 'auto 1fr',
                gridRowGap: '20px'
              }}
            >
              <div css={{ color: colors.gray.calm, fontFamily: options.headerFontFamily.join(`,`), paddingRight: 20 }}>
                Tags
                </div>
              <div>{frontmatter.tags.join(`, `)}</div>

              <div css={{ color: colors.gray.calm, fontFamily: options.headerFontFamily.join(`,`), paddingRight: 20 }}>
                Description
                </div>
              <div>{frontmatter.description}</div>

              <div css={{ color: colors.gray.calm, fontFamily: options.headerFontFamily.join(`,`), paddingRight: 20 }}>
                Features
                </div>
              <div>
                {frontmatter.features ?
                  <ul css={{ marginTop: 0 }}>{frontmatter.features.map((f, i) => <li key={i}>{f}</li>)}</ul> :
                  "n/a"
                }
              </div>

              <div css={{ color: colors.gray.calm, fontFamily: options.headerFontFamily.join(`,`), paddingRight: 20 }}>
                Dependencies
                </div>

              <div>
                <div css={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridColumnGap: 20
                }}>
                  {/* const shownDeps = this.state.showAllDeps ? allDeps : allDeps.slice(0,15) */}
                  {shownDeps && shownDeps.map(dep => <div key={dep} css={{
                    ...styles.truncate,
                    marginBottom: '1rem'
                  }}>{dep}</div>)}
                </div>
                {showMore &&
                  <a href="#showmore" onClick={() => this.setState({ showAllDeps: true })}>{`Show ${allDeps.length - shownDeps.length} more`}</a>}
              </div>

            </div>
          </div>
        </div>
      </Layout>
    )
  }
}


export default StarterTemplate

export const pageQuery = graphql`
  query TemplateStarter($slug: String!) {
    markdownRemark(fields: {
        starterShowcase: {
          slug: { eq: $slug }
        }
      }) {
        frontmatter {
          date
          demo
          repo
          tags
          features
          description
        }
        fields {
          starterShowcase {
            stub
            slug
            date
            gatsbyDependencies
            miscDependencies
            lastUpdated
            description
            githubFullName
            owner {
              login
            }
            githubData {
              repoMetadata {
                updated_at
                full_name
                name
              }
            }
            stars
          }
        }
    }
  }
`


const styles = {
  link: {
    color: colors.gatsby,
    textDecoration: `none`,
  },
  prevNextLink: {
    color: colors.lilac,
    fontFamily: options.headerFontFamily.join(`,`),
    position: `absolute`,
    top: 280,
    width: 300,
    transform: `translateX(-75px) rotate(90deg)`,
    [presets.Desktop]: {
      ...scale(-1 / 6),
    },
  },
  prevNextLinkSiteTitle: {
    color: colors.gatsby,
    fontWeight: `bold`,
  },
  prevNextImage: {
    borderRadius: presets.radius,
    boxShadow: `0 0 38px -8px ${colors.gatsby}`,
  },
  prevNextPermalinkLabel: {
    color: colors.gray.calm,
    fontFamily: options.headerFontFamily.join(`,`),
    fontWeight: `normal`,
  },
  prevNextPermalinkImage: {
    marginBottom: 0,
    marginTop: rhythm(options.blockMarginBottom),
  },
  prevNextPermalinkTitle: {
    color: colors.gatsby,
    display: `block`,
    position: `relative`,
  },
  prevNextPermalinkContainer: {
    width: `50%`,
  },
  truncate: {
    whiteSpace: `nowrap`,
    overflow: `hidden`,
    textOverflow: `ellipsis`,
    display: `block`,
    width: `100%`,
  },
  prevNextPermalinkArrow: {
    color: colors.lilac,
    marginRight: 4,
    verticalAlign: `sub`,
    position: `absolute`,
    left: `-${rhythm(3 / 4)}`,
    top: `50%`,
    transform: `translateY(-50%)`,
  },
  prevNextPermalinkMeta: {
    marginLeft: rhythm(6 / 4),
    display: `flex`,
    flexDirection: `row`,
    justifyContent: `flex-end`,
  },
  prevNextPermalinkMetaInner: {
    flexBasis: 540,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
}

function showDate(dt) {
  const date = new Date(dt)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}