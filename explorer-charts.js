const colors = {fam: "#285479", com: "#963f2b"};
const labels = {fam: "Family", com: "Community"};

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.onload = resolve;
    script.onerror = () => reject(new Error("Chart library unavailable"));
    script.src = url;
    document.head.append(script);
  });
}
const cdn = "https://cdn.jsdelivr.net/npm/";
export const diagramReady = loadScript(cdn + "d3@7.9.0/dist/d3.min.js");
export const chartReady = loadScript(cdn + "vega@5.30.0/build/vega.min.js")
  .then(() => loadScript(cdn + "vega-lite@5.20.1/build/vega-lite.min.js"));

let view;
export function drawCounts(counts, filter, onFilter) {
  if (!window.vegaLite || !window.vega) return;
  const values = Object.entries(counts).map(([key, count]) => ({
    key, category: labels[key], count, color: colors[key], opacity: filter === "all" || filter === key ? 1 : .35
  }));
  const spec = {
    width: 106, height: 50, padding: 3, background: null,
    data: {values},
    mark: {type: "bar", cornerRadiusEnd: 3, cursor: "pointer"},
    encoding: {
      y: {field: "category", type: "nominal", sort: ["Family", "Community"], axis: {title: null, domain: false, ticks: false, labelFontSize: 13, labelPadding: 7}},
      x: {field: "count", type: "quantitative", scale: {domain: [0, Math.max(1, counts.fam, counts.com)]}, axis: null},
      color: {field: "color", type: "nominal", scale: null},
      opacity: {field: "opacity", type: "quantitative", scale: null},
      tooltip: [{field: "category", title: "Type"}, {field: "count", type: "quantitative", title: "Connections"}]
    },
    config: {view: {stroke: null}}
  };
  view?.finalize();
  const container = document.querySelector("#bars");
  container.replaceChildren();
  view = new window.vega.View(window.vega.parse(window.vegaLite.compile(spec).spec), {renderer: "svg", container});
  view.addEventListener("click", (_, item) => {
    if (item?.datum?.key) onFilter(item.datum.key === filter ? "all" : item.datum.key);
  });
  view.run();
}

export function drawDiagram(person, neighbors, active, choose) {
  const d3 = window.d3;
  if (!d3) return;
  const container = d3.select("#diagram");
  container.selectAll("*").remove();
  if (!neighbors.length) return;
  const w = Math.max(260, Math.min(600, container.node().clientWidth));
  const height = Math.max(72, 34 * neighbors.length + 12);
  const start = 9, end = Math.round(w * .40), middle = Math.round(height / 2);
  const svg = container.append("svg").attr("viewBox", `0 0 ${w} ${height}`)
    .attr("aria-label", `Connections of ${person}. Select a name to read its record.`).attr("role", "group");
  const spaced = d3.scalePoint().domain(neighbors.map(d => d.id)).range([18, height - 18]);
  const y = id => neighbors.length === 1 ? middle : spaced(id);
  const path = d3.linkHorizontal().x(d => d.x).y(d => d.y);
  svg.selectAll("path").data(neighbors).join("path")
    .attr("d", d => path({source: {x: start, y: middle}, target: {x: end, y: y(d.id)}}))
    .attr("fill", "none").attr("stroke", d => colors[d.kind])
    .attr("stroke-dasharray", d => d.cert === "documented" ? null : "4 4")
    .attr("stroke-width", d => d.id === active ? 3 : 1.4)
    .attr("opacity", d => d.id === active ? 1 : .55);
  svg.append("circle").attr("cx", start).attr("cy", middle).attr("r", 5).attr("fill", "#182c42");
  const groups = svg.selectAll("g.neighbor").data(neighbors).join("g").attr("class", "neighbor")
    .attr("transform", d => `translate(${end},${y(d.id)})`).style("cursor", "pointer")
    .attr("tabindex", 0).attr("role", "button").attr("aria-pressed", d => String(d.id === active))
    .attr("aria-label", d => `Read the connection with ${d.name}`)
    .on("click", (_, d) => choose(d.id))
    .on("keydown", (event, d) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      choose(d.id);
      document.querySelector("#connection").focus();
    });
  groups.append("rect").attr("x", -8).attr("y", -15).attr("width", w - end + 8).attr("height", 30)
    .attr("rx", 4).attr("fill", d => d.id === active ? "#efe9dd" : "transparent");
  groups.append("circle").attr("r", 4.5).attr("fill", d => colors[d.kind]);
  groups.append("text").attr("x", 12).attr("dy", ".35em")
    .attr("class", d => d.id === active ? "focused" : null).text(d => d.name);
}
