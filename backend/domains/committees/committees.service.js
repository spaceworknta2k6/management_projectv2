const Committee = require('../../models/Committee');
const ProjectPeriod = require('../../models/ProjectPeriod');

const createCommittee = async (data, user) => {
  const { periodId, name, evaluationMode, members } = data;

  const period = await ProjectPeriod.findById(periodId);
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const committee = new Committee({
    periodId,
    name,
    evaluationMode: evaluationMode || 'defense',
    facultyId: period.facultyId,
    members,
    status: 'draft',
  });

  return await committee.save();
};

const getCommittees = async (query = {}) => {
  return await Committee.find(query).populate('periodId');
};

const getCommitteeById = async (id) => {
  const committee = await Committee.findById(id).populate('periodId');
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }
  return committee;
};

const updateCommittee = async (id, data) => {
  const committee = await Committee.findById(id);
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  if (committee.status !== 'draft') {
    throw { status: 400, message: 'Chỉ cho phép cập nhật hội đồng khi đang ở trạng thái Nháp (draft).' };
  }

  if (data.name !== undefined) committee.name = data.name;
  if (data.evaluationMode !== undefined) committee.evaluationMode = data.evaluationMode;
  if (data.members !== undefined) committee.members = data.members;

  return await committee.save();
};

const approveCommittee = async (id, userId) => {
  const committee = await Committee.findById(id);
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  if (committee.status !== 'draft') {
    throw { status: 400, message: 'Chỉ cho phép duyệt hội đồng khi đang ở trạng thái Nháp (draft).' };
  }

  committee.status = 'approved';
  committee.approvedBy = userId;
  committee.approvedAt = new Date();

  return await committee.save();
};

const activateCommittee = async (id) => {
  const committee = await Committee.findById(id);
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  if (committee.status !== 'approved') {
    throw { status: 400, message: 'Chỉ cho phép kích hoạt hội đồng từ trạng thái Đã duyệt (approved).' };
  }

  committee.status = 'active';
  return await committee.save();
};

const finishCommittee = async (id) => {
  const committee = await Committee.findById(id);
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  if (committee.status !== 'active') {
    throw { status: 400, message: 'Chỉ cho phép đánh dấu hoàn thành khi hội đồng đang ở trạng thái Đang hoạt động (active).' };
  }

  committee.status = 'finished';
  return await committee.save();
};

const deleteCommittee = async (id) => {
  const committee = await Committee.findById(id);
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  if (committee.status !== 'draft') {
    throw { status: 400, message: 'Chỉ cho phép xóa hội đồng khi đang ở trạng thái Nháp (draft).' };
  }

  await Committee.findByIdAndDelete(id);
  return { success: true, message: 'Hội đồng chấm đã được xóa thành công.' };
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
