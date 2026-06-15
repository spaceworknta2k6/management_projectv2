const rubricsService = require('./rubrics.service');
const { isStaff } = require('../../utils/access-control');

const assertStaffUser = (user) => {
  if (!isStaff(user)) {
    throw { status: 403, message: 'Bạn không có quyền thực hiện hành động này. Yêu cầu quyền Giáo vụ khoa.' };
  }
};

const createRubric = async (req, res, next) => {
  try {
    assertStaffUser(req.user);
    const rubric = await rubricsService.createRubric(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: 'Khởi tạo tiêu chí đánh giá (Rubric) thành công!',
      data: rubric,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getRubrics = async (req, res, next) => {
  try {
    const rubrics = await rubricsService.getRubrics(req.query);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách Rubrics thành công!',
      data: rubrics,
    });
  } catch (error) {
    next(error);
  }
};

const getRubricById = async (req, res, next) => {
  try {
    const rubric = await rubricsService.getRubricById(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết Rubric thành công!',
      data: rubric,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const updateRubric = async (req, res, next) => {
  try {
    assertStaffUser(req.user);
    const rubric = await rubricsService.updateRubric(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: 'Cập nhật Rubric thành công!',
      data: rubric,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const deleteRubric = async (req, res, next) => {
  try {
    assertStaffUser(req.user);
    await rubricsService.deleteRubric(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: 'Xóa tiêu chí đánh giá (Rubric) thành công!',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  createRubric,
  getRubrics,
  getRubricById,
  updateRubric,
  deleteRubric,
};
