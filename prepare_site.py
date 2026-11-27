"""Split a freshly generated Prut family Pages export into the site's modules."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DECODER = json.JSONDecoder()


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def export_rows(name, rows):
    return f"export const {name} = [\n" + ",\n".join(dump(r) for r in rows) + "\n];\n"


def explorer_records(story, rows):
    focus = set(story["steps"][story["familyStep"]]["show"])
    people = {p["id"]: p["name"] for p in story["people"] if p["id"] in focus}
    by_pair = {}
    for row in rows:
        by_pair.setdefault(frozenset((row[0], row[3])), []).append(row)
    ties = []
    for edge in story["ties"]:
        if edge["a"] not in people or edge["b"] not in people:
            continue
        pair = frozenset(people[edge[key]] for key in ("a", "b"))
        evidence = by_pair.get(pair, [])
        if not evidence:
            raise ValueError(f"Missing source record for {sorted(pair)}")
        ties.append({**edge, "records": [{"from": r[0], "to": r[3], "relation": r[2],
                                         "detail": r[6], "excerpt": r[7], "source": r[8]}
                                        for r in evidence]})
    return {"people": people, "ties": ties}


def prepare(source):
    html = source.read_text()
    if '<script type="module" src="story-map.js">' in html:
        return
    files = {}
    styles = iter(("page.css", "story-map.css", "records-table.css"))

    def split(match):
        tag, attrs, code = match.groups()
        if tag == "style":
            name = next(styles)
            files[name] = code.strip() + "\n"
            return f'<link rel="stylesheet" href="{name}">'
        if "src=" in attrs:
            return match[0]
        if "var D = {" in code:
            before, data = code.split("var D = ", 1)
            story, end = DECODER.raw_decode(data)
            suffix = data[end:]
            if not suffix.startswith(", SID = "):
                raise ValueError("Unrecognized story export")
            files["story-data.js"] = "export const story = " + json.dumps(story, ensure_ascii=False, indent=1) + ";\n"
            files["story-map.js"] = 'import {story as D} from "./story-data.js";\n' + before + "var " + suffix[2:].strip() + "\n"
            parsed["story"] = story
            name = "story-map.js"
        elif "var P = [[" in code:
            before, data = code.split("var P = ", 1)
            people, end = DECODER.raw_decode(data)
            if not data[end:].startswith(", T = "):
                raise ValueError("Unrecognized spreadsheet export")
            data = data[end+6:]
            ties, end = DECODER.raw_decode(data)
            files["records-data.js"] = export_rows("people", people) + export_rows("ties", ties)
            suffix = data[end:]
            if not suffix.startswith(", root = "):
                raise ValueError("Unrecognized spreadsheet initializer")
            files["records-table.js"] = 'import {people as P, ties as T} from "./records-data.js";\n' + before + "var " + suffix[2:].strip() + "\n"
            parsed["ties"] = ties
            name = "records-table.js"
        else:
            raise ValueError("Unrecognized inline script")
        return f'<script type="module" src="{name}"></script>'

    parsed = {}
    html = re.sub(r'<(script|style)\b([^>]*)>(.*?)</\1\s*>', split, html, flags=re.S)
    records = explorer_records(parsed["story"], parsed["ties"])
    files["explorer-data.js"] = ("export const people = " + json.dumps(records["people"], ensure_ascii=False, indent=2) +
                                 ";\n" + export_rows("ties", records["ties"]))
    anchor = '<div class="after">'
    if html.count(anchor) != 1:
        raise ValueError("Cannot locate spreadsheet section")
    html = html.replace(anchor, anchor + """
<section id="kin-explore" aria-label="Explore the Prut family's ties">
<iframe id="ties-frame" src="explorer.html" title="Explore the Prut family's ties" loading="lazy" width="100%" height="880" style="border:0;display:block"></iframe>
<p><a href="explorer.html">Open the relationship explorer on its own</a></p>
</section>
<script type="module" src="embed-size.js"></script>
""")
    html = html.replace(' · <a href="#kin-prut-family-names">Spreadsheet', ' · <a href="#kin-explore">Explore the ties</a> · <a href="#kin-prut-family-names">Spreadsheet')
    html = html.replace('<p><a href="#kin-prut-family-names">See the project spreadsheet', '<p><a href="#kin-explore">Explore the family and community ties &darr;</a><br><a href="#kin-prut-family-names">See the project spreadsheet')
    files["index.html"] = html
    for name, content in files.items():
        (ROOT / name).write_text(content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", nargs="?", default=ROOT / "index.html", type=Path)
    prepare(parser.parse_args().export)
