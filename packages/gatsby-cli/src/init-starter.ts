import opn from "better-opn"
import { execSync } from "child_process"
import execa from "execa"
import { sync as existsSync } from "fs-exists-cached"
import fs from "fs-extra"
import hostedGitInfo from "hosted-git-info"
import isValid from "is-valid-path"
import sysPath from "path"
import prompts from "prompts"
import url from "url"
import { updateInternalSiteMetadata } from "gatsby-core-utils"
import report from "./reporter"
import { getPackageManager, setPackageManager } from "./util/package-manager"
import reporter from "./reporter"

const spawnWithArgs = (
  file: string,
  args: Array<string>,
  options?: execa.Options
): execa.ExecaChildProcess =>
  execa(file, args, { stdio: `inherit`, preferLocal: false, ...options })

const spawn = (
  cmd: string,
  options?: execa.Options
): execa.ExecaChildProcess => {
  // Split on spaces, tabs, new lines
  const [file, ...args] = cmd.split(/\s+/)
  return spawnWithArgs(file, args, options)
}
// Checks the existence of yarn package
// We use yarnpkg instead of yarn to avoid conflict with Hadoop yarn
// Refer to https://github.com/yarnpkg/yarn/issues/673
const checkForYarn = (): boolean => {
  try {
    execSync(`yarnpkg --version`, { stdio: `ignore` })
    return true
  } catch (e) {
    return false
  }
}

// Checks the existence of bun binary
const checkForBun = (): boolean => {
  try {
    execSync(`bun --version`, { stdio: `ignore` })
    return true
  } catch (e) {
    return false
  }
}

const isAlreadyGitRepository = async (): Promise<boolean> => {
  try {
    return await spawn(`git rev-parse --is-inside-work-tree`, {
      stdio: `pipe`,
    }).then(output => output.stdout === `true`)
  } catch (err) {
    return false
  }
}

// Initialize newly cloned directory as a git repo
const gitInit = async (
  rootPath: string
): Promise<execa.ExecaReturnBase<string>> => {
  report.info(`Initialising git in ${rootPath}`)

  return await spawn(`git init`, { cwd: rootPath })
}

// Create a .gitignore file if it is missing in the new directory
const maybeCreateGitIgnore = async (rootPath: string): Promise<void> => {
  if (existsSync(sysPath.join(rootPath, `.gitignore`))) {
    return
  }

  report.info(`Creating minimal .gitignore in ${rootPath}`)
  await fs.writeFile(
    sysPath.join(rootPath, `.gitignore`),
    `.cache\nnode_modules\npublic\n`
  )
}

// Create an initial git commit in the new directory
const createInitialGitCommit = async (
  rootPath: string,
  starterUrl: string
): Promise<void> => {
  report.info(`Create initial git commit in ${rootPath}`)

  await spawn(`git add -A`, { cwd: rootPath })
  // use execSync instead of spawn to handle git clients using
  // pgp signatures (with password)
  try {
    execSync(`git commit -m "Initial commit from gatsby: (${starterUrl})"`, {
      cwd: rootPath,
    })
  } catch {
    // Remove git support if initial commit fails
    report.info(`Initial git commit failed - removing git support\n`)
    fs.removeSync(sysPath.join(rootPath, `.git`))
  }
}

// Executes `npm install`, `yarn install`, or `bun install` in rootPath.
const install = async (rootPath: string): Promise<void> => {
  const prevDir = process.cwd()

  report.info(`Installing packages...`)
  process.chdir(rootPath)

  const npmConfigUserAgent = process.env.npm_config_user_agent

  try {
    if (!getPackageManager()) {
      if (npmConfigUserAgent?.includes(`yarn`)) {
        setPackageManager(`yarn`)
      } else if (npmConfigUserAgent?.includes(`bun`)) {
        setPackageManager(`bun`)
      } else {
        setPackageManager(`npm`)
      }
    }
    if (getPackageManager() === `yarn` && checkForYarn()) {
      await fs.remove(`package-lock.json`)
      await fs.remove(`bun.lockb`)
      await spawn(`yarnpkg`)
    } else if (getPackageManager() === `bun` && checkForBun()) {
      await fs.remove(`package-lock.json`)
      await fs.remove(`yarn.lock`)
      await spawn(`bun install`)
    } else {
      await fs.remove(`yarn.lock`)
      await fs.remove(`bun.lockb`)
      await spawn(
        `npm install --loglevel error --color always --legacy-peer-deps --no-audit`
      )
    }
  } finally {
    process.chdir(prevDir)
  }
}

const ignored = (path: string): boolean =>
  !/^\.(git|hg)$/.test(sysPath.basename(path))

// Copy starter from file system.
const copy = async (
  starterPath: string,
  rootPath: string
): Promise<boolean> => {
  // Chmod with 755.
  // 493 = parseInt('755', 8)
  await fs.ensureDir(rootPath, { mode: 493 })

  if (!existsSync(starterPath)) {
    throw new Error(`starter ${starterPath} doesn't exist`)
  }

  if (starterPath === `.`) {
    throw new Error(
      `You can't create a starter from the existing directory. If you want to
      create a new site in the current directory, the trailing dot isn't
      necessary. If you want to create a new site from a local starter, run
      something like "gatsby new new-gatsby-site ../my-gatsby-starter"`
    )
  }

  report.info(`Creating new site from local starter: ${starterPath}`)

  report.log(`Copying local starter to ${rootPath} ...`)

  await fs.copy(starterPath, rootPath, { filter: ignored })

  report.success(`Created starter directory layout`)

  await install(rootPath)

  return true
}

