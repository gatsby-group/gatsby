const runTests = () => {
  it(`should redirect page to index page when there is no such page`, () => {
    cy.visit(`/redirect-without-page/`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.location(`pathname`).should(`equal`, `/`)
  })

  it(`should redirect page to index page even there is a such page`, () => {
    cy.visit(`/redirect/`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.location(`pathname`).should(`equal`, `/`)
  })

  it(`should redirect to a dynamically-created replacement page`, () => {
    cy.visit(`/redirect-me/`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.location(`pathname`).should(`equal`, `/pt/redirect-me/`)
  })

  it(`should support hash parameter with Link component`, () => {
    cy.visit(`/`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.getTestElement(`redirect-two-anchor`).click().waitForRouteChange()
    cy.location(`pathname`).should(`equal`, `/redirect-search-hash/`)
    cy.location(`hash`).should(`equal`, `#anchor`)
    cy.location(`search`).should(`equal`, ``)
  })

  it(`should support hash parameter on direct visit`, () => {
    cy.visit(`/redirect-two/#anchor`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.location(`pathname`).should(`equal`, `/redirect-search-hash/`)
    cy.location(`hash`).should(`equal`, `#anchor`)
    cy.location(`search`).should(`equal`, ``)
  })

  it(`should support search parameter with Link component`, () => {
    cy.visit(`/`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.getTestElement(`redirect-two-search`).click().waitForRouteChange()
    cy.location(`pathname`).should(`equal`, `/redirect-search-hash/`)
    cy.location(`hash`).should(`equal`, ``)
    cy.location(`search`).should(`equal`, `?query_param=hello`)
  })

  it(`should support search parameter on direct visit`, () => {
    cy.visit(`/redirect-two/?query_param=hello`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.location(`pathname`).should(`equal`, `/redirect-search-hash/`)
    cy.location(`hash`).should(`equal`, ``)
    cy.location(`search`).should(`equal`, `?query_param=hello`)
  })

  it(`should support search & hash parameter with Link component`, () => {
    cy.visit(`/`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.getTestElement(`redirect-two-search-anchor`).click().waitForRouteChange()
    cy.location(`pathname`).should(`equal`, `/redirect-search-hash/`)
    cy.location(`hash`).should(`equal`, `#anchor`)
    cy.location(`search`).should(`equal`, `?query_param=hello`)
  })

  it(`should support search & hash parameter on direct visit`, () => {
    cy.visit(`/redirect-two/?query_param=hello#anchor`, {
      failOnStatusCode: false,
    }).waitForRouteChange()

    cy.location(`pathname`).should(`equal`, `/redirect-search-hash/`)
    cy.location(`hash`).should(`equal`, `#anchor`)
    cy.location(`search`).should(`equal`, `?query_param=hello`)
  })
}

describe(`redirect`, () => {
  describe(`404 is present`, () => {
    before(() => {
      cy.task(`restoreAllBlockedResources`)
    })

    // this is sanity check for this group
    it(`make sure 404 is present`, () => {
      cy.visit(`/______not_existing_page`, {
        failOnStatusCode: false,
      }).waitForRouteChange()
      cy.findByText(`Preview custom 404 page`).click()
      cy.findByText(`A custom 404 page wasn't detected`, {
        exact: false,
      }).should(`not.exist`)
      cy.findByText(
        `You just hit a route that does not exist... the sadness.`
      ).should(`exist`)
    })

    runTests()
  })

  describe(`no 404`, () => {
    before(() => {
      cy.task(`restoreAllBlockedResources`)

      cy.task(`blockAssetsForPage`, {
        pagePath: `/404`,
        filter: `page-data`,
      })
      cy.task(`blockAssetsForPage`, {
        pagePath: `/404.html`,
        filter: `page-data`,
      })
      cy.task(`blockPageComponent`, {
        path: `pages/404.js`,
      })
    })

    after(() => {
      cy.task(`restoreAllBlockedResources`)
    })

    it(`make sure 404 is NOT present`, () => {
      cy.visit(`/______not_existing_page`, {
        failOnStatusCode: false,
      }).waitForRouteChange()
      cy.findByText(`Preview custom 404 page`).click()
      cy.findByText(`A custom 404 page wasn't detected`, {
        exact: false,
      }).should(`exist`)
      cy.findByText(
        `You just hit a route that does not exist... the sadness.`,
        { exact: false }
      ).should(`not.exist`)
    })

    runTests()
  })
})
