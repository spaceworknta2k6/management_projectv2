const scoresService = require('./scores.service');

const submitScoreSheet = async (req, res, next) => {
  try {
    const sheet = await scoresService.submitScoreSheet(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Phiếu điểm đã được nộp/cập nhật thành công.',
      data: sheet,
    });
  } catch (error) {
    next(error);
  }
};

const getScoreSheets = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.rubricRole) filter.rubricRole = req.query.rubricRole;
    if (req.query.graderId) filter.graderId = req.query.graderId;

    const sheets = await scoresService.getScoreSheets(filter);
    res.status(200).json({
      success: true,
      data: sheets,
    });
  } catch (error) {
    next(error);
  }
};

const getScoreSheetById = async (req, res, next) => {
  try {
    const sheet = await scoresService.getScoreSheetById(req.params.id);
    res.status(200).json({
      success: true,
      data: sheet,
    });
  } catch (error) {
    next(error);
  }
};

const updateScoreSheet = async (req, res, next) => {
  try {
    const sheet = await scoresService.updateScoreSheet(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: 'Cập nhật phiếu điểm thành công.',
      data: sheet,
    });
  } catch (error) {
    next(error);
  }
};

const lockScoreSheet = async (req, res, next) => {
  try {
    const sheet = await scoresService.lockScoreSheet(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Phiếu điểm đã được khóa thành công.',
      data: sheet,
    });
  } catch (error) {
    next(error);
  }
};

const aggregateFinalGrade = async (req, res, next) => {
  try {
    const grade = await scoresService.aggregateFinalGrade(req.params.projectId, req.user);
    res.status(200).json({
      success: true,
      message: 'Đã tổng hợp điểm số cuối cùng thành công.',
      data: grade,
    });
  } catch (error) {
    next(error);
  }
};

const getFinalGrade = async (req, res, next) => {
  try {
    const grade = await scoresService.getFinalGrade(req.params.id);
    res.status(200).json({
      success: true,
      data: grade,
    });
  } catch (error) {
    next(error);
  }
};

const getFinalGradeByProjectId = async (req, res, next) => {
  try {
    const grade = await scoresService.getFinalGradeByProjectId(req.params.projectId);
    res.status(200).json({
      success: true,
      data: grade,
    });
  } catch (error) {
    next(error);
  }
};

const publishFinalGrade = async (req, res, next) => {
  try {
    const grade = await scoresService.publishFinalGrade(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Công bố điểm tổng kết đồ án thành công.',
      data: grade,
    });
  } catch (error) {
    next(error);
  }
};

const lockFinalGrade = async (req, res, next) => {
  try {
    const grade = await scoresService.lockFinalGrade(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Điểm tổng kết đã được khóa vĩnh viễn.',
      data: grade,
    });
  } catch (error) {
    next(error);
  }
};

const resolveVariance = async (req, res, next) => {
  try {
    const { flagType, resolution } = req.body;
    if (!flagType || !resolution) {
      return res.status(400).json({ success: false, message: 'flagType và resolution là bắt buộc.' });
    }
    const grade = await scoresService.resolveVariance(req.params.id, flagType, resolution, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Đã xử lý cờ chênh lệch điểm thành công.',
      data: grade,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitScoreSheet,
  getScoreSheets,
  getScoreSheetById,
  updateScoreSheet,
  lockScoreSheet,
  aggregateFinalGrade,
  getFinalGrade,
  getFinalGradeByProjectId,
  publishFinalGrade,
  lockFinalGrade,
  resolveVariance,
};
