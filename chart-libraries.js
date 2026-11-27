export const colors = {fam: "#285479", com: "#963f2b"};

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
