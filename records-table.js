import {people as P, ties as T} from "./records-data.js";

(function () {
  , root = document.getElementById('kin-prut-family-names');
  var q = root.querySelector('input[type=search]'), sel = root.querySelector('select'), count = root.querySelector('.kn-count');
  var tabs = root.querySelectorAll('.kn-tabs button'), panes = root.querySelectorAll('.kn-wrap'), tab = 0;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var PROG = { W: 'Witness Stone', S: 'Stopping Stone' }, SURE = ['Shown in records', 'Likely', 'Possible'], LIKE = ['', ' <em class="kn-c1">likely</em>', ' <em class="kn-c2">possible</em>'];
  var nm = function (n) { return n === 'name not recorded' ? '<span class="kn-none">Name not recorded</span>' : esc(n); };
  function stone(s) {
    var t = esc((PROG[s[1]] || 'Stone') + ' ' + s[0]);
    return s[2] ? '<a href="' + esc(s[2]) + '" target="_blank" rel="noopener">' + t + '</a>' : t;
  }
  var KL = { name: 'Commemorated by name', descendant: 'Descendant (born after slavery)', record: 'Named in the records (not commemorated)' };
  function rowP(r) {
    var dot = r[1].length ? (r[1][0][1] === 'S' ? 'kn-dot kn-s' : 'kn-dot kn-w') : r[7] === 'name' ? 'kn-dot' : 'kn-dot kn-o';
    var ties = r[4].map(function (t) { return esc(t[0] + ' ' + t[1]) + LIKE[t[2]]; });
    var tc = ties.length > 4 ? '<details><summary>' + ties.slice(0, 3).join('; ') + '; and ' + (ties.length - 3) + ' more</summary>' +
             ties.slice(3).join('; ') + '</details>' : ties.join('; ');
    return '<tr><td class="kn-name"><i class="' + dot + '" aria-hidden="true"></i>' + nm(r[0]) +
           (r[5] ? ' <span class="kn-years">' + esc(r[5]) + '</span>' : '') + (r[6] ? '<span class="kn-desc">' + esc(r[6]) + '</span>' : '') +
           '</td><td>' + (r[1].length ? r[1].map(stone).join('<br>') : '<span class="kn-k-' + r[7] + '">' + KL[r[7]] + '</span>') + '</td><td>' + esc(r[2]) +
           (r[3] ? ', ' + esc(r[3]) : '') + '</td><td class="kn-small kn-hide-s">' + tc + '</td></tr>';
  }
  function rowT(r) {
    var who = function (n, s) { return nm(n) + (s ? '<br><span class="kn-small">' + esc(s) + '</span>' : ''); };
    return '<tr><td class="kn-name">' + who(r[0], r[1]) + '</td><td>' + esc(r[2]) + (r[6] ? '<br><span class="kn-small">' + esc(r[6]) + '</span>' : '') +
           '</td><td class="kn-name">' + who(r[3], r[4]) + '</td><td class="kn-sure kn-c' + r[5] + '">' + SURE[r[5]] + '</td><td class="kn-ev kn-hide-s">' +
           esc(r[7]) + (r[8] ? '<br><span class="kn-small">Source: ' + esc(r[8]) + '</span>' : '') + '</td></tr>';
  }
  var D = [
    { rows: P, html: null, make: rowP, cols: 4, what: 'people', text: function (r) {
        return r[0] + ' ' + r[1].map(function (s) { return s[0] + ' ' + s[0].replace(' ', ''); }).join(' ') + ' ' + r[2] + ' ' + r[3] + ' ' +
               r[4].map(function (t) { return t[1]; }).join(' '); } },
    { rows: T, html: null, make: rowT, cols: 5, what: 'ties', text: function (r) {
        return [r[0], r[1], (r[1] || '').replace(' ', ''), r[2], r[3], r[4], (r[4] || '').replace(' ', ''), r[6], r[7], r[8]].join(' '); } }
  ];
  var POPT = sel.innerHTML, TOPT = '<option value="all">All ties</option><option value="counted">Between people commemorated here</option>'
    + '<option value="others">Involving descendants or others in the records</option>';
  var PAGE = 100, lim = PAGE, moreBtn = root.querySelector('.kn-more'), allBtn = root.querySelector('.kn-all');
  function show(keep) {
    if (!keep) lim = PAGE;
    var d = D[tab], words = q.value.toLowerCase().split(/\s+/).filter(Boolean), f = sel.value, out = [];
    if (!d.html) { d.html = d.rows.map(d.make); d.low = d.rows.map(function (r) { return d.text(r).toLowerCase(); }); }
    d.rows.forEach(function (r, k) {
      if (!tab && f !== 'all' && (f === 'stone' ? !r[1].length : f === 'name' ? r[7] !== 'name' : r[7] === 'stone' || r[7] === 'name')) return;
      if (tab && f !== 'all' && (f === 'counted' ? !r[9] : !!r[9])) return;
      if (words.some(function (w) { return d.low[k].indexOf(w) < 0; })) return;
      out.push(d.html[k]);
    });
    var n = out.length, left = n - lim;
    panes[tab].querySelector('tbody').innerHTML = out.slice(0, lim).join('') || '<tr><td colspan="' + d.cols + '" class="kn-none">Nothing matches this search.</td></tr>';
    count.textContent = 'Showing ' + Math.min(lim, n).toLocaleString() + ' of ' + n.toLocaleString() + ' ' + (n === d.rows.length ? '' : 'matching ') + d.what;
    moreBtn.hidden = allBtn.hidden = left <= 0;
    moreBtn.textContent = 'Show ' + Math.min(PAGE, left) + ' more'; allBtn.textContent = 'Show all ' + n.toLocaleString();
  }
  moreBtn.addEventListener('click', function () { lim += PAGE; show(true); });
  allBtn.addEventListener('click', function () { lim = Infinity; show(true); });
  Array.prototype.forEach.call(tabs, function (b, k) {
    b.addEventListener('click', function () {
      tab = k;
      Array.prototype.forEach.call(tabs, function (x, j) { x.setAttribute('aria-selected', j === k ? 'true' : 'false'); });
      Array.prototype.forEach.call(panes, function (x, j) { x.hidden = j !== k; });
      sel.innerHTML = k ? TOPT : POPT; sel.value = 'all';
      show();
    });
  });
  q.addEventListener('input', show); sel.addEventListener('change', show); show();
})();
