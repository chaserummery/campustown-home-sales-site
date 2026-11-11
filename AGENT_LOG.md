# Agent log

Add a dated entry each time you work with your AI coding agent, with the newest entry at the bottom. Each entry records what you asked the agent, what it produced, and what you checked or changed. Paste your key prompts in exactly as you typed them. Include at least one time the agent got something wrong, and how you caught it.

Copy this outline for each entry:

```markdown
## YYYY-MM-DD: What you worked on

- **Asked:** "Paste your prompt here."
- **Agent produced:** What it made or changed.
- **Checked or changed:** How you checked it, and what you fixed.
```
## 2026-11-11: Initial Illinois campus housing map

- **Asked:** "Let's start building the website.\n\nFor our first pull request, I want to create the initial interactive housing price map for the University of Illinois Urbana-Champaign.\n\nPlease read `AGENTS.md` and `docs/data_description_sheet.md` first, and pull the latest `main` branch.\n\nRequirements:\n\n1. Replace the placeholder page with a clean, modern website titled \"Campus Housing Explorer\".\n2. Add the subtitle \"Does Living Closer to Campus Cost More?\"\n3. Build an interactive map showing home sales associated with the University of Illinois Urbana-Champaign.\n4. Each property should appear as a map point, with brighter colors representing higher sale prices.\n5. Add a clear price legend. Handle extreme prices with a documented visualization scale, while preserving actual sale prices in the property details.\n6. Add clustering or another appropriate technique to avoid overcrowding the map.\n7. Clicking a property should show its sale price, distance to campus, living area, bedrooms, bathrooms, and year built.\n8. Mark the university's campus landmark on the map. First try to find the exact landmark coordinates used by the dataset. If they are unavailable, use a clearly labeled approximate reference point and explain the limitation.\n9. Use the actual dataset, not sample or invented data.\n10. Make the website responsive and suitable for desktop and mobile.\n\nFor this first task, do not implement the university selector, scatterplot, or property explorer yet. We will add those in later pull requests.\n\nPlease implement the changes, check for errors, and summarize what you changed. Do not create a pull request yet; I want to review the changes first."
- **Agent produced:** Replaced the placeholder with the responsive map page, added project/data-use notes to the README, used the supplied CSV as the live source, and left the five source dataset files untouched. The campus landmark coordinates were not present in the repository, so the map marks an explicitly approximate Foellinger Auditorium reference point.
- **Checked or changed:** Read `AGENTS.md` and `docs/data_description_sheet.md` first. Attempted `git pull origin main`; it failed because GitHub was unreachable through the configured network proxy. Confirmed the full CSV has 35,442 rows and the Illinois campus subset has 3,664 records with all required map/detail fields. HTML parsing, inline JavaScript syntax (`node --check`), and `git diff --check` passed. No live browser check was possible in this shell-only environment.
