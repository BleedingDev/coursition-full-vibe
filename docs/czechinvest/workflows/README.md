# CzechInvest workflows

Handoffs in this directory are durable inputs for independent Claude Code sessions. They replace earlier `/tmp` copies.

## Launch rule

Start a fresh Claude Code conversation in the repository root and provide exactly one handoff. Follow its orchestration mode: older SEO/methodology handoffs require one `ultracode` Workflow; new handoffs below require one solo agent without spawned subagents.

- SEO — one Workflow: `docs/czechinvest/workflows/seo-research/HANDOFF.md`
- Methodologies — one Workflow: `docs/czechinvest/workflows/methodologies/HANDOFF.md`
- Branding + Marketing + Copywriting — solo agent: `docs/czechinvest/workflows/branding-marketing-copywriting/HANDOFF.md`
- Evidence of completed A1/A3/A7 activities — solo agent: `docs/czechinvest/workflows/completed-activity-evidence/HANDOFF.md`

Before launching, inspect [the current status](../CURRENT-STATUS.md), target output directory, running Claude processes, and persisted workflow metadata. If the same handoff is already running, wait and verify it; do not launch a duplicate.

After completion, update both [CURRENT-STATUS.md](../CURRENT-STATUS.md) and [WORKING-CHECKLIST.md](../WORKING-CHECKLIST.md) with exact output paths, validation results, and unresolved limitations.
