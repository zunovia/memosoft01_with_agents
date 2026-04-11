#!/bin/bash
# VOICEVOX TTS script
# Usage: ./speak.sh "読み上げたいテキスト"
TEXT="$1"
SPEAKER=${2:-14}  # デフォルト: 冥鳴ひまり
SPEED=${3:-1.0}   # デフォルト: 標準
TMPDIR="$LOCALAPPDATA/Temp"

# URLエンコード
ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$TEXT")

# 1. 音声クエリ生成
curl -s -X POST "http://localhost:50021/audio_query?text=${ENCODED}&speaker=${SPEAKER}" -o "$TMPDIR/vvquery.json" 2>/dev/null

# 2. speedScale調整
python3 -c "
import json,os
p=os.path.join(os.environ['LOCALAPPDATA'],'Temp','vvquery.json')
with open(p,'r',encoding='utf-8') as f: q=json.load(f)
q['speedScale']=${SPEED}
with open(p,'w',encoding='utf-8') as f: json.dump(q,f)
"

# 3. 音声合成
curl -s -X POST "http://localhost:50021/synthesis?speaker=${SPEAKER}" \
  -H "Content-Type: application/json" \
  -d @"$TMPDIR/vvquery.json" \
  -o "$TMPDIR/vvvoice.wav" 2>/dev/null

# 4. 再生
powershell.exe -Command '(New-Object System.Media.SoundPlayer "C:\Users\zunov\AppData\Local\Temp\vvvoice.wav").PlaySync()' 2>/dev/null
