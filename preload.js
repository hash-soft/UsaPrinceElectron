'use strict';
const { contextBridge, ipcRenderer } = require('electron');
/**
 * メインプロセスとのファイルのやり取り
 */
contextBridge.exposeInMainWorld('file', {
  /**
   * 送信
   * @param {*} channel
   * @param {*} name
   * @param {*} data
   */
  send: (channel, name, data1, data2) => {
    ipcRenderer.send(channel, name, data1, data2);
  },

  /**
   * 受信
   * @param {*} channel
   * @param {*} fn
   */
  on: (channel, fn) => {
    ipcRenderer.once(channel, (event, ...args) => fn(...args));
  },

  readSaveHeader: (filename) =>
    ipcRenderer.invoke('file:readSaveHeader', filename),

  readTextFile: (filename) => ipcRenderer.invoke('file:readText', filename),

  writeTextFile: (filename, data) =>
    ipcRenderer.invoke('file:writeText', filename, data),

  resetConfig: (data) => ipcRenderer.invoke('file:resetConfig', data),

  onResetConfig: (callback) => {
    ipcRenderer.on('resetConfig', (_event, data) => callback(data));
  },

  endResetConfig: () => ipcRenderer.invoke('file:endResetConfig'),

  onEndResetConfig: (callback) => {
    ipcRenderer.on('endResetConfig', () => callback());
  },

  writeBase64File: (filename, data) =>
    ipcRenderer.invoke('file:writeBase64', filename, data),

  specialKeyDown: (code) => ipcRenderer.invoke('key:specialKeyDown', code),
});
