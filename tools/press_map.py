# Satellite map of Ukraine for the Press page: Ukraine lit, its neighbours dimmed, the occupied
# territories tinted and the front line drawn along their edge. Labels (Soledar, Kyiv) are HTML on
# top of the picture, so they switch language with the page; the script writes their positions and
# the date of the DeepStateMap snapshot into site/presa.html.
#
#   python -I tools/press_map.py [cache_dir]
#
# The Pages workflow runs this every day with an empty cache before publishing, so the published
# map follows DeepStateMap; the copy in the repository is only the fallback when that run fails.
#
# Sources (downloaded into cache_dir, default tools/.map-cache, reused when present):
#   imagery   NASA Blue Marble Next Generation via NASA GIBS (public domain)
#   borders   Natural Earth 10m admin 0, Ukraine's point of view (Crimea is Ukraine)
#   occupied  DeepStateMap, the latest snapshot (its date goes into the caption) - delete
#             cache_dir/deepstate.json to fetch a fresh one
# After changing the extent or size, delete cache_dir/imagery.jpg too (it is cut to the extent).
import datetime, json, os, re, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "site", "img", "press", "map-ukraine.webp")
PAGE = os.path.join(HERE, "..", "site", "presa.html")
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, ".map-cache")

LON0, LON1, LAT0, LAT1 = 20.4, 42.0, 43.4, 53.2     # map extent: room around Ukraine for the page to fade the edges into
COS = np.cos(np.radians(48.3))                       # equirectangular, true to scale around 48.3° N
SS = 2                                               # supersampling for the vector layers
W = 1400                                             # output width, px
H = round(W * (LAT1 - LAT0) / ((LON1 - LON0) * COS))

PLACES = {"soledar": (38.088, 48.684), "kyiv": (30.523, 50.450)}

URLS = {
    "imagery.jpg": "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap"
                   "&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&CRS=EPSG:4326"
                   f"&BBOX={LAT0},{LON0},{LAT1},{LON1}&WIDTH={W * SS}&HEIGHT={H * SS}&FORMAT=image/jpeg",
    "borders.geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
                       "ne_10m_admin_0_countries_ukr.geojson",
    "deepstate.json": "https://deepstatemap.live/api/history/last",
}

def fetch(name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        req = urllib.request.Request(URLS[name], headers={"User-Agent": "vrsoledar.com map build"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
        print("downloaded", name)
    return path

def xy(lon, lat, scale=SS):
    return ((lon - LON0) / (LON1 - LON0) * W * scale, (LAT1 - lat) / (LAT1 - LAT0) * H * scale)

def rings(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poly in polys:
        yield [xy(*p[:2]) for p in poly[0]], [[xy(*p[:2]) for p in hole] for hole in poly[1:]]

def mask(geoms):
    m = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(m)
    for g in geoms:
        for outer, holes in rings(g):
            d.polygon(outer, fill=255)
            for h in holes:
                d.polygon(h, fill=0)
    return m

# --- data -------------------------------------------------------------------------------
img = Image.open(fetch("imagery.jpg")).convert("RGB").resize((W * SS, H * SS), Image.LANCZOS)
borders = json.load(open(fetch("borders.geojson"), encoding="utf-8"))
ukraine = [f["geometry"] for f in borders["features"] if f["properties"]["ADM0_A3"] == "UKR"]
ds = json.load(open(fetch("deepstate.json"), encoding="utf-8"))
OCCUPIED = ("geoJSON.status.occupied", "geoJSON.territories.crimea", "geoJSON.territories.ordlo",
            "geoJSON.territories.tuzla")
occupied = [f["geometry"] for f in ds["map"]["features"]
            if f["geometry"]["type"] in ("Polygon", "MultiPolygon")
            and any(k in f["properties"].get("name", "") for k in OCCUPIED)]

ua = np.asarray(mask(ukraine), dtype=np.float32) / 255
occ = np.asarray(mask(occupied), dtype=np.float32) / 255 * ua      # only what lies inside Ukraine

# --- imagery: darker overall to sit on the site's near-black, neighbours dimmed and greyed --------
a = np.asarray(img, dtype=np.float32) / 255
grey = a.mean(axis=2, keepdims=True)
outside = (grey * .55 + a * .45) * .38
inside = a * .78
uak = ua[..., None]
a = outside * (1 - uak) + inside * uak

# occupied: a light warm red tint over the imagery plus thin diagonal hatching
RED = np.array([0.93, 0.27, 0.16])
yy, xx = np.mgrid[0:H * SS, 0:W * SS]
hatch = (((xx + yy) // SS) % 11 < 1.5).astype(np.float32)
ok = (occ * (.24 + .34 * hatch))[..., None]
a = a * (1 - ok) + RED * ok

# --- lines ------------------------------------------------------------------------------
def edge(m, px):
    im = Image.fromarray((m * 255).astype(np.uint8))
    grown = np.asarray(im.filter(ImageFilter.MaxFilter(px)), dtype=np.float32) / 255
    return np.clip(grown - m, 0, 1)

# Ukraine's border and coast: a thin light line just outside the country
border = edge(ua, 3) * .55
a = a * (1 - border[..., None]) + np.array([0.96, 0.93, 0.87]) * border[..., None]
# front line: where the occupied area meets free Ukrainian land
free = ua * (1 - occ)
front = np.clip(edge(occ, 7) * free * 1.6, 0, 1)
front = np.asarray(Image.fromarray((front * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6)),
                   dtype=np.float32)[..., None] / 255
a = a * (1 - front) + np.array([1.0, 0.42, 0.24]) * front

out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.save(OUT, quality=80, method=6)
print("map", out.size, os.path.getsize(OUT) // 1024, "KB ->", os.path.relpath(OUT))

# --- the page: snapshot date in the caption, pin positions ------------------------------------
# DeepStateMap gives "21.10 o 22:56" (Kyiv time, no year) and a Unix timestamp "id": day and month
# come from the first, the year from the second.
stamp = datetime.datetime.fromtimestamp(ds["id"], datetime.timezone.utc)
m = re.match(r"\s*(\d{1,2})\.(\d{1,2})", ds.get("datetime", ""))
day, month = (int(m.group(1)), int(m.group(2))) if m else (stamp.day, stamp.month)
year = stamp.year - 1 if (month, stamp.month) == (12, 1) else stamp.year     # snapshot late on 31 Dec
date = f"{day:02}.{month:02}.{year}"
print("occupied snapshot:", date, f"({ds.get('datetime')})")

html = open(PAGE, encoding="utf-8").read()
html, n = re.subn(r"(Станом на |As of )\d{2}\.\d{2}\.\d{4}", lambda mt: mt.group(1) + date, html)
assert n == 2, "caption date not found in presa.html"
for name, (lon, lat) in PLACES.items():
    x, y = xy(lon, lat, 1)
    html, n = re.subn(r'(data-place="%s" style=")[^"]*"' % name,
                      lambda mt: mt.group(1) + f'left:{x / W * 100:.2f}%; top:{y / H * 100:.2f}%"', html)
    assert n == 1, f"pin {name} not found in presa.html"
open(PAGE, "w", encoding="utf-8", newline="").write(html)
print("presa.html: caption date and pins written")
