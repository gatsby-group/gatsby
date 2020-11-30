import { execSync } from "child_process"
import execa from "execa"
import fs from "fs-extra"
import path from "path"
import { initStarter } from "../init-starter"
import { reporter } from "../reporter"

jest.mock(`execa`)
jest.mock(`child_process`)
jest.mock(`fs-extra`)
jest.mock(`path`)
jest.mock(`../reporter`)
jest.mock(`../get-config-store`, () => {
  return {
    getConfigStore: (): unknown => {
      return {
        items: {},
        set(key: string, value: unknown): void {
          this.items[key] = value
        },
        get(key: string): unknown {
          return this.items[key]
        },

        __reset(): void {
          this.items = {}
        },
      }
    },
  }
})

describe(`init-starter`, () => {
  beforeEach(() => {
    process.chdir = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe(`initStarter / cloning`, () => {
    it(`reports an error when it s not possible to clone the repo`, async () => {
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => {
        throw new Error(`Not possible to clone the repo`)
      })

      try {
        await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [])
      } catch (e) {
        expect(execa).toBeCalledWith(`git`, [
          `clone`,
          `gatsby-starter-hello-world`,
          `--recursive`,
          `--depth=1`,
          `--quiet`,
        ])
        expect(reporter.panic).toBeCalledWith(`Not possible to clone the repo`)
        expect(reporter.success).not.toBeCalledWith(
          `Created site from template`
        )
        expect(fs.remove).toBeCalledWith(`/somewhere-here`)
      }
    })

    it(`reports a success when everything is going ok`, async () => {
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())

      await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [])

      expect(execa).toBeCalledWith(`git`, [
        `clone`,
        `gatsby-starter-hello-world`,
        `--recursive`,
        `--depth=1`,
        `--quiet`,
      ])
      expect(reporter.panic).not.toBeCalled()
      expect(reporter.success).toBeCalledWith(`Created site from template`)
      expect(fs.remove).toBeCalledWith(`/somewhere-here`)
    })
  })

  describe(`initStarter / install`, () => {
    it(`process package installation with yarn`, async () => {
      process.env.npm_config_user_agent = `yarn`
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())

      await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [])

      expect(fs.remove).toBeCalledWith(`package-lock.json`)
      expect(reporter.success).toBeCalledWith(`Installed packages`)
      expect(reporter.panic).not.toBeCalled()
      expect(execa).toBeCalledWith(`yarnpkg`, [`--silent`])
    })

    it(`process package installation with NPM`, async () => {
      process.env.npm_config_user_agent = `npm`
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())

      await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [
        `one-package`,
      ])

      expect(fs.remove).toBeCalledWith(`yarn.lock`)
      expect(reporter.success).toBeCalledWith(`Installed packages`)
      expect(reporter.panic).not.toBeCalled()
      expect(execa).toBeCalledWith(`npm`, [`install`, `--silent`])
      expect(execa).toBeCalledWith(`npm`, [
        `install`,
        `--silent`,
        `one-package`,
      ])
    })

    it(`gently informs the user that yarn is not available when trying to use it`, async () => {
      process.env.npm_config_user_agent = `yarn`
      ;(execSync as any).mockImplementation(() => {
        throw new Error(`Something wrong occured when trying to use yarn`)
      })
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())

      await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [
        `one-package`,
      ])

      expect(reporter.info).toBeCalledWith(
        `Woops! Yarn doesn't seem be installed on your machine. You can install it on https://yarnpkg.com/getting-started/install. As a fallback, we will run the next steps with npm.`
      )
      expect(reporter.success).toBeCalledWith(`Installed packages`)
      expect(reporter.panic).not.toBeCalled()
      expect(execa).toBeCalledWith(`npm`, [`install`, `--silent`])
      expect(execa).toBeCalledWith(`npm`, [
        `install`,
        `--silent`,
        `one-package`,
      ])
    })
  })
})
