// On the story page, let the same-origin explorer grow with its contents.
const frame = document.querySelector("#ties-frame");
let observer;
function fit() {
  observer?.disconnect();
  const body = frame.contentDocument?.body;
  if (!body?.querySelector("main")) return;
  const resize = () => { frame.height = Math.ceil(body.getBoundingClientRect().height) + 2; };
  observer = new ResizeObserver(resize);
  observer.observe(body);
  resize();
}
frame.addEventListener("load", fit);
if (frame.contentDocument?.readyState === "complete") fit();
