# Test Run Configuration

Fill in the fields below, or just tell Claude what you want in chat.

## Keywords

- **"Run"** → build the course, give the output. No QA, no bug fixing.
- **"Test"** → build the course, then run all QA gates and fix any issues found.
- **"Matrix test"** → test all filled brand/topic combinations, classify and fix bugs.

Examples:
- "Run it with sales and fin-ai" → just builds
- "Test it with Sprig on cybersecurity" → builds + QA + fixes
- "Matrix test with Sprig, Ailyx, and Najaf" → tests all three, groups bugs

---

## Brands

```
BRAND 1: https://sprig.framer.website/
BRAND 2:
BRAND 3:
```

## Topics

Short is fine — even just "Cybersecurity" works. Claude will expand it into a full brief with audience, level, duration, and scope before running the research agent.

```
TOPIC 1: Cybersecurity

TOPIC 2:

TOPIC 3:
```

## Settings

QA is automatic based on keyword: "run" = no QA, "test" = full QA.

---

## Brand Reference

Tested brands you can copy into the slots above.

| Brand | Theme | URL |
|-------|-------|-----|
| Sprig | dark, cyan | `https://sprig.framer.website/` |
| Ailyx | light, blue | `https://ailyx.framer.website/` |
| Najaf | dark, green | `https://najaf.framer.ai/` |
| Fluence | light, amethyst | `https://fluence.framer.website/` |
| FitFlow | light, pink-blue | `https://fitflow.framer.website/` |
| Landio | dark, neutral | `https://landio.framer.website/` |
| Crimzon | dark, crimson | `https://crimzon.framer.website/` |
| Aigents | light, purple | `https://aigents.framer.website/` |

---

## Instructions for Claude

### Running

1. Read this file before every run
2. Detect mode from user's keyword: "run" = build only, "test" = build + QA, "matrix test" = multi-combination + QA
3. If a topic is short (1-3 words), expand it into a full brief before writing to `topic-brief.txt`. Include: subject scope, what it covers (5-7 subtopics), target audience, difficulty level, estimated duration (~45 minutes)
4. Update `brand/url.txt` and `v5/input/topic-brief.txt` with the chosen brand and topic
5. For **"run"**: execute full pipeline (Steps 1-5), deliver the output. No QA scripts. Done.
6. For **"test"**: execute full pipeline (Steps 1-5), then run all QA gates (6a, 6b, 6c). Fix any failures.
7. For **"matrix test"**: run each brand/topic combination, pairing for maximum contrast. Run ALL combinations before fixing. Then:
   - List all failures grouped by type (universal, theme-specific, content-specific, component-specific)
   - Fix universal bugs first (one fix covers all), then specific bugs
   - Re-run the full matrix to verify fixes didn't break other combinations

### When a bug is found — diagnose before fixing

Before fixing any bug, classify it:

- **Universal** — broken for all brands and topics → fix once, applies everywhere
- **Theme-specific** — only broken on dark OR light brands → fix is in colour/contrast handling
- **Content-specific** — only broken with certain content shapes (data-heavy, long text, short sections) → fix is in the fill function or generation engine
- **Component-specific** — only broken for one component type → fix is in that fill function

After fixing, re-run the full matrix — don't just check one combination. A fix for dark brands could break light brands.

### What to test beyond the pipeline

When running matrix tests, also check for these edge cases:
- Components with minimal content (1 item in an accordion, 2-choice MCQ)
- Components with maximum content (8+ accordion panels, long prose in tabs)
- Sections with many consecutive visual components (images, stats, pullquotes)
- Very short courses (3-4 sections) and longer ones (10+ sections)
- Topics that produce lots of statistics vs topics that are mostly narrative
