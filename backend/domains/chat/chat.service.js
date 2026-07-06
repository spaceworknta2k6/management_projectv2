const crypto = require('crypto');
const filesService = require('../files/files.service');
const notificationsService = require('../notifications/notifications.service');
const { uploadImageBuffer } = require('../../config/cloudinary');
const prisma = require('../../config/prisma');

const toId = (value) => String(value?._id || value || '');

const getAttachmentKind = (mimeType) => {
  return String(mimeType || '').startsWith('image/') ? 'image' : 'file';
};

// ─── AUDIT EVENTS ────────────────────────────────────────────────────────────

const createChatAuditEvent = async ({ roomId, user, action, reason, metadata = {} }) => {
  try {
    const id = crypto.randomBytes(12).toString('hex');
    await prisma.workflowEvent.create({
      data: {
        id,
        mongoId: id,
        entityType: 'ChatRoom',
        entityId: roomId,
        toStatus: 'active',
        actorId: user._id.toString(),
        actorRoles: user.roles || [],
        action,
        reason,
        metadata,
      },
    });
  } catch (error) {
    console.error('Chat audit event failed:', error.message);
  }
};

// ─── NOTIFICATION MEMBER HELPERS ──────────────────────────────────────────────

const notifyRoomMembers = async (room, sender, message) => {
  const recipientIds = (room.memberIds || [])
    .map(toId)
    .filter((memberId) => memberId && memberId !== toId(sender._id));
  if (recipientIds.length === 0) return;

  const senderName = sender.fullName || sender.email || 'Người dùng';
  const hasAttachment = (message.attachments || []).length > 0;
  const body = message.body || (hasAttachment ? 'Đã gửi một tệp đính kèm.' : 'Đã gửi một tin nhắn mới.');

  try {
    await Promise.all(recipientIds.map((recipientId) => notificationsService.createNotification({
      recipientId,
      type: 'CHAT_MESSAGE',
      title: `Tin nhắn mới từ ${senderName}`,
      body,
      entityType: 'ChatRoom',
      entityId: room._id,
      actionUrl: `/dashboard/chat?room=${room._id}`,
    })));
  } catch (error) {
    console.error('Chat notification failed:', error.message);
  }
};

// ─── SHAPE MAPPER FOR COMPATIBILITY ──────────────────────────────────────────

const mapRoomToOldShape = async (room, currentUserId) => {
  if (!room) return null;

  const pgMembers = await prisma.chatRoomMember.findMany({
    where: { roomId: room.id },
  });

  const userIds = [...new Set([
    ...pgMembers.map(m => m.userId),
    ...pgMembers.map(m => m.invitedBy).filter(Boolean),
    room.requestedBy,
    room.acceptedBy
  ].filter(Boolean))];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      fullName: true,
      email: true,
      avatarUrl: true,
      roles: true
    }
  });

  const userMap = new Map(users.map(u => [u.id, {
    _id: u.id,
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    avatarUrl: u.avatarUrl || '',
    roles: u.roles
  }]));

  let groupPopulated = null;
  if (room.groupId) {
    const pgGroup = await prisma.projectGroup.findUnique({
      where: { id: room.groupId },
      select: { id: true, name: true, status: true, avatarUrl: true }
    });
    if (pgGroup) {
      groupPopulated = {
        _id: pgGroup.id,
        id: pgGroup.id,
        name: pgGroup.name,
        status: pgGroup.status,
        avatarUrl: pgGroup.avatarUrl || ''
      };
    }
  }

  const activeMembers = pgMembers.filter(m =>
    m.status === 'active' || m.status === 'accepted'
  );
  const populatedMemberIds = activeMembers.map(m => userMap.get(m.userId)).filter(Boolean);

  const teacherInvites = pgMembers.filter(m => m.role === 'teacher');
  const populatedTeacherInvites = teacherInvites.map(m => ({
    lecturerUserId: userMap.get(m.userId) || null,
    requestedBy: m.invitedBy ? userMap.get(m.invitedBy) || null : null,
    status: m.status,
    respondedAt: m.lastReadAt
  }));

  const requestedByPopulated = room.requestedBy ? userMap.get(room.requestedBy) || null : null;
  const acceptedByPopulated = room.acceptedBy ? userMap.get(room.acceptedBy) || null : null;

  return {
    _id: room.id,
    id: room.id,
    type: room.type,
    name: room.name,
    groupId: groupPopulated,
    projectId: room.projectId,
    status: room.status,
    requestedBy: requestedByPopulated,
    acceptedBy: acceptedByPopulated,
    acceptedAt: room.acceptedAt,
    memberIds: populatedMemberIds,
    groupTeacherInvites: populatedTeacherInvites,
    lastMessageAt: room.lastMessageAt,
    isDeleted: room.isDeleted,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
};

