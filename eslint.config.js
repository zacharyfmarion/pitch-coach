import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "playwright-report", "test-results"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Use the shared Radix Dropdown component instead of native <select> elements."
        }
      ]
    }
  },
  {
    files: ["src/audio/audio-input-processor.js"],
    languageOptions: {
      globals: {
        AudioWorkletProcessor: "readonly",
        currentTime: "readonly",
        registerProcessor: "readonly"
      }
    }
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/Dropdown.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@radix-ui/react-select",
              message: "Use the shared Dropdown component from src/components/Dropdown."
            }
          ]
        }
      ]
    }
  }
);
