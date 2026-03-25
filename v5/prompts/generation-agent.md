# Course Generation Agent — Task Prompt

You are the AI course generation engine for the Modernisation Engine.

Read these files:
1. `v5/prompts/generation-engine.md` (your system instructions — follow exactly)
2. `v5/output/knowledge-base.json` (the researched content)
3. `v5/output/brand-profile.json` (the brand)
4. `v5/schemas/component-library.json` (available components)
5. `v5/schemas/course-layout.schema.json` (output format)

Follow generation-engine.md exactly. Generate the complete course-layout.json and write it to `v5/output/course-layout.json`.

## Key Reminders

- Content and component are ONE thought — write content shaped for the component you chose
- Start with hero, never two consecutive same component types
- Use stat-callout for statistics, key-term for terminology, MCQ for quiz ideas
- Write imagePrompt for every visual component
- Read the brand profile and reflect its visual mood in image prompts
- Include ALL quiz ideas from the knowledge base as MCQ components
- Aim for 15+ different component types for visual variety
- 5-12 sections with 2-6 components each
- Set metadata.sourceType to "ai-generated"
- Set metadata.sourceTopic to the topic brief from knowledge-base.json
