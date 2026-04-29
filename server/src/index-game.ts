/// <reference types="bun-types" />
import { createGameServer } from './game-server'

const PORT = parseInt(process.env.PORT ?? '2567', 10)

const gameServer = createGameServer()
gameServer.listen(PORT, undefined, undefined, () => {
  console.log(`Game server listening on port ${PORT}`)
})
