# Coursition Full Modes Dogfood Report

Target: http://localhost:8080/en
Date: 2026-06-04
Session: coursition-full-modes

## Summary

Status: In progress

Severity counts:

- Critical: 0
- High: 3
- Medium: 1
- Low: 0

## Coverage

- Initial anonymous/auth flow: started
- Generate course for me mode: pending
- Help me build it mode: pending
- Manual mode: pending
- Localized routes and browser history: pending
- Expect CLI merciless review: pending

## Issues

### ISSUE-001 - High - Full generation mode skips Sources when moving forward from Mode

Evidence: `screenshots/issue-001-generated-skips-sources.png`

Repro:

1. Sign in and create a new course draft.
2. On Mode, choose "Generate course for me".
3. Click Next.

Expected:
The user lands on Sources because generated mode depends on source material and the next visible workflow step is "Sources".

Actual:
The URL changes to `/questions`, the page title is "Questions", and the Sources step is skipped. This makes the workflow illogical: a fully generated course can proceed before the user has provided the materials it is supposed to generate from.

### ISSUE-002 - High - URL source submission has no visible effect or error

Evidence:

- `screenshots/generated-source-filled.png`
- `screenshots/generated-source-added.png`

Repro:

1. Navigate to Sources in a generated draft.
2. Select URL source type.
3. Enter source name `Junior Guru Handbook`.
4. Enter `https://junior.guru/handbook/`.
5. Click Add source.

Expected:
The source is added to the source list, the form clears, and the app shows processing/completed source state.

Actual:
The form remains filled, no source appears, no toast/error appears, and the workflow gives no feedback. A user cannot tell whether anything happened.

### ISSUE-003 - High - Generate topics button has no visible effect and does not call the workflow

Evidence: `screenshots/generated-topics-after-click.png`

Repro:

1. In generated mode, reach Questions.
2. Leave the prefilled teaching questions as-is.
3. Click Generate topics.
4. Wait at least 5 seconds.

Expected:
The app starts an AI generation run, shows busy/progress feedback, and either displays generated topics or a temporary toast with a clear failure.

Actual:
Nothing changes in the UI. The button remains available, no toast appears, no topics are generated, and the dev server logs show no workflow POST for the click.

### ISSUE-004 - Medium - Root management page does not show course list or a way to create another course

Evidence: `screenshots/issue-004-root-no-management.png`

Repro:

1. Create a draft and work into the wizard.
2. Click the Coursition brand/root link.

Expected:
The root management page shows all courses and provides a clear way to create a new course, as a user would expect from a course-management entry point.

Actual:
`/en` renders the current draft at its current internal step. There is no visible list of courses, no new-course action, and no sign-out or account controls. The only way to test another mode as a user is to use a fresh account/session.
