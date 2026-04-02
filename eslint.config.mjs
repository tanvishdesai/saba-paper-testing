import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [...nextVitals, ...nextTypescript];

const flatConfig = [
  ...eslintConfig,
  {
    ignores: ["convex/_generated/**", "convex/tsconfig.tsbuildinfo"],
  },
];

export default flatConfig;
