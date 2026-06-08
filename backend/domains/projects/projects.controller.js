const projectsService = require('./projects.service');

const getProjects = async (req, res, next) => {
  try {
    const result = await projectsService.getProjects(req.query, req.user);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách dự án thành công!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const result = await projectsService.getProjectById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin dự án chi tiết thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const markInProgress = async (req, res, next) => {
  try {
    const result = await projectsService.markInProgress(req.params.id, req.user._id, req.user.studentId);
    return res.status(200).json({
      success: true,
      message: 'Dự án đồ án đã chính thức bắt đầu thực hiện!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const assignReviewer = async (req, res, next) => {
  try {
    const result = await projectsService.assignReviewer(req.params.id, req.body.reviewerId, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Đã phân công giảng viên phản biện thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const markDefenseEligible = async (req, res, next) => {
  try {
    const result = await projectsService.markDefenseEligible(req.params.id, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Duyệt đủ điều kiện bảo vệ đồ án tốt nghiệp thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const finalizeProject = async (req, res, next) => {
  try {
    const result = await projectsService.finalizeProject(req.params.id, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Dự án đồ án đã hoàn tất thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const cancelProject = async (req, res, next) => {
  try {
    const result = await projectsService.cancelProject(req.params.id, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Đã hủy bỏ dự án đồ án tốt nghiệp thành công!',
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
  getProjects,
  getProjectById,
  markInProgress,
  assignReviewer,
  markDefenseEligible,
  finalizeProject,
  cancelProject,
};
