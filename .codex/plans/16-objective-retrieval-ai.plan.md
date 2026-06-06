---
name: objective-retrieval-ai
overview: Generate Learning Objectives and Activity Briefs with Ax, retrieve source evidence by objective, and make generation useful for huge files and long transcripts.
todos:
  - id: implement-objective-retrieval
    content: Replace fixed first-chunk evidence selection with an objective-targeted source evidence selector that can search knowledge chunks, source names, headings, pages, slides, and timestamps.
    status: pending
  - id: add-blueprint-ax-programs
    content: Add structured Ax programs for Course Preparation assumptions, Learning Objectives, Activity Briefs, source confidence, and activity recommendations.
    status: pending
  - id: add-deterministic-fallbacks
    content: Add deterministic fallback generation for objectives and activity briefs so local tests pass without a live AI provider.
    status: pending
  - id: wire-blueprint-generation
    content: Add store orchestration for generating and saving Learning Blueprint data, including reviewable/applied AI run tracking and source references.
    status: pending
  - id: update-full-generate-path
    content: Update Generate Mode build orchestration so source material plus optional Learning Goal / Source Focus can produce blueprint-backed course content and end on playable preview.
    status: pending
  - id: add-retrieval-ai-tests
    content: Add AI provider and workflow tests for objective-specific retrieval, huge-source relevance, fallback blueprint generation, and Generate Mode with missing optional source focus.
    status: pending
isProject: false
---

# objective-retrieval-ai

## Execution Notes

The PRD allows Ax/RLM or another retrieval implementation, but the domain model must not depend on one provider. Start pragmatic: a deterministic objective-targeted selector is acceptable if it gives Ax focused evidence and can later be replaced.

## Constraints

Do not add arbitrary custom mini-game generation. Do not make MuBit or external memory required. Keep Strict-Source Mode optional and off by default. Do not add no-source generation.

## Validated Done Boundaries

- Retrieval output must be provider-independent: objective id, ranked evidence snippets or chunk ids, source references, support/confidence, and reason for weak support.
- A deterministic objective-targeted selector is acceptable for v1 if it searches available source metadata and text instead of always using first chunks.
- Ax programs must consume and emit the domain contract from `learning-blueprint-domain`; do not make shared types depend on Ax or any memory provider.
- Optional memory may mirror generation decisions only after the course model is saved. It must not be required for tests or normal generation.
- `implement-objective-retrieval`: Done when at least one test proves two different objectives can select different relevant evidence from the same larger source set.
- `add-blueprint-ax-programs`: Done when structured generation returns Course Preparation assumptions, Learning Objectives, Activity Brief recommendations, and source confidence in the shared contract shape.
- `add-deterministic-fallbacks`: Done when local tests can generate useful objectives and briefs without live AI credentials.
- `wire-blueprint-generation`: Done when store orchestration saves generated blueprint data, AI run metadata, and source references without overwriting human-authored content.
- `update-full-generate-path`: Done when Generate Mode can run from source-only input plus optional source-bound Learning Goal / Source Focus and land on playable preview data.
- `add-retrieval-ai-tests`: Done when tests cover objective-specific retrieval, fallback generation, missing optional source focus, and weak source support.

## Operator Guidance

Depends on `learning-blueprint-domain`. This lane can run in parallel with activity rendering once shared types are stable. Coordinate any changes to AI run types and store actions with the domain owner.
