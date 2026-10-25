// historical-basemaps（GPL-3.0）から主要国だけを取り出し、日本語名と系統を付けて powers.js を作る
import fs from 'fs';
import mapshaper from 'mapshaper';
import { geoArea, geoBounds } from 'd3-geo';

const [RAW, OUT] = process.argv.slice(2);

// データ上の名前 → [日本語名（年で変わる場合は関数）, 系統]
const M = {
  // 日本
  'Yayoi': ['倭（弥生）', 'japan'], 'Yamato': [y => y < 700 ? '倭（ヤマト政権）' : '日本', 'japan'], 'Imperial Japan (Fujiwara)': ['日本（平安）', 'japan'],
  'Shogun Japan (Kamakura)': [y => y < 1336 ? '日本（鎌倉幕府）' : '日本（室町幕府）', 'japan'], 'Japan (Warring States)': ['日本（戦国）', 'japan'],
  'Tokugawa shogunate': ['日本（江戸幕府）', 'japan'], 'Imperial Japan': ['大日本帝国', 'japan'], 'Empire of Japan': ['大日本帝国', 'japan'],
  'Japan': [y => y < 1603 ? '日本' : y < 1868 ? '日本（江戸幕府）' : y < 1947 ? '大日本帝国' : '日本', 'japan'],
  'Chūzan': ['琉球（中山）', 'ryukyu'], 'Japan (USA)': ['日本（連合国占領下）', 'japan'], 'Manchuria': [y => y < 1946 ? '満州国' : '中国東北部', 'japan'],
  // 中国
  'Zhou states': ['周と諸侯', 'china'], 'Qin': ['秦', 'china'], 'Han': ['漢', 'china'], 'Han Empire': ['漢', 'china'],
  'Jin': [y => y < 420 ? '晋' : '南朝', 'china'], 'Jin Empire': [y => y < 420 ? '晋' : '南朝', 'china'], 'Toba Wei': ['北魏', 'china2'],
  'Sui Empire': [y => y < 618 ? '隋' : '唐', 'china'], 'Tang Empire': ['唐', 'china'], 'Song Empire': ['宋', 'china'], 'Liao': ['遼', 'steppe'],
  'Xixia': ['西夏', 'tibet'], 'Ming Empire': ['明', 'china'], 'Ming Chinese Empire': ['明', 'china'], 'Post-Ming Warlords': ['南明・三藩', 'china'],
  'Manchu Empire': [y => y < 1912 ? '清' : '中華民国', 'qing'], 'Qing Empire': [y => y < 1912 ? '清' : '中華民国', 'qing'], 'Chinese Warlords': ['中華民国', 'china'], 'Chinese warlords': ['中華民国', 'china'],
  'China': [y => y < 1949 ? '中華民国' : '中華人民共和国', 'china'], 'Xinjiang': ['新疆', 'china2'],
  'Tibet': ['チベット', 'tibet'], 'Tibetan Empire': ['吐蕃', 'tibet'], 'Tufan Empire': ['吐蕃', 'tibet'],
  // 朝鮮
  'Gojoseon': ['古朝鮮', 'korea'], 'Koguryo': ['高句麗', 'korea'], 'Paekche': ['百済', 'korea2'], 'Silla': ['新羅', 'korea'], 'Gaya': ['伽耶', 'korea2'],
  'Balhae': ['渤海', 'korea2'], 'Parhae': ['渤海', 'korea2'], 'Goryeo': ['高麗', 'korea'], 'Korea': [y => y < 1392 ? '高麗' : y < 1897 ? '朝鮮' : '大韓帝国', 'korea'],
  'Korea, Republic of': ['韓国', 'korea'], "Korea, Democratic People's Republic of": ['北朝鮮', 'korea2'],
  // 北アジア・遊牧
  'Xiongnu': ['匈奴', 'steppe'], 'S. Xiongnu': ['南匈奴', 'steppe'], 'Ruanruan': ['柔然', 'steppe'], 'Hunnic Empire': ['フン帝国', 'steppe'],
  'Göktürks': ['突厥', 'turk'], 'Western Gokturk Khaganate': ['西突厥', 'turk'], 'Uyghurs': ['ウイグル', 'steppe'], 'Mongols': ['モンゴル諸部族', 'steppe'],
  'Mongol Empire': [y => y < 1300 ? 'モンゴル帝国' : y < 1368 ? '元' : '北元', 'mongol'], 'Ilkhanate': ['イル・ハン国', 'mongol'],
  'Golden Horde': ['キプチャク・ハン国', 'mongol'], 'Khanate of the Golden Horde': ['キプチャク・ハン国', 'mongol'], 'Chagatai Khanate': ['チャガタイ・ハン国', 'mongol'],
  'Timurid Empire': ['ティムール朝', 'mongol'], 'Timurid Emirates': ['ティムール朝', 'mongol'], 'Oirat Confederation': ['オイラト', 'steppe'], 'Mongolia': ['モンゴル', 'mongol'],
  // ローマ・ギリシア・地中海
  'Greek city-states': ['ギリシア諸ポリス', 'greece'], 'Empire of Alexander': ['アレクサンドロスの帝国', 'greece'], 'Seleucid Kingdom': ['セレウコス朝', 'greece'],
  'Ptolemaic Kingdom': ['プトレマイオス朝', 'egypt'], 'Kingdom of Antigonus': ['アンティゴノス朝', 'greece'], 'Carthage': ['カルタゴ', 'africa'],
  'Carthaginian Empire': ['カルタゴ', 'africa'], 'Rome': ['ローマ', 'rome'], 'Roman Republic': ['ローマ（共和政）', 'rome'], 'Roman Empire': ['ローマ帝国', 'rome'],
  'Rome (Constantinus)': ['ローマ帝国', 'rome'], 'Rome (Diocletianus)': ['ローマ帝国', 'rome'], 'Rome (Galerius)': ['ローマ帝国', 'rome'], 'Rome (Maximian)': ['ローマ帝国', 'rome'],
  'Western Roman Empire': ['西ローマ帝国', 'rome'], 'Eastern Roman Empire': ['ビザンツ帝国', 'byzantine'], 'Byzantine Empire': ['ビザンツ帝国', 'byzantine'],
  'Venice': ['ヴェネツィア', 'italy'], 'Italy': ['イタリア', 'italy'],
  // オリエント・イスラム
  'Assyria': ['アッシリア', 'persia'], 'Babylonia': ['バビロニア', 'islam'], 'Achaemenid Empire': ['アケメネス朝ペルシア', 'persia'], 'Parthia': ['パルティア', 'persia'],
  'Parthian Empire': ['パルティア', 'persia'], 'Sasanian Empire': ['ササン朝ペルシア', 'persia'], 'Umayyad Caliphate': ['ウマイヤ朝', 'islam'],
  'Abbasid Caliphate': ['アッバース朝', 'islam'], 'Fatimid Caliphate': ['ファーティマ朝', 'egypt'], 'Seljuk Empire': ['セルジューク朝', 'turk'], 'Seljuk Caliphate': ['ルーム・セルジューク朝', 'turk'],
  'Mamluke Sultanate': ['マムルーク朝', 'egypt'], 'Safavid Empire': ['サファヴィー朝', 'persia'], 'Persia': ['ペルシア（ガージャール朝）', 'persia'], 'Iran': ['イラン', 'persia'],
  'Ottoman Empire': ['オスマン帝国', 'turk'], 'Ottoman Sultanate': ['オスマン帝国', 'turk'], 'Republic of Turkey': ['トルコ', 'turk'], 'Turkey': ['トルコ', 'turk'], 'Egypt': ['エジプト', 'egypt'],
  // アフリカ
  'Kush': ['クシュ', 'africa'], 'Meroe': ['メロエ（クシュ）', 'africa'], 'Axum': ['アクスム', 'africa'], 'Ethiopia': ['エチオピア', 'africa'], 'Abyssinia': ['エチオピア', 'africa'],
  'Empire of Ghana': ['ガーナ王国', 'africa'], 'Mali': [y => y < 1900 ? 'マリ帝国' : 'マリ', 'africa'], 'Songhai': ['ソンガイ帝国', 'africa'],
  // インド
  'Magadha': ['マガダ国', 'india'], 'Mauryan Empire': ['マウリヤ朝', 'india'], 'Kushan Empire': ['クシャーナ朝', 'india2'], 'Gupta Empire': ['グプタ朝', 'india'],
  'Chola Empire': ['チョーラ朝', 'india2'], 'Sultanate of Delhi': ['デリー・スルタン朝', 'india'], 'Mughal Empire': ['ムガル帝国', 'india'], 'Vijayanagara': ['ヴィジャヤナガル王国', 'india2'],
  'Maratha Confederacy': ['マラーター同盟', 'india2'], 'India': ['インド', 'india'], 'Pakistan': ['パキスタン', 'india2'],
  // 東南アジア
  'Srivijaya Empire': ['シュリーヴィジャヤ', 'sea'], 'Khmer Empire': ['アンコール朝', 'sea2'], 'Đại Việt': ['大越（ベトナム）', 'sea'], 'Annam': [y => y < 1802 ? '大越（ベトナム）' : y < 1945 ? 'ベトナム（阮朝）' : 'ベトナム', 'sea'],
  'Vietnam': ['ベトナム', 'sea'], 'Ayutthaya': ['アユタヤ朝', 'sea2'], 'Sukhothai': ['スコータイ朝', 'sea2'], 'Rattanakosin Kingdom': ['シャム', 'sea2'], 'Siam': ['シャム', 'sea2'],
  'Thailand': ['タイ', 'sea2'], 'Kingdom of Pagan': ['パガン朝（ビルマ）', 'sea'], 'Pagan': ['パガン朝（ビルマ）', 'sea'], 'Burma': ['ビルマ', 'sea'], 'Malacca': ['マラッカ王国', 'sea'],
  'Indonesia': ['インドネシア', 'sea'], 'Philippines': [y => y < 1898 ? 'フィリピン（スペイン領）' : y < 1946 ? 'フィリピン（アメリカ領）' : 'フィリピン', 'sea2'],
  // ロシア・東欧
  'Kievan Rus': ['キエフ・ルーシ', 'russia'], 'Kyivan Rus': ['キエフ・ルーシ', 'russia'], 'Grand Duchy of Moscow': ['モスクワ大公国', 'russia'],
  'Tsardom of Muscovy': ['ロシア・ツァーリ国', 'russia'], 'Russian Empire': ['ロシア帝国', 'russia'], 'Russia': [y => y < 1918 ? 'ロシア帝国' : 'ロシア', 'russia'], 'USSR': ['ソ連', 'russia'],
  'Poland-Lithuania': ['ポーランド＝リトアニア', 'poland'], 'Polish–Lithuanian Commonwealth': ['ポーランド＝リトアニア', 'poland'], 'Poland': ['ポーランド', 'poland'],
  'Hungary': ['ハンガリー', 'austria'],
  // 西欧
  'Franks': ['フランク王国', 'france'], 'Frankish Kingdom': ['フランク王国', 'france'], 'Carolingian Empire': ['フランク王国', 'france'], 'France': ['フランス', 'france'],
  'Holy Roman Empire': ['神聖ローマ帝国', 'germany'], 'Prussia': ['プロイセン', 'germany'], 'German Empire': ['ドイツ帝国', 'germany'], 'Germany': ['ドイツ', 'germany'],
  'West Germany': ['西ドイツ', 'germany'], 'East Germany': ['東ドイツ', 'germany'], 'Austrian Empire': ['オーストリア', 'austria'], 'Austria': ['オーストリア', 'austria'],
  'Habsburg Austria': ['オーストリア', 'austria'], 'Austria Hungary': ['オーストリア＝ハンガリー', 'austria'], 'Austro-Hungarian Empire': ['オーストリア＝ハンガリー', 'austria'],
  'England': ['イングランド', 'uk'], 'English territory': ['イングランド', 'uk'], 'England and Ireland': ['イングランド', 'uk'], 'Angevin Empire': ['アンジュー帝国（イングランド）', 'uk'],
  'Great Britain': ['イギリス', 'uk'], 'United Kingdom': ['イギリス', 'uk'], 'UK': ['イギリス', 'uk'], 'United Kingdom of Great Britain and Ireland': ['イギリス', 'uk'],
  'British East India Company': ['イギリス東インド会社', 'uk'], 'Canada': ['カナダ', 'uk2'],
  'Visigoths': ['西ゴート', 'goth'], 'Visigothic Kingdom': ['西ゴート王国', 'goth'], 'Ostrogoths': ['東ゴート王国', 'goth'], 'Vandals': ['ヴァンダル王国', 'goth'],
  'Castile': ['カスティリャ', 'spain'], 'Aragón': ['アラゴン', 'spain'], 'Spain': ['スペイン', 'spain'], 'Viceroyalty of New Spain': ['スペイン領（ヌエバ・エスパーニャ）', 'spain'],
  'Viceroyalty of the Río de la Plata': ['スペイン領（ラプラタ）', 'spain'], 'Portugal': ['ポルトガル', 'portugal'],
  'Netherlands': ['オランダ', 'nl'], 'Neterlands': ['オランダ', 'nl'], 'Habsburg Netherlands': ['ネーデルラント', 'nl'], 'Netherlands Indies': ['オランダ領東インド', 'nl'],
  'United Kingdom of Netherlands': ['オランダ', 'nl'], 'Denmark-Norway': ['デンマーク＝ノルウェー', 'nordic'], 'Kalmar Union': ['カルマル同盟', 'nordic'],
  'Sweden': ['スウェーデン', 'nordic'], 'Sweden–Norway': ['スウェーデン＝ノルウェー', 'nordic'], 'Denmark': ['デンマーク', 'nordic'],
  // 南北アメリカ
  'Aztec Empire': ['アステカ王国', 'meso'], 'Maya': ['マヤ', 'meso'], 'Maya states': ['マヤ', 'meso'], 'Maya city-states': ['マヤ', 'meso'], 'Maya chiefdoms and states': ['マヤ', 'meso'],
  'Inca Empire': ['インカ帝国', 'andes'], 'United States of America': ['アメリカ合衆国', 'usa'], 'United States': ['アメリカ合衆国', 'usa'], 'USA': ['アメリカ合衆国', 'usa'],
  'Mexico': ['メキシコ', 'latin'], 'Brazil': ['ブラジル', 'latin2'], 'Kingdom of Brazil': ['ブラジル', 'latin2'],
};

