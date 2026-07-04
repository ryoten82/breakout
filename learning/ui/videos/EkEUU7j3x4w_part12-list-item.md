# 学習ノート — Unreal Engine UI Design Part 12: List Item Part 01

- 動画: https://www.youtube.com/watch?v=EkEUU7j3x4w （22分45秒、UMG/UIデザインシリーズ12本目・次回が最終回）
- 学習日: 2026-07-04 / 抽出: 自動生成字幕（英語ASR、手動字幕なし）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/EkEUU7j3x4w.txt](../transcripts/EkEUU7j3x4w.txt)

## 作業手順（工程順）

| 時刻 | 内容 |
|---|---|
| [01:00]-[01:35] | `Widgets/List`フォルダに共通親を継承した`WBP_ListItem`を作成 |
| [01:39]-[02:03] | 新規Struct `SD_ListItem`（Background: Texture2D）を作成 |
| [05:12]-[08:11] | **テキスト色の動的変更**：カスタムイベント`ChangeColor`→Set Color and Opacity。Bool `UseCustomColor`（Public・Expose on Spawn・デフォルトfalse）+Selectノードで「デフォルト色/カスタム色」を分岐 |
| [08:11]-[09:12] | Borderウィジェットを追加、Item BorderのTextureをUI Settings経由でBackgroundにバインド。Custom Size仮100×100 |
| [09:35]-[12:16] | Horizontal Box（Icon）→ネストしたHorizontal Box（Title）でレイアウト。アイコンサイズ崩れ→Size Box（64×64仮）でラップ |
| [12:36]-[13:53] | Scale Boxも試すが「見た目に大差ない」と判断、**Size Box + Paddingを採用**（Scale Boxは不採用） |
| [14:48]-[17:21] | 下段（数量+アイコン）行を上段行の複製で作成。money iconをエクスポート/インポート（`T_Coin`） |
| [17:21]-[19:12] | Iconウィジェットだと崩れるためImageウィジェットに変更。フォントサイズ12→16に修正（12は小さすぎ） |
| [19:12]-[22:10] | 区切り線（Divider）：`T_Divider`をインポート、SpacerをImageに置き換えSize Boxで極薄幅にラップ、Padding Top10/Bottom5 |

## 判断基準・コツ

- **アセットは「エクスポート→共有UIフォルダ→再インポート」を徹底**：視聴者が同じ素材を再利用できるようにする配慮
- **テキスト色の可変化はPromoted Variable + Selectノードで実装**：常にカスタム色にすると"secondary color"が使えなくなるため、Bool一つで切替可能にする
- **サイズ崩れへの対処はSize Box優先**：内容物の実寸を固定してレイアウトを安定させたい場合はSize Box、拡大縮小させたい場合はScale Box、という使い分け判断（本動画ではSize Box採用）
- **ラフサイズは仮決めで進める**：100×100や64×64は「とりあえず動く値」であり最終値ではないと明言。初期値は目安、最終調整はplaytestベースという姿勢
- **不要な要素はまずHideで対応**：削除せずVisibility=Hiddenで保持（後で使う可能性を残す）

## 主要パラメータ

| 項目 | 値 |
|---|---|
| Struct名 | `SD_ListItem`（Background: Texture2D） |
| Bool変数 | `UseCustomColor`（Public, Expose on Spawn, デフォルトfalse） |
| Item Borderサイズ | 約100×100※仮値 |
| Icon用Size Box | 64×64※仮値 |
| フォントサイズ（数量テキスト） | 12→16 |
| Divider用Padding | Top10/Bottom5 |

## 現行UE5.8での通用性所見

**概ね現行UE5.8でも通用する内容。** 使用ウィジェット（Border/Horizontal Box/Vertical Box/Size Box/Scale Box/Spacer/Image/Text/Struct変数/Promoted Variable/Custom Event/Selectノード/Expose on Spawn）はいずれもUMGの基本コンポーネントで、UE4後期〜UE5系にかけて大きな仕様変更はない。「Fill Size」の挙動（親Boxが Fill 設定でないと子が広がらない）という詰まりポイントも現行で同様に発生し得るため参考になる。注意点として、本動画はあくまで「1アイテムの見た目」を作る回で、**ListView固有機能（Entry Widget Class等）はまだ扱われていない**。

## 確信度が低い抽出

1. [21:35]付近 Divider Size Box幅の数値（「1」か「2」か断定不可）
2. [08:11]付近 Item Borderサイズ（100×100か100×200か）
3. [10:37]-[11:36] Horizontal Boxのネスト階層の詳細（実装時は動画を目視確認推奨）
