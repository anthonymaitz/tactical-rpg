import { useRef } from 'react'
import { Client, type Room } from 'colyseus.js'

const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567'

export function useGameServer() {
  const clientRef = useRef<Client | null>(null)

  function getClient(): Client {
    if (!clientRef.current) {
      clientRef.current = new Client(DEFAULT_SERVER_URL)
    }
    return clientRef.current
  }

  async function joinRoom<T>(roomName: string, options?: object): Promise<Room<T>> {
    return getClient().joinOrCreate<T>(roomName, options)
  }

  return { joinRoom }
}
