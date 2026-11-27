import {colors} from "./chart-libraries.js";

const labels = {fam: "Family", com: "Community"};
let view;
export function drawCounts(container, counts, filter, onFilter) {
  if (!window.vegaLite || !window.vega) return;
  const values = Object.entries(counts).map(([key, count]) => ({
    key, category: labels[key], count, color: colors[key], opacity: filter === "all" || filter === key ? 1 : .35
  }));
  const spec = {
    width: 155, height: 52, padding: 3, background: null,
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
  container.replaceChildren();
  view = new window.vega.View(window.vega.parse(window.vegaLite.compile(spec).spec), {renderer: "svg", container});
  view.addEventListener("click", (_, item) => {
    if (item?.datum?.key) onFilter(item.datum.key === filter ? "all" : item.datum.key);
  });
  view.run();
}
