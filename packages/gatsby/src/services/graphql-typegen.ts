import { EventObject } from "xstate"
import { IBuildContext } from "../internal"
import { IDataLayerContext, IQueryRunningContext } from "../state-machines"
import {
  writeGraphQLFragments,
  writeGraphQLSchema,
} from "../utils/graphql-typegen/file-writes"
import { writeTypeScriptTypes } from "../utils/graphql-typegen/ts-codegen"

export async function graphQLTypegen(
  {
    program,
    store,
    parentSpan,
    reporter,
  }: IBuildContext | IQueryRunningContext | IDataLayerContext,
  _: EventObject,
  {
    src: { compile },
  }: {
    src: {
      type: string
      compile?: "all" | "schema" | "definitions"
    }
  }
): Promise<void> {
  // TypeScript requires null/undefined checks for these
  // But this should never happen unless e.g. the state machine doesn't receive this information from a parent state machine
  if (!program || !store || !compile || !reporter) {
    throw new Error(
      `Missing required params in graphQLTypegen. program: ${!!program}. store: ${!!store}. compile: ${!!compile}`
    )
  }
  const directory = program.directory

  const activity = reporter.activityTimer(
    `Generating GraphQL and TypeScript types`,
    {
      parentSpan,
    }
  )
  activity.start()

  if (compile === `all` || compile === `schema`) {
    await writeGraphQLSchema(directory, store)
    if (compile === `schema`) {
      reporter.verbose(`Re-Generate GraphQL Schema types`)
    }
  }
  if (compile === `all` || compile === `definitions`) {
    await writeGraphQLFragments(directory, store)
    await writeTypeScriptTypes(directory, store)
    if (compile === `definitions`) {
      reporter.verbose(`Re-Generate TypeScript types & GraphQL fragments`)
    }
  }

  activity.end()
}
