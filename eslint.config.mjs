import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "source-data/**", "src/generated/**", "next-env.d.ts", "coverage/**"],
  },
];

export default config;
