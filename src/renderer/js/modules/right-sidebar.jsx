import React from "react";

function HomeSidebar({ identity, friends, channels, groups }) {
  return (
    <>
      <div className="right-sidebar__header">
        <h3>Resumo</h3>
        <p>Visão rápida</p>
      </div>

      <section className="right-sidebar__meta">
        <div className="right-sidebar__stat">
          <span>Identidade</span>
          <strong>{identity.username}</strong>
        </div>
        <div className="right-sidebar__stat">
          <span>Amigos</span>
          <strong>{friends.length}</strong>
        </div>
        <div className="right-sidebar__stat">
          <span>Grupos</span>
          <strong>{channels.length}</strong>
        </div>
      </section>
    </>
  );
}

function ConnectionSidebar({
  p2pStatus,
  knownNodeIds,
  onConnectP2P,
  onDisconnectP2P,
  connectingP2P,
  disconnectingP2P,
}) {
  const isConnected = p2pStatus.connected;
  const isLoading = connectingP2P || disconnectingP2P;

  const handleToggle = () => {
    if (isConnected) {
      onDisconnectP2P();
    } else {
      onConnectP2P();
    }
  };

  return (
    <>
      <div className="right-sidebar__header">
        <h3>Rede P2P</h3>
        <p>Status da conexão</p>
      </div>

      <section className="right-sidebar__meta">
        <div className="right-sidebar__stat">
          <span>Estado</span>
          <span
            className={`conn-status-pill conn-status-pill--${
              isConnected ? "online" : "offline"
            }`}
          >
            <span
              className={`status-dot status-dot--${isConnected ? "online" : "offline"}`}
            />
            {isConnected ? "online" : "offline"}
          </span>
        </div>
        <div className="right-sidebar__stat">
          <span>Peers</span>
          <strong>{p2pStatus.peers}</strong>
        </div>
        <div className="right-sidebar__stat">
          <span>Escuta</span>
          <strong className="right-sidebar__mono">
            {p2pStatus.host}:{p2pStatus.port}
          </strong>
        </div>
        <div className="right-sidebar__stat">
          <span>Nodes salvos</span>
          <strong>{knownNodeIds.length}</strong>
        </div>
      </section>

      <button
        type="button"
        className={`p2p-toggle-btn${isConnected ? " p2p-toggle-btn--connected" : ""}`}
        onClick={handleToggle}
        disabled={isLoading}
      >
        <span className="p2p-toggle-btn__dot" />
        {isLoading
          ? isConnected
            ? "Desconectando…"
            : "Conectando…"
          : isConnected
          ? "Desconectar P2P"
          : "Conectar P2P"}
      </button>
    </>
  );
}

function ChatsSidebar({ activeChannel, channels, groups }) {
  return (
    <>
      <div className="right-sidebar__header">
        <h3>Chat ativo</h3>
        <p>Contexto da conversa</p>
      </div>

      <section className="right-sidebar__meta">
        <div className="right-sidebar__stat">
          <span>Canal</span>
          <strong>{activeChannel?.name ?? "Nenhum"}</strong>
        </div>
        <div className="right-sidebar__stat">
          <span>Membros</span>
          <strong>{activeChannel?.memberCount ?? 0}</strong>
        </div>
        <div className="right-sidebar__stat">
          <span>Total</span>
          <strong>{channels.length} grupos</strong>
        </div>
      </section>

      <div className="right-sidebar__icons">
        {groups.map((group) => (
          <div key={group.id} className="right-sidebar__icon-chip" title={group.label}>
            {group.short}
          </div>
        ))}
      </div>
    </>
  );
}

export function RightSidebar({
  activePage,
  identity,
  friends,
  channels,
  activeChannel,
  p2pStatus,
  knownNodeIds,
  groups,
  onConnectP2P,
  onDisconnectP2P,
  connectingP2P,
  disconnectingP2P,
}) {
  return (
    <aside className="right-sidebar">
      {activePage === "home" && (
        <HomeSidebar
          identity={identity}
          friends={friends}
          channels={channels}
          groups={groups}
        />
      )}
      {activePage === "connection" && (
        <ConnectionSidebar
          p2pStatus={p2pStatus}
          knownNodeIds={knownNodeIds}
          onConnectP2P={onConnectP2P}
          onDisconnectP2P={onDisconnectP2P}
          connectingP2P={connectingP2P}
          disconnectingP2P={disconnectingP2P}
        />
      )}
      {activePage === "chats" && (
        <ChatsSidebar
          activeChannel={activeChannel}
          channels={channels}
          groups={groups}
        />
      )}
    </aside>
  );
}
