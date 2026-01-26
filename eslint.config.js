// eslint.config.js

/*
The MIT License (MIT)

Copyright (c) 2025 Michael Welter <me@mikinho.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
// import eslintConfigPrettier from "eslint-config-prettier";
import pluginPrettier from "eslint-plugin-prettier";

export default defineConfig([
    {
        ignores: ["**/node_modules/**", "**/*.min.js", "**/package-lock.json", "**/docs/**"],
        linterOptions: { reportUnusedDisableDirectives: true },
    },
    {
        files: ["**/*.{js,mjs,cjs}"],
        ignores: ["**/node_modules/**", "**/*.min.js", "**/package-lock.json", "**/docs/**"],
        plugins: { js, prettier: pluginPrettier },
        extends: ["js/recommended"],
        languageOptions: {
            globals: { ...globals.node, ...globals.es2024 },
        },
        rules: {
            "no-var": "error",
            "prefer-const": ["error", { destructuring: "all" }],
            "no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true }],
            "no-implicit-coercion": ["warn", { allow: ["!!"] }],
            indent: ["error", 4, { SwitchCase: 1 }],
            semi: ["error", "always"],
            curly: ["error", "all"],
            "brace-style": ["error", "1tbs", { allowSingleLine: false }],
            quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
        },
    },
    {
        files: ["**/*.json"],
        ignores: ["**/node_modules/**", "**/*.min.js", "**/package-lock.json", "**/docs/**"],
        plugins: { json },
        language: "json/json",
        extends: ["json/recommended"],
    },
    {
        files: ["**/*.md"],
        ignores: ["**/node_modules/**", "**/docs/**"],
        plugins: { markdown },
        language: "markdown/gfm",
        extends: ["markdown/recommended"],
    },
    // Optionally put this LAST to disable any rules that would fight Prettier
    // eslintConfigPrettier,
]);
