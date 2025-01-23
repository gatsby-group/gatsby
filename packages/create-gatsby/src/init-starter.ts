import { execSync } from "child_process"
import execa, { Options } from "execa"
import fs from "fs-extra"
import path from "path"
import { reporter } from "./utils/reporter"
import { spin } from "tiny-spin"
import { getConfigStore } from "./utils/get-config-store"
type PackageManager = "yarn" | "npm" | "bun"
import colors from "ansi-colors"
import { clearLine } from "./utils/clear-line"

const packageManagerConfigKey = `cli.packageManager`

export const getPackageManager = (
  npmConfigUserAgent?: string
): PackageManager => {
  const configStore = getConfigStore()
  const actualPackageManager = configStore.get(packageManagerConfigKey)

  if (actualPackageManager) {
    return actualPackageManager
  }

  if (npmConfigUserAgent?.includes(`yarn`)) {
    configStore.set(packageManagerConfigKey, `yarn`)
    return `yarn`
  }

  if (npmConfigUserAgent?.includes(`bun`)) {
    configStore.set(packageManagerConfigKey, `bun`)
    return `bun`
  }

  configStore.set(packageManagerConfigKey, `npm`)
  return `npm`
}

// Checks the existence of yarn package
// We use yarnpkg instead of yarn to avoid conflict with Hadoop yarn
// Refer to https://github.com/yarnpkg/yarn/issues/673
const checkForYarn = (): boolean => {
  try {
    execSync(`yarnpkg --version`, { stdio: `ignore` })
    return true
  } catch (e) {
    reporter.info(
      `Woops! You have chosen "yarn" as your package manager, but it doesn't seem be installed on your machine. You can install it from https://yarnpkg.com/getting-started/install or change your preferred package manager with the command "gatsby options set pm npm". As a fallback, we will run the next steps with npm.`
    )
    return false
  }
}

// Checks the existence of bun bunary
const checkForBun = (): boolean => {
  try {
    execSync(`bun --version`, { stdio: `ignore` })
    return true
  } catch (e) {
    reporter.info(
      `Woops! You have chosen "bun" as your package manager, but it doesn't seem be installed on your machine. You can install it from https://bun.sh or change your preferred package manager with the command "gatsby options set pm npm". As a fallback, we will run the next steps with npm.`
    )
    return false
  }
}

// Initialize newly cloned directory as a git repo
const gitInit = async (
  rootPath: string
): Promise<execa.ExecaReturnBase<string>> =>
  await execa(`git`, [`init`], { cwd: rootPath })

// Create a .gitignore file if it is missing in the new directory
const maybeCreateGitIgnore = async (rootPath: string): Promise<void> => {
  if (fs.existsSync(path.join(rootPath, `.gitignore`))) {
    return
  }

  await fs.writeFile(
    path.join(rootPath, `.gitignore`),
    `.cache\nnode_modules\npublic\n`
  )
}

// Create an initial git commit in the new directory
const createInitialGitCommit = async (rootPath: string): Promise<void> => {
  await execa(`git`, [`add`, `-A`], { cwd: rootPath })
  // use execSync instead of spawn to handle git clients using
  // pgp signatures (with password)
  try {
    execSync(`git commit -m "Initial commit from gatsby"`, {
      cwd: rootPath,
    })
  } catch {
    // Remove git support if initial commit fails
    reporter.info(`Initial git commit failed - removing git support\n`)
    fs.removeSync(path.join(rootPath, `.git`))
  }
}

const setNameInPackage = async (
  sitePath: string,
  npmSafeSiteName: string
): Promise<void> => {
  const packageJsonPath = path.join(sitePath, `package.json`)
  const packageJson = await fs.readJSON(packageJsonPath)
  packageJson.name = npmSafeSiteName
  packageJson.description = npmSafeSiteName
  delete packageJson.license
  try {
    const result = await execa(`git`, [`config`, `user.name`])
    if (result.failed) {
      delete packageJson.author
    } else {
      packageJson.author = result.stdout
    }
  } catch (e) {
    delete packageJson.author
  }

  await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 })
}

// Executes `npm install` or `yarn install` in rootPath.
const install = async (
  rootPath: string,
  packages: Array<string>
): Promise<void> => {
  const prevDir = process.cwd()

  reporter.info(
    `${colors.blueBright(colors.symbols.pointer)} Installing Gatsby...`
  )

  process.chdir(rootPath)

  const npmConfigUserAgent = process.env.npm_config_user_agent

  try {
    const pm = getPackageManager(npmConfigUserAgent)

    const options: Options = {
      stderr: `inherit`,
    }

    const npmAdditionalCliArgs = [
      `--loglevel`,
      `error`,
      `--color`,
      `always`,
      `--legacy-peer-deps`,
      `--no-audit`,
    ]

    if (pm === `yarn` && checkForYarn()) {
      const args = packages.length
        ? [`add`, `--silent`, ...packages]
        : [`--silent`]

      await fs.remove(`package-lock.json`)
      await execa(`yarnpkg`, args, options)
    } else if (pm === `bun` && checkForBun()) {
      const args = packages.length
        ? [`add`, `--silent`, ...packages]
        : [`install`, `--silent`]

      await fs.remove(`package-lock.json`)
      await execa(`bun`, args, options)
    } else {
      await fs.remove(`yarn.lock`)
      await fs.remove(`bun.lockb`)
      await execa(`npm`, [`install`, ...npmAdditionalCliArgs], options)
      await clearLine()

      reporter.success(`Installed Gatsby`)
      reporter.info(
        `${colors.blueBright(colors.symbols.pointer)} Installing plugins...`
      )

      await execa(
        `npm`,
        [`install`, ...npmAdditionalCliArgs, ...packages],
        options
      )
      await clearLine()
    }

    reporter.success(`Installed plugins`)
  } catch (e) {
    reporter.panic((e as Error).message)
  } finally {
    process.chdir(prevDir)
  }
}

// Clones starter from URI.
const clone = async (
  url: string,
  rootPath: string,
  branch?: string
): Promise<void> => {
  const branchProps = branch ? [`-b`, branch] : []
  const stop = spin(`Cloning site template`)
  const args = [
    `clone`,
    ...branchProps,
    url,
    rootPath,
    `--recursive`,
    `--depth=1`,
    `--quiet`,
  ].filter(arg => Boolean(arg))

  try {
    await execa(`git`, args)

    reporter.success(`Created site from template`)
  } catch (err) {
    reporter.panic((err as Error).message)
  }

  stop()
  await fs.remove(path.join(rootPath, `.git`))

  await fs.remove(path.join(rootPath, `LICENSE`))
}

export async function gitSetup(rootPath: string): Promise<void> {
  await gitInit(rootPath)
  await maybeCreateGitIgnore(rootPath)
  await createInitialGitCommit(rootPath)
}

/**
 * Main function that clones or copies the starter.
 */
export async function initStarter(
  starter: string,
  rootPath: string,
  packages: Array<string>,
  npmSafeSiteName: string
): Promise<void> {
  const sitePath = path.resolve(rootPath)

  await clone(starter, sitePath)

  await setNameInPackage(sitePath, npmSafeSiteName)

  await install(rootPath, packages)

  // trackCli(`NEW_PROJECT_END`);
}
