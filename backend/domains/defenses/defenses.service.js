const DefenseSession = require('../../models/DefenseSession');
const Project = require('../../models/Project');
const Committee = require('../../models/Committee');
const { resolveProjectOwner } = require('../../utils/project-owner');
const { checkScheduleOverlap, checkConflictOfInterest } = require('./defenses.helper');

const scheduleSession = async (data, user) => {
  const { projectId, committeeId, mode, room, meetingUrl, defenseDate, startTime, endTime, orderNumber } = data;

  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const committee = await Committee.findOne({ _id: committeeId, isDeleted: { $ne: true } });
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  if (!['approved', 'active'].includes(committee.status)) {
    throw { status: 400, message: 'Hội đồng chấm phải được phê duyệt hoặc kích hoạt mới có thể xếp lịch.' };
  }

  // Conflict of Interest Check
  checkConflictOfInterest(committee, project);

  // Overlapping Schedule Check
  await checkScheduleOverlap(defenseDate, startTime, endTime, committeeId);

  const owner = resolveProjectOwner(project);
  const session = new DefenseSession({
    projectId,
    ownerType: owner?.ownerType,
    ownerId: owner?.ownerId,
    studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
    groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
    committeeId,
    reviewerId: project.reviewerId,
    mode,
    room: mode === 'offline' ? room : undefined,
    meetingUrl: mode === 'online' ? meetingUrl : undefined,
    defenseDate,
    startTime,
    endTime,
    orderNumber,
    status: 'scheduled',
  });

  return await session.save();
};

const populateSessionQuery = (query) => query
  .populate({
    path: 'projectId',
    populate: [
      { path: 'topicId' },
    ],
  })
  .populate('groupId')
  .populate({
    path: 'committeeId',
    populate: { path: 'periodId' },
  });

const getSessions = async (query = {}) => {
  return await populateSessionQuery(
    DefenseSession.find({ ...query, isDeleted: { $ne: true } })
  );
};

const getSessionById = async (id) => {
  const session = await populateSessionQuery(
    DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } })
  );
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }
  return session;
};

const updateSession = async (id, data) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }

  if (data.defenseDate || data.startTime || data.endTime || data.committeeId) {
    const date = data.defenseDate || session.defenseDate;
    const start = data.startTime || session.startTime;
    const end = data.endTime || session.endTime;
    const commId = data.committeeId || session.committeeId;

    await checkScheduleOverlap(date, start, end, commId, session._id);
  }

  if (data.mode) session.mode = data.mode;
  if (data.room) session.room = data.room;
  if (data.meetingUrl) session.meetingUrl = data.meetingUrl;
  if (data.defenseDate) session.defenseDate = data.defenseDate;
  if (data.startTime) session.startTime = data.startTime;
  if (data.endTime) session.endTime = data.endTime;
  if (data.orderNumber) session.orderNumber = data.orderNumber;

  return await session.save();
};

const deleteSession = async (id, userId) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại hoặc đã bị xóa.' };
  }

  if (['in_progress', 'completed'].includes(session.status)) {
    throw { status: 400, message: 'Không thể xóa phiên bảo vệ đang diễn ra hoặc đã hoàn thành.' };
  }

  session.status = 'cancelled';
  session.isDeleted = true;
  session.deletedAt = new Date();
  session.deletedBy = userId;

  return await session.save();
};

const checkIdentity = async (id, userId) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }

  session.identityChecked = true;
  session.identityCheckedBy = userId;

  return await session.save();
};

const startSession = async (id) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }

  if (session.status !== 'scheduled') {
    throw { status: 400, message: 'Chỉ có thể bắt đầu phiên bảo vệ khi ở trạng thái đã lên lịch (scheduled).' };
  }

  session.status = 'in_progress';
  return await session.save();
};

const reportIncident = async (id, incidentData, userId) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }

  session.incidentReports.push({
    reportedBy: userId,
    type: incidentData.type,
    evidenceFileIds: incidentData.evidenceFileIds || [],
    accepted: incidentData.accepted || false,
    resolution: incidentData.resolution,
  });

  return await session.save();
};

const uploadRecording = async (id, recordingUrl) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }

  session.recordingUrl = recordingUrl;
  return await session.save();
};

const completeSession = async (id) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }

  if (session.status !== 'in_progress') {
    throw { status: 400, message: 'Chỉ có thể hoàn thành phiên bảo vệ khi đang tiến hành (in_progress).' };
  }

  session.status = 'completed';
  return await session.save();
};

const rescheduleSession = async (id, data) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }

  await checkScheduleOverlap(data.defenseDate, data.startTime, data.endTime, session.committeeId, session._id);

  session.defenseDate = data.defenseDate;
  session.startTime = data.startTime;
  session.endTime = data.endTime;
  session.status = 'rescheduled';

  return await session.save();
};

const markNoShow = async (id) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!session) {
    throw { status: 404, message: 'Phiên bảo vệ không tồn tại.' };
  }

  session.status = 'no_show';
  return await session.save();
};

const validateSchedule = async (data) => {
  const { projectId, committeeId, defenseDate, startTime, endTime, excludeSessionId } = data;

  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const committee = await Committee.findOne({ _id: committeeId, isDeleted: { $ne: true } });
  if (!committee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  // 1. Conflict of Interest Check
  checkConflictOfInterest(committee, project);

  // 2. Overlapping Schedule Check
  await checkScheduleOverlap(defenseDate, startTime, endTime, committeeId, excludeSessionId);

  return { success: true };
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
