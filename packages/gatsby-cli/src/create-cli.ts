import path from "path"
import resolveCwd from "resolve-cwd"
import yargs from "yargs"
import envinfo from "envinfo"
import { sync as existsSync } from "fs-exists-cached"
import { run as runCreateGatsby } from "create-gatsby"
import report from "./reporter"
import { setStore } from "./reporter/redux"
import { getLocalGatsbyVersion } from "./util/version"
import { initStarter } from "./init-starter"
import { login } from "./login"
import { logout } from "./logout"
import { whoami } from "./whoami"
import { getPackageManager, setPackageManager } from "./util/package-manager"
import reporter from "./reporter"

const handlerP =
  (fn: (args: yargs.Arguments) => void) =>
  (args: yargs.Arguments): void => {
    Promise.resolve(fn(args)).then(
      () => process.exit(0),
      err => report.panic(err)
    )
  }

function buildLocalCommands(cli: yargs.Argv, isLocalSite: boolean): void {
  const defaultHost = `localhost`
  const defaultPort = `8000`
  const directory = path.resolve(`.`)

  // 'not dead' query not available in browserslist used in Gatsby v1
  const DEFAULT_BROWSERS =
    getLocalGatsbyMajorVersion() === 1
      ? [`> 1%`, `last 2 versions`, `IE >= 9`]
      : [`>0.25%`, `not dead`]

  const siteInfo = {
    directory,
    browserslist: DEFAULT_BROWSERS,
    sitePackageJson: undefined,
  }

  const useYarn = existsSync(path.join(directory, `yarn.lock`))
  if (isLocalSite) {
    const json = require(path.join(directory, `package.json`))
    siteInfo.sitePackageJson = json
    siteInfo.browserslist = json.browserslist || siteInfo.browserslist
  }

  function getLocalGatsbyMajorVersion(): number | undefined {
    const version = getLocalGatsbyVersion()

    if (version) {
      return Number(version.split(`.`)[0])
    }

    return undefined
  }

  function resolveLocalCommand(
    command: string
  ): ((...args: Array<unknown>) => void) | never {
    if (!isLocalSite) {
      cli.showHelp()
      report.verbose(`current directory: ${directory}`)
      return report.panic(
        `gatsby <${command}> can only be run for a gatsby site.\n` +
          `Either the current working directory does not contain a valid package.json or ` +
          `'gatsby' is not specified as a dependency`
      )
    }

    try {
      const cmdPath =
        resolveCwd.silent(`gatsby/dist/commands/${command}`) ||
        // Old location of commands
        resolveCwd.silent(`gatsby/dist/utils/${command}`)
      if (!cmdPath)
        return report.panic(
          `There was a problem loading the local ${command} command. Gatsby may not be installed in your site's "node_modules" directory. Perhaps you need to run "npm install"? You might need to delete your "package-lock.json" as well.`
        )

      report.verbose(`loading local command from: ${cmdPath}`)

      const cmd = require(cmdPath)
      if (cmd instanceof Function) {
        return cmd
      }

      return report.panic(
        `Handler for command "${command}" is not a function. Your Gatsby package might be corrupted, try reinstalling it and running the command again.`
      )
    } catch (err) {
      cli.showHelp()
      return report.panic(
        `There was a problem loading the local ${command} command. Gatsby may not be installed. Perhaps you need to run "npm install"?`,
        err
      )
    }
  }

  function getCommandHandler(
    command: string,
    handler?: (
      args: yargs.Arguments,
      cmd: (args: yargs.Arguments) => void
    ) => void,
    nodeEnv?: string | undefined
  ): (argv: yargs.Arguments) => void {
    return (argv: yargs.Arguments): void => {
      report.setVerbose(!!argv.verbose)

      report.setNoColor(!!(argv.noColor || process.env.NO_COLOR))

      process.env.gatsby_log_level = argv.verbose ? `verbose` : `normal`
      report.verbose(`set gatsby_log_level: "${process.env.gatsby_log_level}"`)

      process.env.gatsby_executing_command = command
      report.verbose(`set gatsby_executing_command: "${command}"`)

      // This is to make sure that the NODE_ENV is set before resolveLocalCommand is called
      // This way, cache-lmdb uses the same DB files in main & workers
      if (nodeEnv) {
        process.env.NODE_ENV = nodeEnv
      }

      const localCmd = resolveLocalCommand(command)
      const args = { ...argv, ...siteInfo, report, useYarn, setStore }

      report.verbose(`running command: ${command}`)
      return handler ? handler(args, localCmd) : localCmd(args)
    }
  }

  cli.command({
    command: `develop`,
    describe:
      `Start development server. Watches files, rebuilds, and hot reloads ` +
      `if something changes`,
    builder: _ =>
      _.option(`H`, {
        alias: `host`,
        type: `string`,
        default: process.env.GATSBY_HOST || defaultHost,
        describe: process.env.GATSBY_HOST
          ? `Set host. Defaults to ${process.env.GATSBY_HOST} (set by env.GATSBY_HOST) (otherwise defaults ${defaultHost})`
          : `Set host. Defaults to ${defaultHost}`,
      })
        .option(`p`, {
          alias: `port`,
          type: `string`,
          default: process.env.PORT || defaultPort,
          describe: process.env.PORT
            ? `Set port. Defaults to ${process.env.PORT} (set by env.PORT) (otherwise defaults ${defaultPort})`
            : `Set port. Defaults to ${defaultPort}`,
        })
        .option(`o`, {
          alias: `open`,
          type: `boolean`,
          describe: `Open the site in your (default) browser for you.`,
        })
        .option(`S`, {
          alias: `https`,
          type: `boolean`,
          describe: `Use HTTPS. See https://www.gatsbyjs.com/docs/local-https/ as a guide`,
        })
        .option(`c`, {
          alias: `cert-file`,
          type: `string`,
          default: ``,
          describe: `Custom HTTPS cert file (also required: --https, --key-file). See https://www.gatsbyjs.com/docs/local-https/`,
        })
        .option(`k`, {
          alias: `key-file`,
          type: `string`,
          default: ``,
          describe: `Custom HTTPS key file (also required: --https, --cert-file). See https://www.gatsbyjs.com/docs/local-https/`,
        })
        .option(`ca-file`, {
          type: `string`,
          default: ``,
          describe: `Custom HTTPS CA certificate file (also required: --https, --cert-file, --key-file).  See https://www.gatsbyjs.com/docs/local-https/`,
        })
        .option(`graphql-tracing`, {
          type: `boolean`,
          describe: `Trace every graphql resolver, may have performance implications`,
          default: false,
        })
        .option(`open-tracing-config-file`, {
          type: `string`,
          describe: `Tracer configuration file (OpenTracing compatible). See https://gatsby.dev/tracing`,
        })
        .option(`inspect`, {
          type: `number`,
          describe: `Opens a port for debugging. See https://www.gatsbyjs.com/docs/debugging-the-build-process/`,
        })
        .option(`inspect-brk`, {
          type: `number`,
          describe: `Opens a port for debugging. Will block until debugger is attached. See https://www.gatsbyjs.com/docs/debugging-the-build-process/`,
        }),
    handler: handlerP(
      getCommandHandler(
        `develop`,
        (args: yargs.Arguments, cmd: (args: yargs.Arguments) => unknown) => {
          if (Object.prototype.hasOwnProperty.call(args, `inspect`)) {
            args.inspect = args.inspect || 9229
          }
          if (Object.prototype.hasOwnProperty.call(args, `inspect-brk`)) {
            args.inspectBrk = args[`inspect-brk`] || 9229
          }

          cmd(args)
          // Return an empty promise to prevent handlerP from exiting early.
          // The development server shouldn't ever exit until the user directly
          // kills it so this is fine.
          return new Promise(() => {})
        },
        process.env.NODE_ENV || `development`
      )
    ),
  })

  cli.command({
    command: `build`,
    describe: `Build a Gatsby project.`,
    builder: _ =>
      _.option(`prefix-paths`, {
        type: `boolean`,
        default:
          process.env.PREFIX_PATHS === `true` ||
          process.env.PREFIX_PATHS === `1`,
        describe: `Build site with link paths prefixed with the pathPrefix value in gatsby-config.js. Default is env.PREFIX_PATHS or false.`,
      })
        .option(`no-uglify`, {
          type: `boolean`,
          default: false,
          describe: `Build site without uglifying JS bundles (for debugging).`,
        })
        .option(`profile`, {
          type: `boolean`,
          default:
            process.env.REACT_PROFILE === `true` ||
            process.env.REACT_PROFILE === `1`,
          describe: `Build site with react profiling (this can add some additional overhead). See https://reactjs.org/docs/profiler`,
        })
        .option(`graphql-tracing`, {
          type: `boolean`,
          describe: `Trace every graphql resolver, may have performance implications`,
          default: false,
        })
        .option(`open-tracing-config-file`, {
          type: `string`,
          describe: `Tracer configuration file (OpenTracing compatible). See https://gatsby.dev/tracing`,
        })
        // log-pages and write-to-file were added specifically to experimental GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES feature
        // in gatsby@2. They are useful, but not very applicable (specifically `--write-to-file`) as generic approach, as it only
        // list pages without other artifacts, so it's useful in very narrow scope. Because we don't have alternative right now
        // those toggles are kept for users that rely on them, but we won't promote them and will keep them "hidden".
        .option(`log-pages`, {
          type: `boolean`,
          default: false,
          describe: `Log the pages that changes since last build.`,
          hidden: true,
        })
        .option(`write-to-file`, {
          type: `boolean`,
          default: false,
          describe: `Save the log of changed pages for future comparison.`,
          hidden: true,
        })
        .option(`functions-platform`, {
          type: `string`,
          describe: `The platform bundled functions will execute on. Defaults to current platform or settings provided by used adapter.`,
        })
        .option(`functions-arch`, {
          type: `string`,
          describe: `The architecture bundled functions will execute on. Defaults to current architecture or settings provided by used adapter.`,
        }),
    handler: handlerP(
      getCommandHandler(
        `build`,
        (args: yargs.Arguments, cmd: (args: yargs.Arguments) => void) =>
          cmd(args),
        `production`
      )
    ),
  })

  cli.command({
    command: `serve`,
    describe: `Serve previously built Gatsby site.`,
    builder: _ =>
      _.option(`H`, {
        alias: `host`,
        type: `string`,
        default: defaultHost,
        describe: `Set host. Defaults to ${defaultHost}`,
      })
        .option(`p`, {
          alias: `port`,
          type: `string`,
          default: `9000`,
          describe: `Set port. Defaults to 9000`,
        })
        .option(`o`, {
          alias: `open`,
          type: `boolean`,
          describe: `Open the site in your (default) browser for you.`,
        })
        .option(`prefix-paths`, {
          type: `boolean`,
          default:
            process.env.PREFIX_PATHS === `true` ||
            process.env.PREFIX_PATHS === `1`,
          describe: `Serve site with link paths prefixed with the pathPrefix value in gatsby-config.js.Default is env.PREFIX_PATHS or false.`,
        })
        .option(`open-tracing-config-file`, {
          type: `string`,
          describe: `Tracer configuration file (OpenTracing compatible). See https://gatsby.dev/tracing`,
        }),

    handler: getCommandHandler(
      `serve`,
      (args: yargs.Arguments, cmd: (args: yargs.Arguments) => void) =>
        cmd(args),
      process.env.NODE_ENV || `production`
    ),
  })

  cli.command({
    command: `info`,
    describe: `Get environment information for debugging and issue reporting`,
    builder: _ =>
      _.option(`C`, {
        alias: `clipboard`,
        type: `boolean`,
        default: false,
        describe: `Automagically copy environment information to clipboard`,
      }),
    handler: (args: yargs.Arguments) => {
      try {
        const copyToClipboard =
          // Clipboard is not accessible when on a linux tty
          process.platform === `linux` && !process.env.DISPLAY
            ? false
            : args.clipboard

        envinfo
          .run({
            System: [`OS`, `CPU`, `Shell`],
            Binaries: [`Node`, `npm`, `Yarn`],
            Browsers: [`Chrome`, `Edge`, `Firefox`, `Safari`],
            Languages: [`Python`],
            npmPackages: `gatsby*`,
            npmGlobalPackages: `gatsby*`,
          })
          .then(envinfoOutput => {
            console.log(envinfoOutput)

            if (copyToClipboard) {
              // clipboardy is ESM-only package
              import(`clipboardy`).then(({ default: clipboardy }) => {
                clipboardy.writeSync(envinfoOutput)
              })
            }
          })
      } catch (err) {
        console.log(`Error: Unable to print environment info`)
        console.log(err)
      }
    },
  })

  cli.command({
    command: `feedback`,
    builder: _ =>
      _.option(`disable`, {
        type: `boolean`,
        describe: `Opt out of future feedback requests`,
      }).option(`enable`, {
        type: `boolean`,
        describe: `Opt into future feedback requests`,
      }),
    handler: getCommandHandler(`feedback`),
  })

  cli.command({
    command: `clean`,
    describe: `Wipe the local gatsby environment including built assets and cache`,
    handler: getCommandHandler(`clean`),
  })

  cli.command({
    command: `repl`,
    describe: `Get a node repl with context of Gatsby environment, see (https://www.gatsbyjs.com/docs/gatsby-repl/)`,
    handler: getCommandHandler(
      `repl`,
      (args: yargs.Arguments, cmd: (args: yargs.Arguments) => void) =>
        cmd(args),
      process.env.NODE_ENV || `development`
    ),
  })

  cli.command({
    command: `plugin <cmd> [plugins...]`,
    describe: `Useful commands relating to Gatsby plugins`,
    builder: yargs =>
      yargs.positional(`cmd`, {
        choices: [`docs`, `ls`],
        describe: "Valid commands include `docs`, `ls`.",
        type: `string`,
      }),
    handler: async ({
      cmd,
    }: yargs.Arguments<{
      cmd: string | undefined
    }>) => {
      const pluginHandler = require(`./handlers/plugin`).default
      await pluginHandler(siteInfo.directory, cmd)
    },
  })

  if (process.env.GATSBY_EXPERIMENTAL_CLOUD_CLI) {
    cli.command({
      command: `login`,
      describe: `Log in to Gatsby Cloud.`,
      handler: handlerP(async () => {
        await login()
      }),
    })

    cli.command({
      command: `logout`,
      describe: `Sign out of Gatsby Cloud.`,
      handler: handlerP(async () => {
        await logout()
      }),
    })

    cli.command({
      command: `whoami`,
      describe: `Gives the username of the current logged in user.`,
      handler: handlerP(async () => {
        await whoami()
      }),
    })
  }
}

