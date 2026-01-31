import json
import math
import random

# Load Ernakulam polygon
with open('static/ernakulam_boundary.geojson', 'r', encoding='utf-8') as f:
    gj = json.load(f)

poly = gj['features'][0]['geometry']['coordinates'][0]

# Bounding box
lons = [p[0] for p in poly]
lats = [p[1] for p in poly]
min_lon, max_lon = min(lons), max(lons)
min_lat, max_lat = min(lats), max(lats)

# Ray-casting point-in-polygon
def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-16) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside

# Grid spacing (degrees). ~0.005 degrees ~ ~500m (approx)
spacing = 0.005

def frange(start, stop, step):
    vals = []
    v = start
    # ensure inclusive of stop
    while v <= stop:
        vals.append(round(v, 6))
        v += step
    return vals

points = []
for lat in frange(min_lat, max_lat, spacing):
    for lon in frange(min_lon, max_lon, spacing):
        if point_in_poly(lon, lat, poly):
            points.append((lat, lon))

print(f"Generated {len(points)} candidate grid points inside bounding box; {len(points)} points inside polygon (approx).")

# Centroid for hotspot weighting
centroid_lat = sum([p[1] for p in poly]) / len(poly)
centroid_lon = sum([p[0] for p in poly]) / len(poly)

# Normalized distance to centroid -> intensity contribution

def intensity_for_point(lat, lon, base=0.35, scale=0.6, jitter=0.12):
    # great-circle-ish simple euclidean over small area
    d = math.sqrt((lat - centroid_lat)**2 + (lon - centroid_lon)**2)
    # Estimate max distance as diagonal of bbox
    maxd = math.sqrt((max_lat - min_lat)**2 + (max_lon - min_lon)**2)
    norm = d / (maxd + 1e-9)
    # invert so center is hotter
    val = base + scale * (1 - norm) + (random.random() - 0.5) * jitter
    return max(0.03, min(0.98, round(val, 3)))

# Build morning and afternoon arrays
morning = []
afternoon = []

for (lat, lon) in points:
    # morning cooler (lower base)
    m_int = intensity_for_point(lat, lon, base=0.2, scale=0.5, jitter=0.15)
    a_int = intensity_for_point(lat, lon, base=0.35, scale=0.6, jitter=0.18)
    morning.append([round(lat,6), round(lon,6), m_int])
    afternoon.append([round(lat,6), round(lon,6), a_int])

# Save files
with open('static/temperature_morning_dense.json', 'w', encoding='utf-8') as f:
    json.dump(morning, f)

with open('static/temperature_afternoon_dense.json', 'w', encoding='utf-8') as f:
    json.dump(afternoon, f)

print('Wrote static/temperature_morning_dense.json and static/temperature_afternoon_dense.json')
print('Sample points:')
print(morning[:5])
print(afternoon[:5])