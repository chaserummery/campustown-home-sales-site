# Campus Housing Explorer

An interactive map exploring home sales associated with the University of Illinois Urbana-Champaign and the question: **Does Living Closer to Campus Cost More?**

## What the map shows

The page reads `data/college_town_home_sales.csv` directly and maps rows whose `university` value is `University of Illinois Urbana-Champaign`. Sale points cluster as users zoom out and separate into individual points as they zoom in. Select a point to see its reported sale price, straight-line campus distance, living area, bedroom and bathroom counts, year built, and sale date.

The map's color scale runs from $0 to $1,000,000 and is capped at $1,000,000; sales at or above that amount share the brightest color. This keeps the colors useful for the bulk of this campus's prices while popups retain each row's actual `sale_price`. The data description warns that some prices are implausible, so values are presented as reported by the source and are not independently verified.

The data description identifies Foellinger Auditorium on the Illinois Main Quad as the landmark used for campus-distance assignment, but gives no landmark coordinates. The map therefore labels its campus marker as approximate. The plotted `miles_to_campus` values remain the values supplied with the dataset.

## Libraries and data

The site uses Leaflet for the map, Leaflet.markercluster for point clustering, and Papa Parse to read the CSV in the browser. The map tiles come from OpenStreetMap. These libraries and map tiles are loaded from their public CDNs, so the interactive map requires an internet connection. No build step or server-side code is used.

The source dataset is not modified. To publish, push the site files to `main`; the existing GitHub Pages workflow publishes the repository root.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
