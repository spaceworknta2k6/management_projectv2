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
    const force = req.query.force === 'true';
    const job = await aiService.suggestTopics(req.params.id, req.user, force);
    res.status(200).json({
      success: true,
      message: 'Gợi ý đề tài cho sinh viên hoàn tất.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const chatTopicSuggestion = async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'Tin nhắn không hợp lệ.' });
    }
    const reply = await aiService.chatTopicSuggestion(req.params.id, messages);
    res.status(200).json({ success: true, data: { message: reply } });
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

const analyzeMilestoneReport = async (req, res, next) => {
  try {
    const { milestoneId, fileId } = req.params;
    const job = await aiService.analyzeMilestoneReport(milestoneId, fileId, req.user);
    res.status(200).json({
      success: true,
      message: 'Tác vụ đánh giá báo cáo bằng AI đã hoàn tất.',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkDuplicateTopic,
  suggestTopics,
  chatTopicSuggestion,
  analyzeReportFeedback,
  getJobById,
  retryAiJob,
  manualOverrideJob,
  analyzeMilestoneReport,
};
