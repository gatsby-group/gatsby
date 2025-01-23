const { defineConfig } = require('cypress')

module.exports = defineConfig({
  fixturesFolder: 'data',
  projectId: 'c9d3r3',
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require('./cypress/plugins/index.js')(on, config)
    },
    baseUrl: 'http://localhost:8000',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
})
