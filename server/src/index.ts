/// <reference types="bun-types" />
import { createHttpApp } from './http-app'
import { createGameServer } from './game-server'

const httpPort = parseInt(process.env.HTTP_PORT ?? '3000', 10)
const gamePort = parseInt(process.env.PORT ?? '2567', 10)

const httpApp = createHttpApp()
Bun.serve({
  port: httpPort,
  fetch: httpApp.fetch,
})
console.log(`HTTP server listening on port ${httpPort}`)

const gameServer = createGameServer()
gameServer.listen(gamePort, undefined, undefined, () => {
  console.log(`Game server listening on port ${gamePort}`)
})
