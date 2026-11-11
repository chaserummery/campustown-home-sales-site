#!/usr/bin/env python3
"""Reconstruct approximate campus reference coordinates from the published CSV."""

import csv
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "college_town_home_sales.csv"
DESTINATION = ROOT / "data" / "campus_references.json"
EARTH_RADIUS_MILES = 3958.7613
LANDMARKS = {
    "University of California, Davis": "Shields Library / UC Davis Quad",
    "University of Florida": "Century Tower",
    "University of Georgia": "Georgia campus reference point",
    "The University of Iowa": "Old Capitol",
    "University of Illinois Urbana-Champaign": "Foellinger Auditorium / Illinois Main Quad",
    "Purdue University": "Engineering Fountain",
    "University of Michigan": "The Diag",
    "The University of North Carolina at Chapel Hill": "Old Well",
    "The Pennsylvania State University": "Penn State campus reference point",
    "University of Virginia": "Virginia campus reference point",
    "University of Wisconsin-Madison": "Bascom Hill",
}


def haversine_miles(latitudes, longitudes, point):
    lat0, lon0 = math.radians(point[0]), math.radians(point[1])
    distances = []
    for lat, lon in zip(latitudes, longitudes):
        lat1, lon1 = math.radians(lat), math.radians(lon)
        dlat, dlon = lat1 - lat0, lon1 - lon0
        a = math.sin(dlat / 2) ** 2 + math.cos(lat0) * math.cos(lat1) * math.sin(dlon / 2) ** 2
        distances.append(2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(min(1.0, a))))
    return distances


def solve_two_by_two(a00, a01, a11, b0, b1):
    determinant = a00 * a11 - a01 * a01
    if abs(determinant) < 1e-16:
        raise ValueError("Could not uniquely infer a campus reference point")
    return ((b0 * a11 - b1 * a01) / determinant,
            (a00 * b1 - a01 * b0) / determinant)


def infer_reference(rows):
    latitudes = [float(row["latitude"]) for row in rows]
    longitudes = [float(row["longitude"]) for row in rows]
    reported = [float(row["miles_to_campus"]) for row in rows]

    # Seed near the densest part of the market, then fit distances across all sales.
    weights = [1 / (distance + 0.5) for distance in reported]
    weight_sum = sum(weights)
    point = [sum(v * w for v, w in zip(latitudes, weights)) / weight_sum,
             sum(v * w for v, w in zip(longitudes, weights)) / weight_sum]

    for _ in range(40):
        predicted = haversine_miles(latitudes, longitudes, point)
        residuals = [actual - wanted for actual, wanted in zip(predicted, reported)]
        step = 1e-5
        lat_plus = haversine_miles(latitudes, longitudes, [point[0] + step, point[1]])
        lat_minus = haversine_miles(latitudes, longitudes, [point[0] - step, point[1]])
        lon_plus = haversine_miles(latitudes, longitudes, [point[0], point[1] + step])
        lon_minus = haversine_miles(latitudes, longitudes, [point[0], point[1] - step])
        j0 = [(p - m) / (2 * step) for p, m in zip(lat_plus, lat_minus)]
        j1 = [(p - m) / (2 * step) for p, m in zip(lon_plus, lon_minus)]
        a00 = sum(a * a for a in j0)
        a01 = sum(a * b for a, b in zip(j0, j1))
        a11 = sum(b * b for b in j1)
        b0 = -sum(a * r for a, r in zip(j0, residuals))
        b1 = -sum(b * r for b, r in zip(j1, residuals))
        delta = solve_two_by_two(a00, a01, a11, b0, b1)
        point[0] += delta[0]
        point[1] += delta[1]
        if math.hypot(*delta) < 1e-10:
            break

    errors = [abs(p - r) for p, r in zip(haversine_miles(latitudes, longitudes, point), reported)]
    return {
        "latitude": round(point[0], 6),
        "longitude": round(point[1], 6),
        "sales_used": len(rows),
        "median_distance_fit_error_miles": round(sorted(errors)[len(errors) // 2], 4),
    }


def main():
    grouped = defaultdict(list)
    with SOURCE.open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            if row["latitude"] and row["longitude"] and row["miles_to_campus"]:
                grouped[row["university"]].append(row)

    unknown = set(grouped) - set(LANDMARKS)
    missing = set(LANDMARKS) - set(grouped)
    if unknown or missing:
        raise ValueError(f"University labels changed: unexpected={sorted(unknown)}, missing={sorted(missing)}")

    result = {
        "method": "Approximate reference coordinates fitted from property coordinates and miles_to_campus, which is rounded to one decimal mile.",
        "landmarks": [
            {"university": university, "landmark": landmark, **infer_reference(grouped[university])}
            for university, landmark in LANDMARKS.items()
        ],
    }
    DESTINATION.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(result['landmarks'])} approximate campus reference points to {DESTINATION.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
