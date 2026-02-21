import { Status, ActiveType, View, Profile, Participant, Message, Group, Friend, ActiveRef, AppState } from '../../core/model.js';

// ── State ───────────────────────────────────────────────────

const state: AppState = {
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

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

const ui = {
  homeButton:          getEl<HTMLButtonElement>('home-button'),
  friendsButton:       getEl<HTMLButtonElement>('friends-button'),
  openCreateGroup:     getEl<HTMLButtonElement>('open-create-group'),
  createGroupInline:   getEl<HTMLButtonElement>('create-group-inline'),
  groupList:           getEl<HTMLUListElement>('group-list'),
  friendList:          getEl<HTMLUListElement>('friend-list'),
  groupCount:          getEl<HTMLElement>('group-count'),
  friendCount:         getEl<HTMLElement>('friend-count'),
  chatContext:         getEl<HTMLElement>('chat-context'),
  chatTitle:           getEl<HTMLElement>('chat-title'),
  chatSubtitle:        getEl<HTMLElement>('chat-subtitle'),
  messageList:         getEl<HTMLElement>('message-list'),
  messageForm:         getEl<HTMLFormElement>('message-form'),
  messageInput:        getEl<HTMLInputElement>('message-input'),
  participantList:     getEl<HTMLUListElement>('participant-list'),
  participantCount:    getEl<HTMLElement>('participant-count'),
  participantsTitle:   getEl<HTMLElement>('participants-title'),
  createGroupDialog:   getEl<HTMLDialogElement>('create-group-dialog'),
  createGroupForm:     getEl<HTMLFormElement>('create-group-form'),
  cancelCreateGroup:   getEl<HTMLButtonElement>('cancel-create-group'),
  groupName:           getEl<HTMLInputElement>('group-name'),
  groupDescription:    getEl<HTMLTextAreaElement>('group-description'),
  profileAvatar:       getEl<HTMLElement>('profile-avatar'),
  profileName:         getEl<HTMLElement>('profile-name'),
  profileHandle:       getEl<HTMLElement>('profile-handle'),
  profileStatus:       getEl<HTMLElement>('profile-status')
};

// ── Utilities ───────────────────────────────────────────────

function getStatusClass(status: Status): string {
  if (status === 'offline') return 'offline';
  if (status === 'busy') return 'busy';
  return '';
}

function activeConversation(): Group | Friend | undefined {
  if (state.active.type === 'group') {
    return state.groups.find((g) => g.id === state.active.id);
  }
  if (state.active.type === 'friend') {
    return state.friends.find((f) => f.id === state.active.id);
  }
  return undefined;
}

function nowTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── Render Functions ────────────────────────────────────────

function renderRail(): void {
  ui.homeButton.classList.toggle('active', state.view === 'home');
  ui.friendsButton.classList.toggle('active', state.view === 'friends');
}

function renderGroups(): void {
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

function renderFriends(): void {
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

function renderChat(): void {
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
    const group = conversation as Group;
    ui.chatContext.textContent = 'grupo';
    ui.chatTitle.textContent = `#${group.name}`;
    ui.chatSubtitle.textContent = group.description;
    ui.participantsTitle.textContent = 'Pessoas do grupo';
  } else {
    const friend = conversation as Friend;
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

function renderParticipants(): void {
  if (!state.active.type) {
    ui.participantCount.textContent = '0';
    ui.participantList.innerHTML = '';
    return;
  }

  if (state.active.type === 'group') {
    const group = activeConversation() as Group | undefined;
    if (!group) return;

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

  const friend = activeConversation() as Friend | undefined;
  if (!friend) return;

  const directParticipants: Participant[] = [
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

function renderProfile(): void {
  ui.profileAvatar.textContent = state.profile.avatar;
  ui.profileName.textContent = state.profile.name;
  ui.profileHandle.textContent = state.profile.handle;
  ui.profileStatus.textContent = state.profile.status;
}

function render(): void {
  renderRail();
  renderGroups();
  renderFriends();
  renderChat();
  renderParticipants();
  renderProfile();
}

// ── Actions ─────────────────────────────────────────────────

function activateGroup(groupId: string): void {
  state.view = 'home';
  state.active.type = 'group';
  state.active.id = groupId;
  render();
}

function activateFriend(friendId: string): void {
  state.view = 'friends';
  state.active.type = 'friend';
  state.active.id = friendId;
  render();
}

function openCreateGroupDialog(): void {
  if (typeof ui.createGroupDialog.showModal === 'function') {
    ui.createGroupDialog.showModal();
  }
}

function closeCreateGroupDialog(): void {
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

ui.groupList.addEventListener('click', (event: MouseEvent) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-group-id]');
  if (!button?.dataset.groupId) return;
  activateGroup(button.dataset.groupId);
});

ui.friendList.addEventListener('click', (event: MouseEvent) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-friend-id]');
  if (!button?.dataset.friendId) return;
  activateFriend(button.dataset.friendId);
});

ui.openCreateGroup.addEventListener('click', openCreateGroupDialog);
ui.createGroupInline.addEventListener('click', openCreateGroupDialog);
ui.cancelCreateGroup.addEventListener('click', closeCreateGroupDialog);

ui.createGroupForm.addEventListener('submit', (event: SubmitEvent) => {
  event.preventDefault();

  const name = ui.groupName.value.trim().toLowerCase();
  const description = ui.groupDescription.value.trim();

  if (!name || !description) return;

  const newGroupId = `grp-${Date.now()}`;

  const newGroup: Group = {
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

ui.messageForm.addEventListener('submit', (event: SubmitEvent) => {
  event.preventDefault();

  const value = ui.messageInput.value.trim();
  if (!value) return;

  const conversation = activeConversation();
  if (!conversation) return;

  const newMessage: Message = {
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

document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeCreateGroupDialog();
  }
});

// ── Init ────────────────────────────────────────────────────

render();
