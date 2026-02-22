import { contextBridge, ipcRenderer } from 'electron';
import type { UIEventUpdate, UIP2PStatus, ZipAPI } from '../core/model';

const api: ZipAPI = {
  getIdentity: () => ipcRenderer.invoke('identity:get'),
  createIdentity: (username: string) => ipcRenderer.invoke('identity:create', username),
  listChannels: () => ipcRenderer.invoke('channel:list'),
  createChannel: (name: string, description?: string) => ipcRenderer.invoke('channel:create', name, description),
  listMessages: (channelId: string) => ipcRenderer.invoke('message:list', channelId),
  sendMessage: (channelId: string, content: string) => ipcRenderer.invoke('message:send', channelId, content),
  connectP2P: () => ipcRenderer.invoke('p2p:connect'),
  disconnectP2P: () => ipcRenderer.invoke('p2p:disconnect'),
  getP2PStatus: () => ipcRenderer.invoke('p2p:status'),
  onEventsChanged: (listener: (update: UIEventUpdate) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: UIEventUpdate) => {
      listener(payload);
    };

    ipcRenderer.on('events:changed', wrapped);
    return () => {
      ipcRenderer.removeListener('events:changed', wrapped);
    };
  },
  onP2PStatusChanged: (listener: (status: UIP2PStatus) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: UIP2PStatus) => {
      listener(payload);
    };

    ipcRenderer.on('p2p:status-changed', wrapped);
    return () => {
      ipcRenderer.removeListener('p2p:status-changed', wrapped);
    };
  },
};

contextBridge.exposeInMainWorld('zip', api);
