const milestonesService = require('./milestones.service');

const createMilestone = async (req, res, next) => {
  try {
    if (!req.user.lecturerId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản giảng viên hướng dẫn mới được phép tạo mốc tiến độ.' });
    }
    const result = await milestonesService.createMilestone(req.params.projectId, req.body, req.user._id, req.user.lecturerId);
    return res.status(201).json({
      success: true,
      message: 'Tạo mốc tiến độ đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const submitMilestoneWork = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới được quyền nộp báo cáo mốc tiến độ.' });
    }
    const result = await milestonesService.submitMilestoneWork(req.params.id, req.body, req.user._id, req.user.studentId);
    return res.status(200).json({
      success: true,
      message: 'Nộp báo cáo mốc tiến độ thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const submitFeedback = async (req, res, next) => {
  try {
    if (!req.user.lecturerId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản giảng viên mới được phép đánh giá mốc tiến độ.' });
    }
    const result = await milestonesService.submitFeedback(req.params.id, req.body, req.user._id, req.user.lecturerId);
    return res.status(200).json({
      success: true,
      message: 'Nhận xét và đánh giá mốc tiến độ thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const lockMilestone = async (req, res, next) => {
  try {
    if (!req.user.lecturerId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản giảng viên hướng dẫn mới được phép khóa mốc tiến độ.' });
    }
    const result = await milestonesService.lockMilestone(req.params.id, req.user._id, req.user.lecturerId);
    return res.status(200).json({
      success: true,
      message: 'Đã khóa mốc tiến độ thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getMilestones = async (req, res, next) => {
  try {
    const result = await milestonesService.getMilestonesByProject(req.params.projectId);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách mốc tiến độ của dự án thành công!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMilestone,
  submitMilestoneWork,
  submitFeedback,
  lockMilestone,
  getMilestones,
};
