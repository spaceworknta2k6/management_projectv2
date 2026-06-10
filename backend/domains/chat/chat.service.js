const mongoose = require('mongoose');
const crypto = require('crypto');
const ChatRoom = require('../../models/ChatRoom');
const ChatMessage = require('../../models/ChatMessage');
const ProjectGroup = require('../../models/ProjectGroup');
const Lecturer = require('../../models/Lecturer');
const { uploadImageBuffer } = require('../../config/cloudinary');

const toId = (value) => String(value?._id || value || '');

const hasRoomAccess = (room, user) => {
  return (room.memberIds || []).some((memberId) => toId(memberId) === toId(user._id));
};

const populateRoom = (query) => query
  .populate('groupId', 'name status avatarUrl')
  .populate('memberIds', 'fullName email avatarUrl roles')
  .populate('groupTeacherInvites.lecturerUserId', 'fullName email avatarUrl roles')
  .populate('requestedBy', 'fullName email avatarUrl roles')
  .populate('acceptedBy', 'fullName email avatarUrl roles');

const populateMessage = (query) => query.populate('senderId', 'fullName email avatarUrl roles');

const getAcceptedGroupMemberUserIds = async (group) => {
  const populatedGroup = await ProjectGroup.findById(group._id)
    .populate({
      path: 'members.studentId',
      select: 'userId isDeleted',
      match: { isDeleted: false },
    });

  return (populatedGroup?.members || [])
    .filter((member) => member.status === 'accepted' && member.studentId?.userId)
    .map((member) => member.studentId.userId);
};

const ensureGroupRoom = async (group) => {
  const memberIds = await getAcceptedGroupMemberUserIds(group);
  const existingRoom = await ChatRoom.findOne({ type: 'group', groupId: group._id, isDeleted: false });
  const acceptedTeacherIds = (existingRoom?.groupTeacherInvites || [])
    .filter((invite) => invite.status === 'accepted' && invite.lecturerUserId)
    .map((invite) => invite.lecturerUserId);
  const allMemberIds = [...new Set([...memberIds, ...acceptedTeacherIds].map(toId))]
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id));
  return await ChatRoom.findOneAndUpdate(
    { type: 'group', groupId: group._id, isDeleted: false },
    {
      $set: {
        name: group.name,
        memberIds: allMemberIds,
        status: 'active',
      },
      $setOnInsert: {
        type: 'group',
        groupId: group._id,
      },
    },
    { returnDocument: 'after', upsert: true }
  );
};

const syncGroupRoomsForUser = async (user) => {
  if (!user.studentId) return;

  const groups = await ProjectGroup.find({
    isDeleted: false,
    members: {
      $elemMatch: {
        studentId: user.studentId,
        status: 'accepted',
      },
    },
  }).select('name members');

  await Promise.all(groups.map((group) => ensureGroupRoom(group)));
};

