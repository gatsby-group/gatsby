import _ from "lodash"
import semver from "semver"

// Does this experiment run for only builds
type executingCommand = "build" | "develop" | "all"

export const satisfiesSemvers = (
  semverConstraints: Record<string, string>
): boolean => {
  // Check each semver check for the flag.
  // If any are false, then the flag doesn't pass
  const result = _.toPairs(semverConstraints).every(
    ([packageName, semverConstraint]) => {
      let packageVersion: string
      try {
        packageVersion = require(`${packageName}/package.json`).version
      } catch (e) {
        return false
      }

      // We care if the semver check doesn't pass.
      return semver.satisfies(packageVersion, semverConstraint, {
        includePrerelease: true,
      })
    }
  )

  return result
}

export type fitnessEnum = true | false | "OPT_IN" | "LOCKED_IN"

export interface IFlag {
  name: string
  env: string
  description: string
  command: executingCommand
  /**
   * Use string identifier to track enabled flag or false to disable any tracking (useful when flag becomes new defaults)
   */
  telemetryId: string | false
  // Heuristics for deciding if a flag is experimental:
  // - there are known bugs most people will encounter and that block being
  // able to use Gatsby normally
  // - very few people have tested the feature so we're not sure if we've
  // uncovered even common problems.
  //
  // Flags should start as experimental but once all serious known bugs are
  // resolved and ~50+ people have tested it, experimental should be set to
  // false.
  experimental: boolean
  /**
   * True means conditions for the feature are met and can be opted in by user.
   *
   * False means it'll be disabled despite the user setting it true e.g.
   * it just won't work e.g. it doesn't have new enough version for something.
   *
   * OPT_IN means the gatsby will enable the flag (unless the user explicitly
   * disables it.
   *
   * LOCKED_IN means that feature is enabled always (unless `noCI` condition is met).
   * This is mostly to provide more meaningful terminal messages instead of removing
   * flag from the flag list when users has the flag set in configuration
   * (avoids showing unknown flag message and shows "no longer needed" message).
   */
  testFitness: (flag: IFlag) => fitnessEnum
  /**
   * Human-readable text explaining requirements for this feature to be available
   * (e.g. requires Node 14+)
   *
   * It is shown to users when testFitness() returns `false` but flag is set in gatsby-config.js
   */
  requires?: string
  includedFlags?: Array<string>
  umbrellaIssue?: string
  noCI?: boolean
}

const activeFlags: Array<IFlag> = [
  {
    name: `FAST_DEV`,
    env: `GATSBY_EXPERIMENTAL_FAST_DEV`,
    command: `develop`,
    telemetryId: `FastDev`,
    experimental: false,
    description: `Enable all experiments aimed at improving develop server start time & develop DX.`,
    includedFlags: [
      `DEV_SSR`,
      `PRESERVE_FILE_DOWNLOAD_CACHE`,
      `WEBPACK_LAZY_COMPILATION`,
    ],
    testFitness: (): fitnessEnum => true,
  },
  {
    name: `DEV_SSR`,
    env: `GATSBY_EXPERIMENTAL_DEV_SSR`,
    command: `develop`,
    telemetryId: `DevSsr`,
    experimental: false,
    description: `Server Side Render (SSR) pages on full reloads during develop. Helps you detect SSR bugs and fix them without needing to do full builds.`,
    umbrellaIssue: `https://gatsby.dev/dev-ssr-feedback`,
    testFitness: (): fitnessEnum => true,
  },
  {
    name: `PRESERVE_FILE_DOWNLOAD_CACHE`,
    env: `GATSBY_EXPERIMENTAL_PRESERVE_FILE_DOWNLOAD_CACHE`,
    command: `all`,
    telemetryId: `PreserveFileDownloadCache`,
    experimental: false,
    description: `Don't delete the downloaded files cache when changing gatsby-node.js & gatsby-config.js files.`,
    umbrellaIssue: `https://gatsby.dev/cache-clearing-feedback`,
    testFitness: (): fitnessEnum => true,
  },
  {
    name: `PARALLEL_SOURCING`,
    env: `GATSBY_EXPERIMENTAL_PARALLEL_SOURCING`,
    command: `all`,
    telemetryId: `ParallelSourcing`,
    experimental: true,
    description: `Run all source plugins at the same time instead of serially. For sites with multiple source plugins, this can speedup sourcing and transforming considerably.`,
    umbrellaIssue: `https://gatsby.dev/parallel-sourcing-feedback`,
    testFitness: (): fitnessEnum => true,
  },
  {
    name: `DETECT_NODE_MUTATIONS`,
    env: `GATSBY_DETECT_NODE_MUTATIONS`,
    command: `all`,
    telemetryId: `DetectNodeMutations`,
    description: `Diagnostic mode to log any attempts to mutate node directly. Helpful when debugging missing data problems. See https://gatsby.dev/debugging-missing-data for more details.`,
    experimental: false,
    testFitness: (): fitnessEnum => true,
  },
  {
    name: `PARTIAL_HYDRATION`,
    env: `GATSBY_PARTIAL_HYDRATION`,
    command: `build`,
    telemetryId: `PartialHydration`,
    description: `Enable partial hydration to reduce Total Blocking Time and Time To Interactive `,
    umbrellaIssue: `https://gatsby.dev/partial-hydration-umbrella-issue`,
    experimental: true,
    testFitness: (): fitnessEnum => {
      const v18Constraint = {
        react: `>=18.0.0`,
      }
      const v0Constraint = {
        react: `^0.0.0`,
      }

      return (
        _CFLAGS_.GATSBY_MAJOR === `5` &&
        (satisfiesSemvers(v18Constraint) || satisfiesSemvers(v0Constraint))
      )
    },
    requires:
      Number(_CFLAGS_.GATSBY_MAJOR) < 5
        ? `Partial hydration is only available in Gatsby V5. Please upgrade Gatsby.`
        : `Partial hydration requires React 18+ to work.`,
  },
  {
    name: `WEBPACK_LAZY_COMPILATION`,
    env: `GATSBY_EXPERIMENTAL_WEBPACK_LAZY_COMPILATION`,
    command: `develop`,
    telemetryId: `WebpackLazyCompilation`,
    experimental: false,
    description: `Compile entrypoints and dynamic imports only when they are in use. Leads to faster start of gatsby develop.`,
    umbrellaIssue: `https://gatsby.dev/webpack-lazy-compilation-feedback`,
    testFitness: (): fitnessEnum => true,
  },
]

export default activeFlags
