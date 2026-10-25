// 公開用の docs/ を作る。
// ルートの index.html は claude.ai のアーティファクト用（外枠なし）なので、
// GitHub Pages 用に <!doctype html> などの外枠を付けて docs/ に書き出す。
// 使い方: node tools/build_site.mjs
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'docs');
const FILES = ['app.js', 'data.js', 'world.js', 'powers.js'];

const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = src.indexOf('</style>') + '</style>'.length;
if (cut < 8) throw new Error('index.html に </style> が見つかりません');
const head = src.slice(0, cut).replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const body = src.slice(cut).trim();

// アーティファクトの外枠が足していた最低限のリセットをここで補う
const reset = '<style>html,body{margin:0;height:100%}body{font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style>';
const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
${reset}
${head}
</head>
<body>
${body}
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
// GitHub Pages の Jekyll 処理を止める
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`docs/ に書き出しました: index.html, ${FILES.join(', ')}`);
