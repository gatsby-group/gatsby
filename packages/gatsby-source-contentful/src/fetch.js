const contentful = require(`contentful`)
const _ = require(`lodash`)
const normalize = require(`./normalize`)
const { defaultOptions } = require(`./plugin-options`)
const {
  exitProcess,
  CONTENTFUL_CONNECTION_FAILED,
  CONTENTFUL_DATA_FETCHING_FAILED,
} = require(`./utils`)

module.exports = async ({ syncToken, reporter, ...pluginOptions }) => {
  // Fetch articles.
  console.time(`Fetch Contentful data`)

  console.log(`Starting to fetch data from Contentful`)

  // it would be great to streamline plugin options to match contentful client options
  // but for now need to keep current behaviour
  const contentfulClientOptions = {
    ...pluginOptions,
    space: pluginOptions.spaceId,
  }
  delete contentfulClientOptions.spaceId

  const client = contentful.createClient(contentfulClientOptions)

  // The sync API puts the locale in all fields in this format { fieldName:
  // {'locale': value} } so we need to get the space and its default local.
  //
  // We'll extend this soon to support multiple locales.
  let locales
  let defaultLocale = `en-US`
  try {
    console.log(`Fetching default locale`)
    locales = await client.getLocales().then(response => response.items)
    defaultLocale = _.find(locales, { default: true }).code
    console.log(`default locale is : ${defaultLocale}`)
  } catch (e) {
    let details
    if (e.code === `ENOTFOUND`) {
      details = `You seem to be offline`
    } else if (e.response) {
      if (e.response.status === 404) {
        // host and space used to generate url
        details = `Endpoint not found. Check if host and space settings are correct`
      } else if (e.response.status === 401) {
        // authorization error
        details = `Authorization error. Check if accessToken and environment is correct`
      }
    }

    const errorMessage = `Accessing your Contentful space failed.
Try setting GATSBY_CONTENTFUL_OFFLINE=true to see if we can serve from cache.
${details ? `\n${details}\n` : ``}
Used options:`

    reporter.error(errorMessage)
    reporter.optionsSummary({
      options: pluginOptions,
      defaults: defaultOptions,
    })
    exitProcess(CONTENTFUL_CONNECTION_FAILED)
  }

  let currentSyncData
  try {
    let query = syncToken ? { nextSyncToken: syncToken } : { initial: true }
    currentSyncData = await client.sync(query)
  } catch (e) {
    console.log(`error fetching contentful data`, e)
    exitProcess(CONTENTFUL_DATA_FETCHING_FAILED)
  }

  // We need to fetch content types with the non-sync API as the sync API
  // doesn't support this.
  let contentTypes
  try {
    contentTypes = await pagedGet(client, `getContentTypes`)
  } catch (e) {
    console.log(`error fetching content types`, e)
  }
  console.log(`contentTypes fetched`, contentTypes.items.length)

  let contentTypeItems = contentTypes.items

  // Fix IDs on entries and assets, created/updated and deleted.
  contentTypeItems = contentTypeItems.map(c => normalize.fixIds(c))

  currentSyncData.entries = currentSyncData.entries.map(e => {
    if (e) {
      return normalize.fixIds(e)
    }
    return null
  })
  currentSyncData.assets = currentSyncData.assets.map(a => {
    if (a) {
      return normalize.fixIds(a)
    }
    return null
  })
  currentSyncData.deletedEntries = currentSyncData.deletedEntries.map(e => {
    if (e) {
      return normalize.fixIds(e)
    }
    return null
  })
  currentSyncData.deletedAssets = currentSyncData.deletedAssets.map(a => {
    if (a) {
      return normalize.fixIds(a)
    }
    return null
  })

  const result = {
    currentSyncData,
    contentTypeItems,
    defaultLocale,
    locales,
  }

  return result
}

/**
 * Gets all the existing entities based on pagination parameters.
 * The first call will have no aggregated response. Subsequent calls will
 * concatenate the new responses to the original one.
 */
function pagedGet(
  client,
  method,
  query = {},
  skip = 0,
  pageLimit = 1000,
  aggregatedResponse = null
) {
  return client[method]({
    ...query,
    skip: skip,
    limit: pageLimit,
    order: `sys.createdAt`,
  }).then(response => {
    if (!aggregatedResponse) {
      aggregatedResponse = response
    } else {
      aggregatedResponse.items = aggregatedResponse.items.concat(response.items)
    }
    if (skip + pageLimit <= response.total) {
      return pagedGet(client, method, skip + pageLimit, aggregatedResponse)
    }
    return aggregatedResponse
  })
}
