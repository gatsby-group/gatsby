/* eslint-disable no-invalid-this */

import { store, emitter } from "../redux"
import { IAddPendingTemplateDataWriteAction } from "../redux/types"
import { clearDirtyQueriesListToEmitViaWebsocket } from "../redux/actions/internal"
import { Server as HTTPSServer } from "https"
import { Server as HTTPServer } from "http"
import { IPageDataWithQueryResult } from "../utils/page-data"
import telemetry from "gatsby-telemetry"
import url from "url"
import { createHash } from "crypto"
import { findPageByPath } from "./find-page-by-path"
import { Server as SocketIO, Socket } from "socket.io"
import { getPageMode } from "./page-mode"

export interface IPageOrSliceQueryResult {
  id: string
  result?: IPageDataWithQueryResult
}

export interface IStaticQueryResult {
  id: string
  result: unknown // TODO: Improve this once we understand what the type is
}

type QueryResultsMap = Map<string, IStaticQueryResult>

function hashPaths(paths: Array<string>): Array<string> {
  return paths.map(path => createHash(`sha256`).update(path).digest(`hex`))
}

interface IClientInfo {
  activePath: string | null
  socket: Socket
}

export class WebsocketManager {
  activePaths: Set<string> = new Set()
  clients: Set<IClientInfo> = new Set()
  errors: Map<string, string> = new Map()
  staticQueryResults: QueryResultsMap = new Map()
  websocket: SocketIO | undefined

  init = ({ server }: { server: HTTPSServer | HTTPServer }): SocketIO => {
    // make typescript happy, else it complained about this.websocket being undefined
    const websocket = new SocketIO(server, {
      // we see ping-pong timeouts on gatsby-cloud when socket.io is running for a while
      // increasing it should help
      // @see https://github.com/socketio/socket.io/issues/3259#issuecomment-448058937
      pingTimeout: 30000,
      // whitelist all (https://github.com/expressjs/cors#configuration-options)
      cors: {
        origin: true,
      },
      cookie: true,
    })
    this.websocket = websocket

    const updateServerActivePaths = (): void => {
      const serverActivePaths = new Set<string>()
      for (const client of this.clients) {
        if (client.activePath) {
          serverActivePaths.add(client.activePath)
        }
      }
      this.activePaths = serverActivePaths
    }

    websocket.on(`connection`, socket => {
      const clientInfo: IClientInfo = {
        activePath: null,
        socket,
      }
      this.clients.add(clientInfo)

      const setActivePath = (
        newActivePath: string | null,
        fallbackTo404: boolean = false
      ): void => {
        let activePagePath: string | null = null
        if (newActivePath) {
          const page = findPageByPath(
            store.getState(),
            newActivePath,
            fallbackTo404
          )

          if (page) {
            // when it's SSR we don't want to return the page path but the actualy url used,
            // this is necessary when matchPaths are used.
            if (getPageMode(page) === `SSR`) {
              activePagePath = newActivePath
            } else {
              activePagePath = page.path
            }
          }
        }
        clientInfo.activePath = activePagePath
        updateServerActivePaths()
      }

      if (socket?.handshake?.headers?.referer) {
        const path = url.parse(socket.handshake.headers.referer).path
        setActivePath(path, true)
      }

      this.errors.forEach((message, errorID) => {
        socket.send({
          type: `overlayError`,
          payload: {
            id: errorID,
            message,
          },
        })
      })

      socket.on(`registerPath`, (path: string): void => {
        setActivePath(path, true)
      })

      socket.on(`disconnect`, (): void => {
        setActivePath(null)
        this.clients.delete(clientInfo)
      })

      socket.on(`unregisterPath`, (_path: string): void => {
        setActivePath(null)
      })
    })

    if (process.env.GATSBY_QUERY_ON_DEMAND) {
      // page-data marked stale due to dirty query tracking
      const boundEmitStalePageDataPathsFromDirtyQueryTracking =
        this.emitStalePageDataPathsFromDirtyQueryTracking.bind(this)
      emitter.on(
        `CREATE_PAGE`,
        boundEmitStalePageDataPathsFromDirtyQueryTracking
      )
      emitter.on(
        `CREATE_NODE`,
        boundEmitStalePageDataPathsFromDirtyQueryTracking
      )
      emitter.on(
        `DELETE_NODE`,
        boundEmitStalePageDataPathsFromDirtyQueryTracking
      )
      emitter.on(
        `QUERY_EXTRACTED`,
        boundEmitStalePageDataPathsFromDirtyQueryTracking
      )
    }

    // page-data marked stale due to static query hashes change
    emitter.on(
      `ADD_PENDING_TEMPLATE_DATA_WRITE`,
      this.emitStalePageDataPathsFromStaticQueriesAssignment.bind(this)
    )

    return websocket
  }

