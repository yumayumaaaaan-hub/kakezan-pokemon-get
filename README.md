# 掛け算でポケモンゲットだぜ！

九九（掛け算）の問題に答えて、ポケモンを集める学習ゲームのMVPプロトタイプです。

## 公開URL

- **プレイする:** https://yumayumaaaaan-hub.github.io/kakezan-pokemon-get/
- **ソースコード:** https://github.com/yumayumaaaaan-hub/kakezan-pokemon-get

## 遊び方

1. 「スタート」をタップ
2. 掛け算の問題に答える（5問チャレンジ）
3. 正解数に応じてボールが投げられる
4. ポケモンをゲットして図鑑を埋めていく
5. 21匹ゲットごとに伝説のポケモンが登場

## ローカルで試す

```powershell
cd kakezan-pokemon-get
python -m http.server 8080
```

ブラウザで http://localhost:8080/ を開いてください。

## ファイル構成

| ファイル | 内容 |
|---------|------|
| `index.html` | 画面のHTML |
| `style.css` | デザイン |
| `script.js` | ゲームの動き |
| `sound.js` | BGM・効果音 |
| `pokemon-data.js` | ポケモンデータ（1〜151） |
| `pokemon-data-gen2.js` | ポケモンデータ（152〜251） |
| `assets/` | 画像・BGM |

## 公開の仕組み

- **GitHub Pages** … `main` ブランチを push すると自動で公開されます
- **Cloudflare Pages**（任意）… 下記のシークレット設定後、同じく push でデプロイされます

## Cloudflare Pages の設定（任意）

ひらがなプロジェクト（[kids-motor-lab](https://github.com/yumayumaaaaan-hub/kids-motor-lab)）と同じ Cloudflare アカウントを使う場合、GitHub リポジトリに次の2つのシークレットを登録してください。

1. GitHub で https://github.com/yumayumaaaaan-hub/kakezan-pokemon-get/settings/secrets/actions を開く
2. **New repository secret** をクリック
3. 次の2つを追加（値は kids-motor-lab と同じものを使う）

| 名前 | 説明 |
|------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |

4. 追加後、GitHub の **Actions** タブから「Deploy to Cloudflare Pages」を **Run workflow** で再実行

## 技術メモ

- HTML / CSS / JavaScript のみ（フレームワークなし）
- 進行データはブラウザの localStorage に保存
- MVP のため、本番向けのセキュリティ・認証は未実装
