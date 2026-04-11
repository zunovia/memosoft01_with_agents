# AI Notes - ノートとチャット

Next.js ベースの AI ノートアプリ。ノートの作成・管理に加え、AI チャット機能と音声読み上げ（TTS）を搭載しています。

## セットアップ

```bash
git clone <このリポジトリ>
cd second_one
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

## 機能一覧

- AI チャット（ノートを自動参照して回答）
- ノートの作成・編集・タグ管理
- タイムライン表示
- AI によるノート自動生成
- 音声入力（Web Speech API）
- **音声読み上げ（TTS）** - 2つのエンジンに対応

## 音声読み上げ（TTS）

チャットの回答を音声で読み上げる機能です。**インストール不要**ですぐに使えます。

### 基本（インストール不要）

ブラウザ内蔵の Web Speech API を使用します。特別な設定は不要です。

1. チャット画面（`/chat`）を開く
2. 各メッセージの「🔊 読む」ボタンで読み上げ
3. 「自動読み上げON」で回答を自動読み上げ

### 高品質版（VOICEVOX）

[VOICEVOX](https://voicevox.hiroshiba.jp/) をインストールすると、高品質な日本語音声合成が使えます。

#### インストール手順

**方法1: 公式サイトから（推奨）**

1. https://voicevox.hiroshiba.jp/ からWindows版をダウンロード
2. インストーラーを実行

**方法2: winget（Windows）**

```bash
winget install HiroshibaKazuyuki.VOICEVOX
```

#### 使い方

1. VOICEVOX を起動する（API サーバーが `localhost:50021` で起動します）
2. アプリのチャット画面を開く
3. ヘッダーの音声エンジン表示が「🟢 VOICEVOX」に切り替わります
4. 設定パネルからキャラクターを選択できます（冥鳴ひまり、ずんだもん、四国めたんなど）

VOICEVOX が起動していない場合は、自動的にブラウザ音声にフォールバックします。

### Cursor / CLI での読み上げ

`scripts/speak.sh` を使って、ターミナルから VOICEVOX で読み上げできます。

```bash
# 基本（冥鳴ひまり、標準速度）
bash scripts/speak.sh "読み上げたいテキスト"

# キャラ指定（Speaker ID）
bash scripts/speak.sh "テキスト" 3    # ずんだもん

# 速度指定（speedScale）
bash scripts/speak.sh "テキスト" 14 0.8   # ひまり、ゆっくり
```

**Speaker ID 一覧（一部）:**

| ID | キャラクター |
|----|------------|
| 0  | 四国めたん（あまあま） |
| 2  | 四国めたん（ノーマル） |
| 1  | ずんだもん（あまあま） |
| 3  | ずんだもん（ノーマル） |
| 14 | 冥鳴ひまり |
| 8  | 春日部つむぎ |

全キャラ一覧は VOICEVOX 起動中に `curl http://localhost:50021/speakers` で確認できます。

## 技術スタック

- Next.js
- TypeScript
- Tailwind CSS
- Claude API（AI チャット）
- Supabase（データベース）
- Web Speech API / VOICEVOX（音声読み上げ）