const mapMessageToOldShape = async (msg) => {
  if (!msg) return null;

  const sender = await prisma.user.findUnique({
    where: { id: msg.senderId },
    select: {
      id: true,
      fullName: true,
      email: true,
      avatarUrl: true,
      roles: true
    }
  });

  const attachments = [];
  if (Array.isArray(msg.attachments)) {
    for (const att of msg.attachments) {
      let filePopulated = null;
      if (att.fileId) {
        const asset = await prisma.fileAsset.findUnique({
          where: { id: att.fileId }
        });
        if (asset) {
          filePopulated = {
            _id: asset.id,
            id: asset.id,
            originalName: asset.originalName,
            mimeClient: asset.mimeClient,
            mimeVerified: asset.mimeVerified,
            size: asset.size,
            scanStatus: asset.scanStatus,
            accessPolicy: asset.accessPolicy
          };
        }
      }
      attachments.push({
        fileId: filePopulated,
        originalName: att.originalName,
        mimeType: att.mimeType,
        size: att.size,
        kind: att.kind || 'file'
      });
    }
  }

  return {
    _id: msg.id,
    id: msg.id,
    roomId: msg.roomId,
    senderId: sender ? {
      _id: sender.id,
      id: sender.id,
      fullName: sender.fullName,
      email: sender.email,
      avatarUrl: sender.avatarUrl || '',
      roles: sender.roles
    } : null,
    body: msg.body,
    attachments,
    isDeleted: msg.isDeleted,
    deletedAt: msg.deletedAt,
    deletedBy: msg.deletedBy,
    createdAt: msg.createdAt
  };
};

// ─── SERVICES ────────────────────────────────────────────────────────────────

const getAcceptedGroupMemberUserIds = async (group) => {
  const pgGroup = await prisma.projectGroup.findUnique({
    where: { id: group._id.toString() }
  });
  if (!pgGroup) return [];

  const members = Array.isArray(pgGroup.members) ? pgGroup.members : [];
  const acceptedMembers = members.filter(m => m.status === 'accepted');
  const studentIds = acceptedMembers.map(m => m.studentId).filter(Boolean);

  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      isDeleted: false
    },
    select: { userId: true }
  });

  return students.map(s => s.userId);
};

const ensureGroupRoom = async (group) => {
  const memberIds = await getAcceptedGroupMemberUserIds(group);
  const roomId = group._id.toString();

  let room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    room = await prisma.chatRoom.create({
      data: {
        id: roomId,
        mongoId: roomId,
        type: 'group',
        name: group.name,
        groupId: roomId,
        status: 'active'
      }
    });
  } else {
    room = await prisma.chatRoom.update({
      where: { id: roomId },
      data: { name: group.name }
    });
  }

  for (const mId of memberIds) {
    const studentUserId = mId.toString();
    await prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId, userId: studentUserId } },
      create: {
        roomId,
        userId: studentUserId,
        role: 'member',
        status: 'active'
      },
      update: {
        status: 'active'
      }
    });
  }

  return room;
};

const syncGroupRoomsForUser = async (user) => {
  if (!user.studentId) return;

  const groups = await prisma.projectGroup.findMany({
    where: { isDeleted: false }
  });

  const userGroups = groups.filter(g => {
    const members = Array.isArray(g.members) ? g.members : [];
    return members.some(m => m.studentId === user.studentId.toString() && m.status === 'accepted');
  });

  await Promise.all(userGroups.map((group) => ensureGroupRoom({ _id: group.id, name: group.name })));
};

