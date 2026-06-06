---
name: real-course-studio-ui
overview: Replace local prototype wizard behavior with authenticated, server-backed AI Course Studio UI that creates and resumes real drafts, stores wizard state, controls mode-specific flow, manages real sources, runs AI workflows, and opens real Course Builder drafts.
todos:
  - id: load-authenticated-draft
    content: Load the signed-in creator state and create or resume a real Course Draft before showing source upload or AI generation controls.
    status: pending
  - id: wire-wizard-session
    content: Replace local active step and draft state with durable wizard session reads, autosave mutations, resume later behavior, disabled states, error states, and server validation.
    status: pending
  - id: implement-ai-mode-workflow
    content: Persist AI involvement mode and make Generate course for me, Help me build it, and I'll build manually change required questions, AI panel behavior, and navigation.
    status: pending
  - id: wire-knowledge-step
    content: Connect the Knowledge Base step to real source upload, link, notes, source list, status, preview, delete, retry, details, continue, and continue without waiting operations.
    status: pending
  - id: implement-guided-questions
    content: Persist required and optional teaching questions including outcome, audience, prerequisites, depth, avoid list, practice style, tone, length, language, assessment, difficulty, examples, and source-only mode.
    status: pending
  - id: implement-topic-review
    content: Display real generated topics and support manual add, edit, delete, accept, reject, selected count, source support, and AI findings.
    status: pending
  - id: implement-target-learner-review
    content: Display real generated target learner profile and critique, support creator editing, acceptance, confirmation, and findings for vague audience or missing prerequisites.
    status: pending
  - id: implement-chapter-review
    content: Display real generated chapters and support add, delete, rename, edit description, save, reorder, regenerate selected chapter, confirm, and structure warnings.
    status: pending
  - id: route-manual-mode
    content: Make manual mode create a blank durable Course Builder draft and open it without heavy AI generation while keeping passive review available.
    status: pending
  - id: remove-local-prototype-state
    content: Remove component-local duplicate enums, static steps pretending to be server state, absent callbacks, and UI-only status changes from the wizard path.
    status: pending
isProject: false
---

# real-course-studio-ui

## Execution Notes

Research found the wizard currently uses local `useState`, optional callbacks that are not passed by the route, and a local draft object that never reaches the builder. This lane turns the UI into a real client of server state and workflows.

Keep the compact design already established, but the UI must never imply that source processing, AI generation, save, or preview happened unless the backend record changed.

## Constraints

No local-only workflow state for product behavior. No static topic list masquerading as AI suggestions. No fake processing radio buttons. Static UI copy must remain native UltraModern i18n.

## Operator Guidance

Depends on `production-foundation` and `durable-domain-model`. Source-specific controls depend on `real-knowledge-ingestion`; generation controls depend on `real-ai-generation`.
