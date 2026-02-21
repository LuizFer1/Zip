// ── Type Declarations (mirrored from model.ts for browser context) ─────────

interface UIProfile {
  publicKey: string;
  username: string;
  avatar: string;
}

interface UIChannel {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  lastMessage?: string;
}

interface UIMessage {
  id: string;
  author: string;
  authorKey: string;
  own: boolean;
  content: string;
  time: string;
  edited: boolean;
  deleted: boolean;
}

interface ZipAPI {
  getIdentity(): Promise<UIProfile | null>;
  createIdentity(username: string): Promise<UIProfile>;
  listChannels(): Promise<UIChannel[]>;
  createChannel(name: string, description?: string): Promise<UIChannel>;
  listMessages(channelId: string): Promise<UIMessage[]>;
  sendMessage(channelId: string, content: string): Promise<void>;
}

// Access the bridge through a typed accessor to avoid
// TypeScript's strict Window augmentation requirement
const zipApi = (): ZipAPI => (window as unknown as { zip: ZipAPI }).zip;

// ── App State ────────────────────────────────────────────────

interface AppState {
  profile: UIProfile | null;
  channels: UIChannel[];
  activeChannelId: string | null;
  messages: UIMessage[];
}

const state: AppState = {
  profile: null,
  channels: [],
  activeChannelId: null,
  messages: [],
};

// ── UI Helpers ───────────────────────────────────────────────

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

const ui = {
  homeButton:            getEl<HTMLButtonElement>('home-button'),
  openCreateChannel:     getEl<HTMLButtonElement>('open-create-channel'),
  createChannelInline:   getEl<HTMLButtonElement>('create-channel-inline'),
  channelList:           getEl<HTMLUListElement>('channel-list'),
  channelCount:          getEl<HTMLElement>('channel-count'),
  chatContext:           getEl<HTMLElement>('chat-context'),
  chatTitle:             getEl<HTMLElement>('chat-title'),
  chatSubtitle:          getEl<HTMLElement>('chat-subtitle'),
  messageList:           getEl<HTMLElement>('message-list'),
  messageForm:           getEl<HTMLFormElement>('message-form'),
  messageInput:          getEl<HTMLInputElement>('message-input'),
  sendButton:            getEl<HTMLButtonElement>('message-form') // resolved via form submit
    .querySelector<HTMLButtonElement>('.send-button')!,
  participantList:       getEl<HTMLUListElement>('participant-list'),
  participantCount:      getEl<HTMLElement>('participant-count'),
  participantsTitle:     getEl<HTMLElement>('participants-title'),
  profileAvatar:         getEl<HTMLElement>('profile-avatar'),
  profileName:           getEl<HTMLElement>('profile-name'),
  profileHandle:         getEl<HTMLElement>('profile-handle'),
  profileStatus:         getEl<HTMLElement>('profile-status'),
  railProfileAvatar:     getEl<HTMLButtonElement>('profile-trigger'),
  // Onboarding
  onboardingDialog:      getEl<HTMLDialogElement>('onboarding-dialog'),
  onboardingForm:        getEl<HTMLFormElement>('onboarding-form'),
  onboardingUsername:    getEl<HTMLInputElement>('onboarding-username'),
  // Create channel
  createChannelDialog:   getEl<HTMLDialogElement>('create-channel-dialog'),
  createChannelForm:     getEl<HTMLFormElement>('create-channel-form'),
  cancelCreateChannel:   getEl<HTMLButtonElement>('cancel-create-channel'),
  channelName:           getEl<HTMLInputElement>('channel-name'),
  channelDescription:    getEl<HTMLTextAreaElement>('channel-description'),
};

// ── Render Functions ─────────────────────────────────────────

function renderProfile(): void {
  if (!state.profile) return;
  const { username, avatar } = state.profile;
  const handle = '@' + username.toLowerCase().replace(/\s+/g, '');

  ui.profileAvatar.textContent = avatar;
  ui.profileName.textContent = username;
  ui.profileHandle.textContent = handle;
  ui.railProfileAvatar.textContent = avatar;
}

