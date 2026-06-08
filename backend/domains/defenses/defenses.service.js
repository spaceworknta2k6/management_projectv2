const DefenseSession = require('../../models/DefenseSession');
const Project = require('../../models/Project');
const Committee = require('../../models/Committee');
const Lecturer = require('../../models/Lecturer');

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const checkScheduleOverlap = async (defenseDate, startTime, endTime, committeeId, excludeSessionId = null) => {
  const targetCommittee = await Committee.findOne({ _id: committeeId, isDeleted: { $ne: true } });
  if (!targetCommittee) {
    throw { status: 404, message: 'Hội đồng chấm không tồn tại.' };
  }

  const startOfDay = new Date(defenseDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(defenseDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const existingSessions = await DefenseSession.find({
    defenseDate: { $gte: startOfDay, $lte: endOfDay },
    isDeleted: { $ne: true },
    status: { $nin: ['cancelled', 'no_show'] },
    _id: excludeSessionId ? { $ne: excludeSessionId } : { $exists: true }
  }).populate('committeeId');

  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);

  const targetMemberIds = targetCommittee.members.map(m => m.lecturerId.toString());

  for (const session of existingSessions) {
    const sStart = timeToMinutes(session.startTime);
    const sEnd = timeToMinutes(session.endTime);

    // If time windows intersect
    if (newStart < sEnd && sStart < newEnd) {
      if (session.committeeId) {
        const sharedMember = session.committeeId.members.find(m => 
          targetMemberIds.includes(m.lecturerId.toString())
        );

        if (sharedMember) {
          const lecturer = await Lecturer.findById(sharedMember.lecturerId).populate('userId');
          const lecturerName = lecturer && lecturer.userId ? lecturer.userId.fullName : 'Giảng viên';
          throw {
            status: 409,
            message: `Trùng lịch chấm: Giảng viên ${lecturerName} đã được xếp lịch trong khoảng thời gian từ ${session.startTime} đến ${session.endTime} ngày ${session.defenseDate.toISOString().split('T')[0]}.`
          };
        }
      }
    }
  }
};

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
  const chairMember = committee.members.find(m => m.role === 'COMMITTEE_CHAIR');
  if (chairMember) {
    const chairId = chairMember.lecturerId.toString();
    const supervisorId = project.supervisorId ? project.supervisorId.toString() : null;
    const reviewerId = project.reviewerId ? project.reviewerId.toString() : null;

    if (chairId === supervisorId || chairId === reviewerId) {
      throw {
        status: 400,
        message: 'Xung đột lợi ích: Giảng viên đang là giảng viên hướng dẫn hoặc phản biện không được làm Chủ tịch hội đồng chấm đồ án này.'
      };
    }
  }

  // Overlapping Schedule Check
  await checkScheduleOverlap(defenseDate, startTime, endTime, committeeId);

  const session = new DefenseSession({
    projectId,
    groupId: project.groupId,
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

const getSessions = async (query = {}) => {
  return await DefenseSession.find({ ...query, isDeleted: { $ne: true } }).populate('projectId').populate('committeeId');
};

const getSessionById = async (id) => {
  const session = await DefenseSession.findOne({ _id: id, isDeleted: { $ne: true } }).populate('projectId').populate('committeeId');
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
};
