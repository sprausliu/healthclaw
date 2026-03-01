#!/usr/bin/env node
import createApp from './index'

createApp()
  .then((app) => {
    app.start()
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Failed to start HealthClaw webhook server:', message)
    process.exit(1)
  })