const getRooms = async (user) => {
  await syncGroupRoomsForUser(user);

  const pgMembers = await prisma.chatRoomMember.findMany({
    where: {
      userId: user._id.toString(),
      OR: [
        { status: { in: ['active', 'accepted'] } },
        { role: 'teacher', status: 'pending' },
      ],
    }
  });
  const roomIds = pgMembers.map(m => m.roomId);

  const rooms = await prisma.chatRoom.findMany({
    where: {
      id: { in: roomIds },
      isDeleted: false,
      type: { in: ['group', 'direct'] }
    },
    orderBy: [
      { lastMessageAt: 'desc' },
      { updatedAt: 'desc' }
    ]
  });

  const mappedRooms = [];
  for (const room of rooms) {
    const member = pgMembers.find(m => m.roomId === room.id);
    const lastReadAt = member?.lastReadAt;

    const unreadCount = await prisma.chatMessage.count({
      where: {
        roomId: room.id,
        isDeleted: false,
        senderId: { not: user._id.toString() },
        createdAt: { gt: lastReadAt || new Date(0) }
      }
    });

    const latestMessage = await prisma.chatMessage.findFirst({
      where: {
        roomId: room.id,
        isDeleted: false
      },
      orderBy: { createdAt: 'desc' }
    });

    const isPendingInvite = member?.role === 'teacher' && member?.status === 'pending';

    const oldShapeRoom = await mapRoomToOldShape(room, user._id.toString());
    mappedRooms.push({
      ...oldShapeRoom,
      latestMessage: isPendingInvite ? null : await mapMessageToOldShape(latestMessage),
      unreadCount
    });
  }

  return mappedRooms;
};

const getRoomForUser = async (roomId, user) => {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(roomId || '');
  if (!isObjectId) {
    throw { status: 422, message: 'Mã phòng chat không hợp lệ.' };
  }

  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false, type: { in: ['group', 'direct'] } }
  });
  if (!room) {
    throw { status: 404, message: 'Phòng chat không tồn tại.' };
  }

  const member = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user._id.toString() } }
  });

  if (!member || ['rejected', 'cancelled'].includes(member.status)) {
    throw { status: 403, message: 'Bạn không có quyền truy cập phòng chat này.' };
  }

  return await mapRoomToOldShape(room, user._id.toString());
};

const ensureStudentCanRequestDirect = (user) => {
  if (!user.studentId) {
    throw { status: 403, message: 'Chỉ sinh viên mới có thể mời thầy cô vào chat riêng.' };
  }
};

const getLecturerUserId = async ({ lecturerId, lecturerUserId }) => {
  if (lecturerUserId) {
    const lecturer = await prisma.lecturer.findFirst({
      where: { userId: lecturerUserId.toString(), isDeleted: false }
    });
    if (lecturer) return lecturer.userId;
  }
  if (lecturerId) {
    const lecturer = await prisma.lecturer.findFirst({
      where: { id: lecturerId.toString(), isDeleted: false }
    });
    if (lecturer) return lecturer.userId;
  }
  throw { status: 404, message: 'Không tìm thấy giảng viên.' };
};

const requestDirectRoom = async (user, payload = {}) => {
  ensureStudentCanRequestDirect(user);

  const lecturerUserIdObj = await getLecturerUserId(payload);
  const lecturerUserId = lecturerUserIdObj.toString();
  if (lecturerUserId === user._id.toString()) {
    throw { status: 422, message: 'Không thể tự tạo chat với chính mình.' };
  }

  const directKey = [user._id.toString(), lecturerUserId].sort().join(':');

  const existingRoom = await prisma.chatRoom.findUnique({
    where: { directKey }
  });

  if (existingRoom) {
    return await mapRoomToOldShape(existingRoom, user._id.toString());
  }

  const roomId = crypto.randomBytes(12).toString('hex');
  const now = new Date();

  const room = await prisma.chatRoom.create({
    data: {
      id: roomId,
      mongoId: roomId,
      type: 'direct',
      name: 'Chat riêng',
      status: 'pending',
      requestedBy: user._id.toString(),
      directKey,
      createdAt: now,
      updatedAt: now
    }
  });

  await prisma.chatRoomMember.create({
    data: {
      roomId,
      userId: user._id.toString(),
      role: 'member',
      status: 'active',
      joinedAt: now
    }
  });

  await prisma.chatRoomMember.create({
    data: {
      roomId,
      userId: lecturerUserId,
      role: 'teacher',
      status: 'pending',
      joinedAt: now,
      invitedBy: user._id.toString()
    }
  });

  return await mapRoomToOldShape(room, user._id.toString());
};

