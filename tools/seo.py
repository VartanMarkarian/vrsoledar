# Search / share metadata for the site: <head> tags, JSON-LD, robots.txt and sitemap.xml.
#
#   python tools/seo.py                          # without a public address (no canonical / sitemap yet)
#   python tools/seo.py https://example.org/     # once the site has its address: canonical, og:url,
#                                                # absolute image links and sitemap.xml are filled in
# Re-run after changing titles or descriptions; it rewrites the block between <!-- seo --> and <!-- /seo -->.
import json, re, sys, datetime, os

SITE = os.path.join(os.path.dirname(__file__), "..", "site")
BASE = (sys.argv[1].rstrip("/") + "/") if len(sys.argv) > 1 else ""

AUTHOR = {"@type": "Person", "name": "Роксолана Дудка", "alternateName": "Roksolana Dudka"}
NAME = "ВІДДЗЕРКАЛЕННЯ / REFRACTION"

PAGES = {
    "index.html": dict(
        title="ВІДДЗЕРКАЛЕННЯ / REFRACTION — VR-проєкт про пам'ять Соледара",
        desc="«Віддзеркалення» (REFRACTION) — VR-проєкт Роксолани Дудки про пам'ять Соледара: "
             "підземні соляні шахти, архіви та спогади людей. Meta Quest, 28 хвилин.",
        og_type="website", priority="1.0"),
    "istoriya.html": dict(
        title="Історія — ВІДДЗЕРКАЛЕННЯ / REFRACTION",
        desc="Особиста історія авторки проєкту «Віддзеркалення» Роксолани Дудки — від резиденції "
             "«Заземлення» в Соледарі 2021 року до VR-досвіду. З фотографіями експедиції.",
        og_type="article", priority="0.8"),
    "ekskursiya.html": dict(
        title="Екскурсія — ВІДДЗЕРКАЛЕННЯ / REFRACTION",
        desc="Екскурсія VR-простором «Віддзеркалення»: 39 об'єктів — соляні шахти, гіпсові печери, "
             "архіви й спогади мешканців Соледара — з кадрами та описами.",
        og_type="article", priority="0.8"),
    "ar-obyekty.html": dict(
        title="AR-об'єкти — ВІДДЗЕРКАЛЕННЯ / REFRACTION",
        desc="AR-об'єкти «Віддзеркалення»: гном, черепаха і «Релікт» — 3D-моделі з VR-простору про "
             "Соледар, які можна поставити у своїй кімнаті через камеру телефона.",
        og_type="article", priority="0.7"),
    "presa.html": dict(
        title="Преса — ВІДДЗЕРКАЛЕННЯ / REFRACTION",
        desc="Матеріали для преси про VR-проєкт «Віддзеркалення» (REFRACTION): контакт для преси "
             "та прескіт у PDF українською й англійською.",
        og_type="article", priority="0.6"),
}

def url(path=""):
    return BASE + path if BASE else None

def strip_tags(t):
    return re.sub(r"<[^>]+>", "", t).replace("&nbsp;", " ").strip()

def json_ld(page, html):
    img = url("img/og-ua.jpg") or "img/og-ua.jpg"
    soledar = {"@type": "Place", "name": "Соледар", "alternateName": "Soledar",
               "address": {"@type": "PostalAddress", "addressRegion": "Донецька область", "addressCountry": "UA"}}
    if page == "index.html":
        work = {
            "@type": "CreativeWork", "name": "Віддзеркалення", "alternateName": "Refraction",
            "description": PAGES[page]["desc"], "genre": "VR experience", "inLanguage": ["uk", "en"],
            "creator": AUTHOR, "dateCreated": "2025", "timeRequired": "PT28M", "image": img,
            "about": soledar, "keywords": "Соледар, VR, віртуальна реальність, пам'ять, соляні шахти, Артемсіль, Soledar, virtual reality, memory",
            "contributor": [
                {"@type": "Person", "name": "Вартан Маркар'ян", "alternateName": "Vartan Markarian", "jobTitle": "Арт-директор"},
                {"@type": "Person", "name": "Олексій Попов", "alternateName": "Oleksii Popov", "jobTitle": "VR-розробка"},
                {"@type": "Person", "name": "Анна Тищук", "alternateName": "Anna Tyshchuk", "jobTitle": "Голос пам'яті"},
            ],
            "funder": {"@type": "Organization", "name": "Partnership Fund for a Resilient Ukraine (PFRU)"},
        }
        site = {"@type": "WebSite", "name": NAME, "inLanguage": ["uk", "en"]}
        if BASE:
            work["url"] = url(); site["url"] = url()
        return [site, work]
    if page == "istoriya.html":
        art = {"@type": "Article", "headline": "Від першої зустрічі до «Віддзеркалення»",
               "description": PAGES[page]["desc"], "author": AUTHOR, "inLanguage": "uk", "image": img,
               "about": soledar}
        if BASE:
            art["mainEntityOfPage"] = url(page)
        return [art]
    if page == "ekskursiya.html":
        names = [strip_tags(t) for t in re.findall(r'<h3 data-lang="ua">(.*?)</h3>', html)]
        return [{"@type": "ItemList", "name": "Екскурсія «Віддзеркалення»", "numberOfItems": len(names),
                 "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n} for i, n in enumerate(names)]}]
    if page == "ar-obyekty.html":
        items = []
        for mid, name in re.findall(r'<article class="ar-item" id="(\w+)">.*?<h2 data-lang="ua">(.*?)</h2>', html, flags=re.S):
            m = {"@type": "3DModel", "name": strip_tags(name), "creator": AUTHOR,
                 "image": url("img/ar/%s.webp" % mid) or "img/ar/%s.webp" % mid,
                 "encoding": [{"@type": "MediaObject", "encodingFormat": "model/gltf-binary"},
                              {"@type": "MediaObject", "encodingFormat": "model/vnd.usdz+zip"}]}
            if BASE:
                m["encoding"][0]["contentUrl"] = url("ar/%s.glb" % mid)
                m["encoding"][1]["contentUrl"] = url("ar/%s.usdz" % mid)
            items.append(m)
        return [{"@type": "ItemList", "name": "AR-об'єкти «Віддзеркалення»", "numberOfItems": len(items),
                 "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": m} for i, m in enumerate(items)]}]
    if page == "presa.html":
        kits = []
        for lang, name in (("ua", "Прескіт «Віддзеркалення»"), ("en", "Refraction — press kit")):
            kit = {"@type": "DigitalDocument", "name": name, "encodingFormat": "application/pdf",
                   "inLanguage": "uk" if lang == "ua" else "en", "author": AUTHOR}
            if BASE:
                kit["url"] = url("press/refraction-presskit-%s.pdf" % lang)
            kits.append(kit)
        return kits
    return []

