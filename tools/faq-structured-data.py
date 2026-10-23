#!/usr/bin/env python3
"""Rebuild faq.html's FAQPage JSON-LD from the questions on the page.

The structured data must match the visible answers word for word, so run this
after editing any FAQ entry:

    python3 tools/faq-structured-data.py
"""
import html
import json
import re
from pathlib import Path

PAGE = Path(__file__).resolve().parent.parent / "faq.html"
START = "<!-- faq-structured-data:start -->"
END = "<!-- faq-structured-data:end -->"


def plain(fragment: str) -> str:
    text = re.sub(r"</p>\s*<p[^>]*>", " ", fragment)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


source = PAGE.read_text()
entries = re.findall(
    r'<details class="faq-item">\s*<summary>(.*?)</summary>\s*<div class="faq-item__a">(.*?)</div>\s*</details>',
    source, re.S)
data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": "https://angrove.app/faq.html#faq",
    "url": "https://angrove.app/faq.html",
    "about": {"@id": "https://angrove.app/#app"},
    "mainEntity": [
        {"@type": "Question", "name": plain(q),
         "acceptedAnswer": {"@type": "Answer", "text": plain(a)}}
        for q, a in entries
    ],
}
block = (f'{START}\n<script type="application/ld+json">\n'
         f'{json.dumps(data, ensure_ascii=False, indent=2)}\n</script>\n{END}')
if START in source:
    source = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, source, flags=re.S)
else:
    source = source.replace("</head>", block + "\n</head>", 1)
PAGE.write_text(source)
print(f"FAQPage: {len(entries)} questions")
