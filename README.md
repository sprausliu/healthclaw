# HealthClaw

**Automatic Apple Health data sync to OpenClaw**

HealthClaw streams your iPhone and Apple Watch health data — heart rate, HRV, sleep, steps, workouts — to your [OpenClaw](https://github.com/openclaw/openclaw) agent. Once connected, your agent can answer health questions, calculate recovery scores, and alert you to anomalies automatically.

---

## 👉 Get Started

**Agents and users: start here →** [skill/SKILL.md](skill/SKILL.md)

The skill covers everything you need:
- How the pairing flow works
- Running the webhook server (`npx healthclaw-webhook-server`)
- Generating a pairing link and connecting the iOS app
- Data sync and deduplication
- Ready-to-use cron job examples

---

## Repository Structure

```
healthclaw/
├── skill/                  ← Start here (OpenClaw integration guide)
│   ├── SKILL.md            ← Main setup guide
│   └── examples/
│       ├── recovery-score.md   ← Daily recovery score cron
│       └── health-alerts.md    ← Anomaly detection cron
│
└── webhook-server/         ← Backend server (Node.js)
    ├── src/                ← TypeScript source
    └── docs/API_SPEC.md    ← Full API reference
```

---

## iOS App

The HealthClaw iOS companion app handles background HealthKit syncing.

**TestFlight (beta):** <https://testflight.apple.com/join/SXDjT6vC>
_(App Store submission pending review)_

---

## License

MIT — see [LICENSE](LICENSE) for details.
