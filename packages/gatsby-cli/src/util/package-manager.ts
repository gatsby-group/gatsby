import { getConfigStore } from "gatsby-core-utils"
import report from "../reporter"

type PackageManager = "yarn" | "npm" | "bun"

const packageMangerConfigKey = `cli.packageManager`
export const getPackageManager = (): PackageManager =>
  getConfigStore().get(packageMangerConfigKey)
export const setPackageManager = (packageManager: PackageManager): void => {
  getConfigStore().set(packageMangerConfigKey, packageManager)
  report.info(`Preferred package manager set to "${packageManager}"`)
}