const acceptDirectRoom = async (roomId, user) => {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false, type: 'direct' }
  });
  if (!room) throw { status: 404, message: 'Phòng chat không tồn tại.' };

  const member = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user._id.toString() } }
  });
  if (!member) throw { status: 403, message: 'Bạn không có quyền truy cập phòng chat này.' };

  if (room.status === 'accepted') {
    return await mapRoomToOldShape(room, user._id.toString());
  }

  if (room.requestedBy === user._id.toString()) {
    throw { status: 403, message: 'Người gửi lời mời không thể tự xác nhận.' };
  }

  const now = new Date();
  const updatedRoom = await prisma.chatRoom.update({
    where: { id: roomId },
    data: {
      status: 'accepted',
      acceptedBy: user._id.toString(),
      acceptedAt: now
    }
  });

  await prisma.chatRoomMember.update({
    where: { roomId_userId: { roomId, userId: user._id.toString() } },
    data: { status: 'accepted' }
  });

  return await mapRoomToOldShape(updatedRoom, user._id.toString());
};

const assertGroupLeader = async (room, user) => {
  if (room.type !== 'group' || !room.groupId) {
    throw { status: 422, message: 'Chỉ phòng nhóm mới có cấu hình nhóm.' };
  }

  const group = await prisma.projectGroup.findUnique({
    where: { id: room.groupId }
  });
  if (!group || group.isDeleted) {
    throw { status: 404, message: 'Nhóm không tồn tại.' };
  }

  if (!user.studentId || group.leaderStudentId !== user.studentId.toString()) {
    throw { status: 403, message: 'Chỉ trưởng nhóm mới có quyền cấu hình nhóm.' };
  }

  return {
    _id: group.id,
    id: group.id,
    name: group.name,
    avatarUrl: group.avatarUrl,
    leaderStudentId: group.leaderStudentId,
    save: async function() {
      await prisma.projectGroup.update({
        where: { id: this.id },
        data: {
          name: this.name,
          avatarUrl: this.avatarUrl
        }
      });
    }
  };
};

const updateGroupSettings = async (roomId, user, payload = {}) => {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) throw { status: 404, message: 'Phòng chat không tồn tại.' };

  const group = await assertGroupLeader(room, user);

  let nextName = room.name;
  if (payload.name !== undefined) {
    nextName = String(payload.name || '').trim();
    if (!nextName) throw { status: 422, message: 'Tên nhóm không hợp lệ.' };
    group.name = nextName;
  }

  if (payload.avatarUrl !== undefined) {
    const avatarUrl = String(payload.avatarUrl || '').trim();
    if (avatarUrl && !avatarUrl.startsWith('http')) {
      throw { status: 422, message: 'Ảnh nhóm phải là URL online.' };
    }
    group.avatarUrl = avatarUrl;
  }

  await group.save();

  const updatedRoom = await prisma.chatRoom.update({
    where: { id: roomId },
    data: { name: nextName }
  });

  return await mapRoomToOldShape(updatedRoom, user._id.toString());
};