const getRooms = async (user) => {
  await syncGroupRoomsForUser(user);

  const rooms = await populateRoom(
    ChatRoom.find({
      isDeleted: false,
      type: { $in: ['group', 'direct'] },
      $or: [
        { memberIds: user._id },
        { 'groupTeacherInvites.lecturerUserId': user._id },
      ],
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
  ).lean();
  const roomIds = rooms.map((room) => room._id);
  const latestMessages = await ChatMessage.aggregate([
    { $match: { roomId: { $in: roomIds }, isDeleted: false } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$roomId', latest: { $first: '$$ROOT' } } },
  ]);
  const latestByRoom = new Map(latestMessages.map((item) => [toId(item._id), item.latest]));

  return rooms.map((room) => ({
    ...room,
    latestMessage: (room.groupTeacherInvites || []).some(
      (invite) => toId(invite.lecturerUserId) === toId(user._id) && invite.status === 'pending'
    ) ? null : latestByRoom.get(toId(room._id)) || null,
  }));
};

const getRoomForUser = async (roomId, user) => {
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    throw { status: 422, message: 'Mã phòng chat không hợp lệ.' };
  }

  const room = await populateRoom(ChatRoom.findOne({ _id: roomId, isDeleted: false, type: { $in: ['group', 'direct'] } }));
  if (!room) {
    throw { status: 404, message: 'Phòng chat không tồn tại.' };
  }
  if (!hasRoomAccess(room, user)) {
    const pendingGroupInvite = room.type === 'group' && (room.groupTeacherInvites || [])
      .some((invite) => toId(invite.lecturerUserId) === toId(user._id));
    if (!pendingGroupInvite) {
      throw { status: 403, message: 'Bạn không có quyền truy cập phòng chat này.' };
    }
  }

  return room;
};

const ensureStudentCanRequestDirect = (user) => {
  if (!user.studentId) {
    throw { status: 403, message: 'Chỉ sinh viên mới có thể mời thầy cô vào chat riêng.' };
  }
};

const getLecturerUserId = async ({ lecturerId, lecturerUserId }) => {
  if (lecturerUserId && mongoose.Types.ObjectId.isValid(lecturerUserId)) {
    const lecturer = await Lecturer.findOne({ userId: lecturerUserId, isDeleted: false });
    if (lecturer) return lecturer.userId;
  }

  if (lecturerId && mongoose.Types.ObjectId.isValid(lecturerId)) {
    const lecturer = await Lecturer.findOne({ _id: lecturerId, isDeleted: false });
    if (lecturer) return lecturer.userId;
  }

  throw { status: 404, message: 'Không tìm thấy giảng viên.' };
};

const getDirectMemberKey = (userA, userB) => [toId(userA), toId(userB)].sort();

const requestDirectRoom = async (user, payload = {}) => {
  ensureStudentCanRequestDirect(user);

  const lecturerUserId = await getLecturerUserId(payload);
  if (toId(lecturerUserId) === toId(user._id)) {
    throw { status: 422, message: 'Không thể tự tạo chat với chính mình.' };
  }

  const [firstMemberId, secondMemberId] = getDirectMemberKey(user._id, lecturerUserId)
    .map((id) => new mongoose.Types.ObjectId(id));
  const existingRoom = await ChatRoom.findOne({
    type: 'direct',
    isDeleted: false,
    memberIds: { $all: [firstMemberId, secondMemberId], $size: 2 },
  });

  if (existingRoom) {
    return await populateRoom(ChatRoom.findById(existingRoom._id)).lean();
  }

  const room = await ChatRoom.create({
    type: 'direct',
    name: 'Chat riêng',
    status: 'pending',
    memberIds: [firstMemberId, secondMemberId],
    requestedBy: user._id,
  });

  return await populateRoom(ChatRoom.findById(room._id)).lean();
};

const acceptDirectRoom = async (roomId, user) => {
  const room = await getRoomForUser(roomId, user);
  if (room.type !== 'direct') {
    throw { status: 422, message: 'Chỉ chat riêng mới cần xác nhận lời mời.' };
  }
  if (room.status === 'accepted') return room;
  if (toId(room.requestedBy) === toId(user._id)) {
    throw { status: 403, message: 'Người gửi lời mời không thể tự xác nhận.' };
  }

  room.status = 'accepted';
  room.acceptedBy = user._id;
  room.acceptedAt = new Date();
  await room.save();
  return await populateRoom(ChatRoom.findById(room._id)).lean();
};

const getPendingGroupInvite = (room, user) => {
  if (room.type !== 'group') return null;
  return (room.groupTeacherInvites || [])
    .find((invite) => toId(invite.lecturerUserId) === toId(user._id) && invite.status === 'pending');
};

const assertGroupLeader = async (room, user) => {
  if (room.type !== 'group' || !room.groupId?._id) {
    throw { status: 422, message: 'Chỉ phòng nhóm mới có cấu hình nhóm.' };
  }
  const group = await ProjectGroup.findOne({ _id: room.groupId._id, isDeleted: { $ne: true } });
  if (!group) {
    throw { status: 404, message: 'Nhóm không tồn tại.' };
  }
  if (!user.studentId || toId(group.leaderStudentId) !== toId(user.studentId)) {
    throw { status: 403, message: 'Chỉ trưởng nhóm mới có quyền cấu hình nhóm.' };
  }
  return group;
};

const updateGroupSettings = async (roomId, user, payload = {}) => {
  const room = await getRoomForUser(roomId, user);
  const group = await assertGroupLeader(room, user);

  if (payload.name !== undefined) {
    const nextName = String(payload.name || '').trim();
    if (!nextName) {
      throw { status: 422, message: 'Tên nhóm không hợp lệ.' };
    }
    group.name = nextName;
    room.name = nextName;
  }

  if (payload.avatarUrl !== undefined) {
    const avatarUrl = String(payload.avatarUrl || '').trim();
    if (avatarUrl && !avatarUrl.startsWith('http')) {
      throw { status: 422, message: 'Ảnh nhóm phải là URL online.' };
    }
    group.avatarUrl = avatarUrl;
  }

  await group.save();
  await room.save();
  return await populateRoom(ChatRoom.findById(room._id)).lean();
};

const uploadGroupAvatar = async (roomId, user, file) => {
  const room = await getRoomForUser(roomId, user);
  const group = await assertGroupLeader(room, user);

  if (!file) {
    throw { status: 400, message: 'Vui lòng chọn ảnh nhóm.' };
  }

  const allowedMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const extension = allowedMime[file.mimetype];
  if (!extension) {
    throw { status: 400, message: 'Ảnh nhóm chỉ hỗ trợ JPG, PNG hoặc WEBP.' };
  }

  const publicId = `${group._id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const fileName = `${publicId}${extension}`;
  const uploadResult = await uploadImageBuffer(file.buffer, {
    folder: 'management-project/group-avatars',
    publicId,
    filename: fileName,
  });

  group.avatarUrl = uploadResult.secure_url;
  await group.save();

  return await populateRoom(ChatRoom.findById(room._id)).lean();
};

const inviteLecturerToGroup = async (roomId, user, payload = {}) => {
  const room = await getRoomForUser(roomId, user);
  await assertGroupLeader(room, user);
  const lecturerUserId = await getLecturerUserId(payload);

  const invite = (room.groupTeacherInvites || [])
    .find((item) => toId(item.lecturerUserId) === toId(lecturerUserId));
  if (invite) {
    if (invite.status === 'accepted') {
      throw { status: 400, message: 'Thầy/cô đã ở trong nhóm chat này.' };
    }
    invite.status = 'pending';
    invite.requestedBy = user._id;
    invite.respondedAt = undefined;
  } else {
    room.groupTeacherInvites.push({
      lecturerUserId,
      requestedBy: user._id,
      status: 'pending',
    });
  }

  await room.save();
  return await populateRoom(ChatRoom.findById(room._id)).lean();
};

const acceptGroupInvite = async (roomId, user) => {
  const room = await getRoomForUser(roomId, user);
  const invite = getPendingGroupInvite(room, user);
  if (!invite) {
    throw { status: 404, message: 'Không tìm thấy lời mời vào nhóm chat.' };
  }

  invite.status = 'accepted';
  invite.respondedAt = new Date();
  if (!(room.memberIds || []).some((memberId) => toId(memberId) === toId(user._id))) {
    room.memberIds.push(user._id);
  }
  await room.save();
  return await populateRoom(ChatRoom.findById(room._id)).lean();
};

const assertRoomCanSend = (room, user) => {
  if (room.type === 'direct' && room.status !== 'accepted') {
    if (toId(room.requestedBy) === toId(user._id)) {
      throw { status: 403, message: 'Vui lòng chờ thầy cô xác nhận lời mời chat.' };
    }
    throw { status: 403, message: 'Bạn cần xác nhận lời mời trước khi nhắn tin.' };
  }
  if (getPendingGroupInvite(room, user)) {
    throw { status: 403, message: 'Bạn cần chấp nhận lời mời vào nhóm trước khi nhắn tin.' };
  }
};

const getMessages = async (roomId, user, { limit = 50, before } = {}) => {
  const room = await getRoomForUser(roomId, user);
  if ((room.type === 'direct' && room.status !== 'accepted') || getPendingGroupInvite(room, user)) {
    return [];
  }

  const filter = { roomId, isDeleted: false };
  if (before && !Number.isNaN(Date.parse(before))) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const messages = await populateMessage(
    ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 100))
  ).lean();

  return messages.reverse();
};

const sendMessage = async (roomId, user, body) => {
  const text = String(body || '').trim();
  if (!text) {
    throw { status: 422, message: 'Vui lòng nhập nội dung tin nhắn.' };
  }
  if (text.length > 4000) {
    throw { status: 422, message: 'Tin nhắn không được vượt quá 4000 ký tự.' };
  }

  const room = await getRoomForUser(roomId, user);
  assertRoomCanSend(room, user);

  const message = await ChatMessage.create({
    roomId,
    senderId: user._id,
    body: text,
    readBy: [{ userId: user._id }],
  });

  await ChatRoom.findByIdAndUpdate(roomId, { lastMessageAt: message.createdAt });
  return await populateMessage(ChatMessage.findById(message._id)).lean();
};

module.exports = {
  getRooms,
  getRoomForUser,
  getMessages,
  sendMessage,
  requestDirectRoom,
  acceptDirectRoom,
  updateGroupSettings,
  uploadGroupAvatar,
  inviteLecturerToGroup,
  acceptGroupInvite,
};