// Clones starter from URI.
const clone = async (
  hostInfo: hostedGitInfo,
  rootPath: string
): Promise<void> => {
  let url: string
  // Let people use private repos accessed over SSH.
  if (hostInfo.getDefaultRepresentation() === `sshurl`) {
    url = hostInfo.ssh({ noCommittish: true })
    // Otherwise default to normal git syntax.
  } else {
    url = hostInfo.https({ noCommittish: true, noGitPlus: true })
  }

  const branch = hostInfo.committish ? [`-b`, hostInfo.committish] : []

  report.info(`Creating new site from git: ${url}`)

  const args = [
    `clone`,
    ...branch,
    url,
    rootPath,
    `--recursive`,
    `--depth=1`,
  ].filter(arg => Boolean(arg))

  await spawnWithArgs(`git`, args)

  report.success(`Created starter directory layout`)

  await fs.remove(sysPath.join(rootPath, `.git`))

  await install(rootPath)
  const isGit = await isAlreadyGitRepository()
  if (!isGit) await gitInit(rootPath)
  await maybeCreateGitIgnore(rootPath)
  if (!isGit) await createInitialGitCommit(rootPath, url)
}

interface IGetPaths {
  starterPath: string
  rootPath: string
  selectedOtherStarter: boolean
}

const getPaths = async (
  starterPath?: string,
  rootPath?: string
): Promise<IGetPaths> => {
  let selectedOtherStarter = false

  // if no args are passed, prompt user for path and starter
  if (!starterPath && !rootPath) {
    const response = await prompts.prompt([
      {
        type: `text`,
        name: `path`,
        message: `What is your project called?`,
        initial: `my-gatsby-project`,
      },
      {
        type: `select`,
        name: `starter`,
        message: `What starter would you like to use?`,
        choices: [
          { title: `gatsby-starter-default`, value: `gatsby-starter-default` },
          {
            title: `gatsby-starter-hello-world`,
            value: `gatsby-starter-hello-world`,
          },
          { title: `gatsby-starter-blog`, value: `gatsby-starter-blog` },
          { title: `(Use a different starter)`, value: `different` },
        ],
        initial: 0,
      },
    ])
    // exit gracefully if responses aren't provided
    if (!response.starter || !response.path.trim()) {
      throw new Error(
        `Please mention both starter package and project name along with path(if its not in the root)`
      )
    }

    selectedOtherStarter = response.starter === `different`
    starterPath = `gatsbyjs/${response.starter}`
    rootPath = response.path
  }

  // set defaults if no root or starter has been set yet
  rootPath = rootPath || process.cwd()
  starterPath = starterPath || `gatsbyjs/gatsby-starter-default`

  return { starterPath, rootPath, selectedOtherStarter }
}

const successMessage = (path: string): void => {
  report.info(`
Your new Gatsby site has been successfully bootstrapped. Start developing it by running:

  cd ${path}
  gatsby develop
`)
}

/**
 * Main function that clones or copies the starter.
 */
export async function initStarter(
  starter?: string,
  root?: string
): Promise<void> {
  const { starterPath, rootPath, selectedOtherStarter } = await getPaths(
    starter,
    root
  )

  const urlObject = url.parse(rootPath)

  if (selectedOtherStarter) {
    report.info(
      `Opening the starter library at https://gatsby.dev/starters?v=2...\nThe starter library has a variety of options for starters you can browse\n\nYou can then use the gatsby new command with the link to a repository of a starter you'd like to use, for example:\ngatsby new ${rootPath} https://github.com/gatsbyjs/gatsby-starter-default`
    )
    opn(`https://gatsby.dev/starters?v=2`)
    return
  }
  if (urlObject.protocol && urlObject.host) {
    const isStarterAUrl =
      starter && !url.parse(starter).hostname && !url.parse(starter).protocol

    if (/gatsby-starter/gi.test(rootPath) && isStarterAUrl) {
      report.panic({
        id: `11610`,
        context: {
          starter,
          rootPath,
        },
      })
      return
    }
    report.panic({
      id: `11611`,
      context: {
        rootPath,
      },
    })
    return
  }

  if (!isValid(rootPath)) {
    report.panic({
      id: `11612`,
      context: {
        path: sysPath.resolve(rootPath),
      },
    })
    return
  }

  if (existsSync(sysPath.join(rootPath, `package.json`))) {
    report.panic({
      id: `11613`,
      context: {
        rootPath,
      },
    })
    return
  }

  const hostedInfo = hostedGitInfo.fromUrl(starterPath)

  if (hostedInfo) {
    await clone(hostedInfo, rootPath)
  } else {
    await copy(starterPath, rootPath)
  }

  const sitePath = sysPath.resolve(rootPath)

  const sitePackageJson = await fs
    .readJSON(sysPath.join(sitePath, `package.json`))
    .catch(() => {
      reporter.verbose(
        `Could not read "${sysPath.join(sitePath, `package.json`)}"`
      )
    })

  await updateInternalSiteMetadata(
    {
      name: sitePackageJson?.name || rootPath,
      sitePath,
      lastRun: Date.now(),
    },
    false
  )

  successMessage(rootPath)
}
