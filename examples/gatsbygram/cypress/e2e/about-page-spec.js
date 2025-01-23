describe(`About Page`, () => {
  it(`successfully loads`, () => {
    cy.visit(`/about`)
  })

  it(`contains the title with an SVG icon and text "Gatsbygram"`, () => {
    cy.getTestElement(`site-title`).get(`svg`)
    cy.getTestElement(`site-title`).contains(`Gatsbygram`)
  })

  it(`clicking on site title takes to home page`, () => {
    cy.getTestElement(`site-title`).click()
    cy.url().should(`eq`, `${Cypress.config(`baseUrl`)}/`)

    // go back to about page for further testing
    cy.visit(`/about`)
  })

  it(`contains a link to about page in nav bar and it works`, () => {
    cy.getTestElement(`about-link`).contains(`About`)
    cy.getTestElement(`about-link`).click()
    cy.url().should(`eq`, `${Cypress.config(`baseUrl`)}/about/`)
  })

  it(`displays title of the page`, () => {
    cy.getTestElement(`about-title`).contains(`About Gatsbygram`)
  })
})