const files = fs.readdirSync(RAW).filter(f => f.endsWith('.geojson'));
const yearOf = f => { const m = f.match(/world_(bc)?(\d+)/); return m[1] ? -m[2] : +m[2]; };
const snaps = [];
for (const f of files.sort((a, b) => yearOf(a) - yearOf(b))) {
  const year = yearOf(f);
  const gj = JSON.parse(fs.readFileSync(`${RAW}/${f}`, 'utf8'));
  gj.features = gj.features.filter(x => {
    const p = x.properties, g = (p.NAME === 'Japan (USA)') ? p.NAME : (p.SUBJECTO || p.NAME), m = M[g];
    if (!m || !x.geometry) return false;
    x.properties = { J: typeof m[0] === 'function' ? m[0](year) : m[0], K: m[1] };
    return true;
  });
  const out = await mapshaper.applyCommands(
    '-i in.json -dissolve J copy-fields=K -simplify 7% keep-shapes -filter-islands min-area=3000km2 -clean -o out.json format=geojson precision=0.01',
    { 'in.json': JSON.stringify(gj) });
  const res = JSON.parse(out['out.json']);
  // d3 は外周が時計回りの多角形を前提にするので、GeoJSON 標準（反時計回り）の向きを反転する
  const rewind = g => { const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; polys.forEach(p => p.forEach(r => r.reverse())); return g; };
  const feats = res.features.filter(x => x.geometry).map(x => { rewind(x.geometry);
    let a = geoArea(x); if (a > 2 * Math.PI) a = 4 * Math.PI - a;
    // ラベルは一番大きい塊の中に置く
    const polys = x.geometry.type === 'Polygon' ? [x.geometry.coordinates] : x.geometry.coordinates;
    let best = polys[0], bestA = -1;
    for (const p of polys) { let pa = geoArea({ type: 'Polygon', coordinates: p }); if (pa > 2 * Math.PI) pa = 4 * Math.PI - pa; if (pa > bestA) { bestA = pa; best = p; } }
    const [[x0, y0], [x1, y1]] = geoBounds({ type: 'Polygon', coordinates: best });
    return { j: x.properties.J, k: x.properties.K, a: +(a * 1e4).toFixed(2), l: [+((x0 + (x1 < x0 ? x1 + 360 : x1)) / 2).toFixed(2), +((y0 + y1) / 2).toFixed(2)], g: x.geometry };
  });
  snaps.push({ y: year, f: feats });
  console.error(year, feats.length, feats.map(x => x.j).join(','));
}
const js = '// 勢力図データ。出典: historical-basemaps (aourednik, GPL-3.0) を主要国に絞り簡略化\nwindow.POWERS=' + JSON.stringify(snaps) + ';\n';
fs.writeFileSync(OUT, js);
console.error('bytes', js.length);
