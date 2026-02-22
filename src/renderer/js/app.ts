interface UIProfile {
  publicKey: string;
  username: string;
  avatar: string;
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

interface UIEventUpdate {
  id: string;
  channelId: string;
  type:
    | 'channel.create'
    | 'channel.update'
    | 'channel.delete'
    | 'member.join'
    | 'member.leave'
    | 'role.grant'
    | 'role.revoke'
    | 'message.create'
    | 'message.edit'
    | 'message.delete'
    | 'profile.update';
  source: 'local' | 'remote';
  timestamp: number;
}

interface UIP2PStatus {
  enabled: boolean;
  connected: boolean;
  peers: number;
  host: string;
  port: number;
}

interface UIChannel {
  id: string;
}

interface ZipAPI {
  getIdentity(): Promise<UIProfile | null>;
  createIdentity(username: string): Promise<UIProfile>;
  listChannels(): Promise<UIChannel[]>;
  createChannel(name: string, description?: string): Promise<UIChannel>;
  listMessages(channelId: string): Promise<UIMessage[]>;
  sendMessage(channelId: string, content: string): Promise<void>;
  connectP2P(): Promise<UIP2PStatus>;
  disconnectP2P(): Promise<UIP2PStatus>;
  getP2PStatus(): Promise<UIP2PStatus>;
  onEventsChanged(listener: (update: UIEventUpdate) => void): () => void;
  onP2PStatusChanged(listener: (status: UIP2PStatus) => void): () => void;
}

const zipApi = (): ZipAPI => (window as unknown as { zip: ZipAPI }).zip;

const DEFAULT_CHANNEL = 'geral';

const state = {
  profile: null as UIProfile | null,
  p2p: null as UIP2PStatus | null,
  channelId: DEFAULT_CHANNEL,
  messages: [] as UIMessage[],
};

const ui = {
  profileLabel: getEl<HTMLElement>('profile-label'),
  connectionStatus: getEl<HTMLElement>('connection-status'),
  connectButton: getEl<HTMLButtonElement>('connect-button'),
  disconnectButton: getEl<HTMLButtonElement>('disconnect-button'),
  identityPanel: getEl<HTMLElement>('identity-panel'),
  identityForm: getEl<HTMLFormElement>('identity-form'),
  identityInput: getEl<HTMLInputElement>('identity-input'),
  channelIdInput: getEl<HTMLInputElement>('channel-id'),
  messageList: getEl<HTMLElement>('message-list'),
  messageForm: getEl<HTMLFormElement>('message-form'),
  messageInput: getEl<HTMLInputElement>('message-input'),
  sendButton: getEl<HTMLButtonElement>('send-button'),
};

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) {
    throw new Error(`Element #${id} not found`);
  }
  return el;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderProfile(): void {
  if (!state.profile) {
    ui.profileLabel.textContent = 'Sem identidade';
    ui.identityPanel.style.display = 'block';
    ui.messageInput.disabled = true;
    ui.sendButton.disabled = true;
    return;
  }

  ui.profileLabel.textContent = `${state.profile.username} (${state.profile.publicKey.slice(0, 8)}...)`;
  ui.identityPanel.style.display = 'none';
  ui.messageInput.disabled = false;
  ui.sendButton.disabled = false;
}

function renderP2PStatus(): void {
  const status = state.p2p;
  if (!status || !status.enabled || !status.connected) {
    ui.connectionStatus.textContent = 'Desconectado';
    ui.connectionStatus.className = 'status-badge offline';
    ui.connectButton.disabled = false;
    ui.disconnectButton.disabled = true;
    return;
  }

  ui.connectionStatus.textContent = `Conectado (${status.peers} peers)`;
  ui.connectionStatus.className = 'status-badge online';
  ui.connectButton.disabled = true;
  ui.disconnectButton.disabled = false;
}

function renderMessages(): void {
  const visibleMessages = state.messages.filter((message) => !message.deleted);
  if (!state.profile) {
    ui.messageList.innerHTML = '<p class="placeholder">Crie sua identidade para começar.</p>';
    return;
  }

  if (visibleMessages.length === 0) {
    ui.messageList.innerHTML = '<p class="placeholder">Nenhuma mensagem ainda.</p>';
    return;
  }

  ui.messageList.innerHTML = visibleMessages
    .map((message) => `
      <article class="message ${message.own ? 'own' : ''}">
        <div class="message-meta">${escapeHtml(message.author)} • ${escapeHtml(message.time)}</div>
        <div>${escapeHtml(message.content)}</div>
      </article>
    `)
    .join('');

  ui.messageList.scrollTop = ui.messageList.scrollHeight;
}

async function ensureDefaultChannel(): Promise<void> {
  if (!state.profile) {
    return;
  }

  const channels = await zipApi().listChannels();
  const exists = channels.some((channel) => channel.id === state.channelId);
  if (!exists) {
    await zipApi().createChannel(state.channelId, 'Canal padrão');
  }
}

async function loadMessages(): Promise<void> {
  if (!state.profile) {
    state.messages = [];
    renderMessages();
    return;
  }

  try {
    await ensureDefaultChannel();
    state.messages = await zipApi().listMessages(state.channelId);
    renderMessages();
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
}

async function connectP2P(): Promise<void> {
  try {
    state.p2p = await zipApi().connectP2P();
    renderP2PStatus();
  } catch (error) {
    console.error('Failed to connect P2P:', error);
  }
}

async function disconnectP2P(): Promise<void> {
  try {
    state.p2p = await zipApi().disconnectP2P();
    renderP2PStatus();
  } catch (error) {
    console.error('Failed to disconnect P2P:', error);
  }
}

ui.connectButton.addEventListener('click', () => {
  void connectP2P();
});

ui.disconnectButton.addEventListener('click', () => {
  void disconnectP2P();
});

ui.identityForm.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();
  const username = ui.identityInput.value.trim();
  if (!username) {
    return;
  }

  try {
    state.profile = await zipApi().createIdentity(username);
    ui.identityInput.value = '';
    renderProfile();
    await ensureDefaultChannel();
    await loadMessages();
  } catch (error) {
    console.error('Failed to create identity:', error);
  }
});

ui.messageForm.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();

  if (!state.profile) {
    return;
  }

  const content = ui.messageInput.value.trim();
  if (!content) {
    return;
  }

  ui.messageInput.value = '';

  try {
    await ensureDefaultChannel();
    await zipApi().sendMessage(state.channelId, content);
    await loadMessages();
  } catch (error) {
    console.error('Failed to send message:', error);
  }
});

async function init(): Promise<void> {
  ui.channelIdInput.value = state.channelId;

  zipApi().onEventsChanged((update) => {
    if (update.channelId === state.channelId) {
      void loadMessages();
    }
  });

  zipApi().onP2PStatusChanged((status) => {
    state.p2p = status;
    renderP2PStatus();
  });

  try {
    state.profile = await zipApi().getIdentity();
    state.p2p = await zipApi().getP2PStatus();
  } catch (error) {
    console.error('Failed to bootstrap app:', error);
  }

  renderProfile();
  renderP2PStatus();
  await loadMessages();
}

void init();
