# Coursition Browser-Only UX Dogfood

Target: http://localhost:8080/en  
Date: 2026-06-04  
Mode: browser-only via `agent-browser`; no source reads; no file edits outside this output directory.

## Tooling Note

`agent-browser screenshot` was not usable in this run. It repeatedly hung and produced no image files.

Last successful command before the first screenshot hang:

```bash
agent-browser --session coursition-ux-20260604 wait --load networkidle
```

Confirmed later successful browser command:

```bash
agent-browser --session coursition-ux-20260604 snapshot -i
```

Because screenshots could not be captured, the requested screenshot directory is present but empty:

`dogfood-output/20260604-expect-ux/subagent-browser/screenshots/`

Fallback evidence saved from user-observable browser snapshots/text:

- `dogfood-output/20260604-expect-ux/subagent-browser/final-snapshot.txt`
- `dogfood-output/20260604-expect-ux/subagent-browser/final-page-text.txt`

## Findings

### UX-001: Full AI generation path crashes when advancing to Topics

Severity: Critical

Repro:

1. Open `http://localhost:8080/en`.
2. Create account with name, email, and password.
3. Create draft titled `Junior Guru Handbook UX Test`.
4. Select `Generate course for me`.
5. On Sources, select `URL`, enter source name `junior.guru handbook`, enter `https://junior.guru/handbook/`, and click `Add source`.
6. Click `Next` to Questions.
7. Click `Generate topics`; observe no visible change.
8. Click `Next`.

Expected: The app should either generate topics, show a clear validation message, or keep the user on Questions with actionable recovery.

Actual: The app navigates to `/en/course-creation/<course-id>/topics` and shows only `Something went wrong!` with a `Hide Error` button. In Czech, the same happens at `/cs/tvorba-kurzu/<course-id>/temata`.

Evidence: observed in `agent-browser snapshot -i` and `get text body`; screenshot capture failed.

### UX-002: Generate Topics button is inert despite required fields being prefilled

Severity: High

Repro:

1. Complete UX-001 through the Questions step.
2. Observe fields are already filled: learning outcome, target audience, prior knowledge, depth, avoid, practice style.
3. Click `Generate topics`.
4. Click `Save questions`, then click `Generate topics` again.

Expected: The button should start generation, show processing/status, or show inline validation tied to a specific missing input.

Actual: Nothing visibly changes. No spinner, disabled state, toast, inline error, or navigation appears. The page still says generation needs outcome, audience, and practice even though those fields contain values.

Evidence: observed in `agent-browser snapshot -i` output during the Questions step.

### UX-003: Delete course is blocked by unrelated form validation and never deletes

Severity: High

Repro:

1. From `/cs`, locate an existing course.
2. Click `Smazat`.
3. Observe the toast/message.
4. Fill the new-course `Název kurzu*` field with `Temporary delete unblock`.
5. Click `Smazat` again.

Expected: Delete should ask for confirmation or delete the selected course, independent of the new-course form.

Actual: The app shows `Zkontrolujte formulář a zkuste to znovu.` and leaves the course intact. Filling the new-course field still does not unblock delete.

Evidence: observed in browser text after clicking Delete.

### UX-004: Czech localization is incomplete in Review and generated question values

Severity: Medium

Repro:

1. Switch from `/en` to Czech using `Čeština`.
2. Open the existing course via `Upravit`.
3. Inspect Review items and Questions fields.

Expected: Czech UI should not mix English issue titles/descriptions into localized panels unless those are user-authored content.

Actual: Review still shows English system copy such as `Learner prerequisites are missing`, `Add what learners already know...`, `Course outcome is not measurable`, and `Complete required teaching questions`. Auto-filled question answers are also English inside the Czech route.

Evidence: observed at `/cs/tvorba-kurzu/<course-id>/zdroje` and `/cs/tvorba-kurzu/<course-id>/vyukove-otazky`.

### UX-005: Czech pluralization is wrong for one URL source

Severity: Medium

Repro:

1. Add one URL source.
2. Return to `/cs` course list.
3. Read the course metadata line.

Expected: Singular source count should use correct Czech grammar.

Actual: Metadata reads `1 zdrojů`; expected `1 zdroj`.

Evidence: observed in course list text after adding one source.

### UX-006: Browser back does not recover from the generic Topics error

Severity: Medium

Repro:

1. Trigger UX-001.
2. From the `Something went wrong!` page, press browser back via `Alt+Left`.
3. Observe URL and page state.
4. Click `Hide Error`.

Expected: Browser back should return to Questions, or the error page should provide a recovery path.

Actual: URL remains on `/topics` or `/temata`; `Hide Error` only toggles the button to `Show Error` and leaves `Something went wrong!` visible.

Evidence: observed via `agent-browser get url` and snapshot.

### UX-007: Source type visual state is confusing after adding a URL source

Severity: Low

Repro:

1. Add the URL source `https://junior.guru/handbook/`.
2. Reopen the course in Czech and land on Sources.
3. Inspect the source form and source list.

Expected: The source list should clearly show the URL source without implying the current form mode is Notes, or the selected tab should reflect the selected/listed source.

Actual: The source list says `URL - Připraveno - 6097 chars`, but the form tab shows `Poznámky` as selected and the active input is `Surové poznámky`.

Evidence: observed at `/cs/tvorba-kurzu/<course-id>/zdroje`.

### UX-008: Full AI mode selection advances immediately without clear confirmation

Severity: Low

Repro:

1. Create a new draft.
2. On Mode, click `Generate course for me`.

Expected: Selection should visibly mark the mode, or immediate advancement should clearly indicate that the choice has been applied.

Actual: The app immediately advances to Sources. Later course metadata confirms `Generate course for me`, but the moment of selection provides weak confirmation.

Evidence: observed during initial course creation flow.

## Positive Notes

- Sign-up worked without needing source-level setup.
- URL source processing completed and showed `Ready - 6097 chars`.
- Locale-prefixed links switch `/en` to `/cs`.
- Logo navigation from the course list returns to the localized root.
- Renaming a course via Mode -> title -> Save title persists back to the course list.
