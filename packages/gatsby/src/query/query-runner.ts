import fs from "fs-extra"
import report from "gatsby-cli/lib/reporter"

import path from "path"
import { store } from "../redux"
import { boundActionCreators } from "../redux/actions"
import pageDataUtil from "../utils/page-data"
import { getCodeFrame } from "./graphql-errors"
import errorParser from "./error-parser"

import { GraphQLRunner } from "./graphql-runner"
import { ExecutionResult } from "graphql"

const resultHashes = new Map()

type PageContext = any

interface IQueryJob {
  id: string
  hash?: string
  query: string
  componentPath: string
  context: PageContext
  isPage: boolean
  pluginCreatorId: string
}

interface IExecutionResult extends ExecutionResult {
  pageContext?: PageContext
}

// Run query
export const queryRunner = async (
  graphqlRunner: GraphQLRunner,
  queryJob: IQueryJob
): Promise<IExecutionResult> => {
  const { program } = store.getState()

  const graphql = (query: string, context: any): Promise<ExecutionResult> =>
    graphqlRunner.query(query, context)

  // Run query
  let result: IExecutionResult
  // Nothing to do if the query doesn't exist.
  if (!queryJob.query || queryJob.query === ``) {
    result = {}
  } else {
    result = await graphql(queryJob.query, queryJob.context)
  }

  // If there's a graphql error then log the error. If we're building, also
  // quit.
  if (result && result.errors) {
    let urlPath = undefined
    let queryContext = {}
    const plugin = queryJob.pluginCreatorId || `none`

    if (queryJob.isPage) {
      urlPath = queryJob.context.path
      queryContext = queryJob.context.context
    }

    const structuredErrors = result.errors
      .map(e => {
        const structuredError = errorParser({
          message: e.message,
          filePath: undefined,
          location: undefined,
        })

        structuredError.context = {
          ...structuredError.context,
          codeFrame: getCodeFrame(
            queryJob.query,
            e.locations && e.locations[0].line,
            e.locations && e.locations[0].column
          ),
          filePath: queryJob.componentPath,
          ...(urlPath ? { urlPath } : {}),
          ...queryContext,
          plugin,
        }

        return structuredError
      })
      .filter(Boolean)

    report.panicOnBuild(structuredErrors)
  }

  // Add the page context onto the results.
  if (queryJob && queryJob.isPage) {
    result[`pageContext`] = Object.assign({}, queryJob.context)
  }

  // Delete internal data from pageContext
  if (result.pageContext) {
    delete result.pageContext.path
    delete result.pageContext.internalComponentName
    delete result.pageContext.component
    delete result.pageContext.componentChunkName
    delete result.pageContext.updatedAt
    delete result.pageContext.pluginCreator___NODE
    delete result.pageContext.pluginCreatorId
    delete result.pageContext.componentPath
    delete result.pageContext.context
    delete result.pageContext.isCreatedByStatefulCreatePages
  }

  const resultJSON = JSON.stringify(result)
  const resultHash = require(`crypto`)
    .createHash(`sha1`)
    .update(resultJSON)
    .digest(`base64`)
  if (resultHash !== resultHashes.get(queryJob.id)) {
    resultHashes.set(queryJob.id, resultHash)

    if (queryJob.isPage) {
      const publicDir = path.join(program.directory, `public`)
      const { pages } = store.getState()
      const page = pages.get(queryJob.id)
      await pageDataUtil.write({ publicDir }, page, result)
    } else {
      // The babel plugin is hard-coded to load static queries from
      // public/static/d/
      const resultPath = path.join(
        program.directory,
        `public`,
        `static`,
        `d`,
        `${queryJob.hash}.json`
      )
      await fs.outputFile(resultPath, resultJSON)
    }
  }

  boundActionCreators.pageQueryRun({
    path: queryJob.id,
    componentPath: queryJob.componentPath,
    isPage: queryJob.isPage,
  })

  // Sets pageData to the store, here for easier access to the resultHash
  if (
    process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES &&
    queryJob.isPage
  ) {
    boundActionCreators.setPageData({
      id: queryJob.id,
      resultHash,
    })
  }
  return result
}
