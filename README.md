# 歴史航路

神武天皇の時代から令和まで、日本と世界の歴史を地図の上でたどるWebアプリです。
遣唐使や黒船が航路を進むアニメーション、年表スライダー、元号ごとの移動、人物・天皇の一覧、出来事どうしのつながり、地域ごとの絞り込み、当時の勢力図を表示できます。

> **注意：内容は生成AIが作成したものです**
> 出来事・人物・天皇・元号・各国の君主や指導者・年代・説明文・出来事どうしのつながり、および勢力図の日本語の国名と色分けは、生成AI（Claude）が作成しました。
> 資料と一件ずつ照らし合わせる確認はしていないため、誤りが含まれている可能性があります。学習や調べものに使うときは、信頼できる資料で確かめてください。
> 誤りに気づいたら Issue で教えてください。

## 主な機能

- 日本地図・東アジア・世界地図の切り替え（出来事に合わせた自動切り替えもあり）
- 再生、前後の出来事・元号への移動、元号や西暦を指定しての移動
- 出来事・人物・天皇・元号の検索
- 「ざっくり」と「詳細」の2段階、全24地域での絞り込み
- 地図の色：標準／現在の国別／当時の勢力図
- 出来事が「なぜ起きたか」を、背景・きっかけ・偶然の要素に分けて原因の連鎖でたどる表示
- 「経済・お金」のテーマと、貨幣制度の移り変わりを国ごとに比べる「お金の歴史」ページ
- 人物・天皇（126代）のページ、使い方・出典・注意事項のページ

## フォルダ構成

| パス | 内容 |
| --- | --- |
| `index.html` `app.js` | アプリ本体。`index.html` は claude.ai のアーティファクト用で、`<!doctype html>` などの外枠を含みません |
| `data.js` | 出来事・人物・天皇・元号・地域・君主のデータ（生成AIが作成） |
| `why.js` | 出来事ごとの「なぜ起きたか」（原因の連鎖。生成AIが作成） |
| `money.js` | 日本と主な国・国際通貨体制の貨幣制度の移り変わり（生成AIが作成） |
| `world.js` | 世界地図（world-atlas の countries-50m） |
| `powers.js` | 勢力図データ（historical-basemaps を加工） |
| `docs/` | GitHub Pages で公開するファイル。`tools/build_site.mjs` で作ります |
| `tools/` | データ作成と公開用ファイルの書き出しのスクリプト |
| `LICENSE` | GNU General Public License v3.0 |
| `LICENSES/` | 第三者のデータのライセンス文 |

## 手元で動かす

`docs/index.html` をブラウザで直接開けば動きます（地図データも JavaScript ファイルとして読み込むため、サーバーは不要です）。

## 公開用ファイルを作り直す

`index.html` や `app.js` などを変更したら、次のコマンドで `docs/` を作り直します（Node.js 18 以上）。
読み込むファイル名には中身のハッシュ（`app.js?v=…`）が付くので、更新後に古いファイルがブラウザに残ることはありません。

```bash
node tools/build_site.mjs
```

## 勢力図データを作り直す

`powers.js` は次の手順で作りました。主要国の選び方と日本語名は `tools/build_powers.mjs` の対応表にあります。

```bash
cd tools
npm install
npm run download
npm run powers
npm run site
```

1. `download`：historical-basemaps から43時点の GeoJSON を `basemaps/` にダウンロードします（約55MB。リポジトリには含めません）。
2. `powers`：対応表に載っている主要国だけを残し、支配国（SUBJECTO）ごとにまとめ、形を簡略化して `powers.js` を書き出します。
3. `site`：`docs/` を作り直します。

## GitHub Pages で公開する手順

1. このフォルダを GitHub のリポジトリに push します（`.gitignore` で `.claude/` や `basemaps/` は除外しています）。
2. リポジトリの Settings → Pages で、Source を「Deploy from a branch」、Branch を `main`、フォルダを `/docs` にします。

## 出典とライセンス

このリポジトリは **GNU General Public License v3.0**（`LICENSE`）で公開します。
勢力図データが GPL-3.0 のデータを改変したものであるため、全体を同じライセンスにしています。

| 使用しているもの | 提供元 | ライセンス | 使い方 |
| --- | --- | --- | --- |
| 勢力図（過去の国境） | [historical-basemaps](https://github.com/aourednik/historical-basemaps)（André Ourednik ほか） | GPL-3.0 | 主要国だけを抽出し、支配国ごとにまとめ、形を簡略化。日本語名と色分けを追加（`tools/build_powers.mjs`） |
| 世界地図（陸地・現在の国境） | [world-atlas](https://github.com/topojson/world-atlas)（Michael Bostock） | ISC（`LICENSES/world-atlas-ISC.txt`） | countries-50m.json をそのまま JavaScript に変換 |
| world-atlas の元データ | [Natural Earth](https://www.naturalearthdata.com/) | パブリックドメイン | — |
| D3.js | [d3js.org](https://d3js.org/) | ISC | CDN から読み込み |
| topojson-client | [topojson](https://github.com/topojson/topojson-client) | ISC | CDN から読み込み |
| フォント | Google Fonts（Shippori Mincho B1、Zen Kaku Gothic New） | SIL Open Font License | Google Fonts から読み込み |
| 出来事・人物・天皇・元号・君主・貨幣制度・原因の説明・説明文 | 生成AI（Claude）が作成 | このリポジトリのライセンスに従う | 特定の資料からの転載ではありません |
