// @ts-check
const path = require('path')
const { rspack } = require('@rspack/core')

/** @type {import('@rspack/core').Configuration} */
const baseConfig = {
  target: 'node18',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript' },
              target: 'es2020',
            },
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  // better-sqlite3 has native bindings (.node file) — cannot be bundled
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
  },
  optimization: {
    minimize: false, // Keep readable; easier to debug in production
  },
}

module.exports = [
  // --- Library bundle ---
  // Consumers can `require('healthclaw-webhook-server')` and get createApp
  {
    ...baseConfig,
    entry: './src/index.ts',
    output: {
      filename: 'index.js',
      path: path.resolve(__dirname, 'dist'),
      library: { type: 'commonjs2' },
    },
  },

  // --- CLI bundle ---
  // Installed as `healthclaw-webhook` bin; shebang added via BannerPlugin
  {
    ...baseConfig,
    entry: './src/bin.ts',
    output: {
      filename: 'bin.js',
      path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
      new rspack.BannerPlugin({
        banner: '#!/usr/bin/env node',
        raw: true,
      }),
    ],
  },
]