  getSocket = (): SocketIO | undefined => this.websocket

  emitStaticQueryData = (data: IStaticQueryResult): void => {
    this.staticQueryResults.set(data.id, data)

    if (this.websocket) {
      this.websocket.send({ type: `staticQueryResult`, payload: data })

      if (this.clients.size > 0) {
        telemetry.trackCli(
          `WEBSOCKET_EMIT_STATIC_PAGE_DATA_UPDATE`,
          {
            siteMeasurements: {
              clientsCount: this.clients.size,
              paths: hashPaths(Array.from(this.activePaths)),
            },
          },
          { debounce: true }
        )
      }
    }
  }

  emitPageData = (data: IPageOrSliceQueryResult): void => {
    if (this.websocket) {
      this.websocket.send({ type: `pageQueryResult`, payload: data })

      if (this.clients.size > 0) {
        telemetry.trackCli(
          `WEBSOCKET_EMIT_PAGE_DATA_UPDATE`,
          {
            siteMeasurements: {
              clientsCount: this.clients.size,
              paths: hashPaths(Array.from(this.activePaths)),
            },
          },
          { debounce: true }
        )
      }
    }
  }

  emitSliceData = (data: IPageOrSliceQueryResult): void => {
    if (this.websocket) {
      this.websocket.send({ type: `sliceQueryResult`, payload: data })
    }
  }

  emitError = (id: string, message?: string): void => {
    if (message) {
      this.errors.set(id, message)
    } else {
      this.errors.delete(id)
    }

    if (this.websocket) {
      this.websocket.send({
        type: `overlayError`,
        payload: { id, message },
      })
    }
  }

  emitStalePageDataPathsFromDirtyQueryTracking(): void {
    const dirtyQueries =
      store.getState().queries.dirtyQueriesListToEmitViaWebsocket

    if (this.emitStalePageDataPaths(dirtyQueries)) {
      store.dispatch(clearDirtyQueriesListToEmitViaWebsocket())
    }
  }

  emitStalePageDataPathsFromStaticQueriesAssignment(
    pendingTemplateDataWrite: IAddPendingTemplateDataWriteAction
  ): void {
    this.emitStalePageDataPaths(
      Array.from(pendingTemplateDataWrite.payload.pages)
    )
  }

  emitStalePageDataPaths(stalePageDataPaths: Array<string>): boolean {
    if (stalePageDataPaths.length > 0) {
      if (this.websocket) {
        this.websocket.send({
          type: `stalePageData`,
          payload: { stalePageDataPaths },
        })

        return true
      }
    }
    return false
  }

  emitStaleServerData(): boolean {
    if (this.websocket) {
      this.websocket.send({ type: `staleServerData` })
      return true
    }
    return false
  }

  emitDataFilesWillRegenerate(didChange: boolean): void {
    if (this.websocket) {
      this.websocket.send({
        type: `dataFilesWillRegenerate`,
        payload: didChange,
      })
    }
  }

  emitDataFilesDidRegenerate(): void {
    if (this.websocket) {
      this.websocket.send({
        type: `dataFilesDidRegenerate`,
      })
    }
  }
}

export const websocketManager: WebsocketManager = new WebsocketManager()
