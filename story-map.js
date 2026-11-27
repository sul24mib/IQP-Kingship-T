import {story as D} from "./story-data.js";

(function () {
  var SID = 'kin-prut-family';
  var root = document.getElementById(SID), box = root.querySelector('.kin-mapbox');
  if (!window.L) { box.innerHTML = '<p style="padding:16px">The map could not load.</p>'; return; }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var PROG = { W: 'Witness Stone', S: 'Stopping Stone' }, C = { documented: '#2e7d32', probable: '#1f6fb2', speculative: '#7a828c' };
  var P = {}; D.people.forEach(function (p) { P[p.id] = p; });
  var seen = {}, lastLegend = null, legendItems = root.querySelectorAll('.kin-legend [data-k]');   // legend items used in this step
  // the cards float over the map only when the block itself is wide (same 960 px as the CSS container query)
  var wide = function () { return root.clientWidth >= 960; };
  // Touch screens: a finger on the map scrolls the page, as everywhere else on the page; dots can still be tapped and
  // the + / - buttons still zoom. "Move map" turns dragging on until the next step.
  var touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  var calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);   // asked for less motion: no flying
  var map = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.25, zoomControl: false, dragging: !touch, touchZoom: !touch });
  L.control.zoom({ position: 'topright' }).addTo(map);
  var panOn = false;
  function setPan(on) {
    panOn = on;
    if (on) { map.dragging.enable(); map.touchZoom.enable(); } else { map.dragging.disable(); map.touchZoom.disable(); }
    var b = box.querySelector('.kin-pan'); if (b) { b.classList.toggle('on', on); b.textContent = on ? 'Done' : 'Move map'; }
  }
  if (touch) {
    var panCtl = L.control({ position: 'topright' });
    panCtl.onAdd = function () {
      var b = L.DomUtil.create('button', 'kin-pan leaflet-control'); b.type = 'button'; b.textContent = 'Move map';
      L.DomEvent.disableClickPropagation(b); L.DomEvent.on(b, 'click', function () { setPan(!panOn); });
      return b;
    };
    panCtl.addTo(map);
  }
  var base = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 16, attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS' }).addTo(map);
  var labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(map);
  // While the map flies to a new zoom, the old town names are drawn hugely enlarged until the new ones load.
  // Hide the names during the flight and show them again once the new ones are in (or after 1.2 s at the latest).
  var flying = false, showLabels = null;
  var labelsBack = function (ms) { clearTimeout(showLabels); showLabels = setTimeout(function () { labels.setOpacity(1); }, ms); };
  map.on('zoomstart', function () { flying = true; clearTimeout(showLabels); labels.setOpacity(0); });
  map.on('zoomend', function () { flying = false; labelsBack(1200); });
  labels.on('load', function () { if (!flying) labelsBack(300); });
  // the background map blocked (some school networks block map servers): say so instead of showing a blank grey box
  var tilesOk = false, tileErrs = 0;
  base.on('tileload', function () { tilesOk = true; });
  base.on('tileerror', function () { tileErrs++; });
  setTimeout(function () {
    if (tilesOk || !tileErrs) return;
    var n = document.createElement('p'); n.className = 'kin-notice';
    n.textContent = 'The background map could not load on this network. The stones, names and ties still work.';
    box.appendChild(n);
  }, 8000);
  var whenEl = root.querySelector('.kin-when'), bar = root.querySelector('.kin-progress i');
  var CLOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3"/><path d="M8 4.6V8l2.4 1.6"/></svg>';
  var hasUnk = D.stones.some(function (s) { return s[3] !== 'W' && s[3] !== 'S'; });   // stones whose program is not recorded
  // which way a label should open so it stays on the map (phones): toward the side with room, else above or below
  function roomy(ll, z, need, gap, center) {
    var c = map.project(center || mid || map.getCenter(), z), p = map.project(ll, z), w = box.clientWidth, h = box.clientHeight;
    var x = p.x - c.x + w / 2, y = p.y - c.y + h / 2, l = x - gap >= need, r = w - x - gap >= need;
    if (l && (!r || x > w / 2)) return { dir: 'left', off: [-gap, 0] };
    if (r) return { dir: 'right', off: [gap, 0] };
    return y > h / 2 ? { dir: 'top', off: [0, -gap] } : { dir: 'bottom', off: [0, gap] };
  }

  // every stone in every state, drawn once and restyled at each step
  var bg = L.layerGroup().addTo(map), stateLayer = L.layerGroup(), layer = L.layerGroup().addTo(map), tags = L.layerGroup().addTo(map);
  // The map key doubles as a set of switches: untick an item to hide it on every step (F = what is shown).
  // "Commemorated by name" is different: each step starts at its own setting (everyone in the first step, off on the
  // stones step, the family's people in the story), and ticking or unticking it lasts until the next step.
  var F = { W: 1, S: 1, unk: 1, other: 1, documented: 1, probable: 1, speculative: 1, fam: 1, com: 1, move: 1, place: 1, states: 1, names: 1 };
  var everyPick = null, relOn = true, CK = ['documented', 'probable', 'speculative'];
  var progOn = function (p) { return p === 'S' ? F.S : p === 'W' ? F.W : F.unk; };
  // level 0: every person commemorated by name (purple) and every tie in the project; the ties go under the stones
  var everyLayer = L.layerGroup(), CI = ['#2e7d32', '#1f6fb2', '#7a828c'], DASH = [null, '6 5', '1 5'], everyKey = '';
  function setEveryone(on) {
    var key = on ? [F.documented, F.probable, F.speculative, F.fam, F.com].join('') : '';
    if (key === everyKey) return; everyKey = key;
    map.removeLayer(everyLayer); everyLayer.clearLayers();
    if (!on) return;
    D.all.dots.forEach(function (d) {
      L.circleMarker([d[0], d[1]], { radius: 4.2, weight: .8, color: '#ffffff', fillColor: '#7c4dff', fillOpacity: .9 })
        .bindTooltip(esc(d[2] + (d[3] ? ' · ' + d[3] : '') + ' · commemorated by name'), { className: 'kin-name' }).addTo(everyLayer);
    });
    D.all.ties.forEach(function (t) {
      if (F[CK[t[4]]] && F[t[5] ? 'com' : 'fam'])
        L.polyline([[t[0], t[1]], [t[2], t[3]]], { color: CI[t[4]], weight: 1.6, opacity: .6, dashArray: DASH[t[4]], interactive: false }).addTo(everyLayer);
    });
    everyLayer.addTo(map);
    everyLayer.eachLayer(function (l) { if (!(l instanceof L.CircleMarker)) l.bringToBack(); });
  }
  var checks = root.querySelectorAll('.kin-legend input[data-f]'), resetBtn = root.querySelector('.kin-reset');
  var legendBox = root.querySelector('.kin-legend'), keyBtn = root.querySelector('.kin-keyhead');
  function shutKey(shut) {
    legendBox.classList.toggle('kin-shut', shut); keyBtn.setAttribute('aria-expanded', shut ? 'false' : 'true');
    if (!wide()) map.invalidateSize({ pan: false });   // on a phone the key sits under the map
  }
  keyBtn.addEventListener('click', function () { shutKey(!legendBox.classList.contains('kin-shut')); });
  if (!wide()) shutKey(true);                          // phones: folded, so the map and cards keep the room
  Array.prototype.forEach.call(checks, function (c) {
    c.addEventListener('change', function () {
      var k = c.getAttribute('data-f');
      if (k === 'rel') everyPick = c.checked; else F[k] = c.checked ? 1 : 0;
      draw(cur);
    });
  });
  if (resetBtn) resetBtn.addEventListener('click', function () {
    Object.keys(F).forEach(function (k) { F[k] = 1; }); everyPick = null; draw(cur);
  });
  var bgDots = D.stones.map(function (s) {
    var t = esc(s[0] + ' · ' + s[4] + (s[5] ? ' · ' + s[5] : ''));
    var m = L.circleMarker([s[1], s[2]], { radius: 4 }).bindTooltip(t, { className: 'kin-name' }).addTo(bg);
    m.bindPopup(t + '<br>' + (s[6] ? '<a href="' + esc(s[6]) + '" target="_blank" rel="noopener">Read the stone page</a>'
      : '<span style="color:#5b6470">No page on stoppingstones.org yet</span>'), { maxWidth: 260 });
    return m;
  });
  var tiedStone = {}; (D.tiedStones || []).forEach(function (s) { tiedStone[s] = 1; });
  var abolLayer = L.layerGroup();                      // slide -1: when each New England state ended slavery
  (D.abolition || []).forEach(function (a) {
    L.marker([a[1], a[2]], { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: [0, 0],
      html: '<span class="kin-abol kin-abol-' + a[4] + '"><b>' + esc(a[0]) + '</b><i>' + esc(a[3]) + '</i><em>' + esc(a[5]) + '</em></span>' }) }).addTo(abolLayer);
  });
  D.states.forEach(function (s) {
    L.marker([s[1], s[2]], { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: [0, 0],
      html: '<span class="kin-state">' + esc(s[0]) + ' <b>' + s[3] + '</b></span>' }) }).addTo(stateLayer);
  });
  function styleStones(mode) {           // 'all': every stone in colour; 'programs': gold = Stopping, blue = Witness; else grey
    bgDots.forEach(function (m, k) {
      var S = D.stones[k][3] === 'S', W = D.stones[k][3] === 'W';
      if (mode === 'all' || mode === 'programs') { m.setRadius(mode === 'all' ? 4.5 : 5); m.setStyle({ color: S ? '#6b5200' : '#ffffff', weight: 1, opacity: 1, fillColor: S ? '#c9a227' : W ? '#1f3864' : '#8a939e', fillOpacity: S || W ? .95 : .45 }); }
      else { m.setRadius(3); m.setStyle({ color: '#ffffff', weight: 1, opacity: .5, fillColor: '#8a939e', fillOpacity: .45 }); }
    });
  }
  // the legend lists only what the map shows in this step
  function showLegend() {
    Array.prototype.forEach.call(checks, function (c) {          // the switches show what is on now
      var k = c.getAttribute('data-f'), v = k === 'rel' ? relOn : !!F[k];
      c.checked = v; c.parentNode.classList.toggle('kin-off', !v);
      if (k === 'rel') c.parentNode.querySelector('.kin-reltext').textContent = v ? 'Commemorated by name' : 'Show people commemorated by name';
    });
    if (resetBtn) resetBtn.hidden = !(everyPick !== null || Object.keys(F).some(function (k) { return !F[k]; }));
    var key = Object.keys(seen).sort().join();
    if (key === lastLegend) return; lastLegend = key;
    legendBox.style.display = key ? '' : 'none';
    Array.prototype.forEach.call(legendItems, function (el) { el.style.display = seen[el.getAttribute('data-k')] ? '' : 'none'; });
    if (!wide()) map.invalidateSize({ pan: false });   // on a phone the legend sits under the map, so the map's height changed
  }
  function spots(p) {
    var s = p.stones.filter(function (x) { return x.lat != null; });
    return s.length ? s.map(function (x) { return [x.lat, x.lon, x]; }) : (p.lat != null ? [[p.lat, p.lon, null]] : []);
  }
  function nearest(p, to) {
    var s = spots(p); if (!s.length) return null; if (!to || s.length === 1) return s[0];
    var best = s[0], bd = Infinity;
    s.forEach(function (x) { var d = Math.pow(x[0] - to[0], 2) + Math.pow(x[1] - to[1], 2); if (d < bd) { bd = d; best = x; } });
    return best;
  }
  function card(p) {
    var st = p.stones.map(function (s) { return esc((PROG[s.program] || 'Stone') + ' ' + s.id) + (s.town ? ' · ' + esc(s.town) : '') +
      (s.url ? ' · <a href="' + esc(s.url) + '" target="_blank" rel="noopener">stone page</a>' : ''); }).join('<br>');
    return '<b>' + esc(p.name) + '</b>' + (p.years ? ' <span style="color:#5b6470">' + esc(p.years) + '</span>' : '') +
      '<br><span style="color:#5b6470">' + (st || 'Commemorated by name') + '</span>' + (p.note ? '<br>' + esc(p.note) : '');
  }
  function openPerson(id) {
    var p = P[id], s = p && spots(p)[0], at = disp[id] || (s && L.latLng(s[0], s[1]));
    if (at) L.popup({ maxWidth: 260 }).setLatLng(at).setContent(card(p)).openOn(map);
  }
  // Dots that would sit on top of each other (people placed at the same town, stones a few metres apart) are spread
  // around a small ring, so every person and every tie between them can be seen. The ring is worked out for the zoom
  // the step ends at, so it is the same size on every screen.
  var disp = {}, famStone = {};                     // person id -> where their first dot is drawn; this family's stone ids
  D.people.forEach(function (p) { p.stones.forEach(function (s) { famStone[s.id] = 1; }); });
  var tied = function (a, b) { return D.ties.some(function (t) { return (t.a === a && t.b === b) || (t.a === b && t.b === a); }); };
  var degree = function (id) { return D.ties.filter(function (t) { return t.a === id || t.b === id; }).length; };
  function ringOrder(items) {                       // neighbours on the ring are people tied to each other where possible
    if (items.length < 3) return items;
    var rest = items.slice().sort(function (a, b) { return degree(b.p.id) - degree(a.p.id) || (a.p.name < b.p.name ? -1 : 1); }), out = [];
    while (rest.length) {
      var queue = [rest.shift()];
      while (queue.length) {
        var n = queue.shift(); out.push(n);
        var nb = rest.filter(function (m) { return tied(n.p.id, m.p.id); });
        nb.sort(function (a, b) { return (!!a.stone - !!b.stone) || degree(b.p.id) - degree(a.p.id) || (a.p.name < b.p.name ? -1 : 1); });
        nb.forEach(function (m) { rest.splice(rest.indexOf(m), 1); queue.push(m); });
      }
    }
    return out;
  }
  function layout(nodes, z) {
    var ringR = function (c) { return c.items.length < 2 ? 0 : Math.max(16, c.items.length * 29 / (2 * Math.PI)); };
    var cl = nodes.map(function (n) { return { items: [n], pt: map.project(n.ll, z) }; });
    var merged = true, guard = 0;
    while (merged && guard++ < 500) {                // join dots (and rings) that would touch at this zoom
      merged = false;
      for (var a = 0; a < cl.length && !merged; a++) for (var b = a + 1; b < cl.length && !merged; b++) {
        if (cl[a].pt.distanceTo(cl[b].pt) < ringR(cl[a]) + ringR(cl[b]) + 18) {
          var n1 = cl[a].items.length, n2 = cl[b].items.length;
          cl[a].pt = L.point((cl[a].pt.x * n1 + cl[b].pt.x * n2) / (n1 + n2), (cl[a].pt.y * n1 + cl[b].pt.y * n2) / (n1 + n2));
          cl[a].items = cl[a].items.concat(cl[b].items); cl.splice(b, 1); merged = true;
        }
      }
    }
    cl.forEach(function (c) {
      c.r = ringR(c); c.ll = map.unproject(c.pt, z);
      ringOrder(c.items).forEach(function (n, k, arr) {
        var ang = -Math.PI / 2 + 2 * Math.PI * k / arr.length;
        n.pos = c.r ? map.unproject(c.pt.add(L.point(Math.cos(ang) * c.r, Math.sin(ang) * c.r)), z) : n.ll;
        n.cl = c;
      });
    });
  }
  function curve(a, b) {                            // a gentle arc from a to b, so a move does not hide a straight tie
    var dLat = b[0] - a[0], dLng = b[1] - a[1], c = [(a[0] + b[0]) / 2 + dLng * .25, (a[1] + b[1]) / 2 - dLat * .25];
    return function (t) { var u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };
  }
  // names on the map and in pop-ups are buttons: open that person's details (after Leaflet has handled the click)
  box.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-pid]') : null;
    if (t) { var id = t.getAttribute('data-pid'); setTimeout(function () { openPerson(id); }, 0); }
  }, true);
  // fit the map to what this step is about, in the part of the map the cards do not cover
  var first = true, lastFit = '';
  function fit(b, maxZoom) {
    showLegend();
    var key = b.toBBoxString() + '/' + maxZoom;
    if (key === lastFit) return;                    // same view as now: do not fly
    lastFit = key;
    var c = root.querySelector('.kin-card');
    var opt = wide() ? { paddingTopLeft: [c.offsetWidth + 110, 70], paddingBottomRight: [90, root.querySelector('.kin-legend').offsetHeight + 50], maxZoom: maxZoom }
                     : { paddingTopLeft: [40, 40], paddingBottomRight: [40, 60], maxZoom: maxZoom };
    if (first || calm) map.fitBounds(b, Object.assign({ animate: false }, opt)); else map.flyToBounds(b, Object.assign({ duration: 1.1 }, opt));
    first = false;
  }
  function draw(i) {
    seen = {}; drawStep(i); showLegend();
  }
  function drawStep(i) {
    var step = D.steps[i] || { show: [] }, on = {}, pts = [], all = step.kind === 'all', famOn = !(all && !step.connect);
    layer.clearLayers(); tags.clearLayers(); hotList = []; disp = {};
    styleStones(all ? 'all' : step.programs ? 'programs' : 'grey');
    var hist = !!step.history;                         // slide -1: no project dots, only the states
    if (hist) { /* nothing from the project on this map */ }
    else if (all || step.programs) { seen.W = seen.S = 1; if (hasUnk) seen.unk = 1; } else seen.other = 1;
    // people commemorated by name: everyone in the first step, the family in the story; the map key can override
    relOn = everyPick === null ? (all ? !!step.everyone : true) : everyPick;
    var ev = all && relOn && !hist;
    setEveryone(ev);
    if (all && !hist) seen.rel = 1;
    if (hist) abolLayer.addTo(map); else abolLayer.remove();
    if (ev) seen.documented = seen.probable = seen.speculative = seen.fam = seen.com = 1;
    whenEl.innerHTML = step.when ? CLOCK + esc(step.when) : ''; whenEl.style.display = step.when ? 'inline-flex' : 'none';
    // this family's stones are drawn on top (spread out where they overlap), so their plain background dots are hidden;
    // stones of a program switched off in the map key are hidden too
    var gray = !all && !step.programs;
    bgDots.forEach(function (m, k) {
      var s = D.stones[k], hide = hist || (famOn && famStone[s[0]]) || !progOn(s[3]) || (gray && !F.other);
      if (hide) bg.removeLayer(m); else bg.addLayer(m);
    });
    if (all && !step.connect && !ev && !hist && !step.stoneTies) { seen.states = 1; if (F.states) stateLayer.addTo(map); else stateLayer.remove(); }
    else stateLayer.remove();
    if (step.circle) {
      // this family's stones, each ringed in orange so they stand out among all the others (one ring per site)
      var halo = {}, best = null;
      D.people.forEach(function (p) { p.stones.forEach(function (s) {
        if (s.lat == null) return;
        var k = s.lat.toFixed(2) + ',' + s.lon.toFixed(2);
        halo[k] = halo[k] || { ll: L.latLng(s.lat, s.lon), n: 0 }; halo[k].n++;
      }); });
      Object.keys(halo).forEach(function (k) {
        var h = halo[k]; if (!best || h.n > best.n) best = h;
        if (!famOn) L.circleMarker(h.ll, { radius: 11, color: '#b4441c', weight: 3, opacity: .95, fill: false, interactive: false }).addTo(layer);
      });
      var cw = wide();                                // phone: the label sits above the ring, so it is not cut off
      if (best && (cw || !famOn)) L.circleMarker(best.ll, { radius: 0, opacity: 0, fillOpacity: 0, interactive: false })
        .bindTooltip(esc(D.callout), { permanent: true, direction: cw ? 'right' : 'top', offset: cw ? [16, 0] : [0, -14], className: 'kin-name kin-callout' }).addTo(layer);
    }
    // the kinship slide: lines between stones whose people were family or community (under the stone dots)
    if (step.stoneTies) bgDots.forEach(function (m, k) {
      if (tiedStone[D.stones[k][0]]) m.setRadius(5.5); else m.setStyle({ fillOpacity: .18, opacity: .35 });
    });
    if (step.stoneTies) D.all.ties.forEach(function (t) {
      if (!t[6]) return;
      var ck = CK[t[4]], kk = t[5] ? 'com' : 'fam'; seen[ck] = seen[kk] = 1;
      if (!F[ck] || !F[kk]) return;
      L.polyline([[t[0], t[1]], [t[2], t[3]]], { color: CI[t[4]], weight: 2, opacity: .8, dashArray: DASH[t[4]], interactive: false })
        .addTo(layer).bringToBack();
    });
    if (!famOn) {
      mid = null;
      var fb = L.latLngBounds(hist ? D.ne : (step.focus || step.stoneTies) ? D.focus : D.core);
      if (step.stoneTies) D.people.forEach(function (p) { p.stones.forEach(function (s) { if (s.lat != null) fb.extend([s.lat, s.lon]); }); });
      fit(fb, hist ? 7 : (step.focus || step.stoneTies) ? 8.5 : 7.5); return;
    }
    step.show.forEach(function (id) { on[id] = 1; });

    // every dot of this family: one per stone, and one per person without a stone (not on the zoomed-out map)
    var nodes = [], nodesOf = {};
    D.people.forEach(function (p) {
      if (!p.stones.length && all) return;
      if (p.extra && !on[p.id]) return;               // e.g. Rocky Hill: only in the part about them
      var only = step.stones && step.stones[p.id];
      spots(p).forEach(function (x) {
        var prog = x[2] ? (x[2].program === 'S' ? 'S' : 'W') : null;
        if (prog) seen[prog] = 1; else seen.rel = 1;
        nodes.push({ p: p, stone: x[2], ll: L.latLng(x[0], x[1]), hot: !!on[p.id] && !(x[2] && only && only.indexOf(x[2].id) < 0),
                     hide: prog ? !progOn(prog) : !relOn });
      });
    });
    // switched off in the map key: not drawn, but the map still frames them, so switching never moves the map
    var vis = nodes.filter(function (n) { return !n.hide; });
    vis.forEach(function (n) { (nodesOf[n.p.id] = nodesOf[n.p.id] || []).push(n); });
    // where the map will end up, so dots that overlap there can be spread out
    nodes.forEach(function (n) { if (n.hot) pts.push([n.ll.lat, n.ll.lng]); });
    (step.places || []).forEach(function (pl) { pts.push(pl.at); });
    (step.moves || []).forEach(function (mv) { pts.push(mv.from, mv.to, curve(mv.from, mv.to)(.5)); });
    if (step.journey) step.journey.stops.forEach(function (s) { pts.push([s.lat, s.lon]); });
    if (!pts.length) nodes.forEach(function (n) { pts.push([n.ll.lat, n.ll.lng]); });
    var bounds = all ? L.latLngBounds(D.core) : pts.length ? L.latLngBounds(pts) : null, maxZ = all ? 7.5 : (step.zoom || 10);
    var z = bounds ? Math.min(maxZ, map.getBoundsZoom(bounds, false, L.point(wide() ? 600 : 80, 160))) : (first ? 8 : map.getZoom());
    mid = bounds ? bounds.getCenter() : (first ? null : map.getCenter());
    layoutZ = z;
    layout(vis, z);
    if (vis.some(function (n) { return n.cl.r; })) seen.ring = 1;
    vis.forEach(function (n) { if (!disp[n.p.id] || n.hot) disp[n.p.id] = n.pos; });   // pop-ups open at the dot in this step
    var snap = function (at) {                        // a move that starts or ends at a ring: use the ring's centre
      var ll = L.latLng(at), hit = null;
      vis.forEach(function (n) { if (!hit && n.ll.distanceTo(ll) < 60) hit = n; });
      if (!hit) return at;
      var q = hit.cl.items.length > 1 ? hit.cl.ll : hit.pos;
      return [q.lat, q.lng];
    };

    // ties: grey for the rest of the family, in colour between the people in this step
    D.ties.forEach(function (t) {
      var hot = on[t.a] && on[t.b]; if (hot) { seen[t.cert] = 1; seen[t.kind] = 1; }
      if (!F[t.cert] || !F[t.kind]) return;
      var A = nodesOf[t.a], B = nodesOf[t.b]; if (!A || !B) return;
      var best = null, bd = Infinity;
      A.forEach(function (x) { B.forEach(function (y) { var d = x.ll.distanceTo(y.ll); if (d < bd) { bd = d; best = [x, y]; } }); });
      L.polyline([best[0].pos, best[1].pos], { color: hot ? (C[t.cert] || '#888') : '#b5bdc6', weight: hot ? 3 : 1.2,
        opacity: hot ? .95 : .5, dashArray: t.cert === 'speculative' ? '1 7' : t.cert === 'probable' ? '9 6' : null, lineCap: 'round', interactive: false }).addTo(layer);
    });
    // one person remembered by more than one stone: a dotted line between the stones
    D.people.forEach(function (p) {
      var s = (nodesOf[p.id] || []).filter(function (n) { return n.stone; });
      if (s.length < 2) return;
      if (on[p.id]) seen.same = 1;
      L.polyline(s.map(function (n) { return n.pos; }), { color: '#6b7280', weight: 2.5, dashArray: '2 6', opacity: on[p.id] ? .95 : .45, interactive: false }).addTo(layer);
    });
    // the dots, with the people in this step on top
    vis.slice().sort(function (a, b) { return (a.hot - b.hot) || (!!a.stone - !!b.stone); }).forEach(function (n) {
      var p = n.p, stone = n.stone, prog = stone && stone.program, big = n.cl.r ? 7 : 8, m;
      if (stone) {
        seen[prog === 'S' ? 'S' : 'W'] = 1;
        m = L.circleMarker(n.pos, { radius: n.hot ? big : 5, weight: prog === 'S' ? 1.5 : 2, color: prog === 'S' ? '#6b5200' : '#ffffff',
          fillColor: prog === 'S' ? '#c9a227' : '#1f3864', fillOpacity: n.hot ? 1 : .35, opacity: n.hot ? 1 : .55 });
        m.bindTooltip(esc(p.name + ' · ' + stone.id), { className: 'kin-name' });
      } else {
        seen.rel = 1;
        m = L.circleMarker(n.pos, { radius: n.hot ? big : 5, weight: 2, color: '#ffffff', fillColor: '#7c4dff', fillOpacity: n.hot ? 1 : .35, opacity: n.hot ? 1 : .55 });
        m.bindTooltip(esc(p.name + ' · commemorated by name'), { className: 'kin-name' });
      }
      m.bindPopup(card(p), { maxWidth: 260 }).addTo(layer);
      if (n.hot) hotList.push({ id: p.id, name: p.name, sid: stone ? stone.id : '', prog: prog, ll: n.cl.ll, rad: n.cl.r,
                                stone: !!stone, town: (stone && stone.town) || p.town });
    });
    // places named in this finding (for example where a notice was printed)
    placeHeads = [];
    (step.places || []).forEach(function (pl) {
      seen.place = 1; if (!F.place) return;
      var mk = L.marker(pl.at, { keyboard: false, icon: L.divIcon({ className: '', html: '<div class="kin-place"></div>', iconSize: [11, 11], iconAnchor: [6, 6] }) }).addTo(layer);
      var text = pl.name + (pl.note ? ': ' + pl.note : '');
      // people listed at this place already: the place becomes the heading of their name list instead of a second label
      if (hotList.some(function (h) { return h.ll.distanceTo(L.latLng(pl.at)) < 1500; })) placeHeads.push({ ll: L.latLng(pl.at), text: text });
      else mk.bindTooltip('<b>' + esc(pl.name) + '</b>' + (pl.note ? ': ' + esc(pl.note) : ''), { permanent: true, direction: 'top', offset: [0, -8], className: 'kin-name kin-placetag' });
    });
    // a move from one place to another: a curved dashed arrow
    (step.moves || []).forEach(function (mv) {
      seen.move = 1; if (!F.move) return;
      var at = curve(snap(mv.from), snap(mv.to)), line = [];
      for (var t = 0; t <= 1.0001; t += .05) line.push(at(t));
      L.polyline(line, { color: '#00897b', weight: 3.5, dashArray: '9 7', interactive: false }).addTo(layer);
      var p1 = map.project(at(.78), 0), p2 = map.project(at(.86), 0), ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
      L.marker(at(.82), { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: [0, 0],
        html: '<div class="kin-arrow" style="transform:translate(-50%,-50%) rotate(' + ang + 'deg)"></div>' }) }).addTo(layer);
      L.circleMarker(at(.5), { radius: 0, opacity: 0, fillOpacity: 0, interactive: false })
        .bindTooltip(esc(mv.label), (function () {
          var s = wide() ? { dir: 'right', off: [10, 0] } : roomy(L.latLng(at(.5)), z, mv.label.length * 7 + 24, 10);
          return { permanent: true, direction: s.dir, offset: s.off, className: 'kin-name kin-movetag' };
        })()).addTo(layer);
    });
    // a journey: numbered stops; a dashed line to a place they were heading for but never reached
    if (step.journey) seen.move = 1;
    if (step.journey && F.move) {
      var prev = null;
      step.journey.stops.forEach(function (s, k) {
        var goal = /^heading toward/i.test(s.role), ll = [s.lat, s.lon]; seen.move = 1;
        if (prev) L.polyline([prev, ll], { color: '#00897b', weight: 3, dashArray: goal ? '2 7' : '9 7', interactive: false }).addTo(layer);
        L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="kin-stop' + (goal ? ' kin-goal' : '') + '">' + (k + 1) + '</div>', iconSize: null, iconAnchor: [11, 11] }) })
          .bindPopup('<b>' + (k + 1) + '. ' + esc(s.role) + '</b><br>' + esc(s.place) + (s.date ? ' · ' + esc(s.date) : '')).addTo(layer);
        if (!goal) prev = ll;
      });
    }
    if (bounds) fit(bounds, maxZ);
    label(z);
  }
  // one name list per spot: people closer than about 40 pixels share a list. Each name opens that person's details.
  var hotList = [], placeHeads = [], mid = null, layoutZ = 8;
  function label(z, center) {
    tags.clearLayers();
    if (hotList.length) seen.names = 1;
    if (!F.names) return;
    var step = D.steps[cur] || {}, over = step.overview, scale = Math.pow(2, z - layoutZ);
    var cx = map.project(center || mid || map.getCenter(), z).x;
    hotList.sort(function (a, b) { return b.stone - a.stone; });      // people with a stone lead the list
    var groups = [];
    hotList.forEach(function (h) {
      var pt = map.project(h.ll, z), g = null;
      for (var k = 0; k < groups.length && !g; k++) if (groups[k].pt.distanceTo(pt) < 40) g = groups[k];
      if (g) g.items.push(h); else groups.push({ pt: pt, items: [h] });
    });
    groups.forEach(function (g) {
      var seen = {}, items = g.items.filter(function (h) { var k = h.id + '|' + (h.sid || ''); if (seen[k]) return false; seen[k] = 1; return true; });
      var towns = []; items.forEach(function (h) { var t = String(h.town || '').split(/[;(]/)[0].trim(); if (t && towns.indexOf(t) < 0) towns.push(t); });
      var ph = placeHeads.filter(function (q) { return map.project(q.ll, z).distanceTo(g.pt) < 40; })[0];
      var head = step.where || (ph && ph.text) || (items.length >= 3 || (over && items.length > 1) ? towns.slice(0, box.clientWidth < 520 ? 1 : 2).join(' & ') : '');
      var cap = wide() ? 6 : 3, many = items.length > cap, lines = items.slice(0, many ? cap - 1 : cap).map(function (h) {
        var tag = h.sid ? (step.programs ? (PROG[h.prog] || 'Stone') + ' ' : '') + h.sid : '';
        return '<button type="button" class="kin-tagbtn" data-pid="' + esc(h.id) + '">' + esc(h.name) + (tag ? ' <small>' + esc(tag) + '</small>' : '') + '</button>';
      });
      if (many) lines.push('<span class="kin-tagmore">and ' + (items.length - cap + 1) + ' more</span>');
      var left = g.pt.x > cx;                                            // lists on the right half open to the left
      var gap = Math.max.apply(null, items.map(function (h) { return h.rad || 0; })) * scale + 12;   // clear of the ring
      var s = wide() ? { dir: left ? 'left' : 'right', off: [left ? -gap : gap, 0] } : roomy(g.items[0].ll, z, 175, gap, center);
      L.circleMarker(g.items[0].ll, { radius: 0, opacity: 0, fillOpacity: 0, interactive: false })
        .bindTooltip('<div class="kin-tag">' + (head ? '<b>' + esc(head) + '</b>' : '') + lines.join('') + '</div>',
          { permanent: true, interactive: true, direction: s.dir, offset: s.off, className: 'kin-name kin-list' })
        .addTo(tags);
    });
  }
  map.on('zoomend', function () { label(map.getZoom(), map.getCenter()); });

  var cards = root.querySelectorAll('.kin-card'), rail = root.querySelectorAll('.kin-rail button'), secs = root.querySelectorAll('.kin-rail p'), cur = -1;
  var each = function (sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); };
  function go(i) {
    if (i === cur) return; cur = i;
    for (var k = 0; k < cards.length; k++) cards[k].classList.toggle('on', k === i);
    for (k = 0; k < rail.length; k++) { rail[k].classList.toggle('on', k === i); rail[k].setAttribute('aria-current', k === i ? 'step' : 'false'); }
    var sec = rail[i] ? rail[i].getAttribute('data-sec') : '';
    for (k = 0; k < secs.length; k++) secs[k].classList.toggle('on', secs[k].getAttribute('data-sec') === sec);
    if (bar) bar.style.width = Math.round(100 * (i + 1) / cards.length) + '%';
    if (panOn) setPan(false);
    everyPick = null;                                  // a new step starts with its own default for "People without a stone"
    draw(i);
  }
  Array.prototype.forEach.call(cards, function (el, k) { el.addEventListener('click', function () { go(k); }); });
  // jump to a step: move the map now and ignore the cards scrolling past on the way
  var lock = 0;
  function jump(k) {
    lock = Date.now() + 1300; go(k);
    cards[k].scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: cards[k].offsetHeight > window.innerHeight * .8 ? 'start' : 'center' });
  }
  each('[data-step]', function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); jump(+a.getAttribute('data-step')); });
  });
  // a name in the family card: show the whole family and open that person's details
  each('.kin-chip', function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = b.getAttribute('data-person'), moved = cur !== D.familyStep;
      go(D.familyStep);
      setTimeout(function () { openPerson(id); }, moved ? 1200 : 0);
    });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (Date.now() < lock) return;
      es.forEach(function (e) { if (e.isIntersecting) go(Array.prototype.indexOf.call(cards, e.target)); });
    }, { rootMargin: wide() ? '-45% 0px -45% 0px' : '-72% 0px -24% 0px' });
    Array.prototype.forEach.call(cards, function (el) { io.observe(el); });
  }
  // a link like page#kin-prut-family-5 opens at finding 5
  var m = location.hash.match(new RegExp('^#' + SID + '-(\\d+)$'));
  var start = m ? Math.max(0, Math.min(cards.length - 1, +m[1] - 1 + D.firstFinding)) : 0;
  go(start); if (m) cards[start].scrollIntoView({ block: 'center' });
})();