function renderChannels(): void {
  ui.channelCount.textContent = String(state.channels.length);

  if (state.channels.length === 0) {
    ui.channelList.innerHTML = `
      <li class="empty-list-hint">
        Nenhum canal ainda.<br>Crie um para começar.
      </li>
    `;
    return;
  }

  ui.channelList.innerHTML = state.channels
    .map((ch) => {
      const isActive = ch.id === state.activeChannelId;
      const preview = ch.lastMessage
        ? ch.lastMessage.slice(0, 40) + (ch.lastMessage.length > 40 ? '…' : '')
        : 'Sem mensagens';
      return `
        <li>
          <button class="entity-item ${isActive ? 'active' : ''}" type="button" data-channel-id="${ch.id}">
            <span class="avatar">#</span>
            <span class="entity-meta">
              <span class="entity-name">${escapeHtml(ch.name)}</span>
              <span class="entity-subtitle">${escapeHtml(preview)}</span>
            </span>
            <span class="entity-status"></span>
          </button>
        </li>
      `;
    })
    .join('');
}

function renderChat(): void {
  const channel = state.channels.find((c) => c.id === state.activeChannelId);

  if (!channel) {
    ui.chatTitle.textContent = 'Zip Chat';
    ui.chatSubtitle.textContent = 'Selecione um canal para começar';
    ui.chatContext.textContent = '';
    ui.messageList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p class="empty-title">Nenhum canal selecionado</p>
        <p class="empty-sub">Selecione um canal ou crie um novo para começar a conversar.</p>
      </div>
    `;
    setInputEnabled(false);
    return;
  }

  ui.chatContext.textContent = 'canal';
  ui.chatTitle.textContent = `#${channel.name}`;
  ui.chatSubtitle.textContent = channel.description || `${channel.memberCount} membro(s)`;
  setInputEnabled(true);

  if (state.messages.length === 0) {
    ui.messageList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">Nenhuma mensagem ainda</p>
        <p class="empty-sub">Seja o primeiro a escrever algo em #${escapeHtml(channel.name)}.</p>
      </div>
    `;
    return;
  }

  ui.messageList.innerHTML = state.messages
    .filter((m) => !m.deleted)
    .map(
      (m) => `
      <article class="message ${m.own ? 'own' : ''}">
        <header class="message-head">
          <span class="avatar">${m.author.slice(0, 2).toUpperCase()}</span>
          <span class="message-author">${escapeHtml(m.author)}${m.edited ? ' <em class="edited-tag">(editado)</em>' : ''}</span>
          <span class="message-time">${m.time}</span>
        </header>
        <div class="message-bubble">${escapeHtml(m.content)}</div>
      </article>
    `
    )
    .join('');

  ui.messageList.scrollTop = ui.messageList.scrollHeight;
}

function renderParticipants(): void {
  const channel = state.channels.find((c) => c.id === state.activeChannelId);
  if (!channel) {
    ui.participantCount.textContent = '0';
    ui.participantList.innerHTML = '';
    return;
  }

  ui.participantsTitle.textContent = 'Membros do canal';
  ui.participantCount.textContent = String(channel.memberCount);

  // We don't have full member list from message listing,
  // so show a summary row with member count
  const myProfile = state.profile;
  ui.participantList.innerHTML = myProfile
    ? `
    <li class="participant-item">
      <span class="avatar">${escapeHtml(myProfile.avatar)}</span>
      <span>
        <span class="entity-name">${escapeHtml(myProfile.username)}</span>
        <span class="participant-role">você</span>
      </span>
      <span class="entity-status"></span>
    </li>
  `
    : '';
}

function render(): void {
  renderProfile();
  renderChannels();
  renderChat();
  renderParticipants();
}

// ── Utilities ────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setInputEnabled(enabled: boolean): void {
  ui.messageInput.disabled = !enabled;
  ui.messageInput.placeholder = enabled
    ? 'Escreva uma mensagem…'
    : 'Selecione um canal para enviar mensagens…';

  const sendBtn = ui.messageForm.querySelector<HTMLButtonElement>('.send-button');
  if (sendBtn) sendBtn.disabled = !enabled;
}

// ── Actions ──────────────────────────────────────────────────

async function activateChannel(channelId: string): Promise<void> {
  state.activeChannelId = channelId;
  renderChannels();
  renderChat();
  renderParticipants();

  try {
    state.messages = await zipApi().listMessages(channelId);
    renderChat();
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

function openCreateChannelDialog(): void {
  if (typeof ui.createChannelDialog.showModal === 'function') {
    ui.createChannelDialog.showModal();
  }
}

function closeCreateChannelDialog(): void {
  if (ui.createChannelDialog.open) {
    ui.createChannelDialog.close();
  }
}

// ── Event Listeners ──────────────────────────────────────────

ui.openCreateChannel.addEventListener('click', openCreateChannelDialog);
ui.createChannelInline.addEventListener('click', openCreateChannelDialog);
ui.cancelCreateChannel.addEventListener('click', closeCreateChannelDialog);

ui.channelList.addEventListener('click', (event: MouseEvent) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-channel-id]');
  if (!button?.dataset.channelId) return;
  activateChannel(button.dataset.channelId);
});

ui.homeButton.addEventListener('click', () => {
  if (state.channels.length > 0 && !state.activeChannelId) {
    activateChannel(state.channels[0].id);
  }
});

ui.createChannelForm.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();

  const name = ui.channelName.value.trim().toLowerCase().replace(/\s+/g, '-');
  const description = ui.channelDescription.value.trim();

  if (!name) return;

  try {
    const newChannel = await zipApi().createChannel(name, description);
    state.channels.unshift(newChannel);
    ui.createChannelForm.reset();
    closeCreateChannelDialog();
    await activateChannel(newChannel.id);
  } catch (err) {
    console.error('Failed to create channel:', err);
  }
});

ui.messageForm.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();

  const content = ui.messageInput.value.trim();
  if (!content || !state.activeChannelId) return;

  ui.messageInput.value = '';
  ui.messageInput.disabled = true;

  try {
    await zipApi().sendMessage(state.activeChannelId, content);
    // Reload messages to display the sent one
    state.messages = await zipApi().listMessages(state.activeChannelId);
    // Update last message preview in channel list
    const ch = state.channels.find((c) => c.id === state.activeChannelId);
    if (ch) ch.lastMessage = content;
    renderChannels();
    renderChat();
  } catch (err) {
    console.error('Failed to send message:', err);
  } finally {
    ui.messageInput.disabled = false;
    ui.messageInput.focus();
  }
});

document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeCreateChannelDialog();
});

// ── Onboarding ───────────────────────────────────────────────

ui.onboardingForm.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();

  const username = ui.onboardingUsername.value.trim();
  if (!username) return;

  try {
    state.profile = await zipApi().createIdentity(username);
    ui.onboardingDialog.close();
    render();
  } catch (err) {
    console.error('Failed to create identity:', err);
  }
});

// ── Init ─────────────────────────────────────────────────────

async function init(): Promise<void> {
  try {
    // Load identity
    state.profile = await zipApi().getIdentity();

    if (!state.profile) {
      // First run — show onboarding
      if (typeof ui.onboardingDialog.showModal === 'function') {
        ui.onboardingDialog.showModal();
      }
      return;
    }

    // Load channels
    state.channels = await zipApi().listChannels();

    render();

    // Auto-open first channel
    if (state.channels.length > 0) {
      await activateChannel(state.channels[0].id);
    }
  } catch (err) {
    console.error('Init failed:', err);
  }
}

init();
