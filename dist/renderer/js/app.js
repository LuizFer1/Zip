"use strict";
const zipApi = () => window.zip;
const DEFAULT_CHANNEL = 'geral';
const state = {
    profile: null,
    p2p: null,
    channelId: DEFAULT_CHANNEL,
    messages: [],
};
const ui = {
    profileLabel: getEl('profile-label'),
    connectionStatus: getEl('connection-status'),
    connectButton: getEl('connect-button'),
    disconnectButton: getEl('disconnect-button'),
    identityPanel: getEl('identity-panel'),
    identityForm: getEl('identity-form'),
    identityInput: getEl('identity-input'),
    channelIdInput: getEl('channel-id'),
    messageList: getEl('message-list'),
    messageForm: getEl('message-form'),
    messageInput: getEl('message-input'),
    sendButton: getEl('send-button'),
};
function getEl(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Element #${id} not found`);
    }
    return el;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function renderProfile() {
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
function renderP2PStatus() {
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
function renderMessages() {
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
async function ensureDefaultChannel() {
    if (!state.profile) {
        return;
    }
    const channels = await zipApi().listChannels();
    const exists = channels.some((channel) => channel.id === state.channelId);
    if (!exists) {
        await zipApi().createChannel(state.channelId, 'Canal padrão');
    }
}
async function loadMessages() {
    if (!state.profile) {
        state.messages = [];
        renderMessages();
        return;
    }
    try {
        await ensureDefaultChannel();
        state.messages = await zipApi().listMessages(state.channelId);
        renderMessages();
    }
    catch (error) {
        console.error('Failed to load messages:', error);
    }
}
async function connectP2P() {
    try {
        state.p2p = await zipApi().connectP2P();
        renderP2PStatus();
    }
    catch (error) {
        console.error('Failed to connect P2P:', error);
    }
}
async function disconnectP2P() {
    try {
        state.p2p = await zipApi().disconnectP2P();
        renderP2PStatus();
    }
    catch (error) {
        console.error('Failed to disconnect P2P:', error);
    }
}
ui.connectButton.addEventListener('click', () => {
    void connectP2P();
});
ui.disconnectButton.addEventListener('click', () => {
    void disconnectP2P();
});
ui.identityForm.addEventListener('submit', async (event) => {
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
    }
    catch (error) {
        console.error('Failed to create identity:', error);
    }
});
ui.messageForm.addEventListener('submit', async (event) => {
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
    }
    catch (error) {
        console.error('Failed to send message:', error);
    }
});
async function init() {
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
    }
    catch (error) {
        console.error('Failed to bootstrap app:', error);
    }
    renderProfile();
    renderP2PStatus();
    await loadMessages();
}
void init();
