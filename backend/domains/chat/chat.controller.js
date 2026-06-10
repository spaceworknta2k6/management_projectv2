const chatService = require('./chat.service');

const getRooms = async (req, res, next) => {
  try {
    const rooms = await chatService.getRooms(req.user);
    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const messages = await chatService.getMessages(req.params.roomId, req.user, req.query);
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const message = await chatService.sendMessage(req.params.roomId, req.user, req.body?.body);
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

const requestDirectRoom = async (req, res, next) => {
  try {
    const room = await chatService.requestDirectRoom(req.user, req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

const acceptDirectRoom = async (req, res, next) => {
  try {
    const room = await chatService.acceptDirectRoom(req.params.roomId, req.user);
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

const updateGroupSettings = async (req, res, next) => {
  try {
    const room = await chatService.updateGroupSettings(req.params.roomId, req.user, req.body);
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

const uploadGroupAvatar = async (req, res, next) => {
  try {
    const room = await chatService.uploadGroupAvatar(req.params.roomId, req.user, req.file);
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

const inviteLecturerToGroup = async (req, res, next) => {
  try {
    const room = await chatService.inviteLecturerToGroup(req.params.roomId, req.user, req.body);
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

const acceptGroupInvite = async (req, res, next) => {
  try {
    const room = await chatService.acceptGroupInvite(req.params.roomId, req.user);
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRooms,
  getMessages,
  sendMessage,
  requestDirectRoom,
  acceptDirectRoom,
  updateGroupSettings,
  uploadGroupAvatar,
  inviteLecturerToGroup,
  acceptGroupInvite,
};
