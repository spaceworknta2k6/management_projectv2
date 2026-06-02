const aiService = require('./ai.service');

const checkDuplicateTopic = async (req, res, next) => {
  try {
    const job = await aiService.checkDuplicateTopic(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: 'Tác vụ kiểm tra trùng lặp đề tài đã hoàn tất.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const suggestTopics = async (req, res, next) => {
  try {
    const job = await aiService.suggestTopics(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: 'Gợi ý đề tài cho sinh viên hoàn tất.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const analyzeReportFeedback = async (req, res, next) => {
  try {
    const job = await aiService.analyzeReportFeedback(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: 'Tác vụ nhận xét báo cáo đồ án đã hoàn tất.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const suggestDefenseQuestions = async (req, res, next) => {
  try {
    const job = await aiService.suggestDefenseQuestions(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: 'Tạo bộ câu hỏi phản biện bảo vệ đồ án thành công.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const getJobById = async (req, res, next) => {
  try {
    const job = await aiService.getJobById(req.params.id);
    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const retryAiJob = async (req, res, next) => {
  try {
    const job = await aiService.retryAiJob(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: 'Đã thử lại tác vụ AI thành công.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const manualOverrideJob = async (req, res, next) => {
  try {
    const { result } = req.body;
    const job = await aiService.manualOverrideJob(req.params.id, result, req.user);
    res.status(200).json({
      success: true,
      message: 'Ghi đè kết quả của AI thành công.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkDuplicateTopic,
  suggestTopics,
  analyzeReportFeedback,
  suggestDefenseQuestions,
  getJobById,
  retryAiJob,
  manualOverrideJob,
};
