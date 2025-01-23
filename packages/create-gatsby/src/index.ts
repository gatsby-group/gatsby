import Enquirer from "enquirer"
import cmses from "./questions/cmses.json"
import styles from "./questions/styles.json"
import features from "./questions/features.json"
import languages from "./questions/languages.json"
import { initStarter, getPackageManager, gitSetup } from "./init-starter"
import { writeFiles, IFile } from "./write-files"
import { installPlugins } from "./install-plugins"
import colors from "ansi-colors"
import path from "path"
import { plugin } from "./components/plugin"
import { makePluginConfigQuestions } from "./plugin-options-form"
import { center, wrap } from "./components/utils"
import { stripIndent } from "common-tags"
import { reporter } from "./utils/reporter"
import { setSiteMetadata } from "./utils/site-metadata"
import { makeNpmSafe } from "./utils/make-npm-safe"
import {
  generateQuestions,
  validateProjectName,
} from "./utils/question-helpers"
import { maybeUseEmoji } from "./utils/emoji"
import { parseArgs } from "./utils/parse-args"

export const DEFAULT_STARTERS: Record<keyof typeof languages, string> = {
  js: `https://github.com/gatsbyjs/gatsby-starter-minimal.git`,
  ts: `https://github.com/gatsbyjs/gatsby-starter-minimal-ts.git`,
}
interface IAnswers {
  name: string
  project: string
  language: keyof typeof languages
  styling?: keyof typeof styles
  cms?: keyof typeof cmses
  features?: Array<keyof typeof features>
}

/**
 * Interface for plugin JSON files
 */
interface IPluginEntry {
  /**
   * Message displayed in the menu when selecting the plugin
   */
  message: string
  /**
   * Extra NPM packages to install
   */
  dependencies?: Array<string>
  /**
   * Items are either the plugin name, or the plugin name and key, separated by a colon (":")
   * This allows duplicate entries for plugins such as gatsby-source-filesystem.
   */
  plugins?: Array<string>
  /**
   * Keys must match plugin names or name:key combinations from the plugins array
   */
  options?: PluginConfigMap
  /**
   * If the item is not a valid Gatsby plugin, set this to `false`
   */
  isGatsbyPlugin?: boolean
  /**
   * Additional files that should be written to the filesystem
   */
  files?: Array<IFile>
}

export type PluginMap = Record<string, IPluginEntry>

export type PluginConfigMap = Record<string, Record<string, unknown>>

