const service = require('./topic-change-requests.service');

const handle = (res, next, error) => {
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  return next(error);
};

const createChangeRequest = async (req, res, next) => {
  try {
    const result = await service.createChangeRequest(req.params.id, req.body, req.user);
    return res.status(201).json({
      success: true,
      message: 'Đã gửi đơn đổi đề tài thành công.',
      data: result,
    });
  } catch (error) {
    return handle(res, next, error);
  }
};

const getRequests = async (req, res, next) => {
  try {
    const result = await service.getRequests(req.query, req.user);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn đổi đề tài thành công.',
      data: result.requests,
      pagination: {
        total: result.total,
        page: result.page,
        pages: result.pages,
        limit: result.limit,
      },
    });
  } catch (error) {
    return handle(res, next, error);
  }
};

const getTopicRequests = async (req, res, next) => {
  try {
    const result = await service.getRequests({ ...req.query, topicId: req.params.id }, req.user);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn đổi đề tài thành công.',
      data: result.requests,
      pagination: {
        total: result.total,
        page: result.page,
        pages: result.pages,
        limit: result.limit,
      },
    });
  } catch (error) {
    return handle(res, next, error);
  }
};

const getRequestById = async (req, res, next) => {
  try {
    const result = await service.getRequestById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết đơn đổi đề tài thành công.',
      data: result,
    });
  } catch (error) {
    return handle(res, next, error);
  }
};

const supervisorApprove = async (req, res, next) => {
  try {
    const result = await service.supervisorReview(req.params.id, 'approved', req.body.note, req.user);
    return res.status(200).json({ success: true, message: 'Đã ghi nhận ý kiến đồng ý của GVHD.', data: result });
  } catch (error) {
    return handle(res, next, error);
  }
};

const supervisorReject = async (req, res, next) => {
  try {
    const result = await service.supervisorReview(req.params.id, 'rejected', req.body.note, req.user);
    return res.status(200).json({ success: true, message: 'Đã ghi nhận ý kiến từ chối của GVHD.', data: result });
  } catch (error) {
    return handle(res, next, error);
  }
};

const facultyApprove = async (req, res, next) => {
  try {
    const result = await service.facultyReview(req.params.id, 'approved', req.body.note, req.user);
    return res.status(200).json({ success: true, message: 'Đã duyệt đơn đổi đề tài và cập nhật phiên bản đề tài.', data: result });
  } catch (error) {
    return handle(res, next, error);
  }
};

const facultyReject = async (req, res, next) => {
  try {
    const result = await service.facultyReview(req.params.id, 'rejected', req.body.note, req.user);
    return res.status(200).json({ success: true, message: 'Đã từ chối đơn đổi đề tài.', data: result });
  } catch (error) {
    return handle(res, next, error);
  }
};

const cancelRequest = async (req, res, next) => {
  try {
    const result = await service.cancelRequest(req.params.id, req.user);
    return res.status(200).json({ success: true, message: 'Đã hủy đơn đổi đề tài.', data: result });
  } catch (error) {
    return handle(res, next, error);
  }
};

module.exports = {
  createChangeRequest,
  getRequests,
  getTopicRequests,
  getRequestById,
  supervisorApprove,
  supervisorReject,
  facultyApprove,
  facultyReject,
  cancelRequest,
};
