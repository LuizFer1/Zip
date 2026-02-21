"use strict";
// ── Types ───────────────────────────────────────────────────
// ── State ───────────────────────────────────────────────────
const state = {
    view: 'home',
    active: {
        type: null,
        id: null
    },
    profile: {
        name: 'Luiz Fernando',
        handle: '@luizf',
        status: 'Online',
        avatar: 'LF'
    },
    groups: [],
    friends: []
};
// ── UI Helpers ──────────────────────────────────────────────
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`Element #${id} not found`);
    return el;
}
const ui = {
    homeButton: getEl('home-button'),
    friendsButton: getEl('friends-button'),
    openCreateGroup: getEl('open-create-group'),
    createGroupInline: getEl('create-group-inline'),
    groupList: getEl('group-list'),
    friendList: getEl('friend-list'),
    groupCount: getEl('group-count'),
    friendCount: getEl('friend-count'),
    chatContext: getEl('chat-context'),
    chatTitle: getEl('chat-title'),
    chatSubtitle: getEl('chat-subtitle'),
    messageList: getEl('message-list'),
    messageForm: getEl('message-form'),
    messageInput: getEl('message-input'),
    participantList: getEl('participant-list'),
    participantCount: getEl('participant-count'),
    participantsTitle: getEl('participants-title'),
    createGroupDialog: getEl('create-group-dialog'),
    createGroupForm: getEl('create-group-form'),
    cancelCreateGroup: getEl('cancel-create-group'),
    groupName: getEl('group-name'),
    groupDescription: getEl('group-description'),
    profileAvatar: getEl('profile-avatar'),
    profileName: getEl('profile-name'),
    profileHandle: getEl('profile-handle'),
    profileStatus: getEl('profile-status')
};
// ── Utilities ───────────────────────────────────────────────
function getStatusClass(status) {
    if (status === 'offline')
        return 'offline';
    if (status === 'busy')
        return 'busy';
    return '';
}
function activeConversation() {
    if (state.active.type === 'group') {
        return state.groups.find((g) => g.id === state.active.id);
    }
    if (state.active.type === 'friend') {
        return state.friends.find((f) => f.id === state.active.id);
    }
    return undefined;
}
function nowTime() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
// ── Render Functions ────────────────────────────────────────
function renderRail() {
    ui.homeButton.classList.toggle('active', state.view === 'home');
    ui.friendsButton.classList.toggle('active', state.view === 'friends');
}
function renderGroups() {
    ui.groupCount.textContent = String(state.groups.length);
    ui.groupList.innerHTML = state.groups
        .map((group) => {
        const isActive = state.active.type === 'group' && state.active.id === group.id;
        return `
        <li>
          <button class="entity-item ${isActive ? 'active' : ''}" type="button" data-group-id="${group.id}">
            <span class="avatar">${group.name.slice(0, 2).toUpperCase()}</span>
            <span class="entity-meta">
              <span class="entity-name">#${group.name}</span>
              <span class="entity-subtitle">${group.description}</span>
            </span>
            <span class="entity-status"></span>
          </button>
        </li>
      `;
    })
        .join('');
}
function renderFriends() {
    ui.friendCount.textContent = String(state.friends.length);
    ui.friendList.innerHTML = state.friends
        .map((friend) => {
        const isActive = state.active.type === 'friend' && state.active.id === friend.id;
        const statusClass = getStatusClass(friend.status);
        return `
        <li>
          <button class="entity-item ${isActive ? 'active' : ''}" type="button" data-friend-id="${friend.id}">
            <span class="avatar">${friend.avatar}</span>
            <span class="entity-meta">
              <span class="entity-name">${friend.name}</span>
              <span class="entity-subtitle">${friend.lastMessage}</span>
            </span>
            <span class="entity-status ${statusClass}"></span>
          </button>
        </li>
      `;
    })
        .join('');
}
function renderChat() {
    const conversation = activeConversation();
    if (!conversation) {
        ui.chatContext.textContent = '';
        ui.chatTitle.textContent = 'Zip Chat';
        ui.chatSubtitle.textContent = '';
        ui.messageList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p class="empty-title">Nenhuma conversa selecionada</p>
        <p class="empty-sub">Selecione um grupo ou amigo para começar a conversar.</p>
      </div>
    `;
        return;
    }
    if (state.active.type === 'group') {
        const group = conversation;
        ui.chatContext.textContent = 'grupo';
        ui.chatTitle.textContent = `#${group.name}`;
        ui.chatSubtitle.textContent = group.description;
        ui.participantsTitle.textContent = 'Pessoas do grupo';
    }
    else {
        const friend = conversation;
        ui.chatContext.textContent = 'amigo';
        ui.chatTitle.textContent = friend.name;
        ui.chatSubtitle.textContent = 'Conversa direta';
        ui.participantsTitle.textContent = 'Pessoas na conversa';
    }
    ui.messageList.innerHTML = conversation.messages
        .map((message) => `
      <article class="message ${message.own ? 'own' : ''}">
        <header class="message-head">
          <span class="avatar">${message.avatar}</span>
          <span class="message-author">${message.author}</span>
          <span class="message-time">${message.time}</span>
        </header>
        <div class="message-bubble">${message.text}</div>
      </article>
    `)
        .join('');
    ui.messageList.scrollTop = ui.messageList.scrollHeight;
}
function renderParticipants() {
    if (!state.active.type) {
        ui.participantCount.textContent = '0';
        ui.participantList.innerHTML = '';
        return;
    }
    if (state.active.type === 'group') {
        const group = activeConversation();
        if (!group)
            return;
        ui.participantCount.textContent = String(group.participants.length);
        ui.participantList.innerHTML = group.participants
            .map((p) => `
        <li class="participant-item">
          <span class="avatar">${p.avatar}</span>
          <span>
            <span class="entity-name">${p.name}</span>
            <span class="participant-role">${p.role}</span>
          </span>
          <span class="entity-status ${getStatusClass(p.status)}"></span>
        </li>
      `)
            .join('');
        return;
    }
    const friend = activeConversation();
    if (!friend)
        return;
    const directParticipants = [
        { name: state.profile.name, role: 'voce', status: 'online', avatar: state.profile.avatar },
        { name: friend.name, role: 'amigo', status: friend.status, avatar: friend.avatar }
    ];
    ui.participantCount.textContent = String(directParticipants.length);
    ui.participantList.innerHTML = directParticipants
        .map((p) => `
      <li class="participant-item">
        <span class="avatar">${p.avatar}</span>
        <span>
          <span class="entity-name">${p.name}</span>
          <span class="participant-role">${p.role}</span>
        </span>
        <span class="entity-status ${getStatusClass(p.status)}"></span>
      </li>
    `)
        .join('');
}
function renderProfile() {
    ui.profileAvatar.textContent = state.profile.avatar;
    ui.profileName.textContent = state.profile.name;
    ui.profileHandle.textContent = state.profile.handle;
    ui.profileStatus.textContent = state.profile.status;
}
function render() {
    renderRail();
    renderGroups();
    renderFriends();
    renderChat();
    renderParticipants();
    renderProfile();
}
// ── Actions ─────────────────────────────────────────────────
function activateGroup(groupId) {
    state.view = 'home';
    state.active.type = 'group';
    state.active.id = groupId;
    render();
}
function activateFriend(friendId) {
    state.view = 'friends';
    state.active.type = 'friend';
    state.active.id = friendId;
    render();
}
function openCreateGroupDialog() {
    if (typeof ui.createGroupDialog.showModal === 'function') {
        ui.createGroupDialog.showModal();
    }
}
function closeCreateGroupDialog() {
    if (ui.createGroupDialog.open) {
        ui.createGroupDialog.close();
    }
}
// ── Event Listeners ─────────────────────────────────────────
ui.homeButton.addEventListener('click', () => {
    if (state.groups.length > 0) {
        activateGroup(state.groups[0].id);
    }
});
ui.friendsButton.addEventListener('click', () => {
    if (state.friends.length > 0) {
        activateFriend(state.friends[0].id);
    }
});
ui.groupList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-group-id]');
    if (!button?.dataset.groupId)
        return;
    activateGroup(button.dataset.groupId);
});
ui.friendList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-friend-id]');
    if (!button?.dataset.friendId)
        return;
    activateFriend(button.dataset.friendId);
});
ui.openCreateGroup.addEventListener('click', openCreateGroupDialog);
ui.createGroupInline.addEventListener('click', openCreateGroupDialog);
ui.cancelCreateGroup.addEventListener('click', closeCreateGroupDialog);
ui.createGroupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = ui.groupName.value.trim().toLowerCase();
    const description = ui.groupDescription.value.trim();
    if (!name || !description)
        return;
    const newGroupId = `grp-${Date.now()}`;
    const newGroup = {
        id: newGroupId,
        name,
        description,
        participants: [
            { name: state.profile.name, role: 'admin', status: 'online', avatar: state.profile.avatar },
            { name: 'Novo membro', role: 'convidado', status: 'offline', avatar: 'NM' }
        ],
        messages: [
            {
                id: `m-${Date.now()}`,
                author: state.profile.name,
                avatar: state.profile.avatar,
                own: true,
                text: `Grupo ${name} criado com sucesso.`,
                time: nowTime()
            }
        ]
    };
    state.groups.unshift(newGroup);
    ui.createGroupForm.reset();
    closeCreateGroupDialog();
    activateGroup(newGroupId);
});
ui.messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = ui.messageInput.value.trim();
    if (!value)
        return;
    const conversation = activeConversation();
    if (!conversation)
        return;
    const newMessage = {
        id: `msg-${Date.now()}`,
        author: state.profile.name,
        avatar: state.profile.avatar,
        own: true,
        text: value,
        time: nowTime()
    };
    conversation.messages.push(newMessage);
    ui.messageInput.value = '';
    renderChat();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeCreateGroupDialog();
    }
});
// ── Init ────────────────────────────────────────────────────
render();
