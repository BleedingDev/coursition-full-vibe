# Coursition Course Creation

Coursition turns source material and creator intent into repeatable courses that help learners acquire a topic through structured, interactive learning.

## Language

**Course**:
A repeatable learning experience for a defined audience and topic. A course may contain text, exercises, checks, simulations, mini-games, or other activities, but its purpose is learner progress rather than content packaging.
_Avoid_: Course draft when referring to the final learner-facing experience, document, content bundle

**Course Preparation**:
The editable creator-facing setup that defines who the course is for, what learners should achieve, what source material is trusted, and what constraints shape the course.
_Avoid_: Wizard answers, metadata, prompt inputs

**Learning Blueprint**:
The internal teaching plan that connects course preparation, learning objectives, source evidence, activity briefs, and quality findings. It is not a user-facing step name.
_Avoid_: Visible wizard step, course outline

**Course Intent**:
An optional short statement from the creator about who the course is for or what learners should be able to do. When Course Intent is missing, the system infers assumptions from source material and shows them in the playable course preview.
_Avoid_: Required prompt, course description

**Learning Objective**:
An observable learner capability that the course should create or improve. Learning objectives are the primary planning unit for course generation and should be specific enough to drive source retrieval, practice, feedback, and assessment.
_Avoid_: Topic, chapter title, vague outcome

**Teaching Quality Gate**:
A rule that protects whether generated course content can honestly be treated as an interactive course. Blocking gates are reserved for missing source material, missing learning objectives, unsupported strict-source objectives, missing learner action, missing feedback criteria, or text-only output.
_Avoid_: General quality warning, style preference

**Course Personalization**:
The course-generation choices that adapt a course to an intended learner group, such as audience, prior knowledge, objectives, depth, constraints, tone, and activity mix. Course Personalization is saved with the course preparation and does not imply per-learner adaptive sequencing.
_Avoid_: Learner personalization when the course does not change per individual learner

**Agent Memory**:
Optional external memory that records how the course-generation agent made or revised preparation decisions. Agent Memory may improve observability or continuity, but the course must remain usable without it.
_Avoid_: Source of truth, learner memory

**Topic**:
A subject area or content grouping covered by a course. Topics organize learning objectives and source coverage, but they are not the primary planning unit for interactive learning.
_Avoid_: Learning objective when describing what the learner should be able to do

**Course Mode**:
The creator's chosen level of AI authority during course preparation and content generation. The primary course creation flow has two course modes: Generate Mode and Assist Mode.
_Avoid_: AI setting, generation preference

**Generate Mode**:
A course mode where the system completes the course preparation and course content automatically from source material and minimal creator intent. The creator reviews the final result and can go back to adjust assumptions.
_Avoid_: Full AI when discussing the product mode

**Assist Mode**:
A course mode where the system prefills course preparation as the creator moves through the flow, while the creator can review and edit the important decisions before content generation.
_Avoid_: Semi-automatic mode, guided wizard

**Course Content**:
The learner-facing material and activities produced from the course preparation. Course content can include editable text and less-editable interactive activities.
_Avoid_: AI output, generated blocks

**Editable Course Text**:
Learner-facing text that a creator can directly revise after generation, such as explanations, titles, instructions, and feedback wording.
_Avoid_: Editable course content when referring to generated activity mechanics

**Generated Activity**:
A learner-facing interactive activity produced from an activity brief. Generated activities are changed by editing the activity brief or regenerating the activity, not by directly editing their internal mechanics.
_Avoid_: Mini-game when the activity is not game-like, raw generated config

**Playable Course Preview**:
The learner-facing preview of a generated course, shown so the creator can experience the course before publishing or revising it.
_Avoid_: Preview when the surface is only an outline or preparation summary

**Interactive Activity**:
A learner-facing task that asks the learner to do something and receive feedback, such as answering, choosing, diagnosing, ordering, practicing, or applying an idea.
_Avoid_: Mini-game when the activity is not game-like, content block

**Activity Brief**:
The creator-editable description of what an interactive activity should teach, how the learner should act, and what feedback or success should mean. The activity brief is distinct from the generated activity itself.
_Avoid_: Mini-game config, prompt, generated JSON

**Retrieval Check**:
An interactive activity where the learner recalls or recognizes a fact, term, rule, concept, or small procedure step.
_Avoid_: Quiz when referring to all activity types

**Practice Task**:
An interactive activity where the learner applies knowledge to produce, solve, write, calculate, debug, or complete something.
_Avoid_: Exercise when referring to all activity types

**Scenario Decision**:
An interactive activity where the learner chooses or explains a decision in a realistic situation and receives feedback on the consequences.
_Avoid_: Case study when no decision is required

**Ordering / Matching Activity**:
An interactive activity where the learner sequences steps, ranks options, groups items, or matches related concepts.
_Avoid_: Drag-and-drop game when the learning action is ordering or matching

**Rubric Answer**:
An interactive activity where the learner gives a freeform response and receives feedback against explicit criteria.
_Avoid_: Reflection when the answer is assessed

**Source Material**:
Original material provided by a creator, such as files, links, videos, audio, slides, documents, or pasted notes.
_Avoid_: Knowledge base when referring to one original input

**Strict-Source Mode**:
A course preparation setting where generated objectives, explanations, and activities must stay supported by source material. Strict-Source Mode is optional and is most appropriate for compliance, safety, policy, legal, or other source-authoritative courses.
_Avoid_: Default source grounding, provenance display

## Flagged Ambiguities

**Manual Mode**:
Manual Mode is not a course mode. Blank creation or reviewing an existing course may exist as separate entry points, but the main course creation flow uses Generate Mode and Assist Mode.

**Example Dialogue**:
Creator: "I uploaded safety training videos and want a course for warehouse staff."
Product: "So the course preparation should define warehouse staff, safety outcomes, source strictness, and the kind of practice they need."
Creator: "Yes. The course itself should then be a repeatable training experience, not just a text summary."
Product: "For interactive parts, you can edit the activity brief instead of editing the generated interaction directly."
