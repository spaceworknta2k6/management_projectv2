const submissionsService = require('./submissions.service');

const initializePackage = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới được quyền khởi tạo gói nộp bài.' });
    }
    const result = await submissionsService.initializePackage(req.body.projectId, req.body.phase, req.user._id, req.user.studentId);
    return res.status(201).json({
      success: true,
      message: 'Khởi tạo gói hồ sơ nộp đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const uploadPackageItem = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới được quyền tải lên tài liệu.' });
    }
    const result = await submissionsService.uploadPackageItem(req.params.id, req.body.type, req.body.fileId, req.user._id, req.user.studentId);
    return res.status(200).json({
      success: true,
      message: 'Tải lên tài liệu nộp thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const submitPackage = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới có quyền nộp gói hồ sơ.' });
    }
    const result = await submissionsService.submitPackage(req.params.id, req.user._id, req.user.studentId);
    return res.status(200).json({
      success: true,
      message: 'Gửi gói hồ sơ nộp đồ án tốt nghiệp thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const reviewPackageItem = async (req, res, next) => {
  try {
    if (!req.user.lecturerId) {
      return res.status(403).json({ success: false, message: 'Chỉ giảng viên được phân công mới có quyền đánh giá hồ sơ.' });
    }
    const result = await submissionsService.reviewPackageItem(req.params.id, req.body.type, req.body.status, req.user._id, req.user.lecturerId);
    return res.status(200).json({
      success: true,
      message: 'Đã lưu kết quả nhận xét tài liệu đồ án thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getPackageById = async (req, res, next) => {
  try {
    const result = await submissionsService.getPackageById(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết gói hồ sơ nộp đồ án thành công!',
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
  initializePackage,
  uploadPackageItem,
  submitPackage,
  reviewPackageItem,
  getPackageById,
};
