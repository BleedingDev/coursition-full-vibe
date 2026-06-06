# Coursition UX Dogfood Report

Target: http://localhost:8080
Date: 2026-06-04
Scope: Full course creator flow, dashboard, localized URLs, manual/full AI modes, source processing, validation gates, preview.

## Summary

Confirmed findings: 1 high severity issue, fixed in this pass.

Retracted automation artifacts: 2.

## Findings

### RETRACTED - URL source submission works with a real click

The first ref-based automation click did not submit the source form. A coordinate-level click on the actual `Add source` button added `https://junior.guru/handbook/` as a URL source and showed `URL - Ready - 6097 characters`, so this is not counted as an app finding.

### RETRACTED - Workflow links do navigate

The first role-based automation click did not activate the intended link. A coordinate-level click on the actual `Next` anchor navigated from `/sources` to `/questions` and fetched the route loader correctly, so this is not counted as an app finding.

### ISSUE-001 - High - Open review finding does not block advancing to the next step

Evidence: `screenshots/topic-accepted.png`

Repro steps:

1. Generate topics from weak/non-source-backed material.
2. Accept a topic that triggers `Topic needs source support`.
3. Observe the Topics page.

Expected: The user cannot go to Target while the current step has an open validation finding, or the UI clearly requires resolving/dismissing the finding before continuing.

Actual: The Review panel shows an open warning, but the sidebar exposes `5 Target` and the header exposes `Next`. This contradicts the validation-first workflow and lets the user build on unresolved course quality problems.

Fix status: Fixed. Forward step gates now block on any open prior-step finding, and resolving a generated finding persists even when the finding is rebuilt on route load.
