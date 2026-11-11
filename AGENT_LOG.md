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

## 2026-11-11: Complete the university housing explorer

- **Asked:**

  ```text
  The first version of my Campus Housing Explorer is successfully deployed, and the map is working.

  Now I want to complete the entire website in one development task.

  Please read `AGENTS.md` and `docs/data_description_sheet.md` first, and pull the latest `main` branch.

  **1. Support all 11 universities**

  - Add a university dropdown selector.
  - Update the map, campus landmark, home sale markers, and sale count based on the selected university.
  - Automatically zoom to the selected university.

  **2. Improve map markers**

  - Make the individual home sale markers and university campus landmark markers clearly distinguishable.
  - Keep the price-based color gradient, clustering, legend, and property popups.

  **3. Add a Distance vs. Price scatterplot**

  - X-axis: distance to campus (miles).
  - Y-axis: sale price ($).
  - Each point represents a home sale.
  - Add a trendline and show the relationship between distance and price.
  - Synchronize the scatterplot with the university selector.
  - Use the real dataset and clearly explain any filtering of extreme prices.

  **4. Add a Property Explorer**

  - Allow users to filter homes by sale price, distance to campus, living area, bedrooms, bathrooms, and year built.
  - Help users identify expensive homes that are far from campus.
  - Display relevant property features, including garage and fireplace information where available.
  - Make it possible to compare these homes with other properties in the same university market.

  **5. Add a data insights section**

  - Show median sale price, number of sales, and other useful summary statistics for the selected university.
  - Compare prices across different distance ranges.
  - Help users explore whether homes closer to campus tend to be more expensive.
  - Clearly distinguish correlations from possible explanations. Do not claim causation without supporting evidence.

  **6. Design and testing**

  - Keep the existing clean green-and-white visual style.
  - Make the website responsive for desktop and mobile.
  - Use the actual CSV dataset without inventing data.
  - Handle missing values and extreme prices.
  - Test all interactive features and verify that the data loads correctly on GitHub Pages.
  - Update `README.md` and `AGENT_LOG.md`.

  Please implement all these features, review the code for errors, and create one pull request into `main` when finished.

  Do not merge automatically. I want to review the complete website before deploying it.
  ```

- **Agent produced:** Rebased the work on fetched `origin/main`; replaced the single-market page with an 11-university map, campus selector, clustered colored sale markers, SVG distance-price scatterplot and trendline, market insight cards, distance-band medians, and a filterable/sortable property table. Added a reproducible script and derived approximate campus reference locations from each sale's coordinates and source distances rounded to 0.1 mile. Rewrote README usage and data-method notes.
- **Checked or changed:** Generated all 11 campus references; validated the CSV and reference names/counts. Ran HTML/JavaScript/Python syntax checks and `git diff --check`. A headless Playwright smoke check against the local HTTP-served site (using test doubles for CDN-hosted map/parser libraries) verified CSV loading, selector updates for UIUC/Florida/Iowa, map and scatter counts, distance bands, all numeric filters, garage/fireplace filters, quick high-price/farther preset, reset, pagination, sorting, mobile layout, and no application JavaScript errors. GitHub Pages could not be tested with this unmerged branch; its existing workflow publishes only pushes to `main`.
