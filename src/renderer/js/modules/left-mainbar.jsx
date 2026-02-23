import React from "react";

function avatarFrom(name) {
  return name ? name.slice(0, 2).toUpperCase() : "?";
}

function HomeFriends({ friends }) {
  return (
    <>
      <div className="left-mainbar__header">
        <h3>Amigos</h3>
      </div>
      <ul className="left-mainbar__list scroll-region">
        {friends.map((friend) => (
          <li key={friend.id} className="left-mainbar__list-item">
            <div className="avatar-chip">{avatarFrom(friend.name)}</div>
            <div className="left-mainbar__item-info">
              <strong>{friend.name}</strong>
              <small>{friend.handle}</small>
            </div>
            <span className={`status-pill status-pill--${friend.status}`}>
              {friend.status}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Connections({ contacts, onStartDirectChat }) {
  return (
    <>
      <div className="left-mainbar__header">
        <h3>Peers conectados</h3>
      </div>
      {contacts.length === 0 ? (
        <div className="left-mainbar__empty">
          <p>Nenhum peer conectado.</p>
          <small>Conecte no P2P para trocar identidades.</small>
        </div>
      ) : (
        <ul className="left-mainbar__list scroll-region">
          {contacts.map((contact) => (
            <li className="left-mainbar__list-item left-mainbar__list-item--compact" key={contact.nodeId}>
              <div className="left-mainbar__item-info">
                <strong>{contact.username}</strong>
                <small>{contact.nodeId}</small>
              </div>
              <button type="button" onClick={() => onStartDirectChat(contact.nodeId)}>
                Chat
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chats({ channels, activeChannelId, onSelectChannel, onCreateGroup, creatingGroup }) {
  return (
    <>
      <div className="left-mainbar__header">
        <h3>Conversas</h3>
        <button
          type="button"
          className="left-mainbar__icon-btn"
          onClick={onCreateGroup}
          disabled={creatingGroup}
          title="Criar novo grupo"
        >
          {creatingGroup ? "..." : "+"}
        </button>
      </div>
      {channels.length === 0 ? (
        <div className="left-mainbar__empty">
          <p>Nenhum grupo criado.</p>
          <button type="button" onClick={onCreateGroup} disabled={creatingGroup}>
            Criar grupo
          </button>
        </div>
      ) : (
        <ul className="left-mainbar__list scroll-region">
          {channels.map((channel) => (
            <li key={channel.id}>
              <button
                type="button"
                className={`left-mainbar__channel${channel.id === activeChannelId ? " is-active" : ""}`}
                onClick={() => onSelectChannel(channel.id)}
              >
                <div className="left-mainbar__channel-icon">{avatarFrom(channel.name)}</div>
                <div className="left-mainbar__item-info">
                  <strong>{channel.name}</strong>
                  <small>{channel.memberCount} membros</small>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function LeftMainbar({
  activePage,
  friends,
  channels,
  activeChannelId,
  contacts,
  onSelectChannel,
  onCreateGroup,
  creatingGroup,
  onStartDirectChat,
}) {
  return (
    <aside className="left-mainbar">
      {activePage === "home" && <HomeFriends friends={friends} />}
      {activePage === "connection" && (
        <Connections contacts={contacts} onStartDirectChat={onStartDirectChat} />
      )}
      {activePage === "chats" && (
        <Chats
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={onSelectChannel}
          onCreateGroup={onCreateGroup}
          creatingGroup={creatingGroup}
        />
      )}
    </aside>
  );
}
