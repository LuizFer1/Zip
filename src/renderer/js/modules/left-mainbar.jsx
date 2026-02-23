import React from "react";

function avatarFrom(name) {
  return name ? name.slice(0, 2).toUpperCase() : "?";
}

function channelLabel(channel) {
  if (channel.channelType === "voice_video") return `[voz] ${channel.name}`;
  if (channel.channelType === "text") return `# ${channel.name}`;
  if (channel.channelType === "direct") return `DM ${channel.name}`;
  return channel.name;
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

function Chats({
  groups,
  selectedGroup,
  groupChannels,
  activeChannelId,
  onSelectGroup,
  onSelectChannel,
  onCreateGroup,
  onOpenCreateChannelModal,
  onOpenGroupMembersModal,
  creatingGroup,
}) {
  if (!selectedGroup) {
    return (
      <>
        <div className="left-mainbar__header">
          <h3>Grupos</h3>
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
        {groups.length === 0 ? (
          <div className="left-mainbar__empty">
            <p>Nenhum grupo criado.</p>
            <button type="button" onClick={onCreateGroup} disabled={creatingGroup}>
              Criar grupo
            </button>
          </div>
        ) : (
          <ul className="left-mainbar__list scroll-region">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  className="left-mainbar__channel"
                  onClick={() => onSelectGroup(group.id)}
                >
                  <div className="left-mainbar__channel-icon">{avatarFrom(group.name)}</div>
                  <div className="left-mainbar__item-info">
                    <strong>{group.name}</strong>
                    <small>{group.memberCount} membros</small>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <>
      <div className="left-mainbar__header">
        <h3>{selectedGroup.name}</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="left-mainbar__icon-btn" onClick={onOpenCreateChannelModal} title="Adicionar canal">
            +
          </button>
          <button type="button" className="left-mainbar__icon-btn" onClick={onOpenGroupMembersModal} title="Convidar membros">
            @
          </button>
        </div>
      </div>
      {groupChannels.length === 0 ? (
        <div className="left-mainbar__empty">
          <p>Sem canais neste grupo.</p>
          <button type="button" onClick={onOpenCreateChannelModal}>
            Adicionar canal
          </button>
        </div>
      ) : (
        <ul className="left-mainbar__list scroll-region">
          {groupChannels.map((channel) => (
            <li key={channel.id}>
              <button
                type="button"
                className={`left-mainbar__channel${channel.id === activeChannelId ? " is-active" : ""}`}
                onClick={() => onSelectChannel(channel.id)}
              >
                <div className="left-mainbar__channel-icon">{avatarFrom(channel.name)}</div>
                <div className="left-mainbar__item-info">
                  <strong>{channelLabel(channel)}</strong>
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
  groups,
  selectedGroup,
  groupChannels,
  activeChannelId,
  contacts,
  onSelectGroup,
  onSelectChannel,
  onCreateGroup,
  onOpenCreateChannelModal,
  onOpenGroupMembersModal,
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
          groups={groups}
          selectedGroup={selectedGroup}
          groupChannels={groupChannels}
          activeChannelId={activeChannelId}
          onSelectGroup={onSelectGroup}
          onSelectChannel={onSelectChannel}
          onCreateGroup={onCreateGroup}
          onOpenCreateChannelModal={onOpenCreateChannelModal}
          onOpenGroupMembersModal={onOpenGroupMembersModal}
          creatingGroup={creatingGroup}
        />
      )}
    </aside>
  );
}
