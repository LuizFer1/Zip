import { contextBridge, ipcRenderer } from 'electron';
import type { ZipAPI } from '../core/model';

const api: ZipAPI = {
  getIdentity: () => ipcRenderer.invoke('identity:get'),
  createIdentity: (username: string) => ipcRenderer.invoke('identity:create', username),
  listChannels: () => ipcRenderer.invoke('channel:list'),
  createChannel: (name: string, description?: string) => ipcRenderer.invoke('channel:create', name, description),
  listMessages: (channelId: string) => ipcRenderer.invoke('message:list', channelId),
  sendMessage: (channelId: string, content: string) => ipcRenderer.invoke('message:send', channelId, content),
};

contextBridge.exposeInMainWorld('zip', api);
