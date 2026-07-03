# SOURCE: MetaSounds Quick Start
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-quick-start
取得方法: WebFetch（要約モードだが具体的な構成要素まで取得できた良質ソース。前提: 「MetaSounds in Unreal Engine」ハブページは本文がほぼ空のスタブだったため、こちらの Quick Start を採用）
取得日: 2026-07-04

---

Unreal Engine 5.8 のドキュメント。MetaSound（高性能な DSP グラフベースのオーディオシステム）を使ったゲームプレイ駆動オーディオ制作のチュートリアル。

## Overview
MetaSound により、オーディオデザイナーが音生成のための Digital Signal Processing グラフをコントロールできる。

## Project Setup
First Person Template プロジェクト + Starter Content を前提とする。

## 2つの実例プロジェクト

### 1. Bomb Sound Effect
- 3D 空間化のための sound attenuation を持つ MetaSound Source を作成
- Wave Player ノード・Mono Mixer・ランダムサウンド選択を使用
- projectile Blueprint と連携し、衝突時に爆発音をトリガー

### 2. Ambient Wind Sound
- ステレオ・非空間化のアンビエントオーディオを作成
- Noise generator・Low Pass Filter・LFO ノードで動的なバリエーションを実現
- Level Blueprint と接続し、プレイヤーの移動速度に応じて音の強度を変調

## 技術要素
Wave Player・Mixer・Filter・パラメータコントロールノードを使った MetaSound グラフ構築。Blueprint 連携によるリアルタイムのサウンドトリガー・float パラメータ更新。

反復的なテストを推奨し、追加的な動的サウンドデザイン要素への拡張案も含む。
