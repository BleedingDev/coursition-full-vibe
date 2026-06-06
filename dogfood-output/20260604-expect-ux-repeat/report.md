# Coursition UX Repeat Dogfood

Target: http://localhost:8080
Date: 2026-06-04
Scope: Full creator workflow, dashboard management, generated/manual modes, localized URL behavior, validation gates, preview.

## Findings

### ISSUE-001 - Medium - Questions step says required fields are missing even though generated values are filled and generation works

Evidence: `screenshots/questions-prefilled.png` and `screenshots/questions-after-generate-click.png`

Repro steps:

1. Create a course in "Generate course for me" mode.
2. Add `https://junior.guru/handbook/` as a URL source.
3. Continue to Questions.
4. Observe the prefilled fields and the message above the form.
5. Click `Generate topics`.

Expected: If generated/suggested question values are already visible and usable, the page should not claim that outcome, audience, and practice are missing.

Actual: The fields are visibly populated and topic generation succeeds, but the page still says `Generate mode needs outcome, audience, and practice before topic generation.` This makes the user think they must manually fix fields that are already valid.

### ISSUE-002 - High - Generated target learner can be skipped without explicit confirmation

Evidence: `screenshots/target-generated-no-warning.png`

Repro steps:

1. Create a course in full generate mode.
2. Add a ready URL source.
3. Generate topics and accept one.
4. Continue to Target and click `Generate target learner`.
5. Observe the header/sidebar.

Expected: The user must explicitly approve the generated target learner with `Confirm target learner` before Chapters becomes available.

Actual: The generated target learner is still in review, but `Next` and `6 Chapters` are already available. This lets users build the course on unconfirmed AI output.

### ISSUE-003 - High - Generated chapters immediately violate the generated target learner

Evidence: `screenshots/chapters-generated.png`

Repro steps:

1. Generate a source-backed course through Target.
2. Confirm the generated target learner.
3. Click `Generate chapters`.

Expected: The generated chapter structure should respect the confirmed target learner and be ready for review/confirmation without self-created validation blockers.

Actual: The app generated advanced chapters for a beginner/limited-prerequisite learner, then blocked progress with `Chapter difficulty does not match the target learner`. The AI flow creates its own cleanup work.
