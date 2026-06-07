import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const projectRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    // Auto-discover every *.test.ts / *.test.mjs in the repo. No need to list
    // individual files in package.json — adding a new test file is enough.
    include: ["**/*.test.{ts,mts,cts,js,mjs,cjs,tsx,jsx}"],
    exclude: ["**/node_modules/**", "**/.worktrees/**", "**/dist/**", "**/.next/**"],
    environment: "node",
  },
})