def esc(t):
    return t.replace("&", "&amp;").replace('"', "&quot;")

def head_block(page, html):
    p = PAGES[page]
    img = url("img/og-ua.jpg") or "img/og-ua.jpg"
    tags = [
        '<meta name="description" content="%s" />' % esc(p["desc"]),
        '<meta name="robots" content="index, follow, max-image-preview:large" />',
        '<meta name="author" content="Роксолана Дудка" />',
        '<meta name="theme-color" content="#07070a" />',
        '<link rel="icon" href="img/favicon.svg" type="image/svg+xml" />',
    ]
    if BASE:
        tags.append('<link rel="canonical" href="%s" />' % (url("") if page == "index.html" else url(page)))
    tags += [
        '<meta property="og:type" content="%s" />' % p["og_type"],
        '<meta property="og:site_name" content="%s" />' % NAME,
        '<meta property="og:title" content="%s" />' % esc(p["title"]),
        '<meta property="og:description" content="%s" />' % esc(p["desc"]),
        '<meta property="og:locale" content="uk_UA" />',
        '<meta property="og:locale:alternate" content="en_GB" />',
        '<meta property="og:image" content="%s" />' % img,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta property="og:image:alt" content="ВІДДЗЕРКАЛЕННЯ — VR-проєкт про пам\'ять Соледара" />',
    ]
    if BASE:
        tags.append('<meta property="og:url" content="%s" />' % (url("") if page == "index.html" else url(page)))
    tags += [
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:title" content="%s" />' % esc(p["title"]),
        '<meta name="twitter:description" content="%s" />' % esc(p["desc"]),
        '<meta name="twitter:image" content="%s" />' % img,
    ]
    ld = {"@context": "https://schema.org", "@graph": json_ld(page, html)}
    tags.append('<script type="application/ld+json">\n%s\n</script>' % json.dumps(ld, ensure_ascii=False, indent=1))
    return "<!-- seo -->\n" + "\n".join(tags) + "\n<!-- /seo -->"

for page, p in PAGES.items():
    path = os.path.join(SITE, page)
    html = open(path, encoding="utf-8").read()
    html = re.sub(r"<title>.*?</title>", "<title>%s</title>" % p["title"], html, count=1)
    block = head_block(page, html)
    if "<!-- seo -->" in html:
        html = re.sub(r"<!-- seo -->.*?<!-- /seo -->", lambda m: block, html, count=1, flags=re.S)
    else:
        # first run: replace the old loose tags between <title> and the stylesheet
        html = re.sub(r"(</title>\n).*?(<link rel=\"stylesheet\")", lambda m: m.group(1) + block + "\n" + m.group(2),
                      html, count=1, flags=re.S)
    open(path, "w", encoding="utf-8").write(html)
    print("head:", page)

robots = "User-agent: *\nAllow: /\n"
if BASE:
    robots += "\nSitemap: %ssitemap.xml\n" % BASE
    today = datetime.date.today().isoformat()
    rows = "".join("  <url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n"
                   % (url("") if pg == "index.html" else url(pg), today, p["priority"]) for pg, p in PAGES.items())
    open(os.path.join(SITE, "sitemap.xml"), "w", encoding="utf-8").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + "</urlset>\n")
    print("sitemap.xml")
open(os.path.join(SITE, "robots.txt"), "w", encoding="utf-8").write(robots)
print("robots.txt", "(with sitemap)" if BASE else "(sitemap line added once the address is known)")
