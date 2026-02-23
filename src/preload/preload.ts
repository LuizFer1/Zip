import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type {
  UIContact,
  UIChannel,
  UIEventUpdate,
  UIInvite,
  UIMessage,
  UIP2PStatus,
  UIProfile,
  ZipAPI,
} from "../core/model";

const api: ZipAPI = {
  getIdentity: () => ipcRenderer.invoke("identity:get"),
  createIdentity: (username: string) => ipcRenderer.invoke("identity:create", username),
  listChannels: () => ipcRenderer.invoke("channel:list"),
  createChannel: (
    name: string,
    description?: string,
    options?: { channelType?: "group" | "text" | "voice_video"; parentGroupId?: string },
  ) => ipcRenderer.invoke("channel:create", name, description, options),
  listMessages: (channelId: string) => ipcRenderer.invoke("message:list", channelId),
  sendMessage: (channelId: string, content: string) => ipcRenderer.invoke("message:send", channelId, content),
  connectP2P: () => ipcRenderer.invoke("p2p:connect"),
  disconnectP2P: () => ipcRenderer.invoke("p2p:disconnect"),
  getP2PStatus: () => ipcRenderer.invoke("p2p:status"),
  listContacts: () => ipcRenderer.invoke("contacts:list"),
  startDirectChat: (nodeId: string) => ipcRenderer.invoke("contacts:start-direct-chat", nodeId),
  invitePeerToChannel: (channelId: string, nodeId: string) => ipcRenderer.invoke("channel:invite", channelId, nodeId),
  listInvites: () => ipcRenderer.invoke("invite:list"),
  respondInvite: (inviteId: string, accept: boolean) => ipcRenderer.invoke("invite:respond", inviteId, accept),
  onEventsChanged: (listener: (update: UIEventUpdate) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: UIEventUpdate) => {
      listener(payload);
    };
    ipcRenderer.on("events:changed", wrapped);
    return () => {
      ipcRenderer.removeListener("events:changed", wrapped);
    };
  },
  onP2PStatusChanged: (listener: (status: UIP2PStatus) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: UIP2PStatus) => {
      listener(payload);
    };
    ipcRenderer.on("p2p:status-changed", wrapped);
    return () => {
      ipcRenderer.removeListener("p2p:status-changed", wrapped);
    };
  },
  onContactsChanged: (listener: (contacts: UIContact[]) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: UIContact[]) => {
      listener(payload);
    };
    ipcRenderer.on("contacts:changed", wrapped);
    return () => {
      ipcRenderer.removeListener("contacts:changed", wrapped);
    };
  },
  onInvitesChanged: (listener: (invites: UIInvite[]) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: UIInvite[]) => {
      listener(payload);
    };
    ipcRenderer.on("invites:changed", wrapped);
    return () => {
      ipcRenderer.removeListener("invites:changed", wrapped);
    };
  },
};

contextBridge.exposeInMainWorld("zipAPI", api);

declare global {
  interface Window {
    zipAPI?: ZipAPI;
    electronAPI?: {
      getIdentity: () => Promise<UIProfile | null>;
      createIdentity: (username: string) => Promise<UIProfile>;
      listChannels: () => Promise<UIChannel[]>;
      createChannel: (
        name: string,
        description?: string,
        options?: { channelType?: "group" | "text" | "voice_video"; parentGroupId?: string },
      ) => Promise<UIChannel>;
      listMessages: (channelId: string) => Promise<UIMessage[]>;
      sendMessage: (channelId: string, content: string) => Promise<void>;
      connectP2P: () => Promise<UIP2PStatus>;
      disconnectP2P: () => Promise<UIP2PStatus>;
      getP2PStatus: () => Promise<UIP2PStatus>;
      listContacts: () => Promise<UIContact[]>;
      startDirectChat: (nodeId: string) => Promise<UIChannel>;
      invitePeerToChannel: (channelId: string, nodeId: string) => Promise<void>;
      listInvites: () => Promise<UIInvite[]>;
      respondInvite: (inviteId: string, accept: boolean) => Promise<void>;
      onEventsChanged: (listener: (update: UIEventUpdate) => void) => () => void;
      onP2PStatusChanged: (listener: (status: UIP2PStatus) => void) => () => void;
      onContactsChanged: (listener: (contacts: UIContact[]) => void) => () => void;
      onInvitesChanged: (listener: (invites: UIInvite[]) => void) => () => void;
    };
  }
}
