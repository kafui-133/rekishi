(function () {
  'use strict';
  const H = window.HISTORY;
  const { EVENTS, ERAS, EMPERORS, PEOPLE, PERIODS, REGIONS } = H;
  const regionById = new Map(REGIONS.map(r => [r.id, r]));
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CAT = { jp: '国内', ex: '交流・外交', war: '戦い', culture: '文化・宗教', world: '世界', disaster: '災害' };
  const evById = new Map(EVENTS.map(e => [e.id, e]));
  const personById = new Map(PEOPLE.map(p => [p.id, p]));
  const incoming = new Map(EVENTS.map(e => [e.id, []]));
  EVENTS.forEach(e => e.rel.forEach(([to, label]) => incoming.get(to).push([e.id, label])));
  const personEvents = new Map(PEOPLE.map(p => [p.id, []]));
  EVENTS.forEach(e => e.people.forEach(id => personEvents.get(id).push(e)));

  // ---------- 時間軸（古代を圧縮した区分線形スケール）
  const KN = [[-660, 0], [0, .05], [500, .12], [1500, .5], [1868, .78], [2027, 1]];
  function y2p(y) {
    for (let i = 1; i < KN.length; i++) {
      if (y <= KN[i][0] || i === KN.length - 1) {
        const [y0, p0] = KN[i - 1], [y1, p1] = KN[i];
        return clamp(p0 + (y - y0) / (y1 - y0) * (p1 - p0), 0, 1);
      }
    }
  }
  function p2y(p) {
    for (let i = 1; i < KN.length; i++) {
      if (p <= KN[i][1] || i === KN.length - 1) {
        const [y0, p0] = KN[i - 1], [y1, p1] = KN[i];
        return y0 + (p - p0) / (p1 - p0) * (y1 - y0);
      }
    }
  }
  const yearInt = y => Math.floor(y + 1e-6);
  const fmtYear = y => { y = yearInt(y); return y <= 0 ? `紀元前${-y || 1}年` : `${y}年`; };

  // ---------- 元号・天皇・時代
  const ERA_END = { 白雉: 654, 朱鳥: 686 };
  function eraFor(y, court) {
    let found = null;
    for (const e of ERAS) { if (e.from > y) break; if (!e.court || e.court === court) found = e; }
    if (!found) return null;
    if (ERA_END[found.name] !== undefined && y > ERA_END[found.name]) return null;
    return found;
  }
  const eraYearStr = (e, y) => { const n = y - e.from + 1; return `${e.name}${n === 1 ? '元' : n}年`; };
  function eraText(yf) {
    const y = yearInt(yf);
    const n = eraFor(y, 'N'), s = eraFor(y, 'S');
    if (y >= 1331 && y < 1392 && n && s && n !== s) return `南朝 ${eraYearStr(s, y)}／北朝 ${eraYearStr(n, y)}`;
    if (n) return eraYearStr(n, y);
    return y < 645 ? '元号以前' : '元号なし';
  }
  function emperorAt(yf) {
    const y = yearInt(yf); let r = null;
    for (const e of EMPERORS) { if (e.from <= y) r = e; else break; }
    return r;
  }
  const periodAt = yf => { const y = yearInt(yf); return PERIODS.find(p => y >= p.from && y < p.to) || PERIODS[PERIODS.length - 1]; };

  // ---------- 地図
  const svg = d3.select('#map');
  const root = svg.append('g');
  const WW = 1000, BASE = WW / (2 * Math.PI);
  const proj = d3.geoMercator().scale(BASE).translate([0, 0]);
  const geo = d3.geoPath(proj);
  const X = lon => lon * Math.PI / 180 * BASE;
  const Y = lat => proj([0, clamp(lat, -84, 84)])[1];
  const XY = ([lo, la]) => [X(lo), Y(la)];

  // 経度を日本中心（-30〜330度）にそろえ、経路は前の点から連続するようにつなぐ
  const normLon = l => { while (l < -30) l += 360; while (l >= 330) l -= 360; return l; };
  function unwrap(pts) {
    const out = []; let prev = null;
    for (const [lo, la] of pts) {
      let L = prev === null ? normLon(lo) : lo;
      if (prev !== null) { while (L - prev > 180) L -= 360; while (L - prev < -180) L += 360; }
      out.push([L, la]); prev = L;
    }
    return out;
  }
  EVENTS.forEach((e, i) => { e.i = i; e.p = y2p(e.y); e.npts = unwrap(e.pts); });

  const defs = svg.append('defs');
  const tile = defs.append('g').attr('id', 'tile');
  const W = window.WORLD;
  tile.append('path').attr('class', 'grid').attr('d', geo(d3.geoGraticule().step([15, 15]).extent([[-180, -80], [180.01, 80.01]])()));
  tile.append('path').attr('class', 'land').attr('d', geo(topojson.feature(W, W.objects.land)));
  // 国別の色分け（現在の国境）。隣り合う国が同じ色にならないよう貪欲法で塗り分ける
  const cFeats = topojson.feature(W, W.objects.countries).features;
  const cNb = topojson.neighbors(W.objects.countries.geometries);
  const cColor = [];
  cFeats.map((f, i) => i).sort((a, b) => cNb[b].length - cNb[a].length).forEach(i => {
    const used = new Set(cNb[i].map(j => cColor[j]));
    let c = 0; while (used.has(c)) c++;
    cColor[i] = c % 8;
  });
  tile.append('g').attr('class', 'countries').selectAll('path').data(cFeats).join('path')
    .attr('class', (f, i) => `cty c${cColor[i]}`).attr('d', geo);
  tile.append('path').attr('class', 'borders').attr('d', geo(topojson.mesh(W, W.objects.countries, (a, b) => a !== b)));
  const japan = topojson.feature(W, W.objects.countries).features.find(f => +f.id === 392);
  if (japan) tile.append('path').attr('class', 'japan').attr('d', geo(japan));
  const gTiles = root.append('g');
  [-WW, 0, WW].forEach(dx => gTiles.append('use').attr('href', '#tile').attr('x', dx));
  // 勢力図（主要国の当時の範囲）。表示する時点のデータだけを描き直す
  const powerTile = defs.append('g').attr('id', 'powerTile');
  const gPower = root.append('g').attr('display', 'none');
  [-WW, 0, WW].forEach(dx => gPower.append('use').attr('href', '#powerTile').attr('x', dx));
  const gHist = root.append('g');
  const gCity = root.append('g').attr('class', 'city');
  const gRoutes = root.append('g');
  const gMarks = root.append('g');

  // 当時の国・地域名（年代で切り替わる）
  const HL = [
    ['春秋・戦国', -770, -221, 112, 34, 'L'], ['秦', -221, -206, 110, 34, 'L'], ['漢', -206, 220, 110, 33, 'L'], ['魏・呉・蜀', 220, 280, 110, 32, 'L'],
    ['晋・南北朝', 280, 589, 110, 32, 'L'], ['隋', 589, 618, 110, 33, 'L'], ['唐', 618, 907, 108, 33, 'L'], ['五代十国', 907, 960, 110, 32, 'L'],
    ['宋', 960, 1271, 112, 30, 'L'], ['金', 1115, 1234, 120, 44, 'M'], ['元', 1271, 1368, 108, 36, 'L'], ['明', 1368, 1644, 110, 31, 'L'], ['清', 1644, 1912, 108, 34, 'L'],
    ['中華民国', 1912, 1949, 110, 31, 'L'], ['中華人民共和国', 1949, 3000, 106, 33, 'L'],
    ['古朝鮮', -660, -108, 126, 40.5, 'S'], ['楽浪郡', -108, 313, 125.6, 38.8, 'S'], ['高句麗', -37, 668, 126.5, 41, 'S'], ['百済', -18, 660, 126.9, 36.2, 'S'],
    ['新羅', -57, 935, 128.9, 35.9, 'S'], ['渤海', 698, 926, 129, 43.6, 'S'], ['高麗', 918, 1392, 127.6, 37.2, 'M'], ['朝鮮', 1392, 1897, 127.6, 37.2, 'M'],
    ['大韓帝国', 1897, 1910, 127.6, 37.2, 'M'], ['日本統治下の朝鮮', 1910, 1945, 127.6, 37.8, 'S'], ['大韓民国', 1948, 3000, 128, 36.4, 'S'], ['北朝鮮', 1948, 3000, 126.9, 40.2, 'S'],
    ['倭', -660, 701, 138.2, 36.4, 'L'], ['日本', 701, 3000, 138.4, 36.6, 'L'], ['蝦夷地', 600, 1869, 143, 43.3, 'S'], ['北海道', 1869, 3000, 143, 43.3, 'S'],
    ['琉球王国', 1429, 1879, 127.9, 27.1, 'S'], ['米国統治下の沖縄', 1945, 1972, 127.9, 27.1, 'S'], ['台湾（日本統治）', 1895, 1945, 121, 23.6, 'S'],
    ['満州国', 1932, 1945, 125, 45.5, 'M'], ['匈奴', -209, 91, 103, 46, 'M'], ['突厥', 552, 744, 100, 47, 'M'], ['モンゴル帝国', 1206, 1271, 103, 47, 'L'],
    ['ロシア帝国', 1721, 1917, 90, 62, 'L'], ['ソ連', 1922, 1991, 90, 62, 'L'], ['ロシア', 1991, 3000, 90, 62, 'L'], ['モスクワ大公国', 1480, 1721, 40, 57, 'M'],
    ['ローマ帝国', -27, 395, 16, 44, 'L'], ['西ローマ帝国', 395, 476, 8, 45, 'M'], ['ビザンツ帝国', 395, 1453, 29, 39, 'M'], ['フランク王国', 481, 843, 3, 48, 'M'],
    ['神聖ローマ帝国', 962, 1806, 11, 50, 'M'], ['オスマン帝国', 1299, 1922, 34, 38.5, 'M'], ['イギリス', 1707, 3000, -2, 53.5, 'S'], ['フランス', 843, 3000, 2.5, 46.5, 'S'],
    ['ポルトガル', 1143, 3000, -8, 39.6, 'S'], ['スペイン', 1479, 3000, -3.7, 40, 'S'], ['オランダ', 1581, 3000, 5.5, 52.4, 'S'], ['ドイツ帝国', 1871, 1918, 11, 51, 'S'], ['ドイツ', 1918, 3000, 11, 51, 'S'],
    ['アケメネス朝ペルシア', -550, -330, 53, 32, 'M'], ['パルティア', -247, 224, 53, 32, 'M'], ['ササン朝ペルシア', 224, 651, 53, 32, 'M'],
    ['サファヴィー朝', 1501, 1736, 53, 32, 'M'], ['ガージャール朝', 1789, 1925, 53, 32, 'M'], ['イラン', 1925, 3000, 53, 32, 'M'], ['イスラム帝国', 651, 1258, 45, 29, 'M'],
    ['セルジューク朝', 1037, 1194, 45, 36, 'M'], ['トルコ', 1923, 3000, 34, 39, 'M'],
    ['プトレマイオス朝', -305, -30, 30, 27, 'S'], ['ローマ領エジプト', -30, 641, 30, 27, 'S'], ['ファーティマ朝', 909, 1171, 30, 27, 'S'], ['アイユーブ朝', 1171, 1250, 30, 27, 'S'],
    ['マムルーク朝', 1250, 1517, 30, 27, 'S'], ['ムハンマド・アリー朝エジプト', 1805, 1953, 30, 27, 'S'], ['エジプト', 1953, 3000, 30, 27, 'S'],
    ['柔然', 402, 552, 103, 46, 'M'], ['ウイグル', 744, 840, 103, 47, 'M'], ['北元', 1368, 1635, 104, 46, 'M'], ['清領モンゴル', 1691, 1911, 104, 46, 'S'], ['モンゴル', 1911, 3000, 104, 46.5, 'M'],
    ['シュリーヴィジャヤ', 650, 1300, 104, -1, 'S'], ['マジャパヒト', 1293, 1527, 112, -7.5, 'S'], ['オランダ領東インド', 1800, 1945, 112, -2, 'S'], ['インドネシア', 1945, 3000, 113, -1, 'S'],
    ['大越', 1009, 1804, 105.8, 20.5, 'S'], ['ベトナム（阮朝）', 1804, 1887, 106.5, 16, 'S'], ['仏領インドシナ', 1887, 1945, 105.5, 16, 'S'], ['ベトナム', 1945, 3000, 106.5, 16, 'S'],
    ['アンコール朝', 802, 1431, 104, 12.8, 'S'], ['アユタヤ朝', 1351, 1767, 100.5, 15.5, 'S'], ['シャム', 1782, 1939, 100.5, 15.5, 'S'], ['タイ', 1939, 3000, 100.5, 15.5, 'S'],
    ['マウリヤ朝', -322, -185, 80, 23, 'M'], ['クシャーナ朝', 30, 375, 72, 32, 'S'], ['グプタ朝', 320, 550, 80, 23, 'M'], ['デリー・スルタン朝', 1206, 1526, 78, 25, 'S'],
    ['ギリシア', -800, -146, 22, 39.3, 'S'], ['ローマ（共和政）', -509, -27, 13, 42.5, 'M'], ['ヴェネツィア共和国', 697, 1797, 12.3, 45.6, 'S'], ['教皇領', 756, 1870, 12.6, 42.6, 'S'],
    ['イタリア王国', 1861, 1946, 12.5, 43, 'S'], ['イタリア', 1946, 3000, 12.5, 43, 'S'], ['ギリシャ', 1830, 3000, 22, 39.3, 'S'],
    ['イングランド王国', 927, 1707, -1.5, 52.5, 'S'], ['プロイセン', 1701, 1871, 14, 53, 'S'], ['アル＝アンダルス（イスラム勢力）', 711, 1492, -4.5, 37.8, 'S'],
    ['イギリス領13植民地', 1607, 1776, -77, 38, 'S'], ['ポルトガル領ブラジル', 1500, 1822, -52, -12, 'S'], ['ブラジル', 1822, 3000, -52, -12, 'M'],
    ['ペルー', 1821, 3000, -75, -10, 'S'], ['キューバ', 1902, 3000, -79.5, 21.8, 'S'], ['大コロンビア', 1819, 1831, -74, 4.7, 'S'], ['ムガル帝国', 1526, 1858, 78, 23, 'M'], ['英領インド', 1858, 1947, 78, 23, 'M'], ['インド', 1947, 3000, 78, 23, 'M'],
    ['アステカ', 1325, 1521, -99, 20, 'S'], ['スペイン領メキシコ', 1521, 1821, -102, 24, 'S'], ['メキシコ', 1821, 3000, -102, 24, 'S'], ['アメリカ合衆国', 1776, 3000, -99, 39, 'L'],
    ['インカ帝国', 1438, 1533, -72, -14, 'S'], ['スペイン領フィリピン', 1571, 1898, 122.5, 12, 'S'], ['フィリピン', 1946, 3000, 122.5, 12, 'S'],
  ];
  const HL_SIZE = { L: 20, M: 14, S: 11 };
  const hlData = [];
  HL.forEach(([name, from, to, lon, lat, size]) => {
    const L = normLon(lon);
    [L, L + 360].forEach(l => hlData.push({ name, from, to, x: X(l), y: Y(lat), size }));
  });
  const hlSel = gHist.selectAll('text').data(hlData).join('text').attr('class', 'hl').attr('x', d => d.x).attr('y', d => d.y).text(d => d.name);

  // 都市名（拡大時のみ）
  const CITY = [
    ['飛鳥', 592, 710, 'asuka'], ['平城京（奈良）', 710, 794, 'nara'], ['奈良', 794, 3000, 'nara'], ['平安京（京都）', 794, 1185, 'kyoto'], ['京都', 1185, 3000, 'kyoto'],
    ['難波', 400, 1583, 'naniwa'], ['大坂', 1583, 1868, 'osaka'], ['大阪', 1868, 3000, 'osaka'], ['鎌倉', 1180, 3000, 'kamakura'], ['江戸', 1457, 1868, 'edo'], ['東京', 1868, 3000, 'tokyo'],
    ['大宰府', 600, 1400, 'dazaifu'], ['博多', 1000, 3000, 'hakata'], ['長崎', 1571, 3000, 'nagasaki'], ['鹿児島', 1600, 3000, 'kagoshima'], ['平泉', 1090, 1189, 'hiraizumi'],
    ['仙台', 1600, 3000, 'sendai'], ['箱館', 1454, 1869, 'hakodate'], ['函館', 1869, 3000, 'hakodate'], ['広島', 1589, 3000, 'hiroshima'], ['横浜', 1859, 3000, 'yokohama'],
    ['首里', 1429, 1879, 'naha'], ['那覇', 1879, 3000, 'naha'], ['長安', -202, 904, 'xian'], ['洛陽', -770, 1000, 'luoyang'], ['明州（寧波）', 700, 3000, 'ningbo'],
    ['揚州', 600, 3000, 'yangzhou'], ['大都', 1271, 1368, 'beijing'], ['北京', 1421, 3000, 'beijing'], ['南京', 1368, 3000, 'nanjing'], ['慶州', -57, 935, 'gyeongju'],
    ['漢城', 1394, 1910, 'seoul'], ['ソウル', 1945, 3000, 'seoul'], ['平壌', -108, 3000, 'pyongyang'], ['釜山', 1400, 3000, 'busan'], ['上海', 1843, 3000, 'shanghai'], ['香港', 1842, 3000, 'hongkong'],
  ];
  const cityData = CITY.map(([name, from, to, pl]) => { const [lo, la] = H.PLACES[pl]; const L = normLon(lo); return { name, from, to, x: X(L), y: Y(la) }; });
  const citySel = gCity.selectAll('g').data(cityData).join('g');
  citySel.append('circle');
  citySel.append('text');
  citySel.select('text').text(d => d.name);

  // ---------- 拡大縮小
  let T = d3.zoomIdentity, Wd = 800, Ht = 500;
  const zoom = d3.zoom().scaleExtent([0.5, 120]).on('zoom', ev => { if (!isFinite(ev.transform.k) || !isFinite(ev.transform.x)) return; T = ev.transform; root.attr('transform', T); rescale(); });
  svg.call(zoom).on('dblclick.zoom', null);
  function measure() { const r = svg.node().getBoundingClientRect(); Wd = r.width || 800; Ht = r.height || 500; }

  const VIEWS = { jp: [[122.5, 24], [147, 46]], asia: [[96, 12], [150, 52]], world: [[-25, -48], [325, 72]] };
  const VIEW_ORDER = ['jp', 'asia', 'world'];
  let viewMode = 'auto', camKey = '';
  function fit(b, dur) {
    const x0 = X(b[0][0]), x1 = X(b[1][0]), y0 = Y(b[1][1]), y1 = Y(b[0][1]);
    const k = clamp(Math.min(Wd / ((x1 - x0) * 1.08), Ht / ((y1 - y0) * 1.1)), 0.5, 120);
    if (!isFinite(k) || !isFinite(x0 + x1 + y0 + y1)) return;
    const t = d3.zoomIdentity.translate(Wd / 2 - (x0 + x1) / 2 * k, Ht / 2 - (y0 + y1) / 2 * k).scale(k);
    svg.interrupt();
    if (dur && !reduceMotion) svg.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, t);
    else svg.call(zoom.transform, t);
  }
  const inside = (pts, b) => pts.every(([lo, la]) => lo >= b[0][0] && lo <= b[1][0] && la >= b[0][1] && la <= b[1][1]);
  function autoView(e) {
    const rb = regionById.get(region).box;
    if (rb && inside(e.npts, rb)) return ['reg:' + region, rb];
    for (let i = VIEW_ORDER.indexOf(e.view); i < VIEW_ORDER.length; i++) {
      const v = VIEW_ORDER[i];
      if (inside(e.npts, VIEWS[v])) return [v, VIEWS[v]];
    }
    const los = e.npts.map(p => p[0]), las = e.npts.map(p => p[1]);
    return ['ev:' + e.id, [[Math.min(...los) - 12, Math.min(...las) - 10], [Math.max(...los) + 12, Math.max(...las) + 10]]];
  }
  function camera(key, box, dur) { if (key === camKey) return; camKey = key; fit(box, dur); }
  function applyView(dur) {
    if (viewMode === 'auto') { const e = EVENTS[focusIdx]; if (e) { const [k, b] = autoView(e); camera(k, b, dur); } }
    else camera(viewMode, VIEWS[viewMode], dur);
  }

  function rescale() {
    const k = T.k, y = yearInt(cur);
    const pw = colorMode === 'power';
    hlSel.attr('font-size', d => HL_SIZE[d.size] / k)
      .attr('display', d => (!pw && y >= d.from && y < d.to && (d.size !== 'S' || k > 2.6)) ? null : 'none');
    if (pw) {
      // 画面上で十分な大きさがある国だけ名前を出す
      powerTile.selectAll('text').attr('font-size', d => clamp(9 + Math.sqrt(d.a) * 0.15, 10, 20) / k).attr('stroke-width', 3 / k)
        .attr('display', d => Math.sqrt(d.a) * 1.59 * k > 45 ? null : 'none');
    }
    citySel.attr('display', d => (k > 7 && y >= d.from && y < d.to) ? null : 'none');
    citySel.select('circle').attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 2.2 / k);
    citySel.select('text').attr('x', d => d.x + 4 / k).attr('y', d => d.y - 3 / k).attr('font-size', 11 / k).attr('stroke-width', 3 / k);
    gRoutes.selectAll('path.route').attr('stroke-width', 2.4 / k).attr('stroke-dasharray', `${7 / k} ${6 / k}`);
    gRoutes.selectAll('path.route-shadow').attr('stroke-width', 6 / k);
    gMarks.selectAll('g.mk:not(.mover)').attr('transform', d => `translate(${d.x},${d.y}) scale(${1 / k})`);
  }

  // ---------- 絵（船・印）
  const SHIP = `<g class="bob">
    <path d="M-22 11 q4 -3 8 0 q4 3 8 0" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.2"/>
    <path d="M-15 1 L15 1 L10 9 L-11 9 Z" fill="#7a5230" stroke="#3b2814" stroke-width="1"/>
    <line x1="-1" y1="1" x2="-1" y2="-20" stroke="#3b2814" stroke-width="1.6"/>
    <rect x="-9" y="-18" width="16" height="14" rx="1" fill="#efe4c4" stroke="#3b2814" stroke-width="1"/>
    <line x1="-9" y1="-13.5" x2="7" y2="-13.5" stroke="#8a7550" stroke-width=".8"/>
    <line x1="-9" y1="-9" x2="7" y2="-9" stroke="#8a7550" stroke-width=".8"/>
    <path class="flag" d="M-1 -20 L9 -22 L-1 -25 Z"/></g>`;
  const STEAM = `<g class="bob">
    <circle class="smoke" cx="-6" cy="-19" r="3.5" fill="#9a9a9a"/>
    <circle class="smoke" cx="-12" cy="-24" r="4.5" fill="#b8b8b8" style="animation-delay:.5s"/>
    <path d="M-25 12 q4 -3 8 0 q4 3 8 0" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.2"/>
    <path d="M-18 2 L18 2 L13 10 L-15 10 Z" fill="#1d1d1d" stroke="#000" stroke-width="1"/>
    <rect x="-12" y="-3" width="20" height="5" fill="#3d3d3d"/>
    <rect x="-3" y="-15" width="5" height="12" fill="#262626"/>
    <rect x="-3" y="-15" width="5" height="2.5" fill="#b33"/>
    <line x1="11" y1="2" x2="11" y2="-17" stroke="#222" stroke-width="1.4"/>
    <path d="M11 -15 L17 -8 L11 -8 Z" fill="#e5e5e5" stroke="#555" stroke-width=".6"/>
    <path class="flag" d="M11 -17 L18 -19 L11 -21 Z"/></g>`;
  const badge = icon => `<circle class="badge" r="14"/><text class="emoji" font-size="15">${icon}</text>`;

  // ---------- モード（ざっくり／詳細 × 地域）
  const store = {
    get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても動作は続ける */ } },
  };
  let level = store.get('rekishi.level', '1') === '2' ? 2 : 1;
  let region = regionById.has(store.get('rekishi.region', 'all')) ? store.get('rekishi.region', 'all') : 'all';
  const inRegion = (e, r) => r === 'all' || (r === 'jp' ? e.reg.includes('jp') : r === 'world' ? e.reg.some(x => x !== 'jp') : e.reg.includes(r));
  const isActive = e => e.lv <= level && inRegion(e, region);
  let ACTIVE = EVENTS.filter(isActive);

  // ---------- 表示する出来事
  let WIN = 0.022;
  let pos = 0, cur = -660, focusIdx = -1;
  function markersFor(list) {
    const m = [];
    list.forEach(e => {
      const age = clamp((pos - e.p) / WIN, 0, 1);
      const isF = e.i === focusIdx;
      if (e.route) {
        const [x, y] = XY(e.npts[e.npts.length - 1]);
        m.push({ key: 'm:' + e.id, type: 'mover', e, age, isF });
        m.push({ key: 'd:' + e.id, type: 'dest', e, age, isF, x, y });
      } else {
        const [x, y] = XY(e.npts[0]);
        m.push({ key: 'p:' + e.id, type: 'pin', e, age, isF, x, y });
      }
    });
    return m;
  }
  function routeD(e) {
    const pts = e.npts.map(XY);
    if (pts.length === 2) {
      const [a, b] = pts, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      pts.splice(1, 0, [mx - dy * 0.12, my + dx * 0.12]);
    }
    return d3.line().curve(d3.curveCatmullRom.alpha(0.5))(pts);
  }
  let visKey = '';
  function updateVisible(force) {
    const vis = EVENTS.filter(e => (e.p <= pos + 1e-9 && pos - e.p < WIN && isActive(e)) || e.i === focusIdx);
    const key = vis.map(e => e.id).join(',') + '|' + focusIdx + '|' + Math.round(pos * 400);
    if (key === visKey && !force) return;
    visKey = key;
    const now = performance.now();

    const rs = gRoutes.selectAll('g.r').data(vis.filter(e => e.route), d => d.id);
    rs.exit().remove();
    const rsE = rs.enter().append('g').attr('class', 'r');
    rsE.append('path').attr('class', 'route-shadow').attr('d', routeD);
    rsE.append('path').attr('class', 'route').attr('d', routeD).style('stroke', d => `var(--c-${d.cat})`)
      .each(function (d) { d._path = this; d._len = this.getTotalLength(); d._t0 = now; });
    rsE.merge(rs).classed('old', d => d.i !== focusIdx && (pos - d.p) / WIN > 0.5).raise();
    gRoutes.selectAll('g.r').filter(d => d.i === focusIdx).raise();

    const ms = gMarks.selectAll('g.mk').data(markersFor(vis), d => d.key);
    ms.exit().remove();
    const mE = ms.enter().append('g').attr('class', d => 'mk ' + d.type)
      .style('--flagc', d => `var(--c-${d.e.cat})`)
      .on('click', (ev, d) => { ev.stopPropagation(); setPos(d.e.p, d.e.i); });
    mE.each(function (d) {
      const g = d3.select(this), c = `var(--c-${d.e.cat})`;
      if (d.type === 'mover') {
        const inner = d.e.icon === '⛵' ? SHIP : d.e.icon === '🚢' ? STEAM : badge(d.e.icon);
        g.html(`<g class="flipper">${inner}</g>`);
        g.selectAll('.flag').attr('fill', c);
        g.selectAll('.badge').attr('stroke', c);
      } else if (d.type === 'dest') {
        g.html(`<circle class="pulse" r="9"/><circle class="dest" r="7"/><circle r="3"/>`);
        g.selectAll('circle').attr('stroke', c); g.select('circle:last-child').attr('fill', c);
        if (d.e.icon !== '⛵' && d.e.icon !== '🚢') { /* 経路の絵は移動体で表示 */ }
      } else {
        g.html(`<circle class="pulse" r="14"/>${badge(d.e.icon)}`);
        g.selectAll('.pulse, .badge').attr('stroke', c);
      }
      if (d.type !== 'mover') {
        const lx = d.type === 'pin' ? 19 : 11;
        g.append('text').attr('class', 'evlabel').attr('x', lx).attr('y', 5);
      }
    });
    const all = mE.merge(ms);
    all.classed('focus', d => d.e.i === focusIdx).classed('old', d => d.e.i !== focusIdx && (pos - d.e.p) / WIN > 0.45)
      .style('opacity', d => d.e.i === focusIdx ? 1 : 1 - 0.65 * clamp((pos - d.e.p) / WIN, 0, 1));
    all.select('text.evlabel').each(function (d) {
      const t = d3.select(this);
      t.html(`<tspan class="y">${esc(fmtYear(d.e.y))} </tspan>${esc(d.e.title)}`);
      t.attr('display', (d.e.i === focusIdx || (pos - d.e.p) / WIN < 0.6) ? null : 'none');
    });
    all.select('.pulse').attr('display', d => d.e.i === focusIdx ? null : 'none');
    gMarks.selectAll('g.mk').filter(d => d.e.i === focusIdx).raise();
    rescale();
  }

  function animate(now) {
    const k = T.k;
    gMarks.selectAll('g.mover').each(function (d) {
      const e = d.e; if (!e._path) return;
      const L = e._len;
      const dur = clamp(L * k / 70, 3.5, 14) * 1000;
      let t = ((now - e._t0) % (dur * 1.2)) / dur;
      t = Math.min(1, t);
      if (reduceMotion) t = 1;
      const a = e._path.getPointAtLength(t * L);
      const b = e._path.getPointAtLength(clamp(t * L + (t < 1 ? 1 : -1) * 2 / k, 0, L));
      const dir = t < 1 ? (b.x < a.x ? -1 : 1) : (b.x > a.x ? -1 : 1);
      this.setAttribute('transform', `translate(${a.x},${a.y}) scale(${1 / k})`);
      this.firstChild.setAttribute('transform', `scale(${dir},1)`);
    });
    gRoutes.selectAll('path.route').attr('stroke-dashoffset', reduceMotion ? 0 : -(now / 70) / k);
  }

  // ---------- サイドパネル
  const chipEv = (e, lbl) => `<button class="chip" data-ev="${e.id}"><span class="cy">${esc(fmtYear(e.y))}</span>${esc(e.title)}${lbl ? `<span class="lbl">${esc(lbl)}</span>` : ''}</button>`;
  const chipP = p => `<button class="chip person" data-person="${p.id}">${esc(p.name)}</button>`;
  function renderSide(e) {
    const side = $('#side');
    if (!e) { side.innerHTML = '<p class="empty">出来事を選んでください。</p>'; return; }
    const ey = yearInt(e.y);
    const era = ey >= 645 ? eraText(e.y) : '';
    // つながり（2段階まで）
    const in1 = incoming.get(e.id).map(([id, l]) => [evById.get(id), l]);
    const out1 = e.rel.map(([id, l]) => [evById.get(id), l]);
    const seen = new Set([e.id, ...in1.map(x => x[0].id), ...out1.map(x => x[0].id)]);
    const in2 = [], out2 = [];
    in1.forEach(([x]) => incoming.get(x.id).forEach(([id, l]) => { if (!seen.has(id)) { seen.add(id); in2.push([evById.get(id), l]); } }));
    out1.forEach(([x]) => x.rel.forEach(([id, l]) => { if (!seen.has(id)) { seen.add(id); out2.push([evById.get(id), l]); } }));
    const row = (label, items, cls = '') => items.length ? `<div class="row ${cls}"><div class="rl">${label}</div><div class="chips">${items.map(([x, l]) => chipEv(x, l)).join('')}</div></div>` : '';
    const parts = [row('さらに前の背景', in2), row('きっかけ・背景', in1), `<div class="row me"><div class="rl">この出来事</div><div class="chips">${chipEv(e)}</div></div>`, row('その後・影響', out1), row('さらにその先', out2)].filter(Boolean);
    const flow = (in1.length || out1.length) ? parts.join('<div class="arrow">↓</div>') : '<p class="empty">登録されたつながりはありません。</p>';
    // 同じころ（日本の出来事なら世界、世界の出来事なら日本）
    const wantWorld = e.reg.includes('jp');
    const contemp = EVENTS.filter(x => x !== e && x.lv <= level && (wantWorld ? !x.reg.includes('jp') : x.reg.includes('jp')) && Math.abs(x.y - e.y) <= 60)
      .sort((a, b) => Math.abs(a.y - e.y) - Math.abs(b.y - e.y)).slice(0, 6).sort((a, b) => a.y - b.y);
    const emp = emperorAt(e.y);
    side.innerHTML = `
      <div>
        <div class="evhead"><span class="cat" style="background:var(--c-${e.cat})">${CAT[e.cat]}</span><span>${esc(fmtYear(e.y))}${era ? `（${esc(era)}）` : ''}</span>${e.lv === 2 ? '<span class="lvtag">詳細</span>' : ''}</div>
        <h2>${esc(e.title)}</h2>
        <p class="desc">${esc(e.desc)}</p>
      </div>
      ${e.people.length ? `<div><h3>関わった人物</h3><div class="chips">${e.people.map(id => chipP(personById.get(id))).join('')}</div></div>` : ''}
      ${emp && e.y >= -660 ? `<div><h3>このときの天皇</h3><div class="chips"><button class="chip person" data-emp="${emp.no}">第${emp.no}代 ${esc(emp.name)}</button></div></div>` : ''}
      <div><h3>つながり</h3><div class="flow">${flow}</div></div>
      <div><h3>${wantWorld ? '同じころの世界' : '同じころの日本'}</h3><div class="chips">${contemp.map(x => chipEv(x)).join('') || '<span class="empty">前後60年に登録なし</span>'}</div></div>
      <div class="navrow"><button class="btn" data-act="prev">◀ 前の出来事</button><button class="btn" data-act="next">次の出来事 ▶</button></div>`;
    side.scrollTop = 0;
  }
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-ev],[data-person],[data-emp],[data-act]');
    if (!t) return;
    if (t.dataset.ev) { const e = evById.get(t.dataset.ev); closePeople(); stop(); setPos(e.p, e.i, { toast: true }); }
    else if (t.dataset.person) openPeople('people', t.dataset.person);
    else if (t.dataset.emp) openPeople('emp');
    else if (t.dataset.act === 'prev') stepEvent(-1);
    else if (t.dataset.act === 'next') stepEvent(1);
  });

  // ---------- ヘッダー
  function updateHeader() {
    const per = periodAt(cur), emp = emperorAt(cur);
    $('#nowYear').textContent = fmtYear(cur);
    $('#nowMeta').innerHTML = `
      <span class="pill"><b>${esc(eraText(cur))}</b></span>
      <span class="pill" style="border-color:${per.color}">${esc(per.name)}時代</span>
      ${emp ? `<span class="pill emp" data-emp="${emp.no}">第${emp.no}代 <b>${esc(emp.name)}</b></span>` : ''}
      ${regionStates()}`;
    const n = eraFor(yearInt(cur), 'N');
    $('#eraSel').value = n ? String(ERAS.indexOf(n)) : '';
    renderPower();
  }

  // 地域モードでは、その地域にあった当時の国名をヘッダーに出す
  function regionStates() {
    const r = regionById.get(region);
    if (!r.box) return '';
    const y = yearInt(cur), [[x0, y0], [x1, y1]] = r.box;
    // 国単位の狭い範囲では小さい地名も数える
    const small = x1 - x0 < 45;
    const names = [...new Set(HL.filter(([n, from, to, lon, lat, size]) => {
      const L = normLon(lon);
      return y >= from && y < to && (small || size !== 'S') && L >= x0 && L <= x1 && lat >= y0 && lat <= y1;
    }).map(h => h[0]))].slice(0, 4);
    const short = r.name.replace(/（.*）/, '');
    let html = names.length ? `<span class="pill reg">${esc(short)}：<b>${esc(names.join('・'))}</b></span>` : '';
    const rulers = H.RULERS[region];
    const ruler = rulers && rulers.filter(([, from, to]) => y >= from && y < to).pop();
    if (ruler) {
      let label = H.RULER_LABEL[region] || '君主・指導者';
      if (region === 'china' && y >= 1912) label = '指導者';
      html += `<span class="pill reg">${label}：<b>${esc(ruler[0])}</b></span>`;
    }
    return html;
  }

  // ---------- 年表トラック
  const bands = $('#bands');
  PERIODS.forEach(p => {
    const a = y2p(p.from), b = y2p(Math.min(p.to, 2027));
    const d = document.createElement('div');
    d.style.left = a * 100 + '%'; d.style.width = (b - a) * 100 + '%'; d.style.background = p.color;
    d.textContent = p.name; d.title = `${p.name}時代（${fmtYear(p.from)}〜）`;
    d.addEventListener('click', () => { stop(); jumpYear(p.from); });
    bands.appendChild(d);
  });
  const ticks = $('#ticks');
  EVENTS.forEach(e => {
    const i = document.createElement('i');
    i.style.left = e.p * 100 + '%'; i.style.background = `var(--c-${e.cat})`;
    i.title = `${fmtYear(e.y)} ${e.title}`;
    i.addEventListener('click', () => { stop(); setPos(e.p, e.i, { toast: true }); });
    e._tick = i; ticks.appendChild(i);
  });
  const axis = $('#axis');
  [-600, 0, 500, 800, 1000, 1200, 1400, 1600, 1700, 1800, 1868, 1945, 2000].forEach(y => {
    const s = document.createElement('span'); s.style.left = y2p(y) * 100 + '%'; s.textContent = y < 0 ? `前${-y}` : y; axis.appendChild(s);
  });
  const slider = $('#slider');
  slider.addEventListener('input', () => { stop(); setPos(slider.value / 10000); });
  function updateTrack() {
    slider.value = Math.round(pos * 10000);
    $('#nowline').style.left = pos * 100 + '%';
  }

  // 元号セレクト（時代ごと）
  const eraSel = $('#eraSel');
  eraSel.innerHTML = '<option value="">（元号以前）</option>' + PERIODS.filter(p => p.to > 645).map(p => {
    const list = ERAS.map((e, i) => [e, i]).filter(([e]) => e.from >= p.from && e.from < p.to);
    if (!list.length) return '';
    return `<optgroup label="${p.name}">${list.map(([e, i]) => `<option value="${i}">${e.name}${e.court === 'S' ? '（南朝）' : e.court === 'N' ? '（北朝）' : ''}　${e.from}〜</option>`).join('')}</optgroup>`;
  }).join('');
  eraSel.addEventListener('change', () => { if (eraSel.value !== '') { stop(); jumpYear(ERAS[+eraSel.value].from); } });
  $('#yearIn').addEventListener('change', ev => { const v = parseInt(ev.target.value, 10); if (!isNaN(v)) { stop(); jumpYear(clamp(v, -660, 2026)); } });

  // ---------- 状態遷移
  let toastTimer = 0;
  function toast(e) {
    const t = $('#toast');
    t.querySelector('.t1').textContent = `${fmtYear(e.y)} ・ ${CAT[e.cat]}`;
    t.querySelector('.t2').textContent = e.title;
    t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function focus(idx, opts) {
    if (EVENTS[focusIdx] && EVENTS[focusIdx]._tick) EVENTS[focusIdx]._tick.classList.remove('on');
    focusIdx = idx;
    const e = EVENTS[idx];
    if (!e) { renderSide(null); return; }
    e._tick.classList.add('on');
    renderSide(e);
    if (viewMode === 'auto') { const [k, b] = autoView(e); camera(k, b, opts.instant ? 0 : 1400); }
    if (opts.toast) toast(e);
  }
  function setPos(p, idx, opts = {}) {
    pos = clamp(p, 0, 1); cur = p2y(pos);
    let fi = idx;
    if (fi === undefined) { fi = -1; for (const e of ACTIVE) { if (e.p <= pos + 1e-9) fi = e.i; else break; } }
    if (fi !== focusIdx) focus(fi, opts);
    else if (opts.toast && EVENTS[fi]) toast(EVENTS[fi]);
    updateHeader(); updateVisible(); updateTrack();
  }
  const jumpYear = y => setPos(y2p(y) + 1e-7);
  function stepEvent(dir) {
    stop();
    const f = EVENTS[focusIdx];
    if (dir < 0 && f && isActive(f) && pos > f.p + 1e-6) { setPos(f.p, f.i, { toast: true }); return; }
    const t = dir > 0 ? nextActive() : ACTIVE.filter(e => e.i < focusIdx).pop();
    if (t) setPos(t.p, t.i, { toast: true });
  }
  const nextActive = () => ACTIVE.find(e => e.i > focusIdx);
  function stepEra(dir) {
    stop();
    const y = yearInt(cur);
    const t = dir > 0 ? ERAS.find(e => e.from > y) : ERAS.filter(e => e.from < y).pop();
    if (t) jumpYear(t.from);
    else if (dir < 0) setPos(0);
  }

  // ---------- 再生
  let playing = false, pauseUntil = 0, lastT = 0;
  const playBtn = $('#play');
  function play() { if (pos >= 1) setPos(0); playing = true; pauseUntil = 0; playBtn.textContent = '⏸ 停止'; }
  function stop() { playing = false; playBtn.textContent = '▶ 再生'; }
  playBtn.addEventListener('click', () => playing ? stop() : play());
  function frame(t) {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
    if (playing && t >= pauseUntil) {
      const speed = +$('#speed').value;
      const np = Math.min(1, pos + speed * dt);
      const next = nextActive();
      if (next && next.p <= np) {
        setPos(next.p, next.i, { toast: true });
        if ($('#autopause').checked) pauseUntil = t + 2800;
      } else {
        setPos(np);
        if (np >= 1) stop();
      }
    }
    animate(t);
    requestAnimationFrame(frame);
  }

  // ---------- 地図の範囲ボタン
  document.querySelectorAll('.viewbtns button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.viewbtns button').forEach(x => x.classList.toggle('on', x === b));
    viewMode = b.dataset.view; camKey = ''; applyView(1200);
  }));
  // 地図の色（標準／国別／勢力図）
  let colorMode = store.get('rekishi.color', 'plain');
  if (!['plain', 'country', 'power'].includes(colorMode) || (colorMode === 'power' && !window.POWERS)) colorMode = 'plain';
  // 勢力の系統ごとの色（同じ系統の国は時代が変わっても同じ色）
  const POWER_COLORS = {
    japan: '#e0503f', ryukyu: '#f08a7a', china: '#e9b43c', china2: '#d89a4a', qing: '#d4a017', korea: '#4f9fd9', korea2: '#7cb8e6',
    steppe: '#9a7bc0', mongol: '#7b5ea7', tibet: '#bfa57a', turk: '#3f9a63', greece: '#4a86c5', rome: '#a8323a', byzantine: '#b4508a',
    persia: '#2e9e90', islam: '#5fb35f', egypt: '#cfa63a', africa: '#b58b62', india: '#ef8b3e', india2: '#e7a86b', sea: '#71c27a', sea2: '#a7cf6b',
    russia: '#6c80c4', poland: '#d98c8c', austria: '#c7b27f', france: '#4f6fd0', germany: '#8a9196', uk: '#e47fae', uk2: '#eaa6c6',
    goth: '#a39a6b', spain: '#e6c445', portugal: '#2aa889', nl: '#f29a26', nordic: '#62b2e2', italy: '#5fcf8a', meso: '#c4846a',
    andes: '#b3a050', usa: '#3c6fb8', latin: '#9cd46e', latin2: '#7ec98f',
  };
  let powerYear = null;
  function renderPower() {
    if (colorMode !== 'power' || !window.POWERS) { gPower.attr('display', 'none'); $('#powerNote').hidden = true; return; }
    gPower.attr('display', null);
    const y = yearInt(cur);
    let snap = window.POWERS[0];
    for (const s of window.POWERS) { if (s.y <= y) snap = s; else break; }
    $('#powerNote').hidden = false;
    $('#powerYear').textContent = `勢力図：${fmtYear(snap.y)}ごろの主要国`;
    if (snap.y === powerYear) return;
    powerYear = snap.y;
    powerTile.selectAll('*').remove();
    powerTile.selectAll('path').data(snap.f).join('path').attr('class', 'pw').attr('d', d => geo(d.g))
      .attr('fill', d => POWER_COLORS[d.k] || '#9e9e9e').append('title').text(d => d.j);
    powerTile.selectAll('text').data(snap.f).join('text').attr('class', 'pwl')
      .attr('x', d => X(d.l[0])).attr('y', d => Y(d.l[1])).text(d => d.j);
    rescale();
  }
  function applyColor() {
    // <use> の複製には祖先のクラスが効かないので、元の図形の表示を直接切り替える
    tile.select('.countries').attr('display', colorMode === 'country' ? null : 'none');
    tile.select('.borders').attr('display', colorMode === 'plain' ? null : 'none');
    tile.select('.japan').attr('display', colorMode === 'power' ? 'none' : null);
    renderPower();
    rescale();
    document.querySelectorAll('#colorBtns button').forEach(b => b.classList.toggle('on', b.dataset.color === colorMode));
    store.set('rekishi.color', colorMode);
  }
  document.querySelectorAll('#colorBtns button').forEach(b => b.addEventListener('click', () => { colorMode = b.dataset.color; applyColor(); }));
  applyColor();

  // ざっくり／詳細と地域の切り替え
  const regSel = $('#regionSel');
  regSel.innerHTML = [...new Set(REGIONS.map(r => r.group))].map(g =>
    `<optgroup label="${esc(g)}">${REGIONS.filter(r => r.group === g).map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</optgroup>`).join('');
  function applyMode(keepFocus) {
    ACTIVE = EVENTS.filter(isActive);
    WIN = level === 2 ? 0.016 : 0.022;
    regSel.value = region;
    document.querySelectorAll('.lvbtns button[data-lv]').forEach(b => b.classList.toggle('on', +b.dataset.lv === level));
    EVENTS.forEach(e => { e._tick.hidden = !isActive(e); });
    $('#modeCount').textContent = `${ACTIVE.length}件`;
    store.set('rekishi.level', String(level)); store.set('rekishi.region', region);
    if (keepFocus) return;
    const f = EVENTS[focusIdx];
    camKey = '';
    if (f && isActive(f)) { renderSide(f); applyView(1000); updateHeader(); updateVisible(true); }
    else { if (f) f._tick.classList.remove('on'); focusIdx = -2; setPos(pos); }
  }
  document.querySelectorAll('.lvbtns button[data-lv]').forEach(b => b.addEventListener('click', () => { level = +b.dataset.lv; applyMode(); }));
  regSel.addEventListener('change', () => {
    region = regSel.value;
    // 地域を選んだら、地図の範囲は自動に戻す
    viewMode = 'auto';
    document.querySelectorAll('.viewbtns button').forEach(x => x.classList.toggle('on', x.dataset.view === 'auto'));
    applyMode();
  });

  $('#legend').innerHTML = Object.entries(CAT).map(([k, v]) => `<span><i style="background:var(--c-${k})"></i>${v}</span>`).join('') + '<span>⛵ 船の移動</span>';

  // ---------- 検索
  const q = $('#q'), results = $('#results');
  let resItems = [], resSel = 0;
  function runSearch() {
    const s = q.value.trim();
    if (!s) { results.hidden = true; return; }
    const evs = EVENTS.filter(e => e.title.includes(s)).concat(EVENTS.filter(e => !e.title.includes(s) && e.desc.includes(s))).slice(0, 10);
    const ps = PEOPLE.filter(p => p.name.includes(s) || p.role.includes(s)).slice(0, 8);
    const emps = EMPERORS.filter(e => e.name.includes(s)).slice(0, 6);
    const eras = ERAS.filter(e => e.name.includes(s)).slice(0, 6);
    resItems = [];
    let html = '';
    const grp = (name, arr, fn) => { if (!arr.length) return; html += `<div class="grp">${name}</div>`; arr.forEach(x => { const [yr, label, act] = fn(x); html += `<button data-ri="${resItems.length}"><span class="yr">${esc(yr)}</span><span>${esc(label)}</span></button>`; resItems.push(act); }); };
    grp('出来事', evs, e => [fmtYear(e.y), e.title, () => { stop(); setPos(e.p, e.i, { toast: true }); }]);
    grp('人物', ps, p => [p.born != null ? `${p.born < 0 ? '前' + -p.born : p.born}〜` : '', `${p.name}（${p.role}）`, () => openPeople('people', p.id)]);
    grp('天皇', emps, e => [`第${e.no}代`, `${e.name}（${fmtYear(e.from)}即位）`, () => { stop(); jumpYear(e.from); }]);
    grp('元号', eras, e => [`${e.from}年`, `${e.name}${e.court === 'S' ? '（南朝）' : e.court === 'N' ? '（北朝）' : ''}`, () => { stop(); jumpYear(e.from); }]);
    results.innerHTML = html || '<div class="grp">見つかりませんでした</div>';
    resSel = 0; markSel();
    results.hidden = false;
  }
  function markSel() { results.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === resSel)); }
  function choose(i) { const a = resItems[i]; if (!a) return; results.hidden = true; q.blur(); a(); }
  q.addEventListener('input', runSearch);
  q.addEventListener('focus', runSearch);
  q.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') { resSel = Math.min(resItems.length - 1, resSel + 1); markSel(); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { resSel = Math.max(0, resSel - 1); markSel(); ev.preventDefault(); }
    else if (ev.key === 'Enter') { choose(resSel); }
    else if (ev.key === 'Escape') { results.hidden = true; q.blur(); }
  });
  results.addEventListener('mousedown', ev => { const b = ev.target.closest('button[data-ri]'); if (b) { ev.preventDefault(); choose(+b.dataset.ri); } });
  q.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 150));

  // ---------- 人物・天皇ページ
  const pp = $('#peoplePage'), ppc = $('#ppContent');
  let ppTab = 'emp', pFilter = 'all', pText = '';
  function openPeople(tab, personId) {
    stop();
    ppTab = tab; pp.hidden = false;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    pp.querySelector('.pp-body').scrollTop = 0;
    if (tab === 'emp') renderEmp();
    else if (personId) renderPerson(personId);
    else renderPeople();
  }
  function closePeople() { pp.hidden = true; }
  $('#openPeople').addEventListener('click', () => openPeople('emp'));
  const about = $('#aboutPage');
  $('#openAbout').addEventListener('click', () => { stop(); about.hidden = false; about.querySelector('.pp-body').scrollTop = 0; });
  $('#closeAbout').addEventListener('click', () => { about.hidden = true; });
  $('#closePeople').addEventListener('click', closePeople);
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => openPeople(b.dataset.tab)));

  function renderEmp() {
    const curEmp = emperorAt(cur);
    ppc.innerHTML = `<p class="empty" style="margin:0 0 12px">行を選ぶと、その天皇の即位年へ地図が移動します。第1〜9代ごろまでは伝承上の年代で、実在は確認されていません。南北朝期は南朝の天皇を数えています。</p>
      <div class="tablewrap"><table class="emp"><thead><tr><th>代</th><th>天皇</th><th>在位</th><th>時代</th><th>ひとこと</th></tr></thead><tbody>
      ${EMPERORS.map(e => `<tr data-y="${e.from}" class="${curEmp && curEmp.no === e.no ? 'cur' : ''}"><td class="n">${e.no}</td><td class="nm">${esc(e.name)}</td>
        <td class="yr">${esc(fmtYear(e.from))}〜${e.to != null ? esc(fmtYear(e.to)) : '現在'}</td><td>${esc(periodAt(e.from).name)}</td><td class="note">${esc(e.note)}</td></tr>`).join('')}
      </tbody></table></div>`;
    ppc.querySelectorAll('tr[data-y]').forEach(tr => tr.addEventListener('click', () => { closePeople(); jumpYear(+tr.dataset.y); }));
    const c = ppc.querySelector('tr.cur'); if (c) c.scrollIntoView({ block: 'center' });
  }
  function personYear(p) { const evs = personEvents.get(p.id); return p.born != null ? p.born : (evs[0] ? evs[0].y : 0); }
  function renderPeople() {
    const list = PEOPLE.filter(p => (pFilter === 'all' || p.side === pFilter) && (!pText || p.name.includes(pText) || p.role.includes(pText) || p.desc.includes(pText)))
      .sort((a, b) => personYear(a) - personYear(b));
    const groups = new Map();
    list.forEach(p => { const per = periodAt(Math.max(-660, personYear(p) + 20)); if (!groups.has(per)) groups.set(per, []); groups.get(per).push(p); });
    ppc.innerHTML = `<div class="pfilter">
        <div class="tabs">${[['all', 'すべて'], ['jp', '日本'], ['world', '世界']].map(([k, v]) => `<button data-pf="${k}" class="${pFilter === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        <input id="pText" type="search" placeholder="名前・役職で絞り込み" value="${esc(pText)}">
        <span class="empty">${list.length}人</span></div>
      ${[...groups].map(([per, ps]) => `<section class="pgroup"><h2><i style="background:${per.color}"></i>${esc(per.name)}</h2><div class="pgrid">
        ${ps.map(p => `<button class="pcard ${p.side === 'world' ? 'world' : ''}" data-pid="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.role)}</span><span>${life(p)}</span></button>`).join('')}
      </div></section>`).join('')}`;
    ppc.querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => { pFilter = b.dataset.pf; renderPeople(); }));
    const ti = ppc.querySelector('#pText');
    ti.addEventListener('input', () => { pText = ti.value.trim(); renderPeople(); const n = ppc.querySelector('#pText'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    ppc.querySelectorAll('[data-pid]').forEach(b => b.addEventListener('click', () => renderPerson(b.dataset.pid)));
  }
  function life(p) {
    const f = y => y == null ? '?' : (y < 0 ? `前${-y}` : y);
    return p.born == null && p.died == null ? '生没年不詳' : `${f(p.born)}〜${f(p.died)}年`;
  }
  function renderPerson(id) {
    const p = personById.get(id); if (!p) return;
    ppTab = 'people';
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'people'));
    const evs = personEvents.get(id);
    ppc.innerHTML = `<button class="btn" id="backPeople" style="margin-bottom:12px">← 人物一覧</button>
      <article class="pdetail">
        <div class="evhead"><span class="cat" style="background:var(--c-${p.side === 'world' ? 'world' : 'jp'})">${p.side === 'world' ? '世界' : '日本'}</span><span>${esc(p.role)}</span></div>
        <h2>${esc(p.name)}</h2><div class="life">${life(p)}</div>
        <p>${esc(p.desc)}</p>
        <h3>関わった出来事（選ぶと地図へ移動）</h3>
        <div class="chips">${evs.map(e => chipEv(e)).join('') || '<span class="empty">登録なし</span>'}</div>
      </article>`;
    pp.querySelector('.pp-body').scrollTop = 0;
    ppc.querySelector('#backPeople').addEventListener('click', renderPeople);
  }

  // ---------- キーボード
  document.addEventListener('keydown', ev => {
    if (ev.target.closest('input, select, textarea')) return;
    if (!about.hidden) { if (ev.key === 'Escape') about.hidden = true; return; }
    if (!pp.hidden) { if (ev.key === 'Escape') closePeople(); return; }
    if (ev.key === ' ') { ev.preventDefault(); playing ? stop() : play(); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.shiftKey ? stepEra(1) : stepEvent(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.shiftKey ? stepEra(-1) : stepEvent(-1); }
  });
  $('#evPrev').addEventListener('click', () => stepEvent(-1));
  $('#evNext').addEventListener('click', () => stepEvent(1));
  $('#eraPrev').addEventListener('click', () => stepEra(-1));
  $('#eraNext').addEventListener('click', () => stepEra(1));

  // ---------- 起動
  measure();
  window.addEventListener('resize', () => { measure(); camKey = ''; applyView(0); });
  applyMode(true);
  const start = evById.get(location.hash.slice(1)) || (isActive(evById.get('kentoshi717')) ? evById.get('kentoshi717') : ACTIVE[0]);
  setPos(start.p, start.i, { instant: true });
  requestAnimationFrame(frame);
})();
