import { crx, defineManifest } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Clave',
  version: '1.0.0',
  permissions: [
    'storage',
    'tabs',
    'clipboardWrite',
  ],
  host_permissions: [
    'http://localhost:*/*',
    'https://*.supabase.co/*',
  ],
  action: {
    default_popup: 'extension/popup/index.html',
    default_title: 'Clave',
  },
  background: {
    service_worker: 'extension/src/background.ts',
    type: 'module',
  },
  icons: {
    16: 'extension/icons/icon-16.png',
    48: 'extension/icons/icon-48.png',
    128: 'extension/icons/icon-128.png',
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '..'), 'EXPO_PUBLIC_')

  return {
    plugins: [crx({ manifest })],
    resolve: {
      alias: {
        '@': resolve(__dirname, '..'),
      },
    },
    define: {
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(env.EXPO_PUBLIC_SUPABASE_URL),
      'process.env.EXPO_PUBLIC_SUPABASE_KEY': JSON.stringify(env.EXPO_PUBLIC_SUPABASE_KEY),
    },
    build: {
      sourcemap: true,
    },
  }
})
