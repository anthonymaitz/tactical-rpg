/// <reference types="bun-types" />
import { createHttpApp } from './http-app'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const app = createHttpApp()

Bun.serve({ port: PORT, fetch: app.fetch.bind(app) })
console.log(`API server listening on port ${PORT}`)
