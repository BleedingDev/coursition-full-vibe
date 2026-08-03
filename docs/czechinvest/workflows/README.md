# CzechInvest workflows

The handoffs in this directory are durable inputs for independent Claude Code Workflows. They replace the earlier `/tmp` copies.

## Launch rule

Start a fresh Claude Code conversation in the repository root, then provide exactly one handoff to a single `ultracode` workflow. The handoff itself contains the required model routing, evidence, scope, and definition of done.

- SEO: `docs/czechinvest/workflows/seo-research/HANDOFF.md`
- Methodologies: `docs/czechinvest/workflows/methodologies/HANDOFF.md`

Before launching, inspect [the current status](../CURRENT-STATUS.md), the target output directory, running Claude processes, and persisted workflow metadata. If the workflow is already running, wait for and verify that run; do not launch a duplicate.

After completion, update both [CURRENT-STATUS.md](../CURRENT-STATUS.md) and [WORKING-CHECKLIST.md](../WORKING-CHECKLIST.md) with exact output paths, validation results, unresolved limitations, and verified model/effort traces.
