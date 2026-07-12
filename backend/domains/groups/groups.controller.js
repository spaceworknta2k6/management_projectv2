const groupsService = require('./groups.service');

const createGroup = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới được quyền lập nhóm đồ án.' });
    }
    const result = await groupsService.createGroup(req.body.periodId, req.body.name, req.user.studentId);
    return res.status(201).json({
      success: true,
      message: 'Khởi tạo nhóm đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const inviteMember = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ trưởng nhóm sinh viên mới có quyền mời thành viên.' });
    }
    const result = await groupsService.inviteMember(req.params.id, req.body.studentId || req.body.studentCode || req.body.email, req.user.studentId);
    return res.status(200).json({
      success: true,
      message: 'Đã gửi lời mời tham gia nhóm thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const acceptInvitation = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới có quyền đồng ý lời mời.' });
    }
    const result = await groupsService.acceptInvitation(req.params.id, req.user.studentId);
    return res.status(200).json({
      success: true,
      message: 'Đồng ý gia nhập nhóm đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const confirmGroup = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ trưởng nhóm mới được quyền xác nhận chốt danh sách.' });
    }
    const result = await groupsService.confirmGroup(req.params.id, req.user.studentId);
    return res.status(200).json({
      success: true,
      message: 'Xác nhận danh sách nhóm đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const updateGroup = async (req, res, next) => {
  try {
    const result = await groupsService.updateGroup(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: 'Cập nhật nhóm đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const deleteGroup = async (req, res, next) => {
  try {
    const result = await groupsService.deleteGroup(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const cancelLinkedWorkAndDeleteGroup = async (req, res, next) => {
  try {
    const result = await groupsService.cancelLinkedWorkAndDeleteGroup(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        cancelledProjects: result.cancelledProjects,
        cancelledTopics: result.cancelledTopics,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getGroups = async (req, res, next) => {
  try {
    const result = await groupsService.getGroupsByPeriod(req.query.periodId, req.user);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách nhóm đồ án thành công!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getGroupById = async (req, res, next) => {
  try {
    const result = await groupsService.getGroupById(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin nhóm đồ án chi tiết thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  createGroup,
  inviteMember,
  acceptInvitation,
  confirmGroup,
  updateGroup,
  deleteGroup,
  cancelLinkedWorkAndDeleteGroup,
  getGroups,
  getGroupById,
};
