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

import { builtinModules } from "node:module";

import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginPrettier from "eslint-plugin-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

export default defineConfig([
    {
        ignores: [
            "CHANGELOG.md",
            "**/node_modules/**",
            "**/*.min.js",
            "**/package-lock.json",
            "**/docs/**",
        ],
        linterOptions: { reportUnusedDisableDirectives: true },
    },
    {
        files: ["**/js/*.js"],
        ignores: [
            "CHANGELOG.md",
            "**/node_modules/**",
            "**/*.min.js",
            "**/package-lock.json",
            "**/docs/**",
        ],
        plugins: { js, prettier: pluginPrettier, "simple-import-sort": simpleImportSort },
        extends: ["js/recommended"],
        languageOptions: {
            globals: { ...globals.browser, ...globals.es2024 },
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
            "simple-import-sort/imports": [
                "error",
                {
                    groups: [
                        ["^\\u0000"],
                        [`^node:`, `^(${builtinModules.join("|")})(/|$)`],
                        ["^@?\\w"],
                        ["^.*core(/|$)"],
                        ["^\\."],
                    ],
                },
            ],
            "simple-import-sort/exports": "error",
        },
    },
    {
        files: ["**/*.{js,mjs,cjs}"],
        ignores: [
            "CHANGELOG.md",
            "**/js/*.js",
            "**/node_modules/**",
            "**/*.min.js",
            "**/package-lock.json",
            "**/docs/**",
        ],
        plugins: { js, prettier: pluginPrettier, "simple-import-sort": simpleImportSort },
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
            "simple-import-sort/imports": [
                "error",
                {
                    groups: [
                        ["^\\u0000"],
                        [`^node:`, `^(${builtinModules.join("|")})(/|$)`],
                        ["^@?\\w"],
                        ["^.*core(/|$)"],
                        ["^\\."],
                    ],
                },
            ],
            "simple-import-sort/exports": "error",
        },
    },
    {
        files: ["**/*.json"],
        ignores: [
            "CHANGELOG.md",
            "**/node_modules/**",
            "**/*.min.js",
            "**/package-lock.json",
            "**/docs/**",
        ],
        plugins: { json },
        language: "json/json",
        extends: ["json/recommended"],
    },
    {
        files: ["**/*.md"],
        ignores: ["CHANGELOG.md", "**/node_modules/**", "**/docs/**"],
        plugins: { markdown },
        language: "markdown/gfm",
        extends: ["markdown/recommended"],
    },
    // Put this LAST to disable rules that conflict with Prettier formatting
    eslintConfigPrettier,
    {
        // eslint-config-prettier turns off `curly`, but we want to strictly enforce it
        files: ["**/*.{js,mjs,cjs}"],
        ignores: [
            "CHANGELOG.md",
            "**/node_modules/**",
            "**/*.min.js",
            "**/package-lock.json",
            "**/docs/**",
        ],
        rules: {
            curly: ["error", "all"],
            "brace-style": ["error", "1tbs", { allowSingleLine: false }],
            quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
        },
    },
]);
