"""Projects a country from a Natural Earth GeoJSON (public domain) into a
preset's map: the projection, the canvas size, a simplified `outline` and a
full-resolution `detail` path, ready to paste into preset.json → "map".

Usage:
  python scripts/make-map-outline.py <countries.geojson> "<ADMIN name>" [--scale 60] [--pad 6] [--x-scale auto]
      [--surround "Russia,Turkey,Armenia,Azerbaijan" --margin 1.5]

Get the data from https://github.com/nvkelso/natural-earth-vector
(geojson/ne_10m_admin_0_countries.geojson). --x-scale auto uses the cosine
of the country's middle latitude so it isn't stretched sideways. --surround
adds `surroundings`: neighbouring land clipped to the frame plus --margin
degrees, so a landlocked border doesn't read as coastline on the map.
"""
import argparse
import json
import math


def simplify(points, tolerance):
    """Douglas–Peucker on a closed ring: split at the point farthest from the start, simplify both halves."""
    if len(points) < 4:
        return points
    x0, y0 = points[0]
    far = max(range(len(points)), key=lambda i: math.hypot(points[i][0] - x0, points[i][1] - y0))
    return simplify_line(points[: far + 1], tolerance) + simplify_line(points[far:], tolerance)[1:]


def simplify_line(points, tolerance):
    """Douglas–Peucker on an open line of (x, y) points."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy) or 1e-9
        best, index = 0.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / length
            if d > best:
                best, index = d, i
        if best > tolerance and index > 0:
            keep[index] = True
            stack += [(a, index), (index, b)]
    return [p for p, k in zip(points, keep) if k]


def clip(ring, x0, y0, x1, y1):
    """Sutherland–Hodgman: a lng/lat ring clipped to a rectangle."""
    def cut(points, inside, cross):
        out = []
        for i, p in enumerate(points):
            q = points[i - 1]
            if inside(p):
                if not inside(q):
                    out.append(cross(q, p))
                out.append(p)
            elif inside(q):
                out.append(cross(q, p))
        return out

    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)

    pts = [tuple(p[:2]) for p in ring]
    for inside, cross in (
        (lambda p: p[0] >= x0, at_x(x0)),
        (lambda p: p[0] <= x1, at_x(x1)),
        (lambda p: p[1] >= y0, at_y(y0)),
        (lambda p: p[1] <= y1, at_y(y1)),
    ):
        if not pts:
            break
        pts = cut(pts, inside, cross)
    return pts


def path(ring, digits):
    fmt = f"{{:.{digits}f}}"
    return "M" + "L".join(f"{fmt.format(x)} {fmt.format(y)}" for x, y in ring) + "Z"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("geojson")
    ap.add_argument("admin")
    ap.add_argument("--scale", type=float, default=60)
    ap.add_argument("--pad", type=float, default=6)
    ap.add_argument("--x-scale", default="auto")
    ap.add_argument("--min-area", type=float, default=4.0, help="drop islands smaller than this (px²)")
    ap.add_argument("--surround", default="", help="comma-separated ADMIN names of neighbours")
    ap.add_argument("--margin", type=float, default=1.5, help="degrees of neighbouring land around the country")
    args = ap.parse_args()

    with open(args.geojson, encoding="utf-8") as f:
        data = json.load(f)
    feature = next(f for f in data["features"] if f["properties"]["ADMIN"] == args.admin)
    geom = feature["geometry"]
    polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    rings = [poly[0] for poly in polygons]  # outer rings only

    lngs = [p[0] for r in rings for p in r]
    lats = [p[1] for r in rings for p in r]
    min_lng, max_lng, min_lat, max_lat = min(lngs), max(lngs), min(lats), max(lats)
    x_scale = math.cos(math.radians((min_lat + max_lat) / 2)) if args.x_scale == "auto" else float(args.x_scale)
    s, pad = args.scale, args.pad

    def project(p):
        return ((p[0] - min_lng) * s * x_scale + pad, (max_lat - p[1]) * s + pad)

    def area(ring):
        return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))) / 2

    projected = [[project(p) for p in r] for r in rings]
    projected = [r for r in projected if area(r) >= args.min_area]
    projected.sort(key=area, reverse=True)

    out = {
        "projection": {"minLng": round(min_lng, 4), "maxLat": round(max_lat, 4), "scale": s, "pad": pad, "xScale": round(x_scale, 4)},
        "width": math.ceil((max_lng - min_lng) * s * x_scale + 2 * pad),
        "height": math.ceil((max_lat - min_lat) * s + 2 * pad),
        "outline": [path(simplify(r, 0.45), 1) for r in projected],
        "detail": "".join(path(simplify(r, 0.06), 2) for r in projected),
    }
    if args.surround:
        names = [n.strip() for n in args.surround.split(",") if n.strip()]
        box = (min_lng - args.margin, min_lat - args.margin, max_lng + args.margin, max_lat + args.margin)
        parts = []
        for f in data["features"]:
            if f["properties"]["ADMIN"] not in names:
                continue
            g = f["geometry"]
            for poly in g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]:
                ring = clip(poly[0], *box)
                if len(ring) >= 3:
                    pr = [project(p) for p in ring]
                    if area(pr) >= args.min_area:
                        parts.append(path(simplify(pr, 0.3), 1))
        out["surroundings"] = "".join(parts)

    print(json.dumps(out))


if __name__ == "__main__":
    main()
