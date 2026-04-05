# はじめに

本リポジトリはうさぎの王子さまのElectronプロジェクトである  
ここではうさぎの王子さまをパッケージ化を行うまでの手順を示す  
OS は Windows

# 環境準備

必要なツールをインストールしていく

## Visual Studio Code インストール(デバッグしなければ不要)

[ダウンロードサイト](https://nodejs.org/ja)から  
Windows 用のインストーラーをダウンロードしてインストール

## Node.js インストール

[Node.js のサイト](https://nodejs.org/ja)から LTS 版をダウンロードすればいいが mise を推奨
Powershellでの使用が前提となる

### mise インストール

以下コマンドでインストール

```
winget install jdx.mise
```

nodeをインストール LTS版を指定

```
mise use -g node@lts
```

このままでは npm と node が使えないためshimsへのパスを通す

ユーザーパスが分からなければコマンドプロンプトの次コマンドで確認

```
echo %userprofile%
```

ユーザー環境変数に次を設定

```
[ユーザーパス]\AppData\Local\mise\shims
```

この後ターミナルを新たに起動したら npm と node が使えるようになっているはず

# ビルド方法

UsaPrinceJsのビルド物を取り込みElectronパッケージを作成できるようにする
事前にUsaPrinceJsのビルドを行っておく

その後ルートフォルダをカレントにして以下コマンドを実行する

## npm パッケージインストール

```
npm install
```

## リリース

```
npm run build
```

## デバッグ

```
npm run debug-build
```

リリースとデバッグは出力先に同一フォルダを使用しているため同時に行わないこと  
「ビルド方法 ⇒ パッケージ化」の手順をリリースとデバッグでそれぞれ行う必要がある

# パッケージ化

ビルド物とデータをパッケージ出力を行う

次のコマンドを実行する

## リリース

```
npm run potable
```

## デバッグ

```
npm run potableDev
```

「build_release」もしくは「build_debug」が出力されるので  
中にある「win-unpacked」フォルダをリネームして zip で固めたら配布物の出来上がり

# デバッグ方法

デバッグビルド、画像、音声、フォントファイル配置後、Visual Studio Code を起動する  
実行とデバッグから「Electron All」を選択し、F5 キーを押すとデバッグ実行される

# asar の展開方法

リリースでパッケージ化すると、resources 以下が asar ファイルにまとめられる
次の方法で展開することができる

1.npm で asar をインストールする  
2.次のコマンドを実行する

```
asar extract ファイル 出力フォルダー名
```
