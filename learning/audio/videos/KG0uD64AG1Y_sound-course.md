# 学習ノート 01 — FREE Unreal Engine 5 Sound Course（Audio 基礎クラッシュコース）

- 動画: https://www.youtube.com/watch?v=KG0uD64AG1Y （18:09）
- 学習日: 2026-07-04 / 抽出: 英語自動字幕(en-orig) → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/KG0uD64AG1Y.txt](../transcripts/KG0uD64AG1Y.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

動画は4本の短いセクション（イントロ / Sound Cue / Attenuation / MP3→WAV 変換）で構成されている。

1. **オーディオのインポート** [00:31–01:02] — UE5 は WAV 形式のみ受け付け（MP3 不可）。ファイルをドラッグ&ドロップ、または Import で取り込むと **SoundWave** アセットになる
2. **SoundWave 単体の基本操作** [01:03–02:15] — Play ボタンでプレビュー、Volume/Pitch 調整、Looping チェックボックスで無限ループ、レベルに直接ドラッグして配置（ただし Auto Activate が既定 ON なので注意）
3. **Subtitles 設定** [02:19–04:07] — SoundWave 個別に Subtitles タブでタイムピン付きテキストを追加。複数音が同時に鳴る場合は Subtitle Priority が高い方が表示される。フォントサイズは Project Settings → General → Advanced → Subtitle Font で変更（要エディタ再起動）
4. **Trigger Volume 経由でのサウンド再生** [04:10–06:47] — Level Blueprint で `OnActorBeginOverlap` イベントから `Play Sound 2D` / `Play Sound at Location` / `Spawn Sound 2D` / `Spawn Sound at Location` の4関数を使い分けて発火
5. **Sound Cue によるサウンド合成** [06:53–13:11] — SoundWave を素材として Sound Cue グラフ上でノード接続し、ランダム化・多重再生・ループ・遅延・ピッチ変調・Blueprint 連動分岐を組む
6. **Attenuation（距離減衰）設定** [14:14–16:31] — 音源にOverride Attenuation を設定し、Inner/Outer Sphere で聞こえる音量を距離で制御。Attenuation を独立した Blueprint アセットとして作り複数音源で使い回すことも可能
7. **MP3 → WAV 変換** [16:36–18:09] — freeconvert.com（オンライン、回数制限あり）または Audacity（無料デスクトップアプリ、File → Export Audio → WAV）で変換してからインポート

## クオリティを上げる教訓（判断基準・なぜそうするか）

### 1. Play Sound と Spawn Sound の使い分け [05:23–06:47]
`Play Sound at Location` は再生後の制御が一切できず、レベルに永続的に存在し続ける。`Spawn Sound at Location` は戻り値（Audio Component への参照）を取得できるため、後から音量変更・停止・削除などの操作が可能になる。**「鳴らして終わり」なら Play、後で操作したいなら Spawn を選び、変数に昇格させて参照を保持する** [06:47] という判断基準。

### 2. Play Sound 2D は「非空間化」専用 [04:46–05:06]
Play Sound 2D はスピーカー全体で常に同じ音量で鳴り、プレイヤー位置や距離を一切考慮しない。講師は UI サウンドやナレーターに適していると明言。空間的な位置関係を持たせたい効果音には使わない、という区別が前提になっている。

### 3. Sound Cue の各ノードは「単発音源を多様化する」ための組み合わせ道具 [08:00–11:04]
- **Random ノード** [08:00–08:57]: 複数の SoundWave からランダムに1つ選んで再生。Weights で出現比率を調整可能（例: 片方を2にすると出現率2倍）。**Randomize without Replacement** をチェックすると、一度鳴らした音は他の全音が鳴り終わるまで再抽選されない（同じ音の連続再生を避ける仕組み）
- **Concatenator ノード** [08:58–09:34]: 接続順に音を1つずつ順番に再生（同時ではなく直列）
- **Mixer ノード** [09:34–09:52]: 複数の音を同時に重ねて合成
- **Looping ノード** [09:52–10:15]: 無限ループ、または Loop Indefinitely を外して回数指定ループ（例: 5回だけ）
- **Delay ノード** [10:15–10:44]: Delay Min/Max で再生開始までのランダム遅延幅を作る。同じ値にすれば固定遅延になる
- **Modulator ノード** [10:44–11:04]: Pitch と Volume を Min/Max 範囲でランダム化し、**毎回同じ音に聞こえないようにする**（「単調さの回避」が目的だと明言）

### 4. Branch / Switch ノードは Blueprint 側の状態と連動させる分岐 [11:08–13:11]
Branch ノードは true/false/未設定（parameter unset）の3系統に別々の音を割り当てられる。実装例として、Level Blueprint 側で `Set Boolean Parameter` を Audio Component に対して呼び、パラメータ名（講師は "example" と命名）を一致させることで、Blueprint 側のフラグに応じて Sound Cue 内の再生音を切り替えている。**Sound Cue 単体では完結せず、Blueprint 側からパラメータを渡す設計が前提**という点が重要。

### 5. Attenuation のカーブ形状は基本 Linear か Natural Sound に留める [14:52–15:16]
UE5 の距離減衰カーブには Linear（距離に応じて均等減衰）、Natural Sound（現実の音の減衰を再現）、Logarithmic、Inverse、Log Reverse、Custom がある。講師は「Log/Inverse/Log Reverse はあまり使ったことがない」とした上で、**Custom カーブでポイントを打って自作もできるが、基本は Linear か Natural Sound に留めることが推奨される**と明言 [15:11–15:16]。凝ったカーブ調整より確実な2択を選ぶという判断基準。

### 6. Attenuation は個別音源ではなく共有アセットとして作る [15:41–16:31]
Sound Attenuation を独立した Blueprint アセットとして作成しておけば、Override Attenuation のチェックを外して代わりにこのアセットを指定するだけで、**複数の音源に同一の減衰設定を使い回せる**。個別に Inner/Outer Sphere を都度調整する手間を避ける設計。

### 7. Inner/Outer Sphere とその操作系 [14:14–16:00]
Inner Sphere 内では音量100%、Outer Sphere に向かって100%→0%へ減衰する。Inner Radius を増やすと Outer Radius も自動的に連動して広がる。**Outer Sphere だけを個別に広げたい場合は Falloff Distance を操作する**（Inner Radius とは別パラメータとして分離されている）。

## 主要パラメータ・設定値の表

| 対象 | パラメータ / 項目 | 値・挙動 | 出典 |
|---|---|---|---|
| インポート形式 | 受理される音声フォーマット | WAV のみ（MP3 不可） | [00:33][00:48] |
| SoundWave | Looping チェックボックス | ON で無限ループ | [01:49–01:57] |
| SoundWave | Auto Activate（Activation） | 既定 ON。レベル配置時に自動再生される | [01:58–02:15] |
| Subtitles | Subtitle Priority | 値が高い方が同時再生時に画面表示される | [02:53–03:18] |
| Subtitle フォント | Project Settings → General → Advanced → Subtitle Font | 例: Roboto。サイズ変更は要エディタ再起動 | [03:37–04:00] |
| Blueprint 関数 | Play Sound 2D | 非空間化・全スピーカー同一音量（UI/ナレーター向け） | [04:46–05:06] |
| Blueprint 関数 | Play Sound at Location | 位置指定再生、再生後の制御不可・永続存在 | [05:06–05:39] |
| Blueprint 関数 | Spawn Sound at Location | Audio Component 参照を取得でき後から操作可能 | [05:39–06:47] |
| Sound Cue: Random | Weights | 数値が大きいほど出現比率が高い（例: 1 vs 2 で2倍） | [08:29–08:39] |
| Sound Cue: Random | Randomize without Replacement | ON で全音を1周するまで再抽選しない | [08:41–08:55] |
| Sound Cue: Looping | Loop Indefinitely OFF 時 | ループ回数を数値指定（例: 5回） | [10:04–10:11] |
| Sound Cue: Delay | Delay Min / Max | 例: min=1, max=5 → 1〜5秒のランダム遅延 | [10:19–10:34] |
| Sound Cue: Modulator | Pitch / Volume Min-Max | 範囲内でランダム化し毎回音を変化させる | [10:52–11:02] |
| Attenuation | Falloff 形状 | Linear / Natural Sound を推奨。Log/Inverse/Log Reverse/Custom は非推奨寄り | [14:52–15:16] |
| Attenuation | Inner Radius 変更時 | Outer Radius が自動連動して拡大 | [15:19–15:27] |
| Attenuation | Outer Sphere の個別調整 | Falloff Distance パラメータで操作 | [15:29–15:38] |
| 変換ツール | freeconvert.com | オンライン無料、1日あたり回数制限あり | [16:45–16:57] |
| 変換ツール | Audacity | 無料デスクトップ、File → Export Audio → Format: WAV | [17:02–17:45] |

## SCRAP BLITZ に活かせる部分

現状 pickup SE（HP/SP/CR 別化）や被弾/ヒット音は実装済みだが、この動画は「多重再生時のミキシング」自体には踏み込んでおらず（Sound Class / Sound Mix / Concurrency は動画内で一切言及されていない）、**Sound Cue レベルのバリエーション制御**が主な収穫になる。

- **Random + Weights + Randomize without Replacement** [08:00–08:57] は、ベルトスクロールアクションで頻発するヒット音・被弾音の「単調な連打感」を崩す直接の対策になる。同じ攻撃を連発した時に毎回同一波形だと耳が疲れる問題に対し、複数バリエーションを Weights で比率調整しつつ Randomize without Replacement で「同じ音が連続しない」保証を入れられる。既存の pickup SE（HP/SP/CR）にも Sound Cue 化してこのノードを挟む余地がある。
- **Modulator によるピッチ/ボリューム微変調** [10:44–11:04] は、講師が明言する通り「毎回同じに聞こえないようにする」ための最小コスト施策。OC 発動音・被弾音など高頻度再生される SE に一律で挟むだけで多重再生時の耳当たりが改善する可能性がある。
- **Attenuation の共有アセット化** [15:41–16:31] は、敵の数が多いステージで爆発音・被弾音が同時多発する際の音量管理の土台になる。個々の SE に Override Attenuation で都度設定するのではなく、「近接戦闘音」「爆発音」等カテゴリ単位で Attenuation アセットを作り使い回すことで、後から一括調整できる設計にしておける。
- **Play Sound 2D vs Spawn Sound at Location の使い分け** [04:46–06:47] は、UI 系 SE（メニュー操作音・OC 選択音など）は 2D で空間化しない、戦闘中の位置依存 SE は Spawn で参照を保持し必要なら途中停止できるようにする、という設計方針の裏付けになる。
- ただし本動画には **Concurrency（同時再生数の上限制御）・Sound Class 階層・Sound Mix（マスターボリューム/ダッキング）** の説明が一切無いため、「戦闘中の効果音多重再生時のミキシング」という要求に直接応える設計知識はこのノートだけでは不足している。これらは別動画での補完が必要（下記参照）。

## 字幕だけでは取れなかったもの

- [08:04] "press alt to break the link" の具体的なマウス操作・グラフ上のノード配置手順は画面操作依存で文字だけでは再現不可。ただし挙動の意味（Random ノードの接続し直し）は文脈から読み取れた
- [11:37–13:11] Branch ノードを使った Blueprint 連動の実装手順（`Set Boolean Parameter` のパラメータ名一致など）は音声のみでは配線の正確な接続順が曖昧な箇所があり、要点（パラメータ名を一致させて true/false を切り替える）のみ確度高く記載し、詳細な接続経路は割愛した
- Sound Class / Sound Mix / Concurrency は本動画では一切扱われておらず、「クオリティ教訓」「パラメータ表」に記載できる情報が transcript 上に存在しない（無理に補完せず欠落として明記）

---

内容サマリ:
1. 本動画は UE5 オーディオの基礎4点（SoundWave インポート/Subtitles、Blueprint 再生関数、Sound Cue ノード群、Attenuation）を扱う入門編で、Sound Class・Sound Mix・Concurrency には触れていない。
2. 最大の収穫は Sound Cue の Random/Modulator/Delay ノードによる「単調な繰り返し感の回避」設計と、Play/Spawn Sound の使い分け判断基準。
3. Attenuation は Linear/Natural Sound の2択推奨、共有 Blueprint アセット化で複数音源に使い回す設計思想が明確だった。
4. SCRAP BLITZ への適用は「多重再生ミキシング」そのものより「SE バリエーション化」「Attenuation のカテゴリ共有化」が中心となり、Concurrency 制御は別ソースでの補完が必要。

確信度が低い抽出 3 件:
1. [08:04] Random ノードの配線操作手順（alt キーでのリンク切断・再接続の具体的な対象ノード）— 音声のみでは操作対象の特定がやや曖昧
2. [11:37–12:44] Branch ノードと Blueprint 側 `Set Boolean Parameter` の接続順序の詳細（どのピンからどのピンへ、の完全な経路）— 要点は明確だが配線の全経路は字幕だけでは再構成しきれていない
3. [15:11–15:16] "it's just recommended to leave that at linear or natural sound" の主語（講師個人の経験則か、UE 公式の一般的推奨かの区別）— 講師個人の意見として記載したが、断定的な UE ドキュメント由来の推奨かは transcript だけでは判別不可

