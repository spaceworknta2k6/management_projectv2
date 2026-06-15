const defensesService = require('./defenses.service');

const scheduleSession = async (req, res, next) => {
  try {
    const session = await defensesService.scheduleSession(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Phiên bảo vệ đã được lên lịch thành công.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const getSessions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.committeeId) filter.committeeId = req.query.committeeId;

    const sessions = await defensesService.getSessions(filter);
    res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
};

const getSessionById = async (req, res, next) => {
  try {
    const session = await defensesService.getSessionById(req.params.id);
    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const updateSession = async (req, res, next) => {
  try {
    const session = await defensesService.updateSession(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Phiên bảo vệ đã được cập nhật thành công.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const deleteSession = async (req, res, next) => {
  try {
    await defensesService.deleteSession(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Phiên bảo vệ đã được xóa thành công.',
    });
  } catch (error) {
    next(error);
  }
};

const checkIdentity = async (req, res, next) => {
  try {
    const session = await defensesService.checkIdentity(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Đã điểm danh/xác thực danh tính sinh viên thành công.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const startSession = async (req, res, next) => {
  try {
    const session = await defensesService.startSession(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Phiên bảo vệ đã được bắt đầu.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const reportIncident = async (req, res, next) => {
  try {
    const session = await defensesService.reportIncident(req.params.id, req.body, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Đã ghi nhận sự cố kỹ thuật thành công.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const uploadRecording = async (req, res, next) => {
  try {
    const { recordingUrl } = req.body;
    if (!recordingUrl) {
      return res.status(400).json({ success: false, message: 'Đường dẫn recordingUrl là bắt buộc.' });
    }
    const session = await defensesService.uploadRecording(req.params.id, recordingUrl);
    res.status(200).json({
      success: true,
      message: 'Tải lên liên kết ghi hình bảo vệ thành công.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const completeSession = async (req, res, next) => {
  try {
    const session = await defensesService.completeSession(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Phiên bảo vệ đã hoàn thành tốt đẹp.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const rescheduleSession = async (req, res, next) => {
  try {
    const { defenseDate, startTime, endTime } = req.body;
    if (!defenseDate || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'defenseDate, startTime và endTime là bắt buộc.' });
    }
    const session = await defensesService.rescheduleSession(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Thay đổi lịch bảo vệ thành công.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const markNoShow = async (req, res, next) => {
  try {
    const session = await defensesService.markNoShow(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu sinh viên vắng mặt (No Show).',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

const validateSchedule = async (req, res, next) => {
  try {
    const result = await defensesService.validateSchedule(req.body);
    res.status(200).json({
      success: true,
      message: 'Lịch bảo vệ hợp lệ (không trùng lịch và không xung đột lợi ích).',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  scheduleSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
  checkIdentity,
  startSession,
  reportIncident,
  uploadRecording,
  completeSession,
  rescheduleSession,
  markNoShow,
  validateSchedule,
};
