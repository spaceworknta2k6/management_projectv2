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
    const result = await topicsService.reviewTopic(req.params.id, 'approve', req.user._id, req.body.note);
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
    const result = await topicsService.reviewTopic(req.params.id, 'reject', req.user._id, req.body.note);
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
    const result = await topicsService.reviewTopic(req.params.id, 'request-revision', req.user._id, req.body.note);
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

module.exports = {
  proposeTopic,
  approveTopic,
  rejectTopic,
  requestRevision,
  assignSupervisor,
  getTopics,
  getTopicById,
};
