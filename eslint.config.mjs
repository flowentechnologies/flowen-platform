import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// Next.js 16 removed `next lint` and the old FlatCompat shim in favor of
// direct flat-config imports — see node_modules/next/dist/docs/.../03-eslint.md.
// package.json previously pinned eslint-config-next at ^0.2.4 (an ancient,
// unrelated version — real releases track the Next.js major, currently 16.x),
// which meant `compat.extends("next/core-web-vitals")` was resolving against
// a package with no such preset at all: `npm run lint` never actually ran.
const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
