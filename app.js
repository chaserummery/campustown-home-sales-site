(() => {
  "use strict";

  const PRICE_MIN = 1000;
  const PRICE_MAX = 5000000;
  const MAP_COLOR_MAX = 1000000;
  const PAGE_SIZE = 100;
  const universitySelect = document.getElementById("university-select");
  const mapElement = document.getElementById("map");
  const numberFormat = new Intl.NumberFormat("en-US");
  const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  let records = [];
  let references = new Map();
  let currentUniversity = "";
  let market = [];
  let map;
  let saleLayer;
  let campusLayer;
  let overviewLayer;
  const OVERVIEW_MAX_ZOOM = 10;
  const OVERVIEW_BASE_CELL_PIXELS = 32;
  let visibleLimit = PAGE_SIZE;
  let mapReady = false;

  const byId = id => document.getElementById(id);
  const numeric = (record, key) => {
    const value = record[key];
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const money = value => value == null ? "Not reported" : moneyFormat.format(value);
  const number = (value, suffix = "") => value == null ? "Not reported" : `${numberFormat.format(value)}${suffix}`;
  const analysisPrice = record => {
    const value = numeric(record, "sale_price");
    return value != null && value >= PRICE_MIN && value <= PRICE_MAX;
  };
  const median = values => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const featureStatus = value => value === "1" ? "Yes" : value === "0" ? "No" : "Not reported";
  const featureClass = value => value === "1" ? "feature-yes" : value === "0" ? "feature-no" : "feature-missing";

  function correlationAndTrend(data) {
    const xs = data.map(row => numeric(row, "miles_to_campus")).filter(value => value != null);
    const ys = data.filter(row => numeric(row, "miles_to_campus") != null).map(row => numeric(row, "sale_price"));
    if (xs.length < 2 || ys.length < 2) return null;
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let xx = 0, yy = 0, xy = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - meanX, dy = ys[i] - meanY;
      xx += dx * dx;
      yy += dy * dy;
      xy += dx * dy;
    }
    if (!xx || !yy) return null;
    return { r: xy / Math.sqrt(xx * yy), slope: xy / xx, intercept: meanY - (xy / xx) * meanX };
  }

  function colorForPrice(price) {
    const stops = [[0, [246, 224, 105]], [.43, [246, 162, 58]], [.72, [222, 77, 48]], [1, [128, 24, 43]]];
    const t = Math.max(0, Math.min(price / MAP_COLOR_MAX, 1));
    let left = stops[0], right = stops.at(-1);
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { left = stops[i]; right = stops[i + 1]; break; }
    }
    const blend = (t - left[0]) / (right[0] - left[0]);
    const rgb = left[1].map((channel, index) => Math.round(channel + (right[1][index] - channel) * blend));
    return `rgb(${rgb.join(",")})`;
  }

  function popupHTML(row) {
    const city = [row.city, row.state].filter(Boolean).join(", ");
    const bits = [
      ["Distance to campus", number(numeric(row, "miles_to_campus"), " mi")],
      ["Living area", number(numeric(row, "living_area_sqft"), " sq ft")],
      ["Bedrooms", number(numeric(row, "beds"))],
      ["Bathrooms", number(numeric(row, "baths"))],
      ["Year built", number(numeric(row, "year_built"))],
      ["Garage", featureStatus(row.has_garage)],
      ["Fireplace", featureStatus(row.has_fireplace)],
      ["Sale date", row.sale_date || "Not reported"]
    ];
    return `<div class="property-popup"><div class="popup-price">${money(numeric(row, "sale_price"))}</div><div class="popup-location">${escapeHTML(city || "Location not reported")}</div><div class="popup-grid">${bits.map(([label, value]) => `<div><span>${label}</span><b>${escapeHTML(value)}</b></div>`).join("")}</div></div>`;
  }

  function initMap() {
    if (!window.L) {
      mapElement.innerHTML = '<div class="map-message error">The map library did not load. Check your connection and reload; the charts and property filters may still work.</div>';
      return;
    }
    mapReady = true;
    mapElement.replaceChildren();
    map = L.map(mapElement, { scrollWheelZoom: false, preferCanvas: true }).setView([40.1059, -88.2272], 12);
    map.createPane("campusPane").style.zIndex = "650";
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.on("click", () => map.scrollWheelZoom.enable());
    saleLayer = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius(zoom) {
        if (zoom >= 15) return 10;
        if (zoom >= 13) return 24;
        return 48;
      },
      disableClusteringAtZoom: 20,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.35,
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount();
        const prices = cluster.getAllChildMarkers().map(marker => marker.options.salePrice).filter(Number.isFinite);
        const middlePrice = median(prices);
        const size = count < 100 ? 38 : count < 1000 ? 44 : 50;
        const label = `${numberFormat.format(count)} properties · median sale price ${money(middlePrice)}`;
        cluster.bindTooltip(`${numberFormat.format(count)} properties<br>Median sale price: ${money(middlePrice)}`, { direction: "top", className: "price-cluster-tooltip", opacity: .98 });
        const textColor = (middlePrice || 0) < 720000 ? "#382b1d" : "#fff";
        return L.divIcon({ className: "", html: `<div class="cluster-marker" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}" style="width:${size}px;height:${size}px;line-height:${size - 6}px;background:${colorForPrice(middlePrice || 0)};color:${textColor}">${numberFormat.format(count)}</div>`, iconSize: [size, size] });
      }
    });
    map.addLayer(saleLayer);
    campusLayer = L.layerGroup().addTo(map);
    overviewLayer = L.layerGroup();
    map.on("zoomend", syncMapPresentation);
  }

  function renderNeighborhoodOverview() {
    overviewLayer.clearLayers();
    const zoom = map.getZoom();
    const cellPixels = Math.max(8, OVERVIEW_BASE_CELL_PIXELS * (2 ** (zoom - 10)));
    const cells = new Map();
    market.forEach(row => {
      const lat = numeric(row, "latitude"), lon = numeric(row, "longitude"), price = numeric(row, "sale_price");
      if (lat == null || lon == null || price == null) return;
      const pixel = map.project([lat, lon], zoom);
      const column = Math.floor(pixel.x / cellPixels);
      const rowIndex = Math.floor(pixel.y / cellPixels);
      const key = `${column}:${rowIndex}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = { column, rowIndex, prices: [], count: 0 };
        cells.set(key, cell);
      }
      cell.prices.push(price);
      cell.count++;
    });
    cells.forEach(cell => {
      const middlePrice = median(cell.prices);
      const northWest = map.unproject([cell.column * cellPixels, cell.rowIndex * cellPixels], zoom);
      const southEast = map.unproject([(cell.column + 1) * cellPixels, (cell.rowIndex + 1) * cellPixels], zoom);
      const marker = L.rectangle([northWest, southEast], {
        weight: 1,
        color: "#fffdf5",
        opacity: .98,
        fillColor: colorForPrice(middlePrice || 0),
        fillOpacity: .72
      });
      marker.bindTooltip(`${numberFormat.format(cell.count)} properties<br>Median sale price: ${money(middlePrice)}`, { direction: "top", className: "price-cluster-tooltip", opacity: .98 });
      overviewLayer.addLayer(marker);
    });
  }

  function syncMapPresentation() {
    if (!mapReady) return;
    if (map.getZoom() <= OVERVIEW_MAX_ZOOM) {
      if (map.hasLayer(saleLayer)) map.removeLayer(saleLayer);
      renderNeighborhoodOverview();
      if (!map.hasLayer(overviewLayer)) map.addLayer(overviewLayer);
    } else {
      if (map.hasLayer(overviewLayer)) map.removeLayer(overviewLayer);
      if (!map.hasLayer(saleLayer)) map.addLayer(saleLayer);
    }
  }

  function updateMap() {
    if (!mapReady) return;
    saleLayer.clearLayers();
    campusLayer.clearLayers();
    const campus = references.get(currentUniversity);
    const bounds = L.latLngBounds();
    if (campus) {
      const campusIcon = L.divIcon({ className: "campus-marker-shell", html: '<span class="campus-marker" aria-label="University campus"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 29 27H3L16 3Z" fill="currentColor"/><path d="M11 13h10v9H11zM9 23h14M13 15v5m3-5v5m3-5v5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>', iconSize: [48, 58], iconAnchor: [24, 54] });
      const campusMarker = L.marker([campus.latitude, campus.longitude], { icon: campusIcon, pane: "campusPane", zIndexOffset: 10000, keyboard: true });
      campusMarker.bindPopup(`<strong>${escapeHTML(currentUniversity)}</strong><br>${escapeHTML(campus.landmark)}<br><small>Approximate reference point</small>`);
      campusLayer.addLayer(campusMarker);
      bounds.extend([campus.latitude, campus.longitude]);
    }
    market.forEach(row => {
      const lat = numeric(row, "latitude"), lon = numeric(row, "longitude"), price = numeric(row, "sale_price");
      if (lat == null || lon == null || price == null) return;
      const marker = L.circleMarker([lat, lon], { radius: 5.5, weight: 1, color: "#fffdf5", opacity: .95, fillColor: colorForPrice(price), fillOpacity: .9, salePrice: price });
      marker.bindPopup(popupHTML(row), { maxWidth: 300 });
      saleLayer.addLayer(marker);
      bounds.extend([lat, lon]);
    });
    if (bounds.isValid()) map.fitBounds(bounds.pad(.06), { maxZoom: 13, animate: false });
    syncMapPresentation();
    byId("map-record-count").textContent = `${numberFormat.format(market.length)} sales in this market`;
    byId("map-university-name").textContent = currentUniversity;
    requestAnimationFrame(() => map.invalidateSize());
  }

  function updateStats() {
    const valid = market.filter(analysisPrice);
    const prices = valid.map(row => numeric(row, "sale_price"));
    const distances = market.map(row => numeric(row, "miles_to_campus")).filter(value => value != null);
    const middlePrice = median(prices);
    const middleDistance = median(distances);
    const trend = correlationAndTrend(valid);
    byId("stat-sales").textContent = numberFormat.format(market.length);
    byId("stat-median").textContent = money(middlePrice);
    byId("stat-distance").textContent = middleDistance == null ? "Not available" : `${middleDistance.toFixed(1)} mi`;
    const belowRange = market.filter(row => numeric(row, "sale_price") != null && numeric(row, "sale_price") < PRICE_MIN).length;
    const aboveRange = market.filter(row => numeric(row, "sale_price") != null && numeric(row, "sale_price") > PRICE_MAX).length;
    byId("chart-note").textContent = `Chart and summary statistics include reported prices from ${money(PRICE_MIN)} through ${money(PRICE_MAX)}. In this market, ${numberFormat.format(belowRange)} sale${belowRange === 1 ? "" : "s"} below the range and ${numberFormat.format(aboveRange)} above it are excluded because the data description flags implausible extremes. This is a descriptive association, not evidence that distance causes price differences.`;
    if (!trend) {
      byId("stat-correlation").textContent = "Not available";
      byId("stat-correlation-note").textContent = "Not enough complete, in-range prices to compare.";
    } else {
      byId("stat-correlation").textContent = `${trend.r >= 0 ? "+" : ""}${trend.r.toFixed(2)} r`;
      const direction = trend.slope > 0 ? "higher" : trend.slope < 0 ? "lower" : "similar";
      byId("stat-correlation-note").textContent = `Prices trend ${direction} farther from campus in this unadjusted comparison.`;
    }
    renderDistanceBands(valid);
    renderScatter(valid, trend);
    return { middlePrice, middleDistance };
  }

  function renderDistanceBands(valid) {
    const bands = [
      { label: "< 1 mi", min: -Infinity, max: 1 },
      { label: "1–<3 mi", min: 1, max: 3 },
      { label: "3–<5 mi", min: 3, max: 5 },
      { label: "5+ mi", min: 5, max: Infinity }
    ].map(band => {
      const rows = valid.filter(row => {
        const d = numeric(row, "miles_to_campus");
        return d != null && d >= band.min && d < band.max;
      });
      const values = rows.map(row => numeric(row, "sale_price"));
      return { ...band, count: rows.length, value: median(values) };
    });
    const max = Math.max(1, ...bands.map(band => band.value || 0));
    byId("distance-bands").innerHTML = bands.map(band => `<div class="band-row" title="${band.count} eligible sales"><span class="band-name">${band.label}</span><div class="band-bar-track"><div class="band-bar" style="width:${band.value == null ? 0 : (band.value / max) * 100}%"></div></div><strong class="band-price">${money(band.value)}</strong><span class="band-count">${numberFormat.format(band.count)} sales</span></div>`).join("");
  }

  function renderScatter(valid, trend) {
    const svg = byId("scatterplot");
    const width = 760, height = 390;
    const margin = { top: 18, right: 20, bottom: 58, left: 68 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const maxDistance = Math.max(1, ...valid.map(row => numeric(row, "miles_to_campus") || 0));
    const xMax = Math.max(1, Math.ceil(maxDistance));
    const yMax = PRICE_MAX;
    const sx = value => margin.left + (value / xMax) * innerW;
    const sy = value => margin.top + innerH - (value / yMax) * innerH;
    const bits = [];
    for (let tick = 0; tick <= 5; tick++) {
      const value = yMax * tick / 5;
      const y = sy(value);
      bits.push(`<line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"/>`);
      bits.push(`<text class="chart-tick" x="${margin.left - 9}" y="${y + 4}" text-anchor="end">${value === 0 ? "$0" : `$${value / 1000000}m`}</text>`);
    }
    const xTicks = Math.min(8, xMax);
    for (let tick = 0; tick <= xTicks; tick++) {
      const value = xMax * tick / xTicks;
      const x = sx(value);
      bits.push(`<line class="chart-grid" x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + innerH}"/>`);
      bits.push(`<text class="chart-tick" x="${x}" y="${margin.top + innerH + 20}" text-anchor="middle">${value.toFixed(value % 1 ? 1 : 0)}</text>`);
    }
    bits.push(`<line class="chart-axis" x1="${margin.left}" y1="${margin.top + innerH}" x2="${width - margin.right}" y2="${margin.top + innerH}"/>`);
    bits.push(`<line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerH}"/>`);
    bits.push(`<text class="chart-axis-title" x="${margin.left + innerW / 2}" y="${height - 10}" text-anchor="middle">Distance to campus (miles)</text>`);
    bits.push(`<text class="chart-axis-title" transform="translate(17 ${margin.top + innerH / 2}) rotate(-90)" text-anchor="middle">Reported sale price ($)</text>`);
    valid.forEach(row => {
      const distance = numeric(row, "miles_to_campus"), price = numeric(row, "sale_price");
      if (distance == null || price == null) return;
      const label = `${money(price)} · ${distance.toFixed(1)} miles · ${row.city}, ${row.state} · ${number(numeric(row, "living_area_sqft"), " sq ft")}`;
      bits.push(`<circle class="scatter-dot" cx="${sx(distance).toFixed(2)}" cy="${sy(price).toFixed(2)}" r="2.15"><title>${escapeHTML(label)}</title></circle>`);
    });
    if (trend) {
      const y0 = trend.intercept + trend.slope * 0;
      const y1 = trend.intercept + trend.slope * xMax;
      const startPrice = Math.max(0, Math.min(yMax, y0));
      const endPrice = Math.max(0, Math.min(yMax, y1));
      bits.push(`<line class="trend-line" x1="${sx(0)}" y1="${sy(startPrice)}" x2="${sx(xMax)}" y2="${sy(endPrice)}"><title>Ordinary least-squares trendline</title></line>`);
    }
    svg.innerHTML = bits.join("");
    const summary = trend
      ? `Showing ${numberFormat.format(valid.length)} sales. Pearson correlation r = ${trend.r.toFixed(2)}; the fitted straight-line trend is ${trend.slope >= 0 ? "up" : "down"} by about ${money(Math.abs(trend.slope))} per mile. This does not adjust for home size, age, or neighborhood.`
      : "Not enough valid sales to calculate a distance and price association.";
    byId("scatter-summary").textContent = summary;
  }

  function readFilter(id) {
    const raw = byId(id).value.trim();
    return raw === "" ? null : Number(raw);
  }

  function applyExplorerFilter(row) {
    const checks = [
      ["filter-price-min", "sale_price", "min"], ["filter-price-max", "sale_price", "max"],
      ["filter-distance-min", "miles_to_campus", "min"], ["filter-distance-max", "miles_to_campus", "max"],
      ["filter-area-min", "living_area_sqft", "min"], ["filter-area-max", "living_area_sqft", "max"],
      ["filter-beds-min", "beds", "min"], ["filter-beds-max", "beds", "max"],
      ["filter-baths-min", "baths", "min"], ["filter-baths-max", "baths", "max"],
      ["filter-year-min", "year_built", "min"], ["filter-year-max", "year_built", "max"]
    ];
    for (const [inputId, field, bound] of checks) {
      const limit = readFilter(inputId);
      if (limit == null) continue;
      const value = numeric(row, field);
      if (value == null || (bound === "min" ? value < limit : value > limit)) return false;
    }
    for (const [id, field] of [["filter-garage", "has_garage"], ["filter-fireplace", "has_fireplace"]]) {
      const selected = byId(id).value;
      const actual = row[field] === "" ? "missing" : row[field];
      if (selected !== "any" && actual !== selected) return false;
    }
    return true;
  }

  function sortRows(rows) {
    const key = byId("sort-results").value;
    const [field, direction] = key.startsWith("distance") ? ["miles_to_campus", key.endsWith("desc") ? -1 : 1] : ["sale_price", key.endsWith("desc") ? -1 : 1];
    return rows.sort((a, b) => direction * ((numeric(a, field) ?? -Infinity) - (numeric(b, field) ?? -Infinity)));
  }

  function renderExplorer() {
    const filtered = sortRows(market.filter(applyExplorerFilter));
    const visible = filtered.slice(0, visibleLimit);
    const body = byId("property-rows");
    if (!visible.length) {
      body.innerHTML = '<tr><td colspan="9" class="empty-state">No sales match these filters. Try widening a range.</td></tr>';
    } else {
      body.innerHTML = visible.map(row => `<tr><td class="price-cell">${money(numeric(row, "sale_price"))}</td><td>${number(numeric(row, "miles_to_campus"), " mi")}</td><td class="city-cell">${escapeHTML([row.city, row.state].filter(Boolean).join(", "))}</td><td>${number(numeric(row, "living_area_sqft"), " sq ft")}</td><td>${number(numeric(row, "beds"))}</td><td>${number(numeric(row, "baths"))}</td><td>${number(numeric(row, "year_built"))}</td><td class="${featureClass(row.has_garage)}">${featureStatus(row.has_garage)}</td><td class="${featureClass(row.has_fireplace)}">${featureStatus(row.has_fireplace)}</td></tr>`).join("");
    }
    byId("results-count").textContent = `Showing ${numberFormat.format(visible.length)} of ${numberFormat.format(filtered.length)} matching sales`;
    byId("load-more").hidden = filtered.length <= visible.length;
    const selectedPrices = filtered.map(row => numeric(row, "sale_price")).filter(value => value != null);
    const eligiblePrices = market.filter(analysisPrice).map(row => numeric(row, "sale_price"));
    const selectedMedian = median(selectedPrices);
    const marketMedian = median(eligiblePrices);
    byId("results-comparison").textContent = selectedMedian == null ? "No reported prices for this selection." : `Filtered match median ${money(selectedMedian)} · eligible market median ${money(marketMedian)}`;
  }

  function onUniversityChange() {
    currentUniversity = universitySelect.value;
    market = records.filter(row => row.university === currentUniversity);
    visibleLimit = PAGE_SIZE;
    updateMap();
    const stats = updateStats();
    byId("find-far-expensive").disabled = stats.middlePrice == null || stats.middleDistance == null;
    renderExplorer();
  }

  function initialize() {
    if (!window.Papa) {
      mapElement.innerHTML = '<div class="map-message error">The CSV reader did not load. Check your connection and reload this page.</div>';
      byId("results-count").textContent = "Dataset unavailable";
      return;
    }
    Promise.all([
      fetch("data/college_town_home_sales.csv").then(response => { if (!response.ok) throw new Error(`CSV request failed (${response.status})`); return response.text(); }),
      fetch("data/campus_references.json").then(response => { if (!response.ok) throw new Error(`Campus reference request failed (${response.status})`); return response.json(); })
    ]).then(([csvText, campusData]) => {
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, dynamicTyping: false });
      records = parsed.data.filter(row => row.listing_id && row.university);
      references = new Map(campusData.landmarks.map(item => [item.university, item]));
      const universities = [...new Set(records.map(row => row.university))].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
      if (universities.length !== campusData.landmarks.length || universities.some(value => !references.has(value))) {
        throw new Error("The campus reference list does not match the university names in the CSV.");
      }
      universitySelect.innerHTML = universities.map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join("");
      if (universities.includes("University of Illinois Urbana-Champaign")) universitySelect.value = "University of Illinois Urbana-Champaign";
      universitySelect.disabled = false;
      initMap();
      universitySelect.addEventListener("change", onUniversityChange);
      const filterInputs = document.querySelectorAll("#explorer-heading ~ .filter-grid input, #explorer-heading ~ .filter-grid select, .filter-grid input, .filter-grid select, #sort-results");
      filterInputs.forEach(input => {
        input.addEventListener("input", () => { visibleLimit = PAGE_SIZE; renderExplorer(); });
        input.addEventListener("change", () => { visibleLimit = PAGE_SIZE; renderExplorer(); });
      });
      byId("reset-filters").addEventListener("click", () => {
        document.querySelectorAll(".filter-grid input").forEach(input => { input.value = ""; });
        byId("filter-price-min").value = String(PRICE_MIN);
        byId("filter-price-max").value = String(PRICE_MAX);
        byId("filter-garage").value = "any";
        byId("filter-fireplace").value = "any";
        byId("sort-results").value = "price-desc";
        visibleLimit = PAGE_SIZE;
        renderExplorer();
      });
      byId("load-more").addEventListener("click", () => { visibleLimit += PAGE_SIZE; renderExplorer(); });
      byId("find-far-expensive").addEventListener("click", () => {
        const prices = market.filter(analysisPrice).map(row => numeric(row, "sale_price"));
        const distances = market.map(row => numeric(row, "miles_to_campus")).filter(value => value != null);
        byId("filter-price-min").value = String(median(prices));
        byId("filter-distance-min").value = median(distances).toFixed(1);
        byId("sort-results").value = "price-desc";
        visibleLimit = PAGE_SIZE;
        renderExplorer();
        byId("explorer-heading").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      onUniversityChange();
    }).catch(error => {
      console.error("Campus Housing Explorer could not initialize:", error);
      mapElement.innerHTML = `<div class="map-message error">The dataset could not be loaded: ${escapeHTML(error.message)}. Confirm the page is hosted with the repository's data directory and reload.</div>`;
      byId("results-count").textContent = "Dataset unavailable";
      byId("stat-sales").textContent = "—";
    });
  }

  initialize();
})();
