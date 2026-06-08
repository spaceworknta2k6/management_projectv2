const periodsService = require('./periods.service');

const createPeriod = async (req, res, next) => {
  try {
    const period = await periodsService.createPeriod(req.body, req.user._id);
    return res.status(201).json({
      success: true,
      message: 'Khởi tạo đợt đồ án thành công!',
      data: period,
    });
  } catch (error) {
    next(error);
  }
};

const getPeriods = async (req, res, next) => {
  try {
    const periods = await periodsService.getAllPeriods(req.query);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đợt đồ án thành công!',
      data: periods,
    });
  } catch (error) {
    next(error);
  }
};

const getPeriodById = async (req, res, next) => {
  try {
    const period = await periodsService.getPeriodById(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết đợt đồ án thành công!',
      data: period,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const updatePeriod = async (req, res, next) => {
  try {
    const period = await periodsService.updatePeriod(req.params.id, req.body, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Cập nhật đợt đồ án thành công!',
      data: period,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const deletePeriod = async (req, res, next) => {
  try {
    const result = await periodsService.deletePeriod(req.params.id, req.user._id);
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

const openRegistration = async (req, res, next) => {
  try {
    const period = await periodsService.transitionStatus(
      req.params.id,
      'registration_open',
      'OPEN_REGISTRATION',
      req.user._id,
      req.user.roles,
      'Mở đợt đăng ký đề tài đồ án'
    );
    return res.status(200).json({
      success: true,
      message: 'Đã kích hoạt mở cổng đăng ký đề tài cho sinh viên!',
      data: period,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const startPeriod = async (req, res, next) => {
  try {
    const period = await periodsService.transitionStatus(
      req.params.id,
      'in_progress',
      'START_PERIOD',
      req.user._id,
      req.user.roles,
      'Chuyển trạng thái sang thực hiện đồ án'
    );
    return res.status(200).json({
      success: true,
      message: 'Đợt đồ án đã chính thức bắt đầu thực hiện!',
      data: period,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const lockResults = async (req, res, next) => {
  try {
    const period = await periodsService.transitionStatus(
      req.params.id,
      'result_locked',
      'LOCK_RESULTS',
      req.user._id,
      req.user.roles,
      'Khóa kết quả điểm số và học vụ'
    );
    return res.status(200).json({
      success: true,
      message: 'Kết quả điểm đợt đồ án đã được khóa thành công!',
      data: period,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const archivePeriod = async (req, res, next) => {
  try {
    const period = await periodsService.transitionStatus(
      req.params.id,
      'archived',
      'ARCHIVE_PERIOD',
      req.user._id,
      req.user.roles,
      'Đóng đợt và lưu trữ tài liệu lưu chiểu'
    );
    return res.status(200).json({
      success: true,
      message: 'Đợt đồ án tốt nghiệp đã được đưa vào lưu trữ!',
      data: period,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  createPeriod,
  getPeriods,
  getPeriodById,
  updatePeriod,
  deletePeriod,
  openRegistration,
  startPeriod,
  lockResults,
  archivePeriod,
};
