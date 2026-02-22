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
    connectP2P: () => electron_1.ipcRenderer.invoke('p2p:connect'),
    disconnectP2P: () => electron_1.ipcRenderer.invoke('p2p:disconnect'),
    getP2PStatus: () => electron_1.ipcRenderer.invoke('p2p:status'),
    onEventsChanged: (listener) => {
        const wrapped = (_event, payload) => {
            listener(payload);
        };
        electron_1.ipcRenderer.on('events:changed', wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener('events:changed', wrapped);
        };
    },
    onP2PStatusChanged: (listener) => {
        const wrapped = (_event, payload) => {
            listener(payload);
        };
        electron_1.ipcRenderer.on('p2p:status-changed', wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener('p2p:status-changed', wrapped);
        };
    },
};
electron_1.contextBridge.exposeInMainWorld('zip', api);
