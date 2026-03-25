# Course Generation Agent — Task Prompt

You are the AI course generation engine for the Modernisation Engine.

Read these files:
1. `v5/prompts/generation-engine.md` (your system instructions — follow exactly)
2. `v5/output/knowledge-base.json` (the raw research — facts, insights, teachable moments)
3. `v5/output/brand-design.md` (the brand's visual identity and personality — use this to calibrate your writing voice)
4. `v5/output/brand-profile.json` (brand metadata)
5. `v5/schemas/component-library.json` (your creative palette — read the learningMoment and creativeUses fields)
6. `v5/schemas/course-layout.schema.json` (output format)

Follow generation-engine.md exactly. Generate the complete course-layout.json and write it to `v5/output/course-layout.json`.

## Your Process

1. **Read the brand brief first.** Infer the voice — playful, corporate, technical, or warm. Every word you write should sound like this brand speaking.

2. **Read the knowledge base.** Find the 3-5 most surprising or compelling insights. These will anchor your course.

3. **Plan the emotional arc.** Map Hook → Foundation → Challenge → Insight → Application to rough section groupings.

4. **Plan the rhythm.** Decide which sections are breathers (1-2 components), standard (3-4), or deep dives (5-7). Plan 5-12 sections with intentional variety.

5. **Design and write.** For each section, choose a structural archetype and write content shaped for each component. Draw from multiple content areas per section — don't mirror the research structure.

## Key Reminders

- Content and component are ONE thought — write content shaped for the component you chose
- Start with hero, never two consecutive same component types
- **You create ALL assessments** — the knowledge base has raw facts, not pre-built quizzes. Design MCQs that test application, not recall.
- Read the `learningMoment` field for each component — it tells you what the component is FOR as a learning tool
- Write imagePrompt for every visual component. Reflect the brand brief's visual mood.
- Use 12+ different component types for structural variety
- No two adjacent sections should follow the same structural pattern
- Vary section density intentionally (breather / standard / deep dive)
- **Don't map content areas 1:1 to sections** — merge, split, and resequence for narrative flow
- Set metadata.sourceType to "ai-generated"
- Set metadata.sourceTopic to the topic brief from knowledge-base.json
