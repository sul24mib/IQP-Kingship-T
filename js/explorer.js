import {people, ties} from "../data/explorer-data.js";
import {chartReady, diagramReady} from "./chart-libraries.js";
import {drawCounts} from "./vega-lite-counts.js";
import {drawDiagram} from "./d3-network.js";

export function mountExplorer(root) {
  const el = id => root.querySelector("#"+id);
  const certainty = {documented: "Documented", probable: "Likely", speculative: "Possible"};
  const state = {person: "rockyhill-cloe-prut", kind: "all", neighbor: "hadley-zebulon-prut"};
  const buttons = Array.from(root.querySelectorAll("[data-kind]"));
  const person = el("person"), connection = el("connection");
  for (const [id, name] of Object.entries(people).sort((a,b) => a[1].localeCompare(b[1]))) {
    person.add(new Option(name, id));
  }
  function element(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function showEvidence(tie) {
    const record = el("record");
    record.replaceChildren();
    if (!tie) return;
    for (const row of tie.records) {
      record.append(element("h3", row.from + " — " + row.relation + " — " + row.to));
      record.append(element("span", certainty[tie.cert] || tie.cert, "certainty"));
      if (row.excerpt) record.append(element("blockquote", row.excerpt));
      if (row.source) record.append(element("p", "Source: " + row.source, "source"));
    }
  }
  function changeKind(kind) {
    state.kind = kind;
    render();
  }
  function choose(id) {
    state.neighbor = id;
    render();
  }
  function render() {
    person.value = state.person;
    const links = ties.filter(t => t.a === state.person || t.b === state.person)
      .map(t => {
        const id = t.a === state.person ? t.b : t.a;
        return {...t, id, name: people[id]};
      })
      .sort((a,b) => a.name.localeCompare(b.name));
    const counts = {fam: 0, com: 0};
    for (const link of links) counts[link.kind]++;
    const shown = links.filter(t => state.kind === "all" || t.kind === state.kind);
    if (!shown.some(t => t.id === state.neighbor)) state.neighbor = shown[0]?.id ?? "";
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.kind === state.kind));
    el("counts").textContent = `Family: ${counts.fam} · Community: ${counts.com}`;
    el("network-title").textContent = people[state.person] + "’s connections";
    el("network-status").textContent = shown.length ?
      `${shown.length} ${shown.length === 1 ? "connection" : "connections"} in this view.` :
      "The project records list no connections of this type for this person.";
    connection.replaceChildren(...shown.map(t => new Option(t.name, t.id)));
    connection.disabled = !shown.length;
    if (!shown.length) connection.add(new Option("No connections in this view", ""));
    connection.value = state.neighbor;
    showEvidence(shown.find(t => t.id === state.neighbor));
    drawCounts(el("bars"), counts, state.kind, changeKind);
    drawDiagram(el("diagram"), connection, people[state.person], shown, state.neighbor, choose);
  }
  person.addEventListener("change", () => { state.person = person.value; state.kind = "all"; render(); });
  connection.addEventListener("change", () => choose(connection.value));
  buttons.forEach(button => button.addEventListener("click", () => changeKind(button.dataset.kind)));
  root.querySelector(".workspace").hidden = false;
  render();
  // The selectors, counts and evidence are usable while external libraries load or if they are blocked.
  for (const ready of [diagramReady, chartReady]) ready.then(render, () => {});
  let previousWidth = 0;
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === previousWidth) return;
    previousWidth = entry.contentRect.width;
    render();
  }).observe(el("diagram"));
}

const standalone = document.getElementById("explorer-ui");
if (standalone) mountExplorer(standalone);
