const Committee = require('../../models/Committee');
const ProjectPeriod = require('../../models/ProjectPeriod');
const DefenseSession = require('../../models/DefenseSession');

const createCommittee = async (data, user) => {
  const { periodId, name, evaluationMode, members } = data;

  const period = await ProjectPeriod.findOne({ _id: periodId, isDeleted: { $ne: true } });
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
  return await Committee.find({ ...query, isDeleted: { $ne: true } })
    .populate('periodId')
    .populate({
      path: 'members.lecturerId',
      populate: {
        path: 'userId',
        select: 'fullName email',
      },
    });
};

const getCommitteeById = async (id) => {
  const committee = await Committee.findOne({ _id: id, isDeleted: { $ne: true } })
    .populate('periodId')
    .populate({
      path: 'members.lecturerId',
      populate: {
        path: 'userId',
        select: 'fullName email',
      },
    });
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }
  return committee;
};

const updateCommittee = async (id, data) => {
  const committee = await Committee.findOne({ _id: id, isDeleted: { $ne: true } });
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
  const committee = await Committee.findOne({ _id: id, isDeleted: { $ne: true } });
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
  const committee = await Committee.findOne({ _id: id, isDeleted: { $ne: true } });
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
  const committee = await Committee.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  if (committee.status !== 'active') {
    throw { status: 400, message: 'Chỉ cho phép đánh dấu hoàn thành khi hội đồng đang ở trạng thái Đang hoạt động (active).' };
  }

  committee.status = 'finished';
  return await committee.save();
};

const deleteCommittee = async (id, userId) => {
  const committee = await Committee.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  const scheduledSession = await DefenseSession.findOne({
    committeeId: committee._id,
    isDeleted: { $ne: true },
    status: { $nin: ['cancelled', 'no_show'] },
  });
  if (scheduledSession) {
    throw { status: 400, message: 'Hội đồng đã được gán lịch bảo vệ nên không thể xóa. Hãy cập nhật hoặc hủy lịch bảo vệ trước.' };
  }

  committee.status = 'cancelled';
  committee.isDeleted = true;
  committee.deletedAt = new Date();
  committee.deletedBy = userId;
  await committee.save();

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
