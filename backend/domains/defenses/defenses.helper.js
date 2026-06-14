const Committee = require('../../models/Committee');
const DefenseSession = require('../../models/DefenseSession');
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

const checkConflictOfInterest = (committee, project) => {
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
};

module.exports = {
  timeToMinutes,
  checkScheduleOverlap,
  checkConflictOfInterest,
};
