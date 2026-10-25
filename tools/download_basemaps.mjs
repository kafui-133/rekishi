// historical-basemaps（GPL-3.0）から、勢力図に使う時点の GeoJSON をダウンロードする
// 使い方: node tools/download_basemaps.mjs <保存先フォルダ>
import fs from 'fs';

const OUT = process.argv[2] || 'basemaps';
const YEARS = ['bc700', 'bc500', 'bc400', 'bc323', 'bc300', 'bc200', 'bc100', 'bc1', '100', '200', '300', '400', '500', '600', '700', '800',
  '900', '1000', '1100', '1200', '1279', '1300', '1400', '1492', '1500', '1530', '1600', '1650', '1700', '1715', '1783', '1800', '1815',
  '1880', '1900', '1914', '1920', '1930', '1938', '1945', '1960', '1994', '2010'];
const BASE = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson';

fs.mkdirSync(OUT, { recursive: true });
for (const y of YEARS) {
  const res = await fetch(`${BASE}/world_${y}.geojson`);
  if (!res.ok) { console.error(`失敗: ${y} (${res.status})`); continue; }
  fs.writeFileSync(`${OUT}/world_${y}.geojson`, Buffer.from(await res.arrayBuffer()));
  console.log(`保存: world_${y}.geojson`);
}
