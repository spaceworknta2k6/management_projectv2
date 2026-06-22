const topicsService = require('./topics.service');

const proposeTopic = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới có quyền đề xuất đề tài đồ án.' });
    }
    const result = await topicsService.proposeTopic(req.body, req.user.studentId);
    return res.status(201).json({
      success: true,
      message: 'Đề xuất đề tài đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const approveTopic = async (req, res, next) => {
  try {
    const result = await topicsService.reviewTopic(req.params.id, 'approve', req.user, req.body.note);
    return res.status(200).json({
      success: true,
      message: 'Đã phê duyệt đề tài đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const rejectTopic = async (req, res, next) => {
  try {
    const result = await topicsService.reviewTopic(req.params.id, 'reject', req.user, req.body.note);
    return res.status(200).json({
      success: true,
      message: 'Đã từ chối đề tài đồ án!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const requestRevision = async (req, res, next) => {
  try {
    const result = await topicsService.reviewTopic(req.params.id, 'request-revision', req.user, req.body.note);
    return res.status(200).json({
      success: true,
      message: 'Đã gửi yêu cầu chỉnh sửa đề cương sơ bộ thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const assignSupervisor = async (req, res, next) => {
  try {
    const result = await topicsService.assignSupervisor(req.params.id, req.body.supervisorId, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Đã phân công giảng viên hướng dẫn chính thức và khởi tạo dự án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const cancelTopic = async (req, res, next) => {
  try {
    const result = await topicsService.cancelTopic(req.params.id, req.user._id, req.user.roles);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        cancelledProjects: result.cancelledProjects,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getTopics = async (req, res, next) => {
  try {
    const result = await topicsService.getTopicsByPeriod(req.query.periodId);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đề tài đồ án thành công!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getTopicById = async (req, res, next) => {
  try {
    const result = await topicsService.getTopicById(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin đề tài đồ án chi tiết thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const updateTopic = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới có quyền cập nhật đề tài đồ án.' });
    }
    const result = await topicsService.updateTopic(req.params.id, req.body, req.user.studentId);
    return res.status(200).json({
      success: true,
      message: 'Cập nhật đề tài đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const createLecturerTopic = async (req, res, next) => {
  try {
    if (!req.user.lecturerId && !req.user.roles.includes('SYSTEM_ADMIN') && !req.user.roles.includes('FACULTY_STAFF')) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản giảng viên hoặc giáo vụ mới có quyền tạo đề tài.' });
    }
    const result = await topicsService.createLecturerTopic(req.body, req.user.lecturerId, req.user._id);
    return res.status(201).json({
      success: true,
      message: 'Giảng viên tạo đề tài thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const registerTopic = async (req, res, next) => {
  try {
    const result = await topicsService.registerExistingTopic(req.params.id, req.body, req.user.studentId, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Đăng ký đề tài thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const publishTopic = async (req, res, next) => {
  try {
    const result = await topicsService.publishTopic(req.params.id, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Đã công khai đề tài thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const unpublishTopic = async (req, res, next) => {
  try {
    const result = await topicsService.unpublishTopic(req.params.id, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Đã gỡ công khai đề tài thành công!',
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
  proposeTopic,
  updateTopic,
  approveTopic,
  rejectTopic,
  requestRevision,
  assignSupervisor,
  cancelTopic,
  getTopics,
  getTopicById,
  createLecturerTopic,
  registerTopic,
  publishTopic,
  unpublishTopic,
};
