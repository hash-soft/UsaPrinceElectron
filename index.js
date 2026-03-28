'use strict';

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { dialog, session } = require('electron');

process.on('uncaughtException', (err) => {
  log.error(err);
  dialog.showErrorBox('エラー', err.message);
  app.quit();
});

const launchArgs = process.argv.slice(1);
const debugLaunch = launchArgs.some((arg) => arg === 'debug');
const vscodeLaunch = launchArgs.some((arg) => arg === 'vscode');

(() => {
  const d = new Date();
  const prefix =
    d.getFullYear() +
    ('00' + (d.getMonth() + 1)).slice(-2) +
    ('00' + d.getDate()).slice(-2);
  const curr = log.transports.file.fileName;
  log.transports.file.fileName = `${prefix}_${curr}`;
  log.initialize({ spyRendererConsole: true });
  if (!app.requestSingleInstanceLock()) {
    log.info('Already running');
    app.quit();
    process.exit(0);
  }
  rotationLog(d);
})();

const startFilename = debugLaunch ? 'index_test.html' : 'index.html';
const htmlRootDir = vscodeLaunch ? path.join(__dirname, 'UsaPrinceNpm') : __dirname;
const basePath = app.isPackaged ? path.dirname(process.argv[0]) : htmlRootDir;
const iconPath = path.join(htmlRootDir, 'assets/icons');

if (debugLaunch) {
  log.verbose(process.argv);
  log.verbose('dirname', htmlRootDir);
  log.verbose('processPath', path.dirname(process.argv[0]));
  log.verbose('basePath', basePath);
}

// ウインドウオブジェクトのグローバル参照を保持してください。さもないと、そのウインドウは
// JavaScript オブジェクトがガベージコレクションを行った時に自動的に閉じられます。
let mainWindow;
let windowSize = { width: 0, height: 0 };
function createWindow() {
  mainWindow = new BrowserWindow({
    useContentSize: true,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(iconPath, 'game_icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.removeMenu();
  const size = initialDipSize();
  mainWindow.setContentSize(size.width, size.height);
  mainWindow.center();
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyUp') {
      return;
    }
    if (input.control || input.alt) {
      return;
    }
    switch (input.key.toLowerCase()) {
      case 'f8':
        if (!debugLaunch) {
          break;
        }
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.toggleDevTools();
        }
        break;
    }
  });

  // アプリの index.html を読み込む
  mainWindow.loadFile(path.join(htmlRootDir, startFilename));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ウィンドウが閉じられた時に発火
  mainWindow.on('closed', () => {
    // ウインドウオブジェクトの参照を外す。
    // 通常、マルチウインドウをサポートするときは、
    // 配列にウインドウを格納する。
    // ここは該当する要素を削除するタイミング。
    mainWindow = null;
  });
}

/**
 * @function startConfigWindow
 * @description
 * 設定ウィンドウを新しく作成します
 * @param {BrowserWindow} mainWindow - メインウィンドウ
 */