const uploadGroupAvatar = async (roomId, user, file) => {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) throw { status: 404, message: 'Phòng chat không tồn tại.' };

  const group = await assertGroupLeader(room, user);

  if (!file) throw { status: 400, message: 'Vui lòng chọn ảnh nhóm.' };

  const allowedMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const extension = allowedMime[file.mimetype];
  if (!extension) {
    throw { status: 400, message: 'Ảnh nhóm chỉ hỗ trợ JPG, PNG hoặc WEBP.' };
  }

  const publicId = `${group.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const fileName = `${publicId}${extension}`;
  const uploadResult = await uploadImageBuffer(file.buffer, {
    folder: 'management-project/group-avatars',
    publicId,
    filename: fileName,
  });

  group.avatarUrl = uploadResult.secure_url;
  await group.save();

  return await mapRoomToOldShape(room, user._id.toString());
};

const inviteLecturerToGroup = async (roomId, user, payload = {}) => {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) throw { status: 404, message: 'Phòng chat không tồn tại.' };

  await assertGroupLeader(room, user);
  const lecturerUserIdObj = await getLecturerUserId(payload);
  const lecturerUserId = lecturerUserIdObj.toString();

  const invite = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: lecturerUserId } }
  });

  if (invite) {
    if (invite.status === 'accepted') {
      throw { status: 400, message: 'Thầy/cô đã ở trong nhóm chat này.' };
    }
    await prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId: lecturerUserId } },
      data: {
        status: 'pending',
        invitedBy: user._id.toString(),
        lastReadAt: null
      }
    });
  } else {
    await prisma.chatRoomMember.create({
      data: {
        roomId,
        userId: lecturerUserId,
        role: 'teacher',
        status: 'pending',
        invitedBy: user._id.toString()
      }
    });
  }

  await createChatAuditEvent({
    roomId,
    user,
    action: 'INVITE_LECTURER_TO_CHAT_GROUP',
    reason: 'Mời giảng viên vào nhóm chat.',
    metadata: { lecturerUserId },
  });

  return await mapRoomToOldShape(room, user._id.toString());
};

const acceptGroupInvite = async (roomId, user) => {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) throw { status: 404, message: 'Phòng chat không tồn tại.' };

  const invite = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user._id.toString() } }
  });

  if (!invite || invite.role !== 'teacher' || invite.status !== 'pending') {
    throw { status: 404, message: 'Không tìm thấy lời mời vào nhóm chat.' };
  }

  await prisma.chatRoomMember.update({
    where: { roomId_userId: { roomId, userId: user._id.toString() } },
    data: {
      status: 'accepted',
      lastReadAt: new Date()
    }
  });

  return await mapRoomToOldShape(room, user._id.toString());
};

const getMessages = async (roomId, user, { limit = 50, before } = {}) => {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) return [];

  const member = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user._id.toString() } }
  });
  if (!member || ['rejected', 'pending'].includes(member.status)) {
    return [];
  }

  const where = { roomId, isDeleted: false };
  if (before && !Number.isNaN(Date.parse(before))) {
    where.createdAt = { lt: new Date(before) };
  }

  const messages = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 50, 100)
  });

  const mappedMessages = [];
  for (const msg of messages) {
    mappedMessages.push(await mapMessageToOldShape(msg));
  }

  return mappedMessages.reverse();
};

const markRoomRead = async (roomId, user) => {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) return { modifiedCount: 0 };

  const member = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user._id.toString() } }
  });
  if (!member || ['rejected', 'pending'].includes(member.status)) {
    return { modifiedCount: 0 };
  }

  await prisma.chatRoomMember.update({
    where: { roomId_userId: { roomId, userId: user._id.toString() } },
    data: { lastReadAt: new Date() }
  });

  return { modifiedCount: 1 };
};

const sendMessage = async (roomId, user, body) => {
  const text = String(body || '').trim();
  if (!text) {
    throw { status: 422, message: 'Vui lòng nhập nội dung tin nhắn.' };
  }
  if (text.length > 4000) {
    throw { status: 422, message: 'Tin nhắn không được vượt quá 4000 ký tự.' };
  }

  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) throw { status: 404, message: 'Phòng chat không tồn tại.' };

  const member = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user._id.toString() } }
  });
  if (!member || member.status === 'rejected' || (member.role === 'teacher' && member.status === 'pending')) {
    throw { status: 403, message: 'Bạn không có quyền nhắn tin trong phòng này.' };
  }

  if (room.type === 'direct' && room.status !== 'accepted') {
    if (room.requestedBy === user._id.toString()) {
      throw { status: 403, message: 'Vui lòng chờ thầy cô xác nhận lời mời chat.' };
    }
    throw { status: 403, message: 'Bạn cần xác nhận lời mời trước khi nhắn tin.' };
  }

  const messageId = crypto.randomBytes(12).toString('hex');
  const now = new Date();

  const msg = await prisma.chatMessage.create({
    data: {
      id: messageId,
      mongoId: messageId,
      roomId,
      senderId: user._id.toString(),
      body: text,
      attachments: [],
      createdAt: now
    }
  });

  await prisma.chatRoom.update({
    where: { id: roomId },
    data: { lastMessageAt: now }
  });

  await prisma.chatRoomMember.update({
    where: { roomId_userId: { roomId, userId: user._id.toString() } },
    data: { lastReadAt: now }
  });

  const oldShapeRoom = await mapRoomToOldShape(room, user._id.toString());
  const populatedMessage = await mapMessageToOldShape(msg);
  await notifyRoomMembers(oldShapeRoom, user, populatedMessage);
  return populatedMessage;
};

const sendAttachmentMessage = async (roomId, user, { body, file } = {}) => {
  const text = String(body || '').trim();
  if (!file) {
    throw { status: 400, message: 'Vui lòng chọn tệp cần gửi.' };
  }
  if (text.length > 4000) {
    throw { status: 422, message: 'Tin nhắn không được vượt quá 4000 ký tự.' };
  }

  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) throw { status: 404, message: 'Phòng chat không tồn tại.' };

  const member = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user._id.toString() } }
  });
  if (!member || member.status === 'rejected' || (member.role === 'teacher' && member.status === 'pending')) {
    throw { status: 403, message: 'Bạn không có quyền nhắn tin trong phòng này.' };
  }

  if (room.type === 'direct' && room.status !== 'accepted') {
    if (room.requestedBy === user._id.toString()) {
      throw { status: 403, message: 'Vui lòng chờ thầy cô xác nhận lời mời chat.' };
    }
    throw { status: 403, message: 'Bạn cần xác nhận lời mời trước khi nhắn tin.' };
  }

  const asset = await filesService.uploadFile(file, 'chat_room', roomId, user);
  const mimeType = asset.mimeVerified || asset.mimeClient;
  const messageId = crypto.randomBytes(12).toString('hex');
  const now = new Date();

  const msg = await prisma.chatMessage.create({
    data: {
      id: messageId,
      mongoId: messageId,
      roomId,
      senderId: user._id.toString(),
      body: text,
      attachments: [{
        fileId: asset._id.toString(),
        originalName: asset.originalName,
        mimeType,
        size: asset.size,
        kind: getAttachmentKind(mimeType)
      }],
      createdAt: now
    }
  });

  await prisma.chatRoom.update({
    where: { id: roomId },
    data: { lastMessageAt: now }
  });

  await prisma.chatRoomMember.update({
    where: { roomId_userId: { roomId, userId: user._id.toString() } },
    data: { lastReadAt: now }
  });

  const oldShapeRoom = await mapRoomToOldShape(room, user._id.toString());
  const populatedMessage = await mapMessageToOldShape(msg);
  await notifyRoomMembers(oldShapeRoom, user, populatedMessage);

  await createChatAuditEvent({
    roomId,
    user,
    action: 'CHAT_SEND_ATTACHMENT',
    reason: 'Gửi tệp trong phòng chat.',
    metadata: {
      messageId,
      fileName: asset.originalName,
      fileSize: asset.size,
      mimeType
    }
  });

  return populatedMessage;
};

const deleteMessage = async (roomId, messageId, user) => {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, isDeleted: false }
  });
  if (!room) throw { status: 404, message: 'Phòng chat không tồn tại.' };

  const member = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user._id.toString() } }
  });
  if (!member || ['rejected', 'pending'].includes(member.status)) {
    throw { status: 403, message: 'Bạn không có quyền thu hồi tin nhắn trong phòng này.' };
  }

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, roomId, isDeleted: false }
  });
  if (!message) throw { status: 404, message: 'Tin nhắn không tồn tại.' };

  if (message.senderId !== user._id.toString()) {
    throw { status: 403, message: 'Bạn chỉ có thể thu hồi tin nhắn của chính mình.' };
  }

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user._id.toString()
    }
  });

  const latest = await prisma.chatMessage.findFirst({
    where: { roomId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });

  await prisma.chatRoom.update({
    where: { id: roomId },
    data: { lastMessageAt: latest?.createdAt || null }
  });

  await createChatAuditEvent({
    roomId,
    user,
    action: 'CHAT_RECALL_MESSAGE',
    reason: 'Thu hồi tin nhắn trong phòng chat.',
    metadata: { messageId }
  });

  return { roomId, messageId };
};

module.exports = {
  getRooms,
  getRoomForUser,
  getMessages,
  markRoomRead,
  sendMessage,
  sendAttachmentMessage,
  deleteMessage,
  requestDirectRoom,
  acceptDirectRoom,
  updateGroupSettings,
  uploadGroupAvatar,
  inviteLecturerToGroup,
  acceptGroupInvite,
};
