const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));

// In-memory storage (temporary)
let messages = {}; // roomId -> messages array
let users = {}; // socketId -> user info
let rooms = new Set(['general']); // Available rooms

// Clean up messages older than 24 hours every minute
setInterval(() => {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    Object.keys(messages).forEach(roomId => {
        messages[roomId] = messages[roomId].filter(msg => msg.timestamp > oneDayAgo);
        if (messages[roomId].length === 0 && roomId !== 'general') {
            delete messages[roomId];
            rooms.delete(roomId);
        }
    });
}, 60000);

// Clean up disconnected users every 30 seconds
setInterval(() => {
    const connectedSocketIds = new Set();

    // Get all currently connected socket IDs
    io.sockets.sockets.forEach(socket => {
        connectedSocketIds.add(socket.id);
    });

    // Remove users whose sockets are no longer connected
    Object.keys(users).forEach(socketId => {
        if (!connectedSocketIds.has(socketId)) {
            console.log(`Cleaning up disconnected user: ${users[socketId]?.username}`);
            delete users[socketId];
        }
    });
}, 30000);

// Initialize general room
messages['general'] = [];

function generatePrivateRoomId(user1, user2) {
    return [user1, user2].sort().join('-');
}

function getUsersInRoom(roomId) {
    return Object.values(users).filter(user => user.currentRoom === roomId);
}

function getAllOnlineUsers() {
    return Object.values(users).map(user => ({
        username: user.username,
        socketId: user.socketId,
        currentRoom: user.currentRoom
    }));
}

// Helper function to clean up user data
function cleanupUser(socketId) {
    if (users[socketId]) {
        const user = users[socketId];
        console.log(`Cleaning up user: ${user.username} (${socketId})`);

        // Remove from users
        delete users[socketId];

        // Clear private rooms/messages involving this user
        rooms.forEach(roomId => {
            if (roomId !== 'general' && roomId.includes(user.username)) {
                delete messages[roomId];
                rooms.delete(roomId);
            }
        });

        // Notify others
        io.emit('user-left', user.username);

        // Update user lists
        io.emit('users-list', getAllOnlineUsers());

        return user;
    }
    return null;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user joining
    socket.on('join-chat', (username) => {
        console.log(`Join attempt: "${username}" from socket ${socket.id}`);

        // First, clean up any existing entry for this socket
        if (users[socket.id]) {
            console.log(`Cleaning up existing user for socket ${socket.id}`);
            cleanupUser(socket.id);
        }

        // Check for username uniqueness (case-insensitive)
        const existingUser = Object.values(users).find(
            user => user.username.toLowerCase() === username.toLowerCase()
        );

        if (existingUser) {
            console.log(`Username "${username}" already taken by socket ${existingUser.socketId}`);

            // Double-check if that socket is actually still connected
            const existingSocket = io.sockets.sockets.get(existingUser.socketId);
            if (!existingSocket || !existingSocket.connected) {
                console.log(`Cleaning up stale user entry for ${username}`);
                cleanupUser(existingUser.socketId);
                // Continue with the join process since the user was stale
            } else {
                socket.emit('error', 'Username already taken. Please choose another.');
                return;
            }
        }

        // Store user info
        users[socket.id] = {
            socketId: socket.id,
            username: username,
            currentRoom: 'general'
        };

        // Join general room
        socket.join('general');
        socket.currentRoom = 'general';
        socket.username = username;

        // Send previous messages from general room
        socket.emit('previous-messages', messages['general'] || []);

        // Emit success event to the joining user FIRST
        socket.emit('join-success', {
            username: username,
            room: 'general'
        });

        // Send list of online users
        socket.emit('users-list', getAllOnlineUsers());

        // Notify others about new user
        socket.broadcast.emit('user-joined', username);

        // Update user lists for everyone
        io.emit('users-list', getAllOnlineUsers());

        console.log(`${username} successfully joined the chat (${socket.id})`);
    });

    // Handle room switching
    socket.on('switch-room', (roomId) => {
        if (!users[socket.id]) return;

        const user = users[socket.id];
        const oldRoom = user.currentRoom;

        // Leave old room
        socket.leave(oldRoom);

        // Join new room
        socket.join(roomId);
        user.currentRoom = roomId;
        socket.currentRoom = roomId;

        // Add room to rooms set if it's a private room
        rooms.add(roomId);

        // Initialize messages array for new room if it doesn't exist
        if (!messages[roomId]) {
            messages[roomId] = [];
        }

        // Send previous messages from new room
        socket.emit('previous-messages', messages[roomId]);
        socket.emit('room-switched', roomId);

        // Update user lists
        io.emit('users-list', getAllOnlineUsers());

        console.log(`${user.username} switched from ${oldRoom} to ${roomId}`);
    });

    // Handle starting private chat
    socket.on('start-private-chat', (targetUsername) => {
        const currentUser = users[socket.id];
        if (!currentUser) return;

        // Find target user
        const targetUser = Object.values(users).find(u => u.username === targetUsername);
        if (!targetUser) {
            socket.emit('error', 'User not found');
            return;
        }

        // Generate private room ID
        const privateRoomId = generatePrivateRoomId(currentUser.username, targetUsername);

        // Send private chat invitation to target user
        io.to(targetUser.socketId).emit('private-chat-invitation', {
            from: currentUser.username,
            roomId: privateRoomId
        });

        // Automatically switch current user to private room
        socket.emit('switch-to-private-room', privateRoomId);
    });

    // Handle accepting private chat invitation
    socket.on('accept-private-chat', (roomId) => {
        socket.emit('switch-to-private-room', roomId);
    });

    // Handle new messages
    socket.on('send-message', (messageData) => {
        const user = users[socket.id];
        if (!user) return;

        const message = {
            id: Date.now() + Math.random(),
            username: messageData.username,
            text: messageData.text,
            timestamp: Date.now(),
            roomId: user.currentRoom
        };

        // Add to room's message array
        if (!messages[user.currentRoom]) {
            messages[user.currentRoom] = [];
        }
        messages[user.currentRoom].push(message);

        // Broadcast to users in the same room
        io.to(user.currentRoom).emit('new-message', message);

        console.log(`${message.username} in ${user.currentRoom}: ${message.text}`);
    });

    // Handle explicit disconnect
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.id} (${reason})`);
        cleanupUser(socket.id);
    });

    // Handle connection errors
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
        cleanupUser(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`TempTalk server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to start chatting`);
});