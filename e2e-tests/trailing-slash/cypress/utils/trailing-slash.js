/**
 * 
 * @param {Array<{ path: string; status: number; destinationPath?: string }>} pages 
 */
export function assertPageVisits(pages) {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]

    cy.intercept(new RegExp(`^${page.path}$`), req => {
      req.continue(res => {
        expect(res.statusCode).to.equal(page.status)
        if (page.destinationPath) {
          expect(res.headers.location).to.equal(page.destinationPath)
        } else {
          expect(res.headers.location).to.be.undefined
        }
      })
    })
  }
}
