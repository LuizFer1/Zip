"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    getIdentity: () => electron_1.ipcRenderer.invoke('identity:get'),
    createIdentity: (username) => electron_1.ipcRenderer.invoke('identity:create', username),
    listChannels: () => electron_1.ipcRenderer.invoke('channel:list'),
    createChannel: (name, description) => electron_1.ipcRenderer.invoke('channel:create', name, description),
    listMessages: (channelId) => electron_1.ipcRenderer.invoke('message:list', channelId),
    sendMessage: (channelId, content) => electron_1.ipcRenderer.invoke('message:send', channelId, content),
};
electron_1.contextBridge.exposeInMainWorld('zip', api);
