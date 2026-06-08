const committeesService = require('./committees.service');

const createCommittee = async (req, res, next) => {
  try {
    const committee = await committeesService.createCommittee(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Hội đồng chấm đã được tạo thành công.',
      data: committee,
    });
  } catch (error) {
    next(error);
  }
};

const getCommittees = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.periodId) {
      filter.periodId = req.query.periodId;
    }
    const committees = await committeesService.getCommittees(filter);
    res.status(200).json({
      success: true,
      data: committees,
    });
  } catch (error) {
    next(error);
  }
};

const getCommitteeById = async (req, res, next) => {
  try {
    const committee = await committeesService.getCommitteeById(req.params.id);
    res.status(200).json({
      success: true,
      data: committee,
    });
  } catch (error) {
    next(error);
  }
};

const updateCommittee = async (req, res, next) => {
  try {
    const committee = await committeesService.updateCommittee(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Thông tin hội đồng đã được cập nhật thành công.',
      data: committee,
    });
  } catch (error) {
    next(error);
  }
};

const approveCommittee = async (req, res, next) => {
  try {
    const committee = await committeesService.approveCommittee(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Hội đồng đã được duyệt thành công.',
      data: committee,
    });
  } catch (error) {
    next(error);
  }
};

const activateCommittee = async (req, res, next) => {
  try {
    const committee = await committeesService.activateCommittee(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Hội đồng đã được kích hoạt thành công.',
      data: committee,
    });
  } catch (error) {
    next(error);
  }
};

const finishCommittee = async (req, res, next) => {
  try {
    const committee = await committeesService.finishCommittee(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Đã hoàn thành đánh giá cho hội đồng.',
      data: committee,
    });
  } catch (error) {
    next(error);
  }
};

const deleteCommittee = async (req, res, next) => {
  try {
    const result = await committeesService.deleteCommittee(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCommittee,
  getCommittees,
  getCommitteeById,
  updateCommittee,
  approveCommittee,
  activateCommittee,
  finishCommittee,
  deleteCommittee,
};
