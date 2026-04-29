import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || ''
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const isUserOrOrgPages = repository.endsWith('.github.io')
const base = isGitHubActions
  ? isUserOrOrgPages
    ? '/'
    : `/${repository}/`
  : '/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base,
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
})
