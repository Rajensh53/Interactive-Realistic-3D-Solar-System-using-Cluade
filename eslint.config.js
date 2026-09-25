import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh, react },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Core no-unused-vars cannot see JSX usage; this marks <Foo /> as a use.
      "react/jsx-uses-vars": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
    },
  },
  {
    files: ["scripts/**/*.mjs", "eslint.config.js", "vite.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
  },
];