function startConfigWindow() {
  const configWindow = new BrowserWindow({
    title: 'UpConfig',
    width: 660,
    height: 680,
    parent: mainWindow,
    modal: true,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(iconPath, 'config_icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  configWindow.removeMenu();
  // 子ウィンドウ用 HTML
  configWindow.loadFile('index_config.html');
  ipcMain.handle('file:endResetConfig', async () => {
    configWindow.webContents.send('endResetConfig');
  });
  configWindow.on('closed', () => {
    ipcMain.removeHandler('file:endResetConfig');
  });
}

/**
 * ウィンドウサイズを、512x512の整数倍に設定する
 * 256x256以下のサイズに設定する場合は、512x512に設定する
 * 512x512以上のサイズに設定する場合は、最大の整数倍に設定する
 * @return {Object} DIP座標系のサイズ
 */
function initialDipSize() {
  const dispPt = calcDispPoint();
  if (
    windowSize.width <= 256 ||
    windowSize.height <= 256 ||
    windowSize.width > dispPt.x ||
    windowSize.height > dispPt.y
  ) {
    for (let i = 2; i < 10; i++) {
      const pt = { x: 512 * i, y: 512 * i };
      if (pt.x > dispPt.x || pt.y > dispPt.y) {
        windowSize.width = 512 * (i - 1);
        windowSize.height = 512 * (i - 1);
        break;
      }
    }
  }
  // windowSizeが物理サイズ、ptが拡大率込みの内部サイズ
  const pt = screen.screenToDipPoint({
    x: windowSize.width,
    y: windowSize.height,
  });
  return { width: Math.floor(pt.x), height: Math.floor(pt.y) };
}

/**
 * 現在のウィンドウサイズを、512x512の整数倍に設定する
 * 512x512以上のサイズに設定する場合は、最大の整数倍に設定する
 * @return {Object} DIP座標系のサイズ
 */
function changeDispSize() {
  const dispPt = calcDispPoint();
  const scale =
    Math.floor(Math.min(windowSize.width, windowSize.height) / 512) + 1;
  windowSize.width = 512 * scale;
  windowSize.height = 512 * scale;
  if (windowSize.width > dispPt.x || windowSize.height > dispPt.y) {
    windowSize.width = 512;
    windowSize.height = 512;
  }
  const pt = screen.screenToDipPoint({
    x: windowSize.width,
    y: windowSize.height,
  });
  return { width: Math.floor(pt.x), height: Math.floor(pt.y) };
}

/**
 * 現在のディスプレイのワークエリアサイズを、DIP座標系に変換して返す
 * @return {Object} DIP座標系のワークエリアサイズ
 */
function calcDispPoint() {
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const dispSize = display.workAreaSize;
  const size = mainWindow.getSize();
  const contentSize = mainWindow.getContentSize();
  dispSize.width -= size[0] - contentSize[0];
  dispSize.height -= size[1] - contentSize[1];
  return screen.dipToScreenPoint({
    x: dispSize.width,
    y: dispSize.height,
  });
}

// このイベントは、Electronが初期化処理と
// browser windowの作成を完了した時に呼び出されます。
// 一部のAPIはこのイベントが発生した後にのみ利用できます。
app.whenReady().then(() => {
  ipcMain.handle('file:readSaveHeader', readSaveHeader);
  ipcMain.handle('file:readText', readTextFile);
  ipcMain.handle('file:writeText', writeTextFile);
  ipcMain.handle('file:resetConfig', resetConfig);
  ipcMain.handle('file:writeBase64', writeBase64File);
  ipcMain.handle('key:specialKeyDown', specialKeyDown);
  createWindow();
});

// 全てのウィンドウが閉じられた時に終了する
app.on('window-all-closed', () => {
  // macOSでは、ユーザが Cmd + Q で明示的に終了するまで、
  // アプリケーションとそのメニューバーは有効なままにするのが一般的。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOSでは、ユーザがドックアイコンをクリックしたとき、
  // そのアプリのウインドウが無かったら再作成するのが一般的。
  if (mainWindow === null) {
    createWindow();
  }
});

// このファイル内には、
// 残りのアプリ固有のメインプロセスコードを含めることができます。
// 別々のファイルに分割してここで require することもできます。

/**
 * セーブファイルリストを取得する
 */
ipcMain.on('getSaveFileList', (event, saveFileFormat, maxText) => {
  const max = Number.parseInt(maxText);
  const ids = Array.from(Array(max).keys(), (x) => x + 1);
  const saveFileList = ids.map((id) => {
    const saveFileName = saveFileFormat.replace('[d]', id);
    let headerText;
    const filePath = path.join(basePath, saveFileName);
    if (fs.existsSync(filePath)) {
      headerText = _loadHeader(filePath);
    }
    return {
      id,
      headerText,
    };
  });
  event.sender.send(
    'getSaveFileListResult',
    'success',
    JSON.stringify(saveFileList)
  );
});

/**
 * 中断ファイルリストを取得する
 */
ipcMain.on('getSuspendFileList', (event, suspendFileFormat, maxText) => {
  const max = Number.parseInt(maxText);
  const ids = Array.from(Array(max).keys(), (x) => x + 1);
  const suspendFileList = ids.map((id) => {
    const suspendFileName = suspendFileFormat.replace('[d]', id);
    let suspendHeaderText;
    const filePath = path.join(basePath, suspendFileName);
    if (fs.existsSync(filePath)) {
      suspendHeaderText = _loadHeader(filePath);
    }
    return {
      id,
      suspendHeaderText,
    };
  });
  event.sender.send(
    'getSuspendFileListResult',
    'success',
    JSON.stringify(suspendFileList)
  );
});

/**
 * ファイルに文字列を書き込み
 */
ipcMain.on('writeFile', (event, filename, header, data) => {
  try {
    const filePath = path.join(basePath, filename);
    const pathName = path.dirname(filePath);
    if (!fs.existsSync(pathName)) {
      fs.mkdirSync(pathName, { recursive: true });
    }
    const lengthText = Buffer.byteLength(header).toString().padEnd(10);
    fs.writeFileSync(filePath, lengthText + header + data);
    event.sender.send('writeResult', 'success', 'ok');
  } catch (e) {
    event.sender.send('writeResult', 'failed', e.name);
    log.error(e);
  }
});

/**
 * セーブファイル名からセーブヘッダーを読み込む
 * @param {string} filename - セーブファイル名
 * @returns {Promise<string>} 中断ヘッダー
 */
async function readSaveHeader(_event, filename) {
  // 中断ヘッダだけを読むことはないであろうが
  // セーブと中断同じ仕様なので同一関数を使用する
  const filePath = path.join(basePath, filename);
  if (!fs.existsSync(filePath)) {
    // 存在しないデータは選べないはずなので
    log.error('Lost save file: ' + filePath);
    return '';
  }
  return _loadHeader(filePath) ?? '';
}

/**
 * ヘッダを読み込み
 * @param {*} filePath
 * @returns
 */
function _loadHeader(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const headerLength = _readHeaderSize(fd);
    const headerText = _readData(fd, headerLength, 10);
    fs.closeSync(fd);

    return headerText;
  } catch (e) {
    log.error(e);
    return;
  }
}

/**
 * ファイルから文字列を読み込み
 */
ipcMain.on('readFile', (event, filename) => {
  try {
    const filePath = path.join(basePath, filename);
    const length = fs.statSync(filePath).size;
    const fd = fs.openSync(filePath, 'r');
    const headerLength = _readHeaderSize(fd) + 10;
    const data = _readData(fd, length - headerLength, headerLength);
    fs.closeSync(fd);
    event.sender.send('readResult', 'success', data);
  } catch (e) {
    event.sender.send('readResult', 'failed', e.name);
    log.error(e);
  }
});

/**
 * ファイルを写す
 */
ipcMain.on('copyFile', (event, srcName, destName) => {
  try {
    fs.copyFileSync(
      path.join(basePath, srcName),
      path.join(basePath, destName)
    );
    event.sender.send('copyResult', 'success', 'ok');
  } catch (e) {
    event.sender.send('copyResult', 'failed', e.name);
    log.error(e);
  }
});

/**
 * ファイルを削除する
 */
ipcMain.on('removeFile', (event, name) => {
  try {
    const filePath = path.join(basePath, name);
    if (!fs.existsSync(filePath)) {
      event.sender.send('removeResult', 'success', 'nothing');
      return;
    }
    fs.unlinkSync(filePath);
    event.sender.send('removeResult', 'success', 'ok');
  } catch (e) {
    event.sender.send('removeResult', 'failed', e.name);
    log.error(e);
  }
});

/**
 * ヘッダサイズを読み込む
 * @param {*} fd
 * @returns
 */
function _readHeaderSize(fd) {
  const buff = Buffer.alloc(10);
  fs.readSync(fd, buff, 0, 10, 0);
  return parseInt(buff.toString('utf8'));
}

/**
 * 指定の位置から指定のサイズを読み込む
 * @param {*} fd
 * @param {*} length
 * @param {*} position
 * @returns
 */
function _readData(fd, length, position) {
  const buff = Buffer.alloc(length);
  fs.readSync(fd, buff, 0, length, position);
  return buff.toString('utf8');
}

/**
 * 20日前以前のログを削除する
 * @param {Date} d 20日前以降の日付
 */
function rotationLog(d) {
  const baseTime = d.getTime() - 20 * 24 * 60 * 60 * 1000;
  const info = log.transports.file.getFile();
  const basePath = path.dirname(info.path);
  const files = fs.readdirSync(basePath);
  for (const file of files) {
    const filePath = path.join(basePath, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < baseTime) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * 指定されたファイル名のテキストファイルを同期的に読み込みます
 * @param {string} filename 読み込むファイル名
 * @returns {string} 読み込まれたテキストデータ
 * @throws {Error} 読み込みに失敗した場合
 */
async function readTextFile(_event, filename) {
  // ファイルが存在していなくても問題ないので事前にファイルチェックを行う
  const filePath = path.join(basePath, filename);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  try {
    const length = fs.statSync(filePath).size;
    const fd = fs.openSync(filePath, 'r');
    const data = _readData(fd, length, 0);
    fs.closeSync(fd);
    return data;
  } catch (e) {
    log.error(e);
    return '';
  }
}

/**
 * 指定されたファイル名にテキストデータを同期的に書き込みます
 * @param {string} filename 書き込むファイル名
 * @param {string} data 書き込むテキストデータ
 * @returns {boolean} 書き込みに成功したか否か
 * @throws {Error} 書き込みに失敗した場合
 */
async function writeTextFile(_event, filename, data) {
  try {
    const filePath = path.join(basePath, filename);
    const pathName = path.dirname(filePath);
    if (!fs.existsSync(pathName)) {
      fs.mkdirSync(pathName, { recursive: true });
    }
    fs.writeFileSync(filePath, data);
    return true;
  } catch (e) {
    log.error(e);
    return false;
  }
}

/**
 * 設定をリセットします
 * @param {*} _event ipcMainのevent
 * @param {*} data 設定データ
 * @returns {boolean} リセットに成功したか否か
 */
async function resetConfig(_event, data) {
  mainWindow.webContents.send('resetConfig', data);
  return true;
}

/**
 * 指定されたファイル名にbase64エンコードされたデータを同期的に書き込みます
 * @param {string} filename 書き込むファイル名
 * @param {string} data 書き込むbase64エンコードされたデータ
 * @returns {boolean} 書き込みに成功したか否か
 * @throws {Error} 書き込みに失敗した場合
 */
async function writeBase64File(_event, filename, data) {
  try {
    const filePath = path.join(basePath, filename);
    const pathName = path.dirname(filePath);
    if (!fs.existsSync(pathName)) {
      fs.mkdirSync(pathName, { recursive: true });
    }
    fs.writeFileSync(filePath, data, { encoding: 'base64' });
    return true;
  } catch (e) {
    log.error(e);
    return false;
  }
}

/**
 * @function specialKeyDown
 * @description
 * F4, F5, F6, F12キーを押した時に呼び出されます
 * F4キー: フルスクリーンでない場合、ディスプレイのワークエリアサイズに
 *         画面サイズを変更して、中心に移動します
 * F5キー: フルスクリーンの ON/OFF を切り替えます
 * F6キー: 設定ウィンドウを表示します
 * F12キー: 画面をリロードします
 * @param {string} code F4, F5, F6, F12のどれか
 */
async function specialKeyDown(_event, code) {
  switch (code) {
    case 'f4':
      if (!mainWindow.isFullScreen()) {
        const { width, height } = changeDispSize();
        mainWindow.setContentSize(width, height);
        mainWindow.center();
      }
      break;
    case 'f5':
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      break;
    case 'f6':
      startConfigWindow();
      break;
    case 'f12':
      mainWindow.webContents.reload();
      break;
  }
}
