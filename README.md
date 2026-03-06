# @ynode/bootify

Copyright (c) 2026 Michael Welter <me@mikinho.com>

[![npm version](https://img.shields.io/npm/v/@ynode/bootify.svg)](https://www.npmjs.com/package/@ynode/bootify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Fastify bootstrap plugin that incorporates standardized @ynode patterns for clustering,
configuration, and lifecycle management.

## Purpose

`@ynode/bootify` eliminates the boilerplate code typically found in the entry points of `@ynode`
applications. It consolidates:

- **Cluster Management**: Automatically handles master/worker process forks using `@ynode/cluster`.
- **Signal Handling**: Manages graceful shutdowns (`SIGINT`, `SIGTERM`, `SIGUSR2`), zero-downtime
  reloads (`SIGHUP`), and keeps `SIGQUIT` mapped to `process.abort()` for core dumps.
- **Fastify Initialization**: Creates the server instance with standard configurations (like
  `proxiable` and `autoshutdown`).

## Installation

```sh
npm install @ynode/bootify
```

## Usage

In your main entry file (e.g., `src/web.js`), simply import `bootify` and your configuration.

```javascript
#!/usr/bin/env node

import { bootify } from "@ynode/bootify";
import config from "./config.js"; // Your yargs configuration
import pkg from "../package.json" with { type: "json" };

bootify({
    config,
    pkg,
    // Lazy-load your application logic
    app: () => import("./app.js"),
    hooks: {
        onBeforeListen: async ({ fastify }) => {
            fastify.log.info("Preparing to listen...");
        },
        onAfterListen: async ({ address }) => {
            console.log(`Listening at ${address}`);
        },
        onShutdown: async ({ signal }) => {
            console.log(`Shutdown triggered by ${signal}`);
        },
    },
});
```

### Configuration Object (`config`)

The `config` object is typically the resolved output of `yargs`. It supports the following reserved
properties:

- `cluster`: Configuration for `@ynode/cluster` (can be a boolean or object).
- `pidfile`: Path to write the PID file (optional).
- `http2`: Enable HTTP/2 support (boolean).
- `rewrite`: An object map for URL rewriting.
- `sleep`: Options for `@ynode/autoshutdown`.
- `listen`: The binding address can be a number (`3000`), a string (e.g., `"3000"`,
  `"127.0.0.1:8080"`, `"[::1]:8080"`), or a Unix socket path string. You can also pass an object
  like `{ port: 3000, host: "0.0.0.0" }` or `{ path: "/tmp/app.sock" }`.
- `listenRetry`: Optional startup retry policy `{ retries?: number, delay?: number }`. Defaults to
  `{ retries: 5, delay: 15000 }`.

### Unix Domain Sockets & `proxiable`

If you bind to a Unix Domain Socket (by ignoring host/port in your config or passing a path),
`bootify` automatically uses [`proxiable`](https://www.npmjs.com/package/proxiable) on the raw
server instance. This fixes common issues where `req.socket.remoteAddress` is undefined or incorrect
when running behind a proxy like Nginx over a socket.

## API

### `bootify(options)`

Initializes the application lifecycle. `bootify` validates option shapes early and throws
`TypeError` for invalid input.

#### Options

| Property    | Type       | Description                                                                                                                                     |
| :---------- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`       | `Function` | A function called as `app(fastify, config)` that returns either a Fastify plugin or module with `default`; invalid returns throw a `TypeError`. |
| `config`    | `Object`   | The configuration object (usually from `argv`).                                                                                                 |
| `pkg`       | `Object`   | Optional parsed content of `package.json` (auto-loaded from `process.cwd()` when omitted).                                                      |
| `validator` | `Function` | Optional function to validate `config` before starting.                                                                                         |
| `hooks`     | `Object`   | Optional lifecycle hooks: `onBeforeListen`, `onAfterListen`, and `onShutdown`.                                                                  |

## License

This project is licensed under the [MIT License](./LICENSE).
