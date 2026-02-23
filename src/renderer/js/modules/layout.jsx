import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Topbar } from "./topbar.jsx";
import { LeftSidebar } from "./left-sidebar.jsx";
import { LeftMainbar } from "./left-mainbar.jsx";
import { MainPanel } from "./main-panel.jsx";
import { RightSidebar } from "./right-sidebar.jsx";

const THEME_STORAGE_KEY = "zip-theme-preference";
const KNOWN_NODE_IDS_STORAGE_KEY = "zip-known-node-ids";

const DEFAULT_P2P_STATUS = {
  enabled: true,
  connected: false,
  peers: 0,
  host: "0.0.0.0",
  port: 7070,
};

function getSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readThemePreference() {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function readKnownNodeIds() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KNOWN_NODE_IDS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value) => typeof value === "string" && value.trim().length > 0);
  } catch {
    return [];
  }
}

function CreateGroupModal({
  open,
  groupName,
  onGroupNameChange,
  onConfirm,
  onCancel,
  creating,
  contacts,
  selectedNodeIds,
  onToggleNodeId,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  function onOverlayClick(event) {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }

  function onOverlayKeyDown(event) {
    if (event.key === "Escape") {
      onCancel();
    }
  }

  return (
    <div className="modal-overlay" onClick={onOverlayClick} onKeyDown={onOverlayKeyDown}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
        <div className="modal__header">
          <div className="modal__header-text">
            <h2 className="modal__title" id="create-group-title">Criar grupo</h2>
            <p className="modal__subtitle">Escolha um nome para o grupo.</p>
          </div>
          <button className="modal__close" type="button" onClick={onCancel} title="Fechar">
            X
          </button>
        </div>

        <form
          className="modal__form"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
          }}
        >
          <label className="modal__label" htmlFor="group-name">
            <span className="modal__label-text">Nome do grupo</span>
            <input
              id="group-name"
              ref={inputRef}
              className="modal__input"
              type="text"
              value={groupName}
              onChange={(event) => onGroupNameChange(event.target.value)}
              placeholder="Equipe de produto"
              maxLength={40}
              autoComplete="off"
            />
          </label>

          <div className="modal__actions">
            <button className="modal__cancel-btn" type="button" onClick={onCancel}>
              Cancelar
            </button>
            <button className="modal__confirm-btn" type="submit" disabled={!groupName.trim() || creating}>
              {creating ? "Criando..." : "Criar grupo"}
            </button>
          </div>
        </form>
        {contacts.length > 0 ? (
          <div className="modal__peer-select">
            <strong>Adicionar peers no grupo</strong>
            <div className="modal__peer-list">
              {contacts.map((contact) => (
                <label key={contact.nodeId} className="modal__peer-item">
                  <input
                    type="checkbox"
                    checked={selectedNodeIds.includes(contact.nodeId)}
                    onChange={() => onToggleNodeId(contact.nodeId)}
                  />
                  <span>{contact.username}</span>
                  <small>{contact.nodeId}</small>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Layout() {
  const api = typeof window !== "undefined" ? window.zipAPI ?? null : null;

  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [identity, setIdentity] = useState(null);
  const [identityName, setIdentityName] = useState("");
  const [creatingIdentity, setCreatingIdentity] = useState(false);
  const [activePage, setActivePage] = useState("home");
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [composerText, setComposerText] = useState("");
  const [p2pStatus, setP2pStatus] = useState(DEFAULT_P2P_STATUS);
  const [knownNodeIds, setKnownNodeIds] = useState(readKnownNodeIds);
  const [contacts, setContacts] = useState([]);
  const [invites, setInvites] = useState([]);
  const [remoteNodeId, setRemoteNodeId] = useState("");
  const [connectingP2P, setConnectingP2P] = useState(false);
  const [disconnectingP2P, setDisconnectingP2P] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalName, setGroupModalName] = useState("");
  const [selectedInviteNodeIds, setSelectedInviteNodeIds] = useState([]);

  const activeChannelRef = useRef(activeChannelId);

  useEffect(() => {
    activeChannelRef.current = activeChannelId;
  }, [activeChannelId]);

  const resolvedTheme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = resolvedTheme;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    }
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light");

    onChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const refreshChannels = useCallback(async () => {
    if (!api) {
      setChannels([]);
      setActiveChannelId(null);
      return;
    }

    const list = await api.listChannels();
    setChannels(list);
    setActiveChannelId((current) => {
      if (current && list.some((channel) => channel.id === current)) {
        return current;
      }
      return list[0]?.id ?? null;
    });
  }, [api]);

  const refreshMessages = useCallback(async (channelId) => {
    if (!channelId || !api) {
      setMessages([]);
      return;
    }

    const list = await api.listMessages(channelId);
    setMessages(list);
  }, [api]);

  useEffect(() => {
    if (!bootstrapped) return;
    void refreshMessages(activeChannelId);
  }, [activeChannelId, bootstrapped, refreshMessages]);

  useEffect(() => {
    let disposeEvents = () => {};
    let disposeP2P = () => {};
    let cancelled = false;

    const bootstrap = async () => {
      if (!api) {
        setStatusMessage("API do Electron indisponivel.");
        setBootstrapped(true);
        return;
      }

      try {
        const [profile, status, contactList, inviteList] = await Promise.all([
          api.getIdentity(),
          api.getP2PStatus(),
          api.listContacts(),
          api.listInvites(),
        ]);
        if (cancelled) return;

        setIdentity(profile);
        setP2pStatus(status);
        setContacts(contactList);
        setInvites(inviteList);
        await refreshChannels();

        disposeEvents = api.onEventsChanged(() => {
          void refreshChannels();
          void refreshMessages(activeChannelRef.current);
        });

        disposeP2P = api.onP2PStatusChanged((next) => {
          setP2pStatus(next);
        });
        const disposeContacts = api.onContactsChanged((next) => {
          setContacts(next);
        });
        const disposeInvites = api.onInvitesChanged((next) => {
          setInvites(next);
        });
        const previousDisposeEvents = disposeEvents;
        disposeEvents = () => {
          previousDisposeEvents();
          disposeContacts();
          disposeInvites();
        };
      } catch (error) {
        console.error("[renderer] bootstrap failed", error);
        setStatusMessage("Falha ao carregar dados do app.");
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      disposeEvents();
      disposeP2P();
    };
  }, [api, refreshChannels, refreshMessages]);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) ?? null,
    [activeChannelId, channels]
  );

  const groupIcons = useMemo(
    () => channels.slice(0, 8).map((channel) => ({
      id: channel.id,
      label: channel.name,
      short: channel.name.slice(0, 2).toUpperCase(),
    })),
    [channels]
  );

  const onCreateIdentity = async (event) => {
    event.preventDefault();
    const username = identityName.trim();

    if (!username) {
      setStatusMessage("Digite seu nome para criar identidade.");
      return;
    }

    if (!api) {
      setStatusMessage("API do Electron indisponivel.");
      return;
    }

    setCreatingIdentity(true);
    setStatusMessage("");
    try {
      const created = await api.createIdentity(username);
      setIdentity(created);
      setIdentityName("");
      setStatusMessage("Identidade criada com sucesso.");
      await refreshChannels();
    } catch (error) {
      console.error("[renderer] create identity failed", error);
      setStatusMessage("Falha ao criar identidade.");
    } finally {
      setCreatingIdentity(false);
    }
  };

  const onCreateGroup = () => {
    setGroupModalName("");
    setSelectedInviteNodeIds([]);
    setGroupModalOpen(true);
  };

  const onCancelCreateGroup = () => {
    setGroupModalOpen(false);
    setGroupModalName("");
    setSelectedInviteNodeIds([]);
  };

  const onConfirmCreateGroup = async () => {
    const name = groupModalName.trim();
    if (!name) return;

    if (!api) {
      setStatusMessage("API do Electron indisponivel.");
      return;
    }

    setGroupModalOpen(false);
    setGroupModalName("");
    setCreatingGroup(true);

    try {
      const createdChannel = await api.createChannel(name);
      setChannels((current) => {
        if (current.some((channel) => channel.id === createdChannel.id)) return current;
        return [...current, createdChannel];
      });
      setActivePage("chats");
      setActiveChannelId(createdChannel.id);
      setStatusMessage(`Grupo \"${createdChannel.name}\" criado.`);
      for (const nodeId of selectedInviteNodeIds) {
        await api.invitePeerToChannel(createdChannel.id, nodeId);
      }
    } catch (error) {
      console.error("[renderer] create group failed", error);
      setStatusMessage("Falha ao criar grupo.");
    } finally {
      setCreatingGroup(false);
      setSelectedInviteNodeIds([]);
    }
  };

  const onToggleInviteNode = (nodeId) => {
    setSelectedInviteNodeIds((current) => (
      current.includes(nodeId)
        ? current.filter((item) => item !== nodeId)
        : [...current, nodeId]
    ));
  };

  const onSendMessage = async (event) => {
    event.preventDefault();
    const content = composerText.trim();

    if (!content || !activeChannelId) return;
    if (!api) {
      setStatusMessage("API do Electron indisponivel.");
      return;
    }

    try {
      await api.sendMessage(activeChannelId, content);
      await refreshMessages(activeChannelId);
      setComposerText("");
    } catch (error) {
      console.error("[renderer] send message failed", error);
      setStatusMessage("Falha ao enviar mensagem.");
    }
  };

  const onConnectP2P = async () => {
    if (!api) {
      setStatusMessage("API do Electron indisponivel.");
      return;
    }

    setConnectingP2P(true);
    try {
      const status = await api.connectP2P();
      setP2pStatus(status);
      setStatusMessage("Conexao P2P iniciada.");
    } catch (error) {
      console.error("[renderer] p2p connect failed", error);
      setStatusMessage("Falha ao iniciar P2P.");
    } finally {
      setConnectingP2P(false);
    }
  };

  const onDisconnectP2P = async () => {
    if (!api) {
      setStatusMessage("API do Electron indisponivel.");
      return;
    }

    setDisconnectingP2P(true);
    try {
      const status = await api.disconnectP2P();
      setP2pStatus(status);
      setStatusMessage("Conexao P2P encerrada.");
    } catch (error) {
      console.error("[renderer] p2p disconnect failed", error);
      setStatusMessage("Falha ao encerrar P2P.");
    } finally {
      setDisconnectingP2P(false);
    }
  };

  const onSaveNodeId = (event) => {
    event.preventDefault();
    const value = remoteNodeId.trim();
    if (!value) return;

    setKnownNodeIds((current) => {
      if (current.includes(value)) return current;
      const next = [value, ...current].slice(0, 12);
      window.localStorage.setItem(KNOWN_NODE_IDS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    setRemoteNodeId("");
    setStatusMessage("NodeID salvo para pareamento.");
  };

  const onStartDirectChat = async (nodeId) => {
    if (!api) return;
    try {
      const channel = await api.startDirectChat(nodeId);
      setActivePage("chats");
      setActiveChannelId(channel.id);
      await refreshChannels();
      setStatusMessage(`Chat direto iniciado com ${nodeId}.`);
    } catch (error) {
      console.error("[renderer] start direct chat failed", error);
      setStatusMessage("Falha ao iniciar chat direto.");
    }
  };

  const onRespondInvite = async (inviteId, accept) => {
    if (!api) return;
    try {
      await api.respondInvite(inviteId, accept);
      setInvites((current) => current.filter((invite) => invite.id !== inviteId));
      if (accept) {
        await refreshChannels();
      }
    } catch (error) {
      console.error("[renderer] invite response failed", error);
      setStatusMessage("Falha ao responder convite.");
    }
  };

  const onRemoveKnownNodeId = (nodeId) => {
    setKnownNodeIds((current) => {
      const next = current.filter((item) => item !== nodeId);
      window.localStorage.setItem(KNOWN_NODE_IDS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const onSelectGroupIcon = (channelId) => {
    setActivePage("chats");
    setActiveChannelId(channelId);
  };

  if (!bootstrapped) {
    return (
      <div className="boot-screen">
        <p>Carregando interface...</p>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="identity-screen">
        <div className="identity-screen__card">
          <div className="identity-screen__logo">Z</div>

          <header className="identity-screen__header">
            <h1>Bem-vindo ao Zip</h1>
            <p>Defina apenas seu nome para entrar na rede.</p>
          </header>

          <form className="identity-screen__form" onSubmit={onCreateIdentity}>
            <label htmlFor="identity-name">Nome</label>
            <input
              id="identity-name"
              type="text"
              value={identityName}
              onChange={(event) => setIdentityName(event.target.value)}
              placeholder="Seu nome"
              autoFocus
              maxLength={32}
            />
            <button type="submit" disabled={creatingIdentity}>
              {creatingIdentity ? "Criando..." : "Criar identidade"}
            </button>
          </form>

          <hr className="identity-screen__divider" />

          <div className="identity-screen__theme">
            <span>
              Tema: <strong>{resolvedTheme === "dark" ? "escuro" : "claro"}</strong>
              {themePreference === "system" ? " (sistema)" : " (manual)"}
            </span>
            <div className="identity-screen__theme-actions">
              <button
                type="button"
                onClick={() => setThemePreference(resolvedTheme === "dark" ? "light" : "dark")}
              >
                Alternar
              </button>
              {themePreference !== "system" ? (
                <button type="button" onClick={() => setThemePreference("system")}>
                  Sistema
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Topbar
        identity={identity}
        activePage={activePage}
        statusMessage={statusMessage}
        resolvedTheme={resolvedTheme}
        themePreference={themePreference}
        onSetThemePreference={setThemePreference}
      />

      <div className="workspace">
        <LeftSidebar
          activePage={activePage}
          onNavigate={setActivePage}
          groups={groupIcons}
          onSelectGroup={onSelectGroupIcon}
        />

        <section className="main-layout">
          <LeftMainbar
            activePage={activePage}
            friends={[]}
            channels={channels}
            activeChannelId={activeChannelId}
            contacts={contacts}
            onSelectChannel={setActiveChannelId}
            onCreateGroup={onCreateGroup}
            creatingGroup={creatingGroup}
            onRemoveKnownNodeId={onRemoveKnownNodeId}
            onStartDirectChat={onStartDirectChat}
          />

          <MainPanel
            activePage={activePage}
            identity={identity}
            friends={[]}
            updateLog={[]}
            channels={channels}
            activeChannel={activeChannel}
            messages={messages}
            composerText={composerText}
            onComposerTextChange={setComposerText}
            onSendMessage={onSendMessage}
            onCreateGroup={onCreateGroup}
            creatingGroup={creatingGroup}
            p2pStatus={p2pStatus}
            remoteNodeId={remoteNodeId}
            onRemoteNodeIdChange={setRemoteNodeId}
            onSaveNodeId={onSaveNodeId}
            onConnectP2P={onConnectP2P}
            onDisconnectP2P={onDisconnectP2P}
            connectingP2P={connectingP2P}
            disconnectingP2P={disconnectingP2P}
            knownNodeIds={knownNodeIds}
            contacts={contacts}
          />
        </section>

        <RightSidebar
          activePage={activePage}
          identity={identity}
          friends={[]}
          channels={channels}
          activeChannel={activeChannel}
          p2pStatus={p2pStatus}
          knownNodeIds={knownNodeIds}
          groups={groupIcons}
          onConnectP2P={onConnectP2P}
          onDisconnectP2P={onDisconnectP2P}
          connectingP2P={connectingP2P}
          disconnectingP2P={disconnectingP2P}
        />
      </div>

      <CreateGroupModal
        open={groupModalOpen}
        groupName={groupModalName}
        onGroupNameChange={setGroupModalName}
        onConfirm={onConfirmCreateGroup}
        onCancel={onCancelCreateGroup}
        creating={creatingGroup}
        contacts={contacts.filter((contact) => contact.connected)}
        selectedNodeIds={selectedInviteNodeIds}
        onToggleNodeId={onToggleInviteNode}
      />
      {invites.length > 0 ? (
        <div className="invite-toast-stack">
          {invites.map((invite) => (
            <article className="invite-toast" key={invite.id}>
              <strong>{invite.fromUsername}</strong>
              <p>Convidou voce para {invite.channelName}</p>
              <div>
                <button type="button" onClick={() => onRespondInvite(invite.id, true)}>Aceitar</button>
                <button type="button" onClick={() => onRespondInvite(invite.id, false)}>Recusar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
