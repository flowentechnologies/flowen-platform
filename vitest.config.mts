import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Unit tests for pure, isolated business logic (src/lib/**) — no React
// rendering, no network, no Supabase. tsconfigPaths lets test files use the
// same `@/lib/...` aliases as the rest of the app instead of long relative
// paths, reading the mapping straight from tsconfig.json.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
