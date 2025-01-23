import * as fs from "fs-extra"
import execa from "execa"
import _ from "lodash"
import {
  readConfigFile,
  lock,
  getConfigPath,
  getConfigStore,
} from "gatsby-core-utils"
import { transform, TransformOptions } from "@babel/core"
import BabelPluginAddPluginsToGatsbyConfig from "./plugin-babel-utils"

const addPluginToConfig = (
  src: string,
  srcPath: string,
  {
    name,
    options,
    key,
  }: {
    name: string
    options: Record<string, unknown> | undefined
    key: string
  }
): string => {
  let code

  try {
    const transformOptions: TransformOptions = {
      plugins: [
        [
          BabelPluginAddPluginsToGatsbyConfig,
          {
            pluginOrThemeName: name,
            options,
            key,
          },
        ],
      ],
      filename: srcPath,
      configFile: false,
    }

    // Use the Babel TS preset if we're operating on `gatsby-config.ts`
    if (srcPath.endsWith(`ts`)) {
      transformOptions.presets = [require.resolve(`@babel/preset-typescript`)]
    }

    code = transform(src, transformOptions)?.code

    // Add back stripped type import, do light formatting, remove added empty module export.
    // Use semicolon since Babel does that anyway, and we might as well be consistent.
    if (srcPath.endsWith(`ts`)) {
      code = `import type { GatsbyConfig } from "gatsby";\n\n${code}`
      code = code.replace(`export {};`, ``)
      code = code.replace(`export default config;`, `\nexport default config;`)
    }
  } catch (error) {
    console.error(`Failed to transform gatsby config`, error)
  }

  return code
}

interface IGatsbyPluginCreateInput {
  root: string
  name: string
  options: Record<string, unknown> | undefined
  key: string
}

export const GatsbyPluginCreate = async ({
  root,
  name,
  options,
  key,
}: IGatsbyPluginCreateInput): Promise<void> => {
  const release = await lock(`gatsby-config.js`)
  const configSrcPath = getConfigPath(root)
  const configSrc = await readConfigFile(root)
  const code = addPluginToConfig(configSrc, configSrcPath, {
    name,
    options,
    key,
  })
  await fs.writeFile(getConfigPath(root), code)
  release()
}

const packageMangerConfigKey = `cli.packageManager`
const PACKAGE_MANAGER = getConfigStore().get(packageMangerConfigKey) || `yarn`

const getPackageNames = (
  packages: Array<{ name: string; version: string }>
): Array<string> => packages.map(n => `${n.name}@${n.version}`)

const generateClientCommands = ({
  packageManager,
  depType,
  packageNames,
}: {
  packageManager: string
  depType: string
  packageNames: Array<string>
}): Array<string> | undefined => {
  const commands: Array<string> = []
  if (packageManager === `yarn`) {
    commands.push(`add`)
    // Needed for Yarn Workspaces and is a no-opt elsewhere.
    commands.push(`-W`)
    if (depType === `development`) {
      commands.push(`--dev`)
    }

    return commands.concat(packageNames)
  } else if (packageManager === `bun`) {
    commands.push(`add`)
    if (depType === `development`) {
      commands.push(`--dev`)
    }

    return commands.concat(packageNames)
  } else if (packageManager === `npm`) {
    commands.push(`install`)
    if (depType === `development`) {
      commands.push(`--save-dev`)
    }
    return commands.concat(packageNames)
  }

  return undefined
}

let installs: Array<{
  outsideResolve: any
  outsideReject: any
  resource: any
}> = []
const executeInstalls = async (root: string): Promise<void> => {
  // @ts-ignore - fix me
  const types = _.groupBy(installs, c => c.resource.dependencyType)

  // Grab the key of the first install & delete off installs these packages
  // then run intall
  // when done, check again & call executeInstalls again.
  // @ts-ignore - fix me
  const depType = installs[0].resource.dependencyType
  const packagesToInstall = types[depType]
  installs = installs.filter(
    // @ts-ignore - fix me
    i => !packagesToInstall.some(p => i.resource.name === p.resource.name)
  )

  // @ts-ignore - fix me
  const pkgs = packagesToInstall.map(p => p.resource)
  const packageNames = getPackageNames(pkgs)

  const commands = generateClientCommands({
    packageNames,
    depType,
    packageManager: PACKAGE_MANAGER,
  })

  const release = await lock(`package.json`)
  try {
    await execa(PACKAGE_MANAGER, commands, {
      cwd: root,
    })
  } catch (e) {
    // A package failed so call the rejects
    return packagesToInstall.forEach(p => {
      // @ts-ignore - fix me
      p.outsideReject(
        JSON.stringify({
          message: e.shortMessage,
          installationError: `Could not install package`,
        })
      )
    })
  }
  release()

  // @ts-ignore - fix me
  packagesToInstall.forEach(p => p.outsideResolve())

  // Run again if there's still more installs.
  if (installs.length > 0) {
    executeInstalls(root)
  }

  return undefined
}

const debouncedExecute = _.debounce(executeInstalls, 25)

interface IPackageCreateInput {
  root: string
  name: string
}

const createInstall = async ({
  root,
  name,
}: IPackageCreateInput): Promise<unknown> => {
  let outsideResolve
  let outsideReject
  const promise = new Promise((resolve, reject) => {
    outsideResolve = resolve
    outsideReject = reject
  })
  installs.push({
    outsideResolve,
    outsideReject,
    resource: name,
  })

  debouncedExecute(root)
  return promise
}

export const NPMPackageCreate = async ({
  root,
  name,
}: IPackageCreateInput): Promise<void> => {
  await createInstall({ root, name })
}
