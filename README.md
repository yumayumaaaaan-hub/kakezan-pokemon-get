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

このプロジェクトは **HTML/CSS/JS だけ** なので、ビルド（変換作業）は不要です。

### 方法A: Cloudflare ダッシュボードで Git 連携（おすすめ）

Cloudflare ダッシュボード → **Workers & Pages** → プロジェクト → **Settings** → **Build**

| 項目 | 設定値 |
|------|--------|
| Framework preset | **None** |
| Build command | **空欄**（何も書かない） |
| Build output directory | **`.`** または **`/`**（ルート） |
| Deploy command | **空欄**（推奨） |

**Deploy command が `npx wrangler deploy` のままの場合**  
ダッシュボードで空欄に直すのが一番確実です。  
どうしても変更できない場合は、リポジトリの `wrangler.toml` に `[assets]` を入れてあるので、そのまま再デプロイを試してください。

**Deploy command を手で直す場合の例（どちらか）**

- 空欄（ビルド出力 `.` だけ使う）
- `npx wrangler pages deploy . --project-name=kakezan-pokemon-get`

設定変更後、**Retry deployment** で再デプロイしてください。

### 方法B: GitHub Actions からデプロイ

GitHub リポジトリに次の2つのシークレットを登録します。

1. https://github.com/yumayumaaaaan-hub/kakezan-pokemon-get/settings/secrets/actions を開く
2. **New repository secret** で以下を追加

| 名前 | 説明 |
|------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |

3. GitHub の **Actions** タブ →「Deploy to Cloudflare Pages」→ **Run workflow**

※ 方法Aと方法Bは **どちらか一方** で十分です。両方同時だと二重デプロイになります。

## 技術メモ

- HTML / CSS / JavaScript のみ（フレームワークなし）
- 進行データはブラウザの localStorage に保存
- MVP のため、本番向けのセキュリティ・認証は未実装
