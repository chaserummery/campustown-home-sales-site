# Campus Housing Explorer

An interactive exploration of completed home sales around 11 US university campuses. The site asks: **Does Living Closer to Campus Cost More?**

## Explore the data

Choose a university to update the map, campus reference pin, scatterplot, market statistics, distance comparisons, and property results together. At zoom levels 10 and below, the map aggregates actual sales into screen-aligned neighborhood cells roughly 2–3 miles wide (32 pixels at zoom 10, with half-width cells at each zoom level farther out). Each cell shows the median reported sale price by color and its tooltip reports count and median. From zoom 11 through 16, price-colored property clusters show their count and median price; their tooltip reports both values. At zoom 15 and above, clustering is limited to points close enough to overlap at the current scale; clicking a remaining cluster at maximum zoom spiderfies it so each sale can be selected. Select an individual home for its reported sale price, distance, area, beds, baths, year, garage, and fireplace details.

The campus reference uses a large navy university pin above the sale layers so it is visually distinct from the round sale points, clusters, and neighborhood cells. Its position remains an approximate reconstruction, as described below.

All map colors use a continuous yellow-to-orange-to-dark-red scale from $0 to $1,000,000. The color scale is capped at $1,000,000, so higher values share the darkest red. Individual sales are colored by their reported sale price; neighborhood cells and property clusters use the median of the reported prices they contain. Aggregated marker tooltips report the underlying count and median. Map popups retain full individual prices, including values above the cap.

The scatterplot includes each sale in the selected market with a reported price from $1,000 through $5,000,000. The description sheet flags impossible prices, including sales under $1,000 and above $5,000,000; the interface reports how many records fall outside the displayed analysis range. The trendline and Pearson correlation describe association only. They do not explain the cause of price differences.

Market median prices, the scatterplot, distance bands, and comparison benchmarks use the same $1,000–$5,000,000 range. The map and property explorer retain access to the original reported sale prices; explorer price bounds can be cleared to include records outside the analysis range. Missing property characteristics appear as “Not reported.” `home_type` is omitted from the explorer because the data description says it is unreliable.

## Campus reference locations

The source description identifies the campus landmarks used to calculate distance but does not publish their coordinates. `scripts/build_campus_references.py` reconstructs approximate reference coordinates for all 11 campuses by fitting property coordinates to the source `miles_to_campus` values. Those distances are rounded to 0.1 mile, so the reference pins are explicitly approximate and are not presented as exact official coordinates. The fit uses all records with coordinates and a reported distance in each university market.

To regenerate the derived file using only the Python standard library:

```sh
python3 scripts/build_campus_references.py
```

This writes `data/campus_references.json`. The CSV remains the source for all home sale records and the five original dataset files are never modified.

## Implementation

The site is static HTML, CSS, and JavaScript. It reads the CSV and campus-reference JSON from relative repository paths. Leaflet displays the map, Leaflet.markercluster groups dense markers, Papa Parse reads the CSV, and the scatterplot is drawn as SVG. The low-zoom grid aggregates each selected market's actual records client-side; it does not load or generate synthetic sale records. Map libraries and OpenStreetMap tiles load from external services, so the interactive map requires an internet connection. GitHub Pages publishes the repository root using the existing workflow.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