export async function run(): Promise<void> {
  const { flags, dirName } = parseArgs(process.argv.slice(2))

  const { version } = require(`../package.json`)

  reporter.info(colors.grey(`create-gatsby version ${version}`))

  // Wecome message
  reporter.info(
    `


${center(colors.blueBright.bold.underline(`Welcome to Gatsby!`))}


`
  )

  // If we aren't skipping prompts, communicate we'll ask setup questions
  if (!flags.yes) {
    reporter.info(
      wrap(
        `This command will generate a new Gatsby site for you in ${colors.bold(
          process.cwd()
        )} with the setup you select. ${colors.white.bold(
          `Let's answer some questions:\n\n`
        )}`,
        process.stdout.columns
      )
    )
  }

  const enquirer = new Enquirer<IAnswers>()
  enquirer.use(plugin)

  // If we aren't skipping prompts, get a site name first to use as a default folder name
  let npmSafeSiteName
  let siteName = ``

  if (!flags.yes) {
    const { name } = await enquirer.prompt({
      type: `textinput`,
      name: `name`,
      message: `What would you like to call your site?`,
      initial: `My Gatsby Site`,
      format: (value: string): string => colors.cyan(value),
    })

    npmSafeSiteName = makeNpmSafe(name)
    siteName = name
  } else {
    const valid = validateProjectName(dirName)

    siteName = dirName
    if (!valid) {
      return
    }

    npmSafeSiteName = makeNpmSafe(dirName)
  }

  // Prompt user with questions and gather answers
  const questions = generateQuestions(npmSafeSiteName, flags)
  const answers = await enquirer.prompt(questions)

  answers.project = answers.project.trim()

  // Language selection
  if (flags.yes) {
    answers.language = `js`
  }
  if (flags.ts) {
    answers.language = `ts`
  }

  // Collect a report of things we will do to present to the user once the questions are complete
  const messages: Array<string> = [
    `${maybeUseEmoji(
      `🛠  `
    )}Create a new Gatsby site in the folder ${colors.magenta(
      answers.project
    )}`,
  ]

  const plugins: Array<string> = []
  const packages: Array<string> = []
  let pluginConfig: PluginConfigMap = {}

  // If a CMS is selected, ask CMS config questions after the main question set is complete
  if (answers.cms && answers.cms !== `none`) {
    messages.push(
      `${maybeUseEmoji(
        `📚 `
      )}Install and configure the plugin for ${colors.magenta(
        cmses[answers.cms].message
      )}`
    )
    const extraPlugins = cmses[answers.cms].plugins || []
    plugins.push(answers.cms, ...extraPlugins)
    packages.push(
      answers.cms,
      ...(cmses[answers.cms].dependencies || []),
      ...extraPlugins
    )
    pluginConfig = { ...pluginConfig, ...cmses[answers.cms].options }
  }

  // If a styling system is selected, ask styling config questions after the main question set is complete
  if (answers.styling && answers.styling !== `none`) {
    messages.push(
      `${maybeUseEmoji(`🎨 `)}Get you set up to use ${colors.magenta(
        styles[answers.styling].message
      )} for styling your site`
    )
    const extraPlugins = styles[answers.styling].plugins || []
    // If the key is not a valid Gatsby plugin, don't add it to the plugins array
    if (styles[answers.styling]?.isGatsbyPlugin === false) {
      plugins.push(...extraPlugins)
    } else {
      plugins.push(answers.styling, ...extraPlugins)
    }
    packages.push(
      answers.styling,
      ...(styles[answers.styling].dependencies || []),
      ...extraPlugins
    )
    pluginConfig = { ...pluginConfig, ...styles[answers.styling].options }
  }

  // If additional features are selected, install required dependencies in install step
  if (answers.features?.length) {
    messages.push(
      `${maybeUseEmoji(`🔌 `)}Install ${answers.features
        ?.map((feat: string) => colors.magenta(feat))
        .join(`, `)}`
    )
    plugins.push(...answers.features)
    const featureDependencies = answers.features?.map(featureKey => {
      const extraPlugins = features[featureKey].plugins || []
      plugins.push(...extraPlugins)
      return [
        // Spread in extra dependencies
        ...(features[featureKey].dependencies || []),
        // Spread in plugins
        ...extraPlugins,
      ]
    })
    const flattenedDependencies = ([] as Array<string>).concat.apply(
      [],
      featureDependencies
    ) // here until we upgrade to node 11 and can use flatMap

    packages.push(...answers.features, ...flattenedDependencies)
    // Merge plugin options
    pluginConfig = answers.features.reduce((prev, key) => {
      return { ...prev, ...features[key].options }
    }, pluginConfig)
  }

  // Ask additional config questions if any
  const config = makePluginConfigQuestions(plugins)

  if (config.length) {
    reporter.info(
      `\nGreat! A few of the selections you made need to be configured. Please fill in the options for each plugin now:\n`
    )

    const enquirer = new Enquirer<Record<string, Record<string, unknown>>>()
    enquirer.use(plugin)

    pluginConfig = { ...pluginConfig, ...(await enquirer.prompt(config)) }
  }

  // If we're not skipping prompts, give the user a report of what we're about to do
  if (!flags.yes) {
    reporter.info(`

${colors.bold(`Thanks! Here's what we'll now do:`)}

    ${messages.join(`\n    `)}
  `)

    const { confirm } = await new Enquirer<{ confirm: boolean }>().prompt({
      type: `confirm`,
      name: `confirm`,
      initial: `Yes`,
      message: `Shall we do this?`,
      format: value => (value ? colors.greenBright(`Yes`) : colors.red(`No`)),
    })

    if (!confirm) {
      reporter.info(`OK, bye!`)
      return
    }
  }

  // Decide starter
  const starter = DEFAULT_STARTERS[answers.language || `js`]

  // Do all the things
  await initStarter(
    starter,
    answers.project,
    packages.map((plugin: string) => plugin.split(`:`)[0]),
    npmSafeSiteName
  )

  reporter.success(`Created site in ${colors.green(answers.project)}`)

  const fullPath = path.resolve(answers.project)

  if (plugins.length) {
    reporter.info(`${maybeUseEmoji(`🔌 `)}Setting-up plugins...`)
    await installPlugins(plugins, pluginConfig, fullPath, [])
  }

  if (answers.styling && styles[answers.styling]?.files) {
    reporter.info(`${maybeUseEmoji(`🎨 `)}Adding necessary styling files...`)
    await writeFiles(answers.project, styles[answers.styling].files)
  }

  await setSiteMetadata(fullPath, `title`, siteName)

  await gitSetup(answers.project)

  const pm = await getPackageManager()
  const runCommand =
    pm === `npm` ? `npm run` : pm === `bun` ? `bun run` : `yarn`

  reporter.info(
    stripIndent`
    ${maybeUseEmoji(`🎉  `)}Your new Gatsby site ${colors.bold(
      siteName
    )} has been successfully created
    at ${colors.bold(fullPath)}.
    `
  )
  reporter.info(`Start by going to the directory with\n
  ${colors.magenta(`cd ${answers.project}`)}
  `)

  reporter.info(`Start the local development server with\n
  ${colors.magenta(`${runCommand} develop`)}
  `)

  reporter.info(`See all commands at\n
  ${colors.blueBright(`https://www.gatsbyjs.com/docs/reference/gatsby-cli/`)}
  `)
}
