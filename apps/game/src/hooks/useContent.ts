import { createResource } from 'solid-js'
import type { SimpleQuestContent } from 'simplequest-hud'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function fetchContent(): Promise<SimpleQuestContent> {
  const res = await fetch(`${API}/content`)
  if (!res.ok) throw new Error(`Failed to fetch content: ${res.status}`)
  return res.json()
}

export function useContent() {
  const [content] = createResource(fetchContent)
  return content
}
