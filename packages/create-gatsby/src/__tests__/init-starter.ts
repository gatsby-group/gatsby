/* eslint-disable @typescript-eslint/no-explicit-any */
import { execSync } from "child_process"
import execa from "execa"
import fs from "fs-extra"
import path from "path"
import { initStarter } from "../init-starter"
import { reporter } from "../utils/reporter"

jest.mock(`tiny-spin`, () => {
  return {
    spin: (): (() => void) => jest.fn(),
  }
})
jest.mock(`../utils/clear-line`)
jest.mock(`../utils/make-npm-safe`)
jest.mock(`execa`)
jest.mock(`child_process`)
jest.mock(`fs-extra`)
jest.mock(`path`)
jest.mock(`../utils/reporter`)
jest.mock(`../utils/get-config-store`, () => {
  return {
    getConfigStore: (): unknown => {
      return {
        items: {},
        set(key: string, value: unknown): void {
          ;(this as any).items[key] = value
        },
        get(key: string): unknown {
          return (this as any).items[key]
        },

        __reset(): void {
          ;(this as any).items = {}
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
        await initStarter(
          `gatsby-starter-hello-world`,
          `./somewhere`,
          [],
          `A site`
        )
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
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(
        `gatsby-starter-hello-world`,
        `./somewhere`,
        [],
        `A site`
      )

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
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(
        `gatsby-starter-hello-world`,
        `./somewhere`,
        [],
        `A site`
      )

      expect(fs.remove).toBeCalledWith(`package-lock.json`)
      expect(reporter.success).toBeCalledWith(`Installed plugins`)
      expect(reporter.panic).not.toBeCalled()
      expect(execa).toBeCalledWith(`yarnpkg`, [`--silent`], {
        stderr: `inherit`,
      })
    })

    it(`process package installation with bun`, async () => {
      process.env.npm_config_user_agent = `bun`
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(
        `gatsby-starter-hello-world`,
        `./somewhere`,
        [],
        `A site`
      )

      expect(fs.remove).toBeCalledWith(`package-lock.json`)
      expect(reporter.success).toBeCalledWith(`Installed plugins`)
      expect(reporter.panic).not.toBeCalled()
      expect(execa).toBeCalledWith(`bun`, [`install`, `--silent`], {
        stderr: `inherit`,
      })
    })

    it(`process package installation with NPM`, async () => {
      process.env.npm_config_user_agent = `npm`
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(
        `gatsby-starter-hello-world`,
        `./somewhere`,
        [`one-package`],
        `A site`
      )

      expect(fs.remove).toBeCalledWith(`yarn.lock`)
      expect(fs.remove).toBeCalledWith(`bun.lockb`)
      expect(reporter.success).toBeCalledWith(`Installed Gatsby`)
      expect(reporter.success).toBeCalledWith(`Installed plugins`)
      expect(reporter.panic).not.toBeCalled()
      expect(execa).toBeCalledWith(
        `npm`,
        [
          `install`,
          `--loglevel`,
          `error`,
          `--color`,
          `always`,
          `--legacy-peer-deps`,
          `--no-audit`,
        ],
        { stderr: `inherit` }
      )
      expect(execa).toBeCalledWith(
        `npm`,
        [
          `install`,
          `--loglevel`,
          `error`,
          `--color`,
          `always`,
          `--legacy-peer-deps`,
          `--no-audit`,
          `one-package`,
        ],
        { stderr: `inherit` }
      )
    })

    it(`gently informs the user that yarn is not available when trying to use it`, async () => {
      process.env.npm_config_user_agent = `yarn`
      ;(execSync as any).mockImplementation(() => {
        throw new Error(`Something wrong occurred when trying to use yarn`)
      })
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(
        `gatsby-starter-hello-world`,
        `./somewhere`,
        [`one-package`],
        `A site`
      )

      expect(reporter.info).toBeCalledWith(
        `Woops! You have chosen "yarn" as your package manager, but it doesn't seem be installed on your machine. You can install it from https://yarnpkg.com/getting-started/install or change your preferred package manager with the command "gatsby options set pm npm". As a fallback, we will run the next steps with npm.`
      )
    })

    it(`gently informs the user that bun is not available when trying to use it`, async () => {
      process.env.npm_config_user_agent = `bun`
      ;(execSync as any).mockImplementation(() => {
        throw new Error(`Something wrong occurred when trying to use bun`)
      })
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(
        `gatsby-starter-hello-world`,
        `./somewhere`,
        [`one-package`],
        `A site`
      )

      expect(reporter.info).toBeCalledWith(
        `Woops! You have chosen "bun" as your package manager, but it doesn't seem be installed on your machine. You can install it from https://bun.sh or change your preferred package manager with the command "gatsby options set pm npm". As a fallback, we will run the next steps with npm.`
      )
    })
  })
})
