import { crx, defineManifest } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import { defineConfig } from 'vite'

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Password Manager',
  version: '1.0.0',
  permissions: [
    'storage',
    'tabs',
    'clipboardWrite',
    'identity',
  ],
  host_permissions: [
    'https://*.supabase.co/*',
  ],
  action: {
    default_popup: 'extension/popup/index.html',
    default_title: 'Password Manager',
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

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, '..'),
    },
  },
})

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, '..'),
    },
  },
  build: {
    sourcemap: true,
  },
})
