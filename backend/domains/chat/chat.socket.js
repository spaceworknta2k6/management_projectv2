const jwt = require('jsonwebtoken');
const chatService = require('./chat.service');
const { getJwtSecret } = require('../../config/jwt');
const authService = require('../auth/auth.service');

const buildSocketUser = async (token) => {
  const decoded = jwt.verify(token, getJwtSecret());
  const user = await authService.getUserByIdForAuth(decoded.id || decoded.userId);
  if (!user || user.isDeleted || user.status === 'locked' || user.status === 'inactive') {
    throw new Error('Unauthorized');
  }

  const socketUser = {
    _id: user.id,
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    roles: user.roles,
    avatarUrl: user.avatarUrl || '',
  };

  if (user.roles.includes('STUDENT') && user.student && !user.student.isDeleted) {
    socketUser.studentId = user.student.id;
  }

  if (user.roles.includes('LECTURER') && user.lecturer && !user.lecturer.isDeleted) {
    socketUser.lecturerId = user.lecturer.id;
  }

  return socketUser;
};

const registerChatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      socket.user = await buildSocketUser(token);
      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Join a user-specific room to receive real-time notifications
    socket.join(`user:${socket.user._id}`);

    socket.on('chat:join', async ({ roomId }, ack) => {
      try {
        await chatService.getRoomForUser(roomId, socket.user);
        socket.join(`chat:${roomId}`);
        ack?.({ success: true });
      } catch (error) {
        ack?.({ success: false, message: error.message || 'Không thể tham gia phòng chat.' });
      }
    });

    socket.on('chat:leave', ({ roomId }) => {
      if (roomId) socket.leave(`chat:${roomId}`);
    });

    socket.on('chat:message', async ({ roomId, body }, ack) => {
      try {
        const message = await chatService.sendMessage(roomId, socket.user, body);
        io.to(`chat:${roomId}`).emit('chat:message', message);
        ack?.({ success: true, data: message });
      } catch (error) {
        ack?.({ success: false, message: error.message || 'Không thể gửi tin nhắn.' });
      }
    });

    socket.on('chat:typing', async ({ roomId, isTyping }, ack) => {
      try {
        await chatService.getRoomForUser(roomId, socket.user);
        socket.to(`chat:${roomId}`).emit('chat:typing', {
          roomId,
          isTyping: Boolean(isTyping),
          user: {
            _id: socket.user._id,
            fullName: socket.user.fullName,
            email: socket.user.email,
            avatarUrl: socket.user.avatarUrl || '',
          },
        });
        ack?.({ success: true });
      } catch (error) {
        ack?.({ success: false });
      }
    });
  });
};

module.exports = registerChatSocket;
