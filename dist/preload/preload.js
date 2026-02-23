"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    getIdentity: () => electron_1.ipcRenderer.invoke("identity:get"),
    createIdentity: (username) => electron_1.ipcRenderer.invoke("identity:create", username),
    listChannels: () => electron_1.ipcRenderer.invoke("channel:list"),
    createChannel: (name, description, options) => electron_1.ipcRenderer.invoke("channel:create", name, description, options),
    listMessages: (channelId) => electron_1.ipcRenderer.invoke("message:list", channelId),
    sendMessage: (channelId, content) => electron_1.ipcRenderer.invoke("message:send", channelId, content),
    connectP2P: () => electron_1.ipcRenderer.invoke("p2p:connect"),
    disconnectP2P: () => electron_1.ipcRenderer.invoke("p2p:disconnect"),
    getP2PStatus: () => electron_1.ipcRenderer.invoke("p2p:status"),
    listContacts: () => electron_1.ipcRenderer.invoke("contacts:list"),
    startDirectChat: (nodeId) => electron_1.ipcRenderer.invoke("contacts:start-direct-chat", nodeId),
    invitePeerToChannel: (channelId, nodeId) => electron_1.ipcRenderer.invoke("channel:invite", channelId, nodeId),
    listGroupMembers: (groupId) => electron_1.ipcRenderer.invoke("group:members", groupId),
    setGroupMemberRole: (groupId, memberPublicKey, role) => electron_1.ipcRenderer.invoke("group:set-role", groupId, memberPublicKey, role),
    listInvites: () => electron_1.ipcRenderer.invoke("invite:list"),
    respondInvite: (inviteId, accept) => electron_1.ipcRenderer.invoke("invite:respond", inviteId, accept),
    onEventsChanged: (listener) => {
        const wrapped = (_event, payload) => {
            listener(payload);
        };
        electron_1.ipcRenderer.on("events:changed", wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener("events:changed", wrapped);
        };
    },
    onP2PStatusChanged: (listener) => {
        const wrapped = (_event, payload) => {
            listener(payload);
        };
        electron_1.ipcRenderer.on("p2p:status-changed", wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener("p2p:status-changed", wrapped);
        };
    },
    onContactsChanged: (listener) => {
        const wrapped = (_event, payload) => {
            listener(payload);
        };
        electron_1.ipcRenderer.on("contacts:changed", wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener("contacts:changed", wrapped);
        };
    },
    onInvitesChanged: (listener) => {
        const wrapped = (_event, payload) => {
            listener(payload);
        };
        electron_1.ipcRenderer.on("invites:changed", wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener("invites:changed", wrapped);
        };
    },
};
electron_1.contextBridge.exposeInMainWorld("zipAPI", api);
