import { Client, type Room } from 'colyseus.js'

const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL
let client: Client | null = null

function getClient(): Client {
  if (!client) client = new Client(DEFAULT_SERVER_URL)
  return client
}

export async function joinRoom<T>(roomName: string, options?: object): Promise<Room<T>> {
  return getClient().joinOrCreate<T>(roomName, options)
}
