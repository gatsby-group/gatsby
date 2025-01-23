/* globals cy */

describe(`The Home Page`, () => {
  it(`successfully loads`, () => {
    cy.visit(`/`).waitForRouteChange()
  })

  it(`contains the title with an SVG icon and text "Gatsbygram"`, () => {
    cy.getTestElement(`site-title`).get(`svg`)
    cy.getTestElement(`site-title`).contains(`Gatsbygram`)
  })

  it(`contains a link to about page in nav bar and it works`, () => {
    cy.getTestElement(`about-link`).contains(`About`)
    cy.getTestElement(`about-link`).click()
    cy.waitForRouteChange().location(`pathname`).should(`equal`, `/about/`)

    // go back to home page
    cy.getTestElement(`site-title`).click()

    cy.waitForRouteChange().location(`pathname`).should(`equal`, `/`)
  })

  it(`renders user avatar and name`, () => {
    cy.getTestElement(`user-avatar`).get(`img`)
    cy.getTestElement(`username`).contains(`kyle__mathews`)
  })

  it(`shows user's posts and followers count`, () => {
    cy.getTestElement(`user-meta`).contains(`100 posts`)
    cy.getTestElement(`user-meta`).contains(`192k followers`)
  })

  it(`shows number of likes when hovered on a post`, () => {
    cy.fixture(`posts`).then(postsData => {
      const post = postsData[0]
      cy.getTestElement(`post`).first().trigger(`mouseover`)
      cy.getTestElement(`likes`).contains(post.likes)
      cy.getTestElement(`post`).first().trigger(`mouseout`)
    })
  })

  it(`opens and closes a post`, () => {
    cy.fixture(`posts`).then(postsData => {
      const post = postsData[0]
      cy.getTestElement(`post`).first().click()

      cy.waitForRouteChange().url().should(`contain`, post.id)

      cy.getTestElement(`post-detail-avatar`).should(
        `have.attr`,
        `src`,
        post.avatar
      )
      cy.getTestElement(`post-detail-username`).contains(post.username)
      cy.getTestElement(`post-detail-likes`).contains(post.likes)
      cy.getTestElement(`post-detail-text`).contains(post.username)
      cy.getTestElement(`post-detail-text`).contains(post.text)
      cy.getTestElement(`modal-close`).click()
      cy.waitForRouteChange().location(`pathname`).should(`equal`, `/`)
    })
  })

  it(`goes to next / previous post on clicking arrow icons`, () => {
    cy.fixture(`posts`).then(([post1, post2]) => {
      cy.getTestElement(`post`).first().click()

      cy.waitForRouteChange().url().should(`contain`, post1.id)

      // click right arrow icon to go to 2nd post
      cy.getTestElement(`next-post`).click()

      cy.waitForRouteChange().url().should(`contain`, post2.id)

      // press left arrow to go back to 1st post
      cy.getTestElement(`previous-post`).click()

      cy.waitForRouteChange().url().should(`contain`, post1.id)

      // close the post
      cy.getTestElement(`modal-close`).click()

      cy.waitForRouteChange().location(`pathname`).should(`equal`, `/`)
    })
  })

  it(`goes to next / previous post with keyboard shortcut`, () => {
    cy.fixture(`posts`).then(([post1, post2]) => {
      // open fist post
      cy.getTestElement(`post`).first().click()

      // wait for page to transition
      cy.waitForRouteChange().url().should(`contain`, post1.id)

      // press right arrow to go to 2nd post
      cy.get(`body`).type(`{rightarrow}`)

      // wait for page to transition
      cy.waitForRouteChange().url().should(`contain`, post2.id)

      // press left arrow to go back to 1st post
      cy.get(`body`).type(`{leftarrow}`)

      // wait for page to transition
      cy.waitForRouteChange().url().should(`contain`, post1.id)

      // close the post
      cy.getTestElement(`modal-close`).click()

      // wait for page to transition
      cy.waitForRouteChange().location(`pathname`).should(`equal`, `/`)
    })
  })

  it(`successfully goes back after reloading the page`, () => {
    cy.fixture(`posts`).then(([post1, post2]) => {
      // open fist post
      cy.getTestElement(`post`).first().click()

      // wait for page to transition
      cy.waitForRouteChange().url().should(`contain`, post1.id)

      // press right arrow to go to 2nd post
      cy.get(`body`).type(`{rightarrow}`)

      // wait for page to transition
      cy.waitForRouteChange().url().should(`contain`, post2.id)

      // reload the page and go back
      cy.reload().waitForRouteChange().go(`back`)

      // test if the first post exists
      cy.waitForRouteChange().get(`div[to='/${post1.id}/']`).should(`exist`)

      // close the post
      cy.getTestElement(`modal-close`).click()

      // wait for page to transition
      cy.waitForRouteChange().location(`pathname`).should(`equal`, `/`)
    })
  })

  it(`loads more posts when Load More button is clicked & on scroll`, () => {
    // initially loads 12 posts
    cy.getTestElement(`post`).should(`have.length`, 12)

    // loads 12 more posts when Load More button is clicked
    cy.getTestElement(`load-more`).click()
    cy.getTestElement(`post`).should(`have.length`, 24)

    // loads 12 more posts when scrolled to bottom
    // cy.getTestElement(`home-container`).scrollTo(`0%`, `99%`)
    cy.window().scrollTo(`bottom`)
    cy.getTestElement(`post`).should(`have.length`, 36)

    // let's go back to top
    cy.window().scrollTo(`top`)
  })
})
