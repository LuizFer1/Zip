import React from "react";

function avatarFrom(name) {
  return name ? name.slice(0, 2).toUpperCase() : "?";
}

function HomeView({ friends, updateLog, onCreateGroup, creatingGroup, onOpenFriendChat }) {
  return (
    <>
      <div className="main-panel__header">
        <div className="main-panel__title">
          <h2>Home</h2>
          <p>Amigos e historico de atualizacoes.</p>
        </div>
        <button className="main-panel__action" type="button" onClick={onCreateGroup} disabled={creatingGroup}>
          {creatingGroup ? "Criando..." : "Criar grupo"}
        </button>
      </div>

      <div className="main-panel__body">
        <div className="main-panel__grid">
          <article className="panel--block">
            <h3>Amigos</h3>
            <div className="panel--block__body">
              {friends.length === 0 ? <p className="main-panel__placeholder">Sem contatos locais.</p> : null}
              {friends.map((friend) => (
                <div key={friend.id} className="friend-item">
                  <div className="avatar-chip">{avatarFrom(friend.name)}</div>
                  <div className="friend-item__info">
                    <strong>{friend.name}</strong>
                    <small>{friend.handle}</small>
                  </div>
                  <span className={`status-pill status-pill--${friend.status}`}>{friend.status}</span>
                  <button type="button" className="main-panel__action" onClick={() => onOpenFriendChat(friend.id)}>
                    Chat
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="panel--block">
            <h3>Update log</h3>
            <div className="panel--block__body">
              {updateLog.length === 0 ? <p className="main-panel__placeholder">Sem updates para exibir.</p> : null}
              {updateLog.map((item) => (
                <div key={item.id} className="update-item">
                  <div className="update-item__header">
                    <strong>{item.title}</strong>
                    <small>{item.date}</small>
                  </div>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

function ConnectionView({ identity, p2pStatus, remoteNodeId, onRemoteNodeIdChange, onSaveNodeId, contacts, onStartDirectChat }) {
  return (
    <>
      <div className="main-panel__header">
        <div className="main-panel__title">
          <h2>Conexao</h2>
          <p>Troca de identidade com peers conectados.</p>
        </div>
      </div>

      <div className="conn-info-bar">
        <div className="conn-nodeid-section">
          <span className="conn-nodeid-label">Meu nodeID</span>
          <code className="conn-nodeid-key">{identity.publicKey}</code>
        </div>
        <div className="conn-tutorial">
          <span className="conn-tutorial__title">Status</span>
          <ol className="conn-tutorial__steps">
            <li>P2P: <strong>{p2pStatus.connected ? "online" : "offline"}</strong></li>
            <li>Peers: <strong>{p2pStatus.peers}</strong></li>
            <li>Escuta: <strong>{p2pStatus.host}:{p2pStatus.port}</strong></li>
          </ol>
        </div>
      </div>

      <div className="planet-scene">
        <div className="planet-add-card">
          <span className="planet-add-card__icon">P2P</span>
          <form className="planet-add-card__form" onSubmit={onSaveNodeId}>
            <input
              className="planet-add-card__input"
              type="text"
              value={remoteNodeId}
              onChange={(event) => onRemoteNodeIdChange(event.target.value)}
              placeholder="Salvar nodeID manual"
            />
            <button className="planet-add-card__btn" type="submit">Salvar</button>
          </form>
        </div>

        <div className="panel--block" style={{ width: "min(720px,100%)" }}>
          <h3>Peers conectados</h3>
          <div className="panel--block__body">
            {contacts.length === 0 ? <p className="main-panel__placeholder">Nenhum peer conectado.</p> : null}
            {contacts.map((contact) => (
              <div className="friend-item" key={contact.nodeId}>
                <div className="avatar-chip">{avatarFrom(contact.username)}</div>
                <div className="friend-item__info">
                  <strong>{contact.username}</strong>
                  <small>{contact.nodeId}</small>
                </div>
                <button type="button" className="main-panel__action" onClick={() => onStartDirectChat(contact.nodeId)}>
                  Chat direto
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ChatsView({
  channels,
  groups,
  selectedGroup,
  groupChannels,
  activeChannel,
  messages,
  composerText,
  onComposerTextChange,
  onSendMessage,
  onCreateGroup,
  onOpenCreateChannelModal,
  onOpenGroupMembersModal,
  onSelectGroup,
  onOpenDirectChat,
}) {
  const directChats = channels.filter((channel) => channel.channelType === "direct");

  if (!selectedGroup && (!activeChannel || activeChannel.channelType !== "direct")) {
    return (
      <div className="main-panel__body">
        <div className="main-panel__grid">
          <article className="panel--block">
            <h3>Grupos</h3>
            <div className="panel--block__body">
              {groups.length === 0 ? <p className="main-panel__placeholder">Nenhum grupo criado.</p> : null}
              {groups.map((group) => (
                <div key={group.id} className="friend-item">
                  <div className="avatar-chip">{avatarFrom(group.name)}</div>
                  <div className="friend-item__info">
                    <strong>{group.name}</strong>
                    <small>{group.memberCount} membros</small>
                  </div>
                  <button type="button" className="main-panel__action" onClick={() => onSelectGroup(group.id)}>
                    Abrir
                  </button>
                </div>
              ))}
              <button type="button" onClick={onCreateGroup}>Criar grupo</button>
            </div>
          </article>
          <article className="panel--block">
            <h3>Chats diretos</h3>
            <div className="panel--block__body">
              {directChats.length === 0 ? <p className="main-panel__placeholder">Nenhum chat direto.</p> : null}
              {directChats.map((chat) => (
                <div key={chat.id} className="friend-item">
                  <div className="avatar-chip">{avatarFrom(chat.name)}</div>
                  <div className="friend-item__info">
                    <strong>{chat.name}</strong>
                    <small>Chat privado</small>
                  </div>
                  <button type="button" className="main-panel__action" onClick={() => onOpenDirectChat(chat.id)}>
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    );
  }

  if (selectedGroup && !activeChannel) {
    return (
      <div className="main-panel__empty">
        <div className="main-panel__empty-icon">#</div>
        <p>Grupo <strong>{selectedGroup.name}</strong> selecionado. Escolha um canal na left-mainbar ou crie um novo.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onOpenCreateChannelModal}>Adicionar canal</button>
          <button type="button" onClick={onOpenGroupMembersModal}>Convidar membros</button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-panel--chats">
      <div className="main-panel__header">
        <div className="main-panel__title">
          <h2>{activeChannel.name}</h2>
          <p>{activeChannel.memberCount} membros</p>
        </div>
        {activeChannel.channelType !== "direct" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="main-panel__action" onClick={onOpenCreateChannelModal}>
              Adicionar canal
            </button>
            <button type="button" className="main-panel__action" onClick={onOpenGroupMembersModal}>
              Convidar membros
            </button>
          </div>
        ) : null}
      </div>

      <div className="main-panel__feed scroll-region">
        {messages.length === 0 ? (
          <p className="main-panel__placeholder">Sem mensagens.</p>
        ) : (
          messages.map((message) => (
            <div className={`message${message.own ? " message--own" : ""}`} key={message.id}>
              <div className="message__meta">
                <strong>{message.author}</strong>
                <small>{message.time}</small>
              </div>
              <div className="message__bubble">{message.content}</div>
            </div>
          ))
        )}
      </div>

      <form className="main-panel__composer" onSubmit={onSendMessage}>
        <input
          type="text"
          value={composerText}
          onChange={(event) => onComposerTextChange(event.target.value)}
          placeholder={`Mensagem em ${activeChannel.name}...`}
        />
        <button type="submit" className="main-panel__send-btn">Enviar</button>
      </form>
    </div>
  );
}

export function MainPanel({
  activePage,
  identity,
  friends,
  updateLog,
  channels,
  groups,
  selectedGroup,
  groupChannels,
  activeChannel,
  messages,
  composerText,
  onComposerTextChange,
  onSendMessage,
  onCreateGroup,
  onOpenCreateChannelModal,
  onOpenGroupMembersModal,
  onSelectGroup,
  onOpenDirectChat,
  onOpenFriendChat,
  creatingGroup,
  p2pStatus,
  remoteNodeId,
  onRemoteNodeIdChange,
  onSaveNodeId,
  contacts,
  onStartDirectChat,
}) {
  return (
    <main className="main-panel">
      {activePage === "home" && (
        <HomeView
          friends={friends}
          updateLog={updateLog}
          onCreateGroup={onCreateGroup}
          creatingGroup={creatingGroup}
          onOpenFriendChat={onOpenFriendChat}
        />
      )}

      {activePage === "connection" && (
        <ConnectionView
          identity={identity}
          p2pStatus={p2pStatus}
          remoteNodeId={remoteNodeId}
          onRemoteNodeIdChange={onRemoteNodeIdChange}
          onSaveNodeId={onSaveNodeId}
          contacts={contacts}
          onStartDirectChat={onStartDirectChat}
        />
      )}

      {activePage === "chats" && (
        <ChatsView
          channels={channels}
          groups={groups}
          selectedGroup={selectedGroup}
          groupChannels={groupChannels}
          activeChannel={activeChannel}
          messages={messages}
          composerText={composerText}
          onComposerTextChange={onComposerTextChange}
          onSendMessage={onSendMessage}
          onCreateGroup={onCreateGroup}
          onOpenCreateChannelModal={onOpenCreateChannelModal}
          onOpenGroupMembersModal={onOpenGroupMembersModal}
          onSelectGroup={onSelectGroup}
          onOpenDirectChat={onOpenDirectChat}
        />
      )}
    </main>
  );
}
