---
name: real-ai-review-provenance
overview: Implement the persistent AI Review Panel and provenance layer using real AI review runs, source coverage analysis, teaching-quality checks, actionable findings, dismissal and resolution state, and traceable references from generated blocks to source chunks.
todos:
  - id: persist-findings
    content: Persist AI Findings with target step or entity, type, severity, actionable copy, status, source references, created time, resolved time, and recomputation markers.
    status: pending
  - id: run-teaching-quality-review
    content: Run real teaching-quality review for weak outcomes, missing practice, passive content dumps, chapter sizing, prerequisite order, target learner mismatch, and difficulty mismatch.
    status: pending
  - id: run-source-coverage-review
    content: Run real source coverage review for unsupported topics, unsupported claims, missing source support, incomplete processing caveats, strict source-only gaps, and AI-inferred content.
    status: pending
  - id: attach-provenance
    content: Attach provenance classifications and source references to generated lessons and blocks including source asset, derived document, chunk, page, slide, timestamp, and heading path.
    status: pending
  - id: build-review-panel-ui
    content: Show real findings, accepted and rejected suggestions, explanations, generation actions, regeneration actions, quality checks, and source coverage checks in the right-side panel.
    status: pending
  - id: implement-finding-actions
    content: Let creators dismiss and resolve findings through backend mutations and prevent resolved findings from immediately reappearing unless underlying content changes.
    status: pending
  - id: recompute-after-edits
    content: Trigger real review recomputation after major source, topic, target learner, chapter, lesson, or block changes.
    status: pending
  - id: remove-static-review-state
    content: Remove static findings, static coverage values, static quality chips, inert resolve buttons, and review copy that implies analysis without a durable AI Run.
    status: pending
isProject: false
---

# real-ai-review-provenance

## Execution Notes

The current review panel is static. The PRD requires structured findings attached to wizard steps and builder objects. Provenance is required internally even if user-visible citations are not part of the first UI.

## Constraints

No generic chat panel as the main review surface. No static warning cards. Findings should not block navigation unless required information is genuinely missing.

## Operator Guidance

Depends on `real-ai-generation`, `real-knowledge-ingestion`, and `real-course-builder`. Coordinate contracts through `durable-domain-model`.
