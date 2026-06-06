# AI Topic Source Research

Status: parked
Date: 2026-06-05

## Problem

Support a course creation flow where the user can specify only a topic, then the app searches for relevant learning materials, adds them as sources, and uses those sources to build or assist the course.

## Desired Flow

The user chooses a course mode and can either add sources manually or ask the app to find materials from a topic.

- Fully build: user provides a topic, the app searches for relevant materials, adds selected sources automatically, extracts the content, fills all required course steps, and takes the user to the completed draft for review.
- Help me build it: user provides a topic, the app suggests source candidates, the user approves or removes them, then AI prefills each course step while the user reviews and edits before continuing.
- I'll build manually: user provides a topic only when they want optional help; AI can suggest materials and feedback, but the user fills the course manually.

## Required Capabilities

1. Add a source option such as "Find materials for me" where the user enters a topic, audience, language, and optional constraints.
2. Add a research provider abstraction for web search and extraction.
3. Store research runs separately from accepted course sources.
4. Rank and deduplicate candidate materials before they become sources.
5. Let users approve, reject, or inspect candidate materials in assisted and manual flows.
6. Automatically convert approved materials through the existing ingestion pipeline.
7. Preserve source provenance and citations so generated course content can reference where it came from.
8. Add limits and safety controls for search depth, allowed domains, excluded domains, source count, and language.

## Provider Options

For an MVP, Exa or Tavily look like the best fit because they combine search-oriented APIs with content retrieval features.

Brave Search is useful as a search index, but it likely needs a separate extraction and crawling layer.

Possible provider references:

- Exa Search API: https://exa.ai/docs/reference/search
- Tavily API: https://docs.tavily.com/documentation/api-reference/introduction
- Brave Search API: https://brave.com/search/api/

## Data Model Sketch

Add entities similar to:

```ts
type ResearchRun = {
  id: string;
  draftId: string;
  topic: string;
  mode: DraftMode;
  language: string;
  status: 'pending' | 'running' | 'needs_review' | 'completed' | 'failed';
  provider: 'exa' | 'tavily' | 'brave';
  createdAt: string;
  completedAt?: string;
};

type ResearchCandidate = {
  id: string;
  runId: string;
  title: string;
  url: string;
  snippet?: string;
  extractedText?: string;
  score: number;
  sourceType: 'article' | 'pdf' | 'video' | 'audio' | 'other';
  language?: string;
  author?: string;
  publishedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
};
```

Accepted candidates should become normal course sources with metadata such as `researchRunId`, `researchCandidateId`, original URL, provider, and retrieval timestamp.

## Ingestion Pipeline

The existing source pipeline should handle accepted materials:

- URLs: fetch and extract readable content.
- PDFs and documents: parse through LlamaParse.
- Audio and video: transcribe through Deepgram where applicable.
- All source types: normalize text, deduplicate, chunk, and attach provenance.

The UI should never expose raw data URLs or unprocessed binary payloads as source text.

## Product Controls

The research UI should support:

- Topic input.
- Target learner or audience hint.
- Preferred language.
- Number of sources.
- Source type filters.
- Include and exclude domains.
- Recency preference.
- Approve all, reject all, and per-source review.

## Open Decisions

- Choose the MVP search provider.
- Decide whether full AI mode can auto-accept sources or should show a short source review checkpoint.
- Define copyright and storage rules for extracted third-party content.
- Decide whether source search should be a separate step or part of the Sources step.
- Decide how citations appear in the generated course editor and preview.
