import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, not from the domain root,
// so the build needs that prefix baked in. GitHub Actions sets
// GITHUB_REPOSITORY ("owner/repo"); locally it is unset and the app is served
// from the root, so the same config covers both without a second build script.
// A user/organisation site (owner.github.io) is served from the root, so it
// keeps the root base too.
function basePath(): string {
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) return '/'

  const [owner, name] = repository.split('/')
  if (name.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/'

  return `/${name}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: basePath(),
  plugins: [react()],
  build: {
    // three.js alone is over the default 500kB bar. It is already split into
    // its own long-lived chunk below, so the warning would only ever be noise.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // three.js is most of the bundle and changes only when we upgrade it,
        // so it goes in its own chunk that browsers can keep cached across
        // app deploys.
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
})
