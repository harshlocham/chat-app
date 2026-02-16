import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    plugins: {
      import: require("eslint-plugin-import"),
    },

    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/components",
              from: "./src/models",
              message: "Client cannot import server models.",
            },
            {
              target: "./src/components",
              from: "./src/server",
              message: "Client cannot import server code.",
            },
            {
              target: "./src/server",
              from: "./src/components",
              message: "Server should not depend on UI.",
            },
          ]
        },
      ],
    },
  },
];

export default eslintConfig;