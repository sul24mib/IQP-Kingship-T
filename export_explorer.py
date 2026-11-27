"""Refresh the optional explorer data from the original Prut story HTML."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
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


def export(source):
    html = source.read_text()
    scripts = re.findall(r"<script\b[^>]*>(.*?)</script>", html, flags=re.S)
    map_script, = (s for s in scripts if "var D = {" in s)
    table_script, = (s for s in scripts if "var P = [[" in s)
    story, _ = DECODER.raw_decode(map_script.split("var D = ", 1)[1])
    people_and_ties = table_script.split("var P = ", 1)[1]
    _, end = DECODER.raw_decode(people_and_ties)
    next_field = people_and_ties[end:]
    if not next_field.startswith(", T = "):
        raise ValueError("Cannot locate the spreadsheet ties")
    ties, _ = DECODER.raw_decode(next_field[6:])
    records = explorer_records(story, ties)
    output = ("export const people = " + json.dumps(records["people"], ensure_ascii=False, indent=2) +
              ";\n" + export_rows("ties", records["ties"]))
    (ROOT / "data" / "explorer-data.js").write_text(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", default=ROOT / "index.html", type=Path)
    export(parser.parse_args().source)
