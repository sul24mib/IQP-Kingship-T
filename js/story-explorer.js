// Keep the map at its current chapter while the reader consults the records.
const links = document.querySelectorAll("[data-open-ties]");
let dialog, opener, content;

function createDialog() {
  dialog = document.createElement("dialog");
  dialog.className = "family-explorer-dialog";
  dialog.setAttribute("aria-label", "Explore the Prut family’s connections");
  dialog.innerHTML = '<form method="dialog"><button type="submit" autofocus>Back to the map</button></form><div class="family-explorer-content" aria-live="polite">Loading the family records…</div>';
  document.body.append(dialog);
  dialog.addEventListener("close", () => opener?.focus({preventScroll:true}));
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
}

async function loadExplorer() {
  const host = dialog.querySelector(".family-explorer-content");
  const url = new URL("../explorer.html", import.meta.url);
  const [response, module] = await Promise.all([fetch(url), import("./explorer.js")]);
  if (!response.ok) throw new Error("Explorer unavailable");
  const page = new DOMParser().parseFromString(await response.text(), "text/html");
  const main = page.getElementById("explorer-ui");
  if (!main) throw new Error("Explorer content unavailable");
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("../styles/explorer.css", import.meta.url);
  host.replaceChildren();
  host.removeAttribute("aria-live");
  const root = host.attachShadow({mode:"open"});
  root.append(css, document.importNode(main, true));
  module.mountExplorer(root);
}

for (const link of links) {
  link.addEventListener("click", event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !window.HTMLDialogElement) return;
    event.preventDefault();
    opener = link;
    if (!dialog) createDialog();
    dialog.showModal();
    if (!content) content = loadExplorer().catch(() => {
      const host = dialog.querySelector(".family-explorer-content");
      const fallback = document.createElement("a");
      fallback.href = link.href;
      fallback.textContent = "Open the relationship explorer";
      host.replaceChildren(fallback);
      content = null;
    });
  });
}
