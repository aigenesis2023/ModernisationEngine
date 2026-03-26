# Test Run Configuration

Fill in the fields below, or tell Claude what to fill in chat.

- **"Run it"** → single run using BRAND 1 + TOPIC 1
- **"Matrix run"** → run all filled brand/topic combinations
- You can also just say what you want in chat: "matrix run with Sprig, Ailyx, and Najaf on cybersecurity" and Claude will fill in the fields

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

```
QA LEVEL: full              [structural + interactive + visual]
```

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
2. If a topic is short (1-3 words), expand it into a full brief before writing to `topic-brief.txt`. Include: subject scope, what it covers (5-7 subtopics), target audience, difficulty level, estimated duration (~45 minutes). Use the research agent's needs as the guide.
3. If only BRAND 1 and TOPIC 1 are filled → single run (update `brand/url.txt` and `v5/input/topic-brief.txt`, run full pipeline)
3. If multiple brands/topics are filled → run each combination, pairing for maximum contrast (dark+light, technical+narrative) to catch the most issues in the fewest runs
4. Run ALL combinations before fixing anything — collect the full picture first
5. After each run, report: which brand + topic was used, QA results (structural + interactive + visual)
6. After all runs complete:
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
