const rostersService = require('./rosters.service');

const importRoster = async (req, res, next) => {
  try {
    const result = await rostersService.importRoster(req.params.periodId, req.body.roster, req.user._id);
    return res.status(200).json({
      success: true,
      message: `Đã nhập thành công ${result.length} sinh viên vào danh sách đợt đồ án!`,
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const addSingleStudent = async (req, res, next) => {
  try {
    const result = await rostersService.addSingleStudent(req.params.periodId, req.body, req.user._id);
    return res.status(201).json({
      success: true,
      message: 'Đã thêm sinh viên vào danh sách thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getRoster = async (req, res, next) => {
  try {
    const roster = await rostersService.getRosterByPeriod(req.params.periodId);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách roster đợt đồ án thành công!',
      data: roster,
    });
  } catch (error) {
    next(error);
  }
};

const removeStudent = async (req, res, next) => {
  try {
    await rostersService.removeStudentFromRoster(req.params.periodId, req.params.studentId, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Đã rút tên sinh viên khỏi danh sách đợt đồ án thành công!',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const updateRosterEntry = async (req, res, next) => {
  try {
    const result = await rostersService.updateRosterEntry(
      req.params.periodId,
      req.params.studentId,
      req.body,
      req.user._id
    );
    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin sinh viên thành công!',
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
  importRoster,
  addSingleStudent,
  getRoster,
  removeStudent,
  updateRosterEntry,
};
