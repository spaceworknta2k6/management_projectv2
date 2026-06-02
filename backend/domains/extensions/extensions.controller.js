const extensionsService = require('./extensions.service');

const createExtensionRequest = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới được quyền xin gia hạn mốc.' });
    }
    const result = await extensionsService.createExtensionRequest(req.body, req.user._id, req.user.studentId);
    return res.status(201).json({
      success: true,
      message: 'Nộp yêu cầu xin gia hạn mốc thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const supervisorRecommend = async (req, res, next) => {
  try {
    if (!req.user.lecturerId) {
      return res.status(403).json({ success: false, message: 'Chỉ giảng viên hướng dẫn mới có quyền nhận xét khuyến nghị gia hạn.' });
    }
    const result = await extensionsService.supervisorRecommend(req.params.id, req.body.status, req.body.note, req.user._id, req.user.lecturerId);
    return res.status(200).json({
      success: true,
      message: 'Ghi nhận ý kiến khuyến nghị của GVHD thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const facultyDecide = async (req, res, next) => {
  try {
    const result = await extensionsService.facultyDecide(req.params.id, req.body.status, req.body.note, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Quyết định phê duyệt gia hạn của Giáo vụ thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getRequests = async (req, res, next) => {
  try {
    const result = await extensionsService.getRequests(req.query);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách yêu cầu gia hạn thành công!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getRequestById = async (req, res, next) => {
  try {
    const result = await extensionsService.getRequestById(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết yêu cầu gia hạn thành công!',
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
  createExtensionRequest,
  supervisorRecommend,
  facultyDecide,
  getRequests,
  getRequestById,
};
