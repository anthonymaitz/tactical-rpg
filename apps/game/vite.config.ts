import { defineConfig, type Plugin } from 'vite'
import solid from 'vite-plugin-solid'

function requireEnv(vars: string[]): Plugin {
  return {
    name: 'require-env',
    config(_, { mode }) {
      if (mode !== 'production') return
      const missing = vars.filter((v) => !process.env[v])
      if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`)
    },
  }
}

export default defineConfig({
  plugins: [requireEnv(['VITE_API_URL', 'VITE_SERVER_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']), solid()],
  server: { host: true, allowedHosts: true },
  optimizeDeps: {
    include: ['@babylonjs/core'],
    exclude: ['simple-quest', 'playsets-board'],
  },
})
