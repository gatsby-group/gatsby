import fetchGraphql from "gatsby-source-wordpress-experimental/utils/fetch-graphql"
import { introspectionQuery } from "gatsby-source-wordpress-experimental/utils/graphql-queries"

import compress from "graphql-query-compress"

import { runGatsby } from "../test-utils/run-gatsby"
import gql from "gatsby-source-wordpress-experimental/utils/gql"
import { incrementalIt } from "../test-utils/incremental-it"
import { createContentDigest } from "gatsby-core-utils"

jest.setTimeout(100000)

require(`dotenv`).config({
  path: `./test-runtime/.env.development`,
})

require(`dotenv`).config({
  path: `./test-runtime/credentials.env`,
})

describe(`[gatsby-source-wordpress-experimental] schema`, () => {
  runGatsby()

  it(`hasn't altered the remote WPGraphQL schema`, async () => {
    const result = await fetchGraphql({
      query: introspectionQuery,
      url: process.env.WPGRAPHQL_URL,
    })

    expect(createContentDigest(result.data.__schema)).toMatchSnapshot()
  })

  it(`hasn't altered the local Gatsby schema`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: introspectionQuery,
    })

    expect(createContentDigest(result.data.__schema)).toMatchSnapshot()
  })

  test(`Type.exclude option removes types from the schema`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          __schema {
            types {
              name
            }
          }
        }
      `,
    })

    const excludedTypes = [
      `ActionMonitorAction`,
      `UserToActionMonitorActionConnection`,
      `Plugin`,
      `PostFormat`,
      `Theme`,
      `UserRole`,
      `UserToUserRoleConnection`,
    ]

    // make sure our schema doesn't have any of the default excluded types
    // in ../../src/models/gatsby-api
    excludedTypes.forEach(typeName => {
      expect(
        !!result.data.__schema.types.find(type => type.name === `Wp${typeName}`)
      ).toBe(false)
    })
  })

  test(`Type.excludeFieldNames removes fields from the schema on types by field names`, async () => {
    const excludeFieldsOnTypesGroups = [
      {
        typeName: `Page`,
        fieldNames: [`enclosure`],
      },
      {
        typeName: `User`,
        fieldNames: [
          `extraCapabilities`,
          `capKey`,
          `description`,
          `email`,
          `registeredDate`,
        ],
      },
    ]

    const query = `
        {
          ${excludeFieldsOnTypesGroups
            .map(
              group => `
                ${group.typeName}: __type(name: "Wp${group.typeName}") {
                  fields {
                    name
                  }
                }
              `
            )
            .join(` `)}
        }
      `

    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query,
    })

    // for all our test type names
    excludeFieldsOnTypesGroups.forEach(excludeGroup => {
      // get that type from the Gatsby schema
      const typeInSchema = result.data[excludeGroup.typeName]

      // for each excluded field on our type
      excludeGroup.fieldNames.forEach(fieldName => {
        // expect that the type in our Gatsby schema doesn't have a field
        // with this excluded name
        const fieldNameExistsOnType = !!typeInSchema.fields
          .map(field => field.name)
          .includes(fieldName)

        expect(fieldNameExistsOnType).toBe(false)
      })
    })
  })

  test(`Type.where option works when set to filter for French posts`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          allWpTranslationFilterTest {
            totalCount
            nodes {
              title
            }
          }
        }
      `,
    })

    expect(result.data.allWpTranslationFilterTest.totalCount).toEqual(1)
    expect(result.data.allWpTranslationFilterTest.nodes[0].title).toEqual(
      `French page`
    )
  })

  test(`Type.limit option works when set to 1`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          allWpTypeLimitTest {
            totalCount
          }
        }
      `,
    })

    expect(result.data.allWpTypeLimitTest.totalCount).toEqual(1)
  })

  test(`Type.limit option works when set to 0`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          allWpTypeLimit0Test {
            totalCount
          }
        }
      `,
    })

    expect(result.data.allWpTypeLimit0Test.totalCount).toEqual(0)
  })

  incrementalIt(`resolves menus`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          allWpMenu {
            nodes {
              name
              count
              id
              menuId
              menuItems {
                nodes {
                  id
                  label
                  menuItemId
                  nodeType
                  target
                  title
                  url
                  childItems {
                    nodes {
                      label
                      id
                      menuItemId
                      connectedObject {
                        __typename
                        ... on WpPost {
                          title
                          uri
                          featuredImage {
                            title
                          }
                        }
                      }
                      childItems {
                        nodes {
                          label
                          url
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
    })

    expect(result).toMatchSnapshot()
  })

  incrementalIt(`resolves pages`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          testPage: wpPage(id: { eq: "cGFnZToy" }) {
            title
          }

          allWpPage {
            nodes {
              uri
              title
              childPages {
                nodes {
                  title
                }
              }
              author {
                name
              }
              translations {
                title
              }
              acfPageFields {
                flex {
                  __typename
                  ... on WpPage_Acfpagefields_Flex_Header {
                    header
                  }
                  ... on WpPage_Acfpagefields_Flex_TeamMembers {
                    teamMembers {
                      teamMember {
                        __typename
                        ... on WpTeamMember {
                          acfData {
                            name
                            title
                            twitterlink {
                              target
                              title
                              url
                            }
                            webSite {
                              target
                              title
                              url
                            }
                            portrait {
                              sourceUrl
                              altText
                              caption
                              commentCount
                              commentStatus
                              date
                              dateGmt
                              databaseId
                              description
                              desiredSlug
                            }
                            fieldGroupName
                            projects {
                              ... on WpProject {
                                id
                                content
                                date
                                databaseId
                                slug
                                status
                                title
                                uri
                              }
                            }
                          }
                          content
                          databaseId
                          date
                          dateGmt
                          desiredSlug
                          enclosure
                          excerpt
                          id
                          link
                          menuOrder
                          pingStatus
                          seo {
                            focuskw
                            metaDesc
                            metaKeywords
                            metaRobotsNofollow
                            title
                          }
                          slug
                          status
                          termNames
                          termSlugs
                          title
                          toPing
                          uri
                        }
                      }
                    }
                  }
                }
                fieldGroupName
              }
            }
          }
        }
      `,
    })

    expect(result).toMatchSnapshot()

    expect(result.data.testPage.title).toEqual(
      process.env.WPGQL_INCREMENT ? `Sample Page DELTA SYNC` : `Sample Page`
    )
  })

  incrementalIt(`resolves posts`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          testPost: wpPost(id: { eq: "cG9zdDox" }) {
            title
          }
          allWpPost {
            nodes {
              title
              featuredImage {
                altText
                sourceUrl
              }
              author {
                avatar {
                  url
                }
                comments {
                  nodes {
                    content
                  }
                }
              }
            }
          }
        }
      `,
    })

    expect(result).toMatchSnapshot()

    expect(result.data.testPost.title).toEqual(
      process.env.WPGQL_INCREMENT ? `Hello world! DELTA SYNC` : `Hello world!`
    )
  })

  incrementalIt(`resolves users`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          testUser: wpUser(id: { eq: "dXNlcjox" }) {
            firstName
          }
          allWpUser {
            nodes {
              name
              databaseId
              pages {
                nodes {
                  title
                }
              }
              posts {
                nodes {
                  title
                }
              }
            }
          }
        }
      `,
    })

    expect(result).toMatchSnapshot()

    expect(result.data.testUser.firstName).toEqual(
      process.env.WPGQL_INCREMENT ? `Tyler DELTA SYNC` : `Tyler`
    )
  })

  incrementalIt(`resolves root fields`, async () => {
    const result = await fetchGraphql({
      url: `http://localhost:8000/___graphql`,
      query: gql`
        {
          wp {
            allSettings {
              discussionSettingsDefaultCommentStatus
              discussionSettingsDefaultPingStatus
              generalSettingsDateFormat
              generalSettingsDescription
              generalSettingsEmail
              generalSettingsLanguage
              generalSettingsStartOfWeek
              generalSettingsTimeFormat
              generalSettingsTimezone
              generalSettingsTitle
              generalSettingsUrl
              readingSettingsPostsPerPage
              writingSettingsDefaultCategory
              writingSettingsDefaultPostFormat
              writingSettingsUseSmilies
            }
            schemaMd5
            nodeType
            writingSettings {
              defaultCategory
              defaultPostFormat
              useSmilies
            }
          }
        }
      `,
    })

    expect(result).toMatchSnapshot()
  })
})
