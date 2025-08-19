// TempTalk Main Application Logic
class TempTalkApp {
    constructor() {
        this.socketClient = null;
        this.currentUsername = '';
        this.currentRoom = 'general';
        this.pendingInvitation = null;
        this.isInChat = false;
        this.typingTimer = null;
        this.isTyping = false;
        this.userListCollapsed = false;

        // DOM elements
        this.elements = {};

        // Initialize the app
        this.init();
    }

    // Initialize the application
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.initializeSocket();
        this.updateUI();
    }

    // Cache DOM elements for better performance
    cacheElements() {
        this.elements = {
            // Landing page elements
            landingPage: document.getElementById('landingPage'),
            usernameInput: document.getElementById('usernameInput'),
            joinButton: document.getElementById('joinButton'),
            connectionStatus: document.getElementById('connectionStatus'),

            // Chat app elements
            chatApp: document.getElementById('chatApp'),
            sidebar: document.getElementById('sidebar'),
            toggleSidebar: document.getElementById('toggleSidebar'),
            closeSidebar: document.getElementById('closeSidebar'),
            currentUsername: document.getElementById('currentUsername'),
            currentRoom: document.getElementById('currentRoom'),
            connectionBadge: document.getElementById('connectionBadge'),

            // Message elements
            messages: document.getElementById('messages'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),

            // User and room lists
            userList: document.getElementById('userList'),
            userCount: document.getElementById('userCount'),
            roomList: document.getElementById('roomList'),
            toggleUsers: document.getElementById('toggleUsers'),

            // Modal elements
            invitationModal: document.getElementById('invitationModal'),
            invitationText: document.getElementById('invitationText'),

            // Toast elements
            errorToast: document.getElementById('errorToast'),
            errorToastBody: document.getElementById('errorToastBody'),

            // Overlay
            sidebarOverlay: document.getElementById('sidebarOverlay')
        };
    }

    // Setup event listeners for the UI
    setupEventListeners() {
        // Join chat
        this.elements.joinButton?.addEventListener('click', () => this.handleJoinChat());
        this.elements.usernameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleJoinChat();
        });

        // Send message
        this.elements.sendButton?.addEventListener('click', () => this.handleSendMessage());
        this.elements.messageInput?.addEventListener('keydown', (e) => this.handleMessageInputKeydown(e));

        // Typing indicators
        this.elements.messageInput?.addEventListener('input', () => this.handleTyping());

        // Sidebar toggle
        this.elements.toggleSidebar?.addEventListener('click', () => this.toggleSidebar());
        this.elements.closeSidebar?.addEventListener('click', () => this.toggleSidebar());

        // Sidebar overlay
        this.elements.sidebarOverlay?.addEventListener('click', () => this.toggleSidebar());

        // User list toggle
        this.elements.toggleUsers?.addEventListener('click', () => this.toggleUserList());

        // Auto-resize message input
        this.elements.messageInput?.addEventListener('input', () => this.autoResizeTextarea());

        // Focus management
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isInChat) {
                this.elements.messageInput?.focus();
            }
        });
    }

    // Initialize socket connection
    initializeSocket() {
        this.socketClient = new SocketClient();

        // Setup socket event listeners
        this.socketClient
            .onConnection((type, data) => this.handleConnectionEvent(type, data))
            .onMessage((type, data) => this.handleMessageEvent(type, data))
            .onUser((type, data) => this.handleUserEvent(type, data))
            .onRoom((type, data) => this.handleRoomEvent(type, data))
            .onInvitation((type, data) => this.handleInvitationEvent(type, data))
            .onError((type, data) => this.handleErrorEvent(type, data))
            .init();
    }

    // Handle socket connection events
    handleConnectionEvent(type, data) {
        switch (type) {
            case 'connected':
                this.updateConnectionStatus(true);
                break;
            case 'disconnected':
                this.updateConnectionStatus(false);
                this.handleDisconnection();
                break;
            case 'error':
                this.updateConnectionStatus(false);
                this.showError('Connection error. Please refresh the page.');
                break;
        }
    }

    // Handle socket message events
    handleMessageEvent(type, data) {
        switch (type) {
            case 'new':
                this.addMessage(data);
                break;
            case 'previous':
                this.displayMessages(data);
                break;
            case 'typing':
                this.showTypingIndicator(data);
                break;
            case 'stop-typing':
                this.hideTypingIndicator(data);
                break;
        }
    }

    // Handle socket user events
    handleUserEvent(type, data) {
        switch (type) {
            case 'joined':
                this.addSystemMessage(`${data} joined the chat`);
                break;
            case 'left':
                this.addSystemMessage(`${data} left the chat`);
                break;
            case 'list':
                this.updateUsersList(data);
                break;
            case 'join-success':
                this.handleJoinSuccess(data);
                break;
        }
    }

    // Handle socket room events
    handleRoomEvent(type, data) {
        switch (type) {
            case 'switched':
                this.currentRoom = data;
                this.updateCurrentRoom();
                this.updateActiveRoom();
                break;
            case 'switch-to-private':
                this.switchRoom(data);
                break;
        }
    }

    // Handle socket invitation events
    handleInvitationEvent(type, data) {
        switch (type) {
            case 'received':
                this.showPrivateInvitation(data);
                break;
        }
    }

    // Handle socket error events
    handleErrorEvent(type, data) {
        switch (type) {
            case 'error':
                if (data.includes('Username already taken')) {
                    this.handleUsernameError();
                } else {
                    this.showError(data);
                }
                break;
        }
    }

    // Handle joining chat
    handleJoinChat() {
        const username = this.elements.usernameInput?.value.trim();

        if (!username) {
            this.showError('Please enter a username');
            return;
        }

        if (username.length < 2) {
            this.showError('Username must be at least 2 characters');
            return;
        }

        if (username.length > 20) {
            this.showError('Username must be less than 20 characters');
            return;
        }

        if (!this.socketClient.getConnectionStatus().connected) {
            this.showError('Not connected to server. Please wait...');
            return;
        }

        try {
            this.currentUsername = username;
            this.socketClient.joinChat(username);
            this.elements.joinButton.disabled = true;
            this.elements.joinButton.innerHTML = '<span class="spinner me-2"></span>Joining...';
        } catch (error) {
            this.showError(error.message);
        }
    }

    // Handle successful join
    handleJoinSuccess(data) {
        this.currentUsername = data.username;
        this.isInChat = true;
        this.showChatApp();
        this.elements.currentUsername.textContent = this.currentUsername;
        this.elements.messageInput?.focus();
    }

    // Handle username error
    handleUsernameError() {
        this.showError('Username already taken. Please choose another.');
        this.elements.joinButton.disabled = false;
        this.elements.joinButton.innerHTML = '<i class="bi bi-arrow-right mr-2"></i>Start Chatting';
        this.elements.usernameInput?.focus();
        this.elements.usernameInput.value = '';
    }

    // Handle sending messages
    handleSendMessage() {
        const messageText = this.elements.messageInput?.value.trim();

        if (!messageText) return;

        try {
            this.socketClient.sendMessage({
                username: this.currentUsername,
                text: messageText
            });

            this.elements.messageInput.value = '';
            this.autoResizeTextarea();
            this.stopTyping();
        } catch (error) {
            this.showError(error.message);
        }
    }

    // Handle message input keydown
    handleMessageInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendMessage();
        }
    }

    // Handle typing indicators
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.socketClient.startTyping(this.currentRoom);
        }

        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.stopTyping();
        }, 1000);
    }

    stopTyping() {
        if (this.isTyping) {
            this.isTyping = false;
            this.socketClient.stopTyping(this.currentRoom);
        }
        clearTimeout(this.typingTimer);
    }

    // Auto-resize textarea
    autoResizeTextarea() {
        const textarea = this.elements.messageInput;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
    }

    // Switch rooms
    switchRoom(roomId) {
        if (roomId === this.currentRoom) return;

        try {
            // Clear messages
            this.clearMessages();

            this.currentRoom = roomId;
            this.socketClient.switchRoom(roomId);
            this.updateCurrentRoom();
            this.updateActiveRoom();
        } catch (error) {
            this.showError(error.message);
        }
    }

    // Start private chat
    startPrivateChat(targetUsername) {
        try {
            this.socketClient.startPrivateChat(targetUsername);
        } catch (error) {
            this.showError(error.message);
        }
    }

    // Custom Modal Functions
    showPrivateInvitation(invitation) {
        this.pendingInvitation = invitation;
        this.elements.invitationText.textContent =
            `${invitation.from} wants to start a private chat with you.`;

        this.showModal(this.elements.invitationModal);
    }

    showModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove('hidden');
            modalElement.classList.add('flex');
            modalElement.classList.add('show');
            // Add backdrop click to close
            modalElement.addEventListener('click', (e) => {
                if (e.target === modalElement) {
                    this.hideModal(modalElement);
                }
            });
        }
    }

    hideModal(modalElement) {
        if (modalElement) {
            modalElement.classList.add('hidden');
            modalElement.classList.remove('flex');
            modalElement.classList.remove('show');
        }
    }

    // Accept private chat invitation
    acceptPrivateChat() {
        if (this.pendingInvitation) {
            try {
                this.socketClient.acceptPrivateChat(this.pendingInvitation.roomId);
                this.dismissInvitation();
            } catch (error) {
                this.showError(error.message);
            }
        }
    }

    // Dismiss invitation
    dismissInvitation() {
        this.hideModal(this.elements.invitationModal);
        this.pendingInvitation = null;
    }

    // Custom Toast Functions
    showError(message) {
        if (this.elements.errorToastBody) {
            this.elements.errorToastBody.textContent = message;
            this.showToast(this.elements.errorToast);
        } else {
            alert(message);
        }
    }

    showToast(toastElement, duration = 5000) {
        if (toastElement) {
            toastElement.classList.remove('hidden');
            toastElement.classList.add('show');

            // Auto hide after duration
            setTimeout(() => {
                this.hideToast(toastElement);
            }, duration);
        }
    }

    hideToast(toastElement) {
        if (toastElement) {
            toastElement.classList.add('hidden');
            toastElement.classList.remove('show');
        }
    }

    // Leave chat
    leaveChat() {
        this.socketClient.leaveChat();
        this.handleDisconnection();
    }

    // Handle disconnection
    handleDisconnection() {
        this.isInChat = false;
        this.currentUsername = '';
        this.currentRoom = 'general';
        this.showLandingPage();
        this.elements.usernameInput.value = '';
        this.elements.joinButton.disabled = false;
        this.elements.joinButton.innerHTML = '<i class="bi bi-arrow-right mr-2"></i>Start Chatting';
    }

    // UI Update methods
    updateConnectionStatus(connected) {
        const statusElement = this.elements.connectionStatus;
        const badgeElement = this.elements.connectionBadge;

        if (connected) {
            if (statusElement) {
                statusElement.innerHTML = '<span class="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span><span class="text-emerald-500">Connected</span>';
            }
            if (badgeElement) {
                badgeElement.innerHTML = '<span class="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span><span class="font-semibold">Connected</span>';
            }
        } else {
            if (statusElement) {
                statusElement.innerHTML = '<span class="w-2.5 h-2.5 bg-red-500 rounded-full"></span><span class="text-red-400">Disconnected</span>';
            }
            if (badgeElement) {
                badgeElement.innerHTML = '<span class="w-2.5 h-2.5 bg-red-500 rounded-full"></span><span class="font-semibold text-red-400">Disconnected</span>';
            }
        }
    }

    updateCurrentRoom() {
        const roomElement = this.elements.currentRoom;
        if (!roomElement) return;

        if (this.currentRoom === 'general') {
            roomElement.textContent = '# general';
            roomElement.nextElementSibling.textContent = 'Public room';
        } else {
            const users = this.currentRoom.split('-');
            const otherUser = users.find(u => u !== this.currentUsername);
            roomElement.textContent = `@ ${otherUser}`;
            roomElement.nextElementSibling.textContent = 'Private chat';
        }
    }

    updateActiveRoom() {
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeRoom = document.querySelector(`[data-room="${this.currentRoom}"]`);
        if (activeRoom) {
            activeRoom.classList.add('active');
        }
    }

    updateUsersList(users) {
        const userList = this.elements.userList;
        const userCount = this.elements.userCount;

        if (userCount) userCount.textContent = users.length;
        if (!userList) return;

        userList.innerHTML = '';

        users.forEach(user => {
            if (user.username !== this.currentUsername) {
                const li = document.createElement('li');
                li.className = 'user-item flex items-center justify-between p-3 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors mb-2';
                li.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <span class="w-3 h-3 bg-emerald-500 rounded-full"></span>
                        <span class="text-gray-300">${user.username}</span>
                    </div>
                    <button class="chat-button bg-transparent text-gray-400 border border-gray-600 px-2 py-1 rounded text-xs hover:bg-emerald-600 hover:border-emerald-600 hover:text-white transition-colors" onclick="app.startPrivateChat('${user.username}')">
                        CHAT
                    </button>
                `;
                userList.appendChild(li);
            }
        });
    }

    // Message display methods
    displayMessages(messages) {
        this.clearMessages();

        if (messages.length === 0) {
            this.showWelcomeMessage();
            return;
        }

        messages.forEach(message => {
            this.addMessage(message, false);
        });

        this.scrollToBottom();
    }

    addMessage(message, animate = true) {
        const messagesContainer = this.elements.messages;
        if (!messagesContainer) return;

        // Remove welcome message if present
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageElement = this.createMessageElement(message);
        if (animate) {
            messageElement.classList.add('slide-up');
        }

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    addSystemMessage(text) {
        const messagesContainer = this.elements.messages;
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message text-center mx-auto my-6 px-4 py-2 bg-gray-700 text-gray-300 rounded-full text-sm max-w-xs';
        messageDiv.innerHTML = `<i class="bi bi-info-circle mr-1"></i>${text}`;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';

        const isOwnMessage = message.username === this.currentUsername;
        const isPrivateRoom = this.currentRoom !== 'general';

        // Set alignment
        if (isOwnMessage) {
            messageDiv.classList.add('justify-end');
        } else {
            messageDiv.classList.add('justify-start');
        }

        // Create message bubble
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = `message-bubble-chat max-w-xs sm:max-w-sm lg:max-w-md p-4 rounded-xl shadow-md ${isOwnMessage
            ? 'bg-emerald-600 text-white'
            : 'bg-gray-700 text-gray-100'
            }`;

        if (isPrivateRoom) {
            bubbleDiv.classList.add('private');
        }

        bubbleDiv.innerHTML = `
            <div class="message-header flex items-center space-x-2 text-xs ${isOwnMessage ? 'text-emerald-200' : 'text-gray-400'} mb-1">
                <span class="font-semibold ${isOwnMessage ? 'text-emerald-200' : 'text-gray-300'}">${message.username}</span>
                <span class="text-xs">${this.formatTime(message.timestamp)}</span>
            </div>
            <div class="message-text">${this.escapeHtml(message.text)}</div>
        `;

        messageDiv.appendChild(bubbleDiv);
        return messageDiv;
    }

    clearMessages() {
        const messagesContainer = this.elements.messages;
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
    }

    showWelcomeMessage() {
        const messagesContainer = this.elements.messages;
        if (!messagesContainer) return;

        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message text-center py-12';
        welcomeDiv.innerHTML = `
            <i class="bi bi-chat-heart text-6xl text-emerald-500 mb-4 block"></i>
            <h4 class="text-xl font-semibold text-white mb-2">Welcome to TempTalk!</h4>
            <p class="text-gray-400">Start the conversation. Messages will appear here.</p>
        `;

        messagesContainer.appendChild(welcomeDiv);
    }

    scrollToBottom() {
        const messagesContainer = this.elements.messages;
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // UI state management
    showLandingPage() {
        this.elements.landingPage?.classList.remove('hidden');
        this.elements.chatApp?.classList.add('hidden');
        this.elements.usernameInput?.focus();
    }

    showChatApp() {
        this.elements.landingPage?.classList.add('hidden');
        this.elements.chatApp?.classList.remove('hidden');
        this.elements.messageInput?.focus();
    }

    toggleSidebar() {
        const sidebar = this.elements.sidebar;
        const overlay = this.elements.sidebarOverlay;

        if (!sidebar || !overlay) return;

        if (window.innerWidth < 768) {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
            overlay.classList.toggle('hidden');
        }
    }

    toggleUserList() {
        const userList = this.elements.userList;
        const toggleBtn = this.elements.toggleUsers?.querySelector('i');

        if (!userList || !toggleBtn) return;

        this.userListCollapsed = !this.userListCollapsed;

        if (this.userListCollapsed) {
            userList.style.display = 'none';
            toggleBtn.className = 'bi bi-chevron-right';
        } else {
            userList.style.display = 'block';
            toggleBtn.className = 'bi bi-chevron-down';
        }
    }

    // Typing indicators (placeholder methods)
    showTypingIndicator(data) {
        // Implementation for showing typing indicator
        console.log(`${data.username} is typing...`);
    }

    hideTypingIndicator(data) {
        // Implementation for hiding typing indicator
        console.log(`${data.username} stopped typing`);
    }

    // Utility methods
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateUI() {
        this.updateConnectionStatus(false);
        this.showLandingPage();
    }

    // Cleanup
    destroy() {
        if (this.socketClient) {
            this.socketClient.destroy();
        }
        clearTimeout(this.typingTimer);
    }
}

// Global functions for onclick handlers
window.switchRoom = function (roomId) {
    window.app?.switchRoom(roomId);
};

window.joinChat = function () {
    window.app?.handleJoinChat();
};

window.sendMessage = function () {
    window.app?.handleSendMessage();
};

window.acceptPrivateChat = function () {
    window.app?.acceptPrivateChat();
};

window.dismissInvitation = function () {
    window.app?.dismissInvitation();
};

window.leaveChat = function () {
    window.app?.leaveChat();
};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    window.app = new TempTalkApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function () {
    window.app?.destroy();
});