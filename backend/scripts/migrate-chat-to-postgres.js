require('../config/env').loadEnv();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const Lecturer = require('../models/Lecturer');
const prisma = require('../config/prisma');

const toId = (v) => (v ? v.toString() : null);
const toDate = (v) => (v ? new Date(v) : null);

const getUserIdFromLecturerField = async (lecturerUserId) => {
  if (!lecturerUserId) return null;
  // Check if it is a Lecturer ID
  const lecturer = await Lecturer.findById(lecturerUserId);
  if (lecturer && lecturer.userId) {
    return lecturer.userId.toString();
  }
  return lecturerUserId.toString();
};

const main = async () => {
  await connectDB();

  console.log('Fetching ChatRooms and ChatMessages from MongoDB...');
  const mongoRooms = await ChatRoom.find({}).setOptions({ includeDeleted: true }).lean();
  const mongoMessages = await ChatMessage.find({}).setOptions({ includeDeleted: true }).lean();

  console.log(`Found ${mongoRooms.length} ChatRooms and ${mongoMessages.length} ChatMessages.`);

  // 1. Migrate ChatRooms
  let roomsCount = 0;
  let membersCount = 0;
  for (const room of mongoRooms) {
    const roomId = toId(room._id);

    // Build direct key if direct room
    let directKey = null;
    if (room.type === 'direct' && room.memberIds && room.memberIds.length === 2) {
      directKey = room.memberIds.map(toId).sort().join(':');
    }

    const roomData = {
      id: roomId,
      mongoId: roomId,
      type: room.type,
      name: room.name || 'Chat',
      groupId: toId(room.groupId),
      projectId: toId(room.projectId),
      status: room.status || 'active',
      requestedBy: toId(room.requestedBy),
      acceptedBy: toId(room.acceptedBy),
      acceptedAt: toDate(room.acceptedAt),
      directKey,
      lastMessageAt: toDate(room.lastMessageAt),
      isDeleted: Boolean(room.isDeleted),
      deletedAt: toDate(room.deletedAt),
      deletedBy: toId(room.deletedBy),
      createdAt: toDate(room.createdAt) || new Date(),
      updatedAt: toDate(room.updatedAt) || new Date(),
    };

    // Upsert Room
    await prisma.chatRoom.upsert({
      where: { id: roomId },
      create: roomData,
      update: {
        ...roomData,
        id: undefined,
        mongoId: undefined,
        createdAt: undefined,
      },
    });
    roomsCount++;

    // Process members and calculate lastReadAt for each member in this room
    const memberIds = (room.memberIds || []).map(toId).filter(Boolean);
    const uniqueMemberIds = [...new Set(memberIds)];

    // Get all messages in this room to compute lastReadAt for each user
    const roomMessages = mongoMessages.filter((m) => toId(m.roomId) === roomId && !m.isDeleted);

    for (const userId of uniqueMemberIds) {
      // Find the latest message this user sent or read
      let lastReadAt = null;
      const userSentOrReadMsgs = roomMessages.filter((m) => {
        const isSender = toId(m.senderId) === userId;
        const isRead = (m.readBy || []).some((r) => toId(r.userId) === userId);
        return isSender || isRead;
      });

      if (userSentOrReadMsgs.length > 0) {
        // Sort by createdAt descending
        userSentOrReadMsgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        lastReadAt = toDate(userSentOrReadMsgs[0].createdAt);
      }

      await prisma.chatRoomMember.upsert({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
        create: {
          roomId,
          userId,
          role: 'member',
          status: 'active',
          lastReadAt,
          joinedAt: toDate(room.createdAt) || new Date(),
        },
        update: {
          role: 'member',
          status: 'active',
          lastReadAt,
        },
      });
      membersCount++;
    }

    // Process invites
    if (room.groupTeacherInvites && room.groupTeacherInvites.length > 0) {
      for (const invite of room.groupTeacherInvites) {
        const lecturerUserId = await getUserIdFromLecturerField(invite.lecturerUserId);
        if (!lecturerUserId) continue;

        const inviteStatus = invite.status || 'pending';
        // Member role is 'teacher'
        await prisma.chatRoomMember.upsert({
          where: {
            roomId_userId: {
              roomId,
              userId: lecturerUserId,
            },
          },
          create: {
            roomId,
            userId: lecturerUserId,
            role: 'teacher',
            status: inviteStatus,
            lastReadAt: toDate(invite.respondedAt),
            joinedAt: toDate(invite.respondedAt) || toDate(room.createdAt) || new Date(),
            invitedBy: toId(invite.requestedBy),
          },
          update: {
            role: 'teacher',
            status: inviteStatus,
            lastReadAt: toDate(invite.respondedAt),
          },
        });
        membersCount++;
      }
    }
  }

  // 2. Migrate ChatMessages
  let messagesCount = 0;
  for (const message of mongoMessages) {
    const messageId = toId(message._id);

    const attachments = (message.attachments || []).map((att) => ({
      fileId: toId(att.fileId),
      originalName: att.originalName,
      mimeType: att.mimeType,
      size: att.size,
      kind: att.kind || 'file',
    }));

    const messageData = {
      id: messageId,
      mongoId: messageId,
      roomId: toId(message.roomId),
      senderId: toId(message.senderId),
      body: message.body || '',
      attachments,
      isDeleted: Boolean(message.isDeleted),
      deletedAt: toDate(message.deletedAt),
      deletedBy: toId(message.deletedBy),
      createdAt: toDate(message.createdAt) || new Date(),
    };

    // Verify room exists in Postgres (prevent foreign key constraint failure)
    const roomExists = await prisma.chatRoom.findUnique({
      where: { id: messageData.roomId },
    });
    if (!roomExists) {
      console.warn(`Warning: ChatRoom ${messageData.roomId} not found in Postgres. Skipping message ${messageId}.`);
      continue;
    }

    await prisma.chatMessage.upsert({
      where: { id: messageId },
      create: messageData,
      update: {
        ...messageData,
        id: undefined,
        mongoId: undefined,
        createdAt: undefined,
      },
    });
    messagesCount++;
  }

  console.log('Chat migration completed successfully!');
  console.log(`ChatRooms: ${roomsCount}`);
  console.log(`ChatRoomMembers: ${membersCount}`);
  console.log(`ChatMessages: ${messagesCount}`);
};

main()
  .catch((err) => {
    console.error('Chat migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
