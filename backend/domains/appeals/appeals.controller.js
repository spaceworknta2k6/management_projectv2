const appealsService = require('./appeals.service');

const submitAppeal = async (req, res, next) => {
  try {
    const appeal = await appealsService.submitAppeal(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Nộp đơn phúc khảo thành công.',
      data: appeal,
    });
  } catch (error) {
    next(error);
  }
};

const getAppeals = async (req, res, next) => {
  try {
    const result = await appealsService.getAppeals(req.query, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getMyAppeals = async (req, res, next) => {
  try {
    const appeals = await appealsService.getMyAppeals(req.user);
    res.status(200).json({ success: true, data: appeals });
  } catch (error) {
    next(error);
  }
};

const getAppealById = async (req, res, next) => {
  try {
    const appeal = await appealsService.getAppealById(req.params.id, req.user);
    res.status(200).json({ success: true, data: appeal });
  } catch (error) {
    next(error);
  }
};

const assignRecheck = async (req, res, next) => {
  try {
    const appeal = await appealsService.assignRecheck(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: 'Phân công giảng viên chấm phúc khảo thành công.',
      data: appeal,
    });
  } catch (error) {
    next(error);
  }
};

const cancelAppeal = async (req, res, next) => {
  try {
    const appeal = await appealsService.cancelAppeal(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: 'Đã rút đơn phúc khảo.',
      data: appeal,
    });
  } catch (error) {
    next(error);
  }
};

const completeAppeal = async (req, res, next) => {
  try {
    const result = await appealsService.completeAppeal(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: 'Hoàn tất phúc khảo. Điểm tổng kết đã được cập nhật.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitAppeal,
  getAppeals,
  getMyAppeals,
  getAppealById,
  assignRecheck,
  cancelAppeal,
  completeAppeal,
};
