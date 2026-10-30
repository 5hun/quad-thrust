import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-irregular-whitespace": [
        "error",
        { skipStrings: true, skipTemplates: true },
      ],
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowTernary: true },
      ],
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowTernary: true },
      ],
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        HOVER_MUSIC: "readonly",
        HOVER_MODELS: "readonly",
        HOVER_BACKGROUNDS: "readonly",
        HoverEngine: "readonly",
        HOVER_TRAINING_TRACKS: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  prettier,
);