function isLocalGatsbySite(): boolean {
  let inGatsbySite = false
  try {
    const { dependencies, devDependencies } = require(path.resolve(
      `./package.json`
    ))
    inGatsbySite =
      (dependencies && dependencies.gatsby) ||
      (devDependencies && devDependencies.gatsby)
  } catch (err) {
    /* ignore */
  }
  return !!inGatsbySite
}

function getVersionInfo(): string {
  const { version } = require(`../package.json`)
  const isGatsbySite = isLocalGatsbySite()
  if (isGatsbySite) {
    // we need to get the version from node_modules
    let gatsbyVersion = getLocalGatsbyVersion()

    if (!gatsbyVersion) {
      gatsbyVersion = `unknown`
    }

    return `Gatsby CLI version: ${version}
Gatsby version: ${gatsbyVersion}
  Note: this is the Gatsby version for the site at: ${process.cwd()}`
  } else {
    return `Gatsby CLI version: ${version}`
  }
}

export const createCli = (argv: Array<string>): yargs.Arguments => {
  const cli = yargs(argv).parserConfiguration({
    "boolean-negation": false,
  })

  const isLocalSite = isLocalGatsbySite()

  cli
    .scriptName(`gatsby`)
    .usage(`Usage: $0 <command> [options]`)
    .alias(`h`, `help`)
    .alias(`v`, `version`)
    .option(`verbose`, {
      default: false,
      type: `boolean`,
      describe: `Turn on verbose output`,
      global: true,
    })
    .option(`no-color`, {
      alias: `no-colors`,
      default: false,
      type: `boolean`,
      describe: `Turn off the color in output`,
      global: true,
    })
    .option(`json`, {
      describe: `Turn on the JSON logger`,
      default: false,
      type: `boolean`,
      global: true,
    })

  buildLocalCommands(cli, isLocalSite)

  try {
    cli.version(
      `version`,
      `Show the version of the Gatsby CLI and the Gatsby package in the current project`,
      getVersionInfo()
    )
  } catch (e) {
    // ignore
  }

  return cli
    .command({
      command: `new [rootPath] [starter]`,
      describe: `Create new Gatsby project.`,
      handler: handlerP(async ({ rootPath, starter }) => {
        const starterStr = starter ? String(starter) : undefined
        const rootPathStr = rootPath ? String(rootPath) : undefined

        // We only run the interactive CLI when there are no arguments passed in
        if (!starterStr && !rootPathStr) {
          await runCreateGatsby()
        } else {
          await initStarter(starterStr, rootPathStr)
        }
      }),
    })
    .command({
      command: `telemetry`,
      describe: `Enable or disable Gatsby anonymous analytics collection.`,
      builder: yargs =>
        yargs
          .option(`enable`, {
            type: `boolean`,
            description: `Enable telemetry (default)`,
          })
          .option(`disable`, {
            type: `boolean`,
            description: `Disable telemetry`,
          }),

      handler: handlerP(() => {
        report.log(`Telemetry is no longer gathered and is always disabled`)
      }),
    })
    .command({
      command: `options [cmd] [key] [value]`,
      describe: `View or set your gatsby-cli configuration settings.`,
      builder: yargs =>
        yargs
          .positional(`cmd`, {
            choices: [`set`],
            type: `string`,
            describe: `Configure your package manager.`,
          })
          .positional(`key`, {
            choices: [`pm`, `package-manager`],
            type: `string`,
            describe: `Set the package manager \`gatsby new\` is using.`,
          })
          .positional(`value`, {
            choices: [`npm`, `yarn`, `bun`],
            type: `string`,
            describe: `Set package manager as \`npm\`, \`yarn\`, or \`bun\`.`,
          }),

      handler: handlerP(({ cmd, key, value }: yargs.Arguments) => {
        if (!getPackageManager()) {
          setPackageManager(`npm`)
        }

        if (cmd === `set`) {
          if (key === `pm` || key === `package-manager`) {
            if (
              value &&
              value !== `yarn` &&
              value !== `npm` &&
              value !== `bun`
            ) {
              report.panic(`Package manager must be yarn, npm, or bun.`)
            }

            if (value) {
              // @ts-ignore
              setPackageManager(value)

              return
            } else {
              setPackageManager(`npm`)
            }
          } else {
            reporter.warn(
              `Please pass your desired config key and value. Currently you can only set your package manager using \`pm\`.`
            )
          }
          return
        }

        console.log(`
        Package Manager: ${getPackageManager()}
        `)
      }),
    })
    .wrap(cli.terminalWidth())
    .demandCommand(1, `Pass --help to see all available commands and options.`)
    .strict()
    .recommendCommands()
    .parse(argv.slice(2))
}
