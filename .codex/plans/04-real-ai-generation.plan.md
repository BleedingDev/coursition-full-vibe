---
name: real-ai-generation
overview: Implement durable real AI workflows for topics, target learner, chapters, lessons, checks, review, validation, retries, and safe application into Course Builder using actual configured model providers and processed Knowledge Chunks.
todos:
  - id: configure-ai-provider
    content: Add real configurable AI provider access for generation and review with required credentials, model selection, request metadata, rate error handling, and no fallback mock provider.
    status: pending
  - id: implement-ai-run-lifecycle
    content: Persist AI Run creation, queued, running, needs review, applied, failed, cancelled, retry, input selection, provider request ids, token or cost metadata, and failure reasons.
    status: pending
  - id: generate-topics-from-chunks
    content: Generate structured topic suggestions from processed Knowledge Chunks with source support, difficulty, importance, related chunks, and suggested or accepted or rejected or manual states.
    status: pending
  - id: generate-target-learner
    content: Generate and critique target learner profiles from accepted topics, source chunks, and guided question answers.
    status: pending
  - id: generate-chapter-structure
    content: Generate chapter structures from accepted topics, confirmed target learner, and source chunks with outcomes, covered topics, source support, difficulty, lesson count, and structure checks.
    status: pending
  - id: generate-lessons-as-blocks
    content: Generate full lesson drafts as validated Course Builder blocks including objective, explanation, worked example when appropriate, exercise or check, summary, next step, and source provenance.
    status: pending
  - id: generate-assessments-and-practice
    content: Generate quiz or check blocks, exercise tasks, reflection prompts, code blocks when appropriate, and practice feedback data tied to the target learner and source material.
    status: pending
  - id: validate-generated-output
    content: Validate every AI output against runtime schemas, lesson quality rules, source-only mode, provenance rules, and Course Builder block contracts before application.
    status: pending
  - id: apply-ai-patches-safely
    content: Apply approved AI outputs as durable patches to topics, target learner, chapters, lessons, and blocks without silently overwriting creator edits.
    status: pending
  - id: add-real-ai-gates
    content: Add real provider validation proving AI workflows use configured model providers, record durable AI Runs, validate outputs, and fail loudly if provider configuration is missing.
    status: pending
isProject: false
---

# real-ai-generation

## Execution Notes

The PRD is explicit that AI is workflow-native, not chatbox-native. Every meaningful AI operation is a durable AI Run. Outputs must validate before application and must not silently mutate accepted human work.

The current UI has no AI call path. The current domain sketch includes `internal_mock`, which must be removed from the production path.

## Constraints

No mock model, no fake generated course, no hardcoded AI output, no static translated lesson body pretending to be generated content. A missing provider key is a blocked operational state, not a reason to substitute static data.

## Operator Guidance

Depends on `production-foundation`, `durable-domain-model`, and real processed chunks from `real-knowledge-ingestion`. Coordinate with `real-course-builder` on block validation and safe application.
