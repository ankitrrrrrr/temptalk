// Socket Client Logic for TempTalk
class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.connectionListeners = [];
        this.messageListeners = [];
        this.userListeners = [];
        this.errorListeners = [];
        this.invitationListeners = [];
        this.roomListeners = [];
    }

    // Initialize socket connection
    init() {
        this.socket = io();
        this.setupEventListeners();
        return this;
    }

    // Setup all socket event listeners
    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.notifyConnectionListeners('connected');
            console.log('Connected to TempTalk server');
        });

        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            this.notifyConnectionListeners('disconnected', reason);
            console.log('Disconnected from TempTalk server:', reason);
        });

        this.socket.on('connect_error', (error) => {
            this.isConnected = false;
            this.notifyConnectionListeners('error', error);
            console.error('Connection error:', error);
        });

        // Message events
        this.socket.on('new-message', (message) => {
            this.notifyMessageListeners('new', message);
        });

        this.socket.on('previous-messages', (messages) => {
            this.notifyMessageListeners('previous', messages);
        });

        // User events
        this.socket.on('user-joined', (username) => {
            this.notifyUserListeners('joined', username);
        });

        this.socket.on('user-left', (username) => {
            this.notifyUserListeners('left', username);
        });

        this.socket.on('users-list', (users) => {
            this.notifyUserListeners('list', users);
        });

        // Room events
        this.socket.on('room-switched', (roomId) => {
            this.notifyRoomListeners('switched', roomId);
        });

        this.socket.on('switch-to-private-room', (roomId) => {
            this.notifyRoomListeners('switch-to-private', roomId);
        });

        // Private chat events
        this.socket.on('private-chat-invitation', (invitation) => {
            this.notifyInvitationListeners('received', invitation);
        });

        // Error events
        this.socket.on('error', (message) => {
            this.notifyErrorListeners('error', message);
        });

        // Custom events for better UX
        this.socket.on('join-success', (data) => {
            this.notifyUserListeners('join-success', data);
        });

        this.socket.on('typing', (data) => {
            this.notifyMessageListeners('typing', data);
        });

        this.socket.on('stop-typing', (data) => {
            this.notifyMessageListeners('stop-typing', data);
        });
    }

    // Connection status
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            id: this.socket?.id || null
        };
    }

    // Join chat with username
    joinChat(username) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        if (!username || username.trim() === '') {
            throw new Error('Username is required');
        }

        this.socket.emit('join-chat', username.trim());
    }

    // Send message
    sendMessage(messageData) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        if (!messageData.text || messageData.text.trim() === '') {
            throw new Error('Message text is required');
        }

        this.socket.emit('send-message', {
            username: messageData.username,
            text: messageData.text.trim()
        });
    }

    // Switch room
    switchRoom(roomId) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        this.socket.emit('switch-room', roomId);
    }

    // Start private chat
    startPrivateChat(targetUsername) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        if (!targetUsername) {
            throw new Error('Target username is required');
        }

        this.socket.emit('start-private-chat', targetUsername);
    }

    // Accept private chat invitation
    acceptPrivateChat(roomId) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        this.socket.emit('accept-private-chat', roomId);
    }

    // Reject private chat invitation
    rejectPrivateChat(roomId) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        this.socket.emit('reject-private-chat', roomId);
    }

    // Typing indicators
    startTyping(roomId) {
        if (!this.isConnected) return;
        this.socket.emit('typing', roomId);
    }

    stopTyping(roomId) {
        if (!this.isConnected) return;
        this.socket.emit('stop-typing', roomId);
    }

    // Leave chat
    leaveChat() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    // Event listener management
    onConnection(callback) {
        this.connectionListeners.push(callback);
        return this;
    }

    onMessage(callback) {
        this.messageListeners.push(callback);
        return this;
    }

    onUser(callback) {
        this.userListeners.push(callback);
        return this;
    }

    onError(callback) {
        this.errorListeners.push(callback);
        return this;
    }

    onInvitation(callback) {
        this.invitationListeners.push(callback);
        return this;
    }

    onRoom(callback) {
        this.roomListeners.push(callback);
        return this;
    }

    // Notification methods
    notifyConnectionListeners(type, data) {
        this.connectionListeners.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Error in connection listener:', error);
            }
        });
    }

    notifyMessageListeners(type, data) {
        this.messageListeners.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Error in message listener:', error);
            }
        });
    }

    notifyUserListeners(type, data) {
        this.userListeners.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Error in user listener:', error);
            }
        });
    }

    notifyErrorListeners(type, data) {
        this.errorListeners.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Error in error listener:', error);
            }
        });
    }

    notifyInvitationListeners(type, data) {
        this.invitationListeners.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Error in invitation listener:', error);
            }
        });
    }

    notifyRoomListeners(type, data) {
        this.roomListeners.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Error in room listener:', error);
            }
        });
    }

    // Remove listeners
    removeConnectionListener(callback) {
        const index = this.connectionListeners.indexOf(callback);
        if (index > -1) {
            this.connectionListeners.splice(index, 1);
        }
    }

    removeMessageListener(callback) {
        const index = this.messageListeners.indexOf(callback);
        if (index > -1) {
            this.messageListeners.splice(index, 1);
        }
    }

    removeUserListener(callback) {
        const index = this.userListeners.indexOf(callback);
        if (index > -1) {
            this.userListeners.splice(index, 1);
        }
    }

    removeErrorListener(callback) {
        const index = this.errorListeners.indexOf(callback);
        if (index > -1) {
            this.errorListeners.splice(index, 1);
        }
    }

    removeInvitationListener(callback) {
        const index = this.invitationListeners.indexOf(callback);
        if (index > -1) {
            this.invitationListeners.splice(index, 1);
        }
    }

    removeRoomListener(callback) {
        const index = this.roomListeners.indexOf(callback);
        if (index > -1) {
            this.roomListeners.splice(index, 1);
        }
    }

    // Cleanup
    destroy() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
        }

        this.connectionListeners = [];
        this.messageListeners = [];
        this.userListeners = [];
        this.errorListeners = [];
        this.invitationListeners = [];
        this.roomListeners = [];
    }
}

// Export for use in main app
window.SocketClient = SocketClient;