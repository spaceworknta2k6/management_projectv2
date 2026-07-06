const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const prisma = require('../../config/prisma');
const ProjectRosterMirror = require('../../models/ProjectRoster');
const UserMirror = require('../../models/User');
const StudentMirror = require('../../models/Student');
const WorkflowEvent = require('../../models/WorkflowEvent');
const Project = require('../../models/Project');
const ProjectTopic = require('../../models/ProjectTopic');
const ProjectGroup = require('../../models/ProjectGroup');

const newObjectId = () => new mongoose.Types.ObjectId().toString();
const toId = (value) => (value ? value.toString() : null);

const logWorkflowEvent = async ({
  entityId,
  fromStatus,
  toStatus,
  actorId,
  action,
  reason = '',
}) => WorkflowEvent.create({
  entityType: 'ProjectRoster',
  entityId,
  fromStatus,
  toStatus,
  actorId,
  actorRoles: ['FACULTY_STAFF'],
  action,
  reason,
});

const toPublicUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    _id: user.id,
  };
};

const toPublicStudent = (student, user = null) => {
  if (!student) return null;
  return {
    ...student,
    _id: student.id,
    userId: user ? toPublicUser(user) : student.userId,
  };
};

const toPublicRoster = (roster, student = null, user = null) => {
  if (!roster) return null;
  return {
    ...roster,
    _id: roster.id,
    studentId: student ? toPublicStudent(student, user) : roster.studentId,
  };
};

const trimStudentData = (studentData) => ({
  studentCode: studentData.studentCode.trim(),
  fullName: studentData.fullName.trim(),
  email: studentData.email.trim().toLowerCase(),
  classSection: studentData.classSection.trim(),
  className: (studentData.className || studentData.classSection).trim(),
  cohort: (studentData.cohort || 'K67').trim(),
  major: (studentData.major || 'Công nghệ thông tin').trim(),
});

const mirrorUser = async (user) => {
  await UserMirror.updateOne(
    { _id: user.id },
    {
      $set: {
        fullName: user.fullName,
        email: user.email,
        passwordHash: user.passwordHash,
        roles: user.roles,
        status: user.status,
        phoneNumber: user.phoneNumber || '',
        cohort: user.cohort || '',
        avatarUrl: user.avatarUrl || '',
        isDeleted: user.isDeleted,
        deletedAt: user.deletedAt,
        deletedBy: user.deletedBy,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

const mirrorStudent = async (student) => {
  await StudentMirror.updateOne(
    { _id: student.id },
    {
      $set: {
        userId: student.userId,
        studentCode: student.studentCode,
        className: student.className,
        cohort: student.cohort,
        major: student.major,
        facultyId: student.facultyId,
        skills: student.skills || [],
        interests: student.interests || [],
        technologies: student.technologies || [],
        isDeleted: student.isDeleted,
        deletedAt: student.deletedAt,
        deletedBy: student.deletedBy,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

const mirrorRoster = async (roster) => {
  await ProjectRosterMirror.updateOne(
    { _id: roster.id },
    {
      $set: {
        periodId: roster.periodId,
        studentId: roster.studentId,
        classSection: roster.classSection,
        status: roster.status,
        importedBy: roster.importedBy,
        importedAt: roster.importedAt,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

const getPeriodOrThrow = async (periodId) => {
  const period = await prisma.projectPeriod.findFirst({
    where: {
      id: toId(periodId),
      isDeleted: false,
    },
  });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }
  return period;
};

const getOrCreateStudent = async (studentData, passwordHash, facultyId) => {
  const data = trimStudentData(studentData);

  let student = await prisma.student.findFirst({
    where: {
      studentCode: data.studentCode,
      isDeleted: false,
    },
  });

  let user = student
    ? await prisma.user.findFirst({
      where: {
        id: student.userId,
        isDeleted: false,
      },
    })
    : await prisma.user.findFirst({
      where: {
        email: data.email,
        isDeleted: false,
      },
    });

  if (student && !user) {
    throw { status: 404, message: 'Không tìm thấy tài khoản sinh viên.' };
  }

  if (!user) {
    const id = newObjectId();
    user = await prisma.user.create({
      data: {
        id,
        mongoId: id,
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        roles: ['STUDENT'],
        status: 'active',
      },
    });
  } else if (!user.roles.includes('STUDENT')) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        roles: [...user.roles, 'STUDENT'],
      },
    });
  }

  if (!student) {
    const id = newObjectId();
    student = await prisma.student.create({
      data: {
        id,
        mongoId: id,
        userId: user.id,
        studentCode: data.studentCode,
        className: data.className,
        cohort: data.cohort,
        major: data.major,
        facultyId: toId(facultyId),
      },
    });
  }

  await Promise.all([
    mirrorUser(user),
    mirrorStudent(student),
  ]);

  return { student, user };
};

const upsertRosterEntry = async ({ periodId, studentId, classSection, actorId }) => {
  const existing = await prisma.projectRoster.findUnique({
    where: {
      periodId_studentId: {
        periodId: toId(periodId),
        studentId: toId(studentId),
      },
    },
  });

  if (existing && existing.status === 'active') {
    return { rosterEntry: existing, createdOrReactivated: false };
  }

  const now = new Date();
  const rosterEntry = existing
    ? await prisma.projectRoster.update({
      where: { id: existing.id },
      data: {
        classSection: classSection.trim(),
        status: 'active',
        importedBy: toId(actorId),
        importedAt: now,
      },
    })
    : await prisma.projectRoster.create({
      data: {
        id: newObjectId(),
        periodId: toId(periodId),
        studentId: toId(studentId),
        classSection: classSection.trim(),
        status: 'active',
        importedBy: toId(actorId),
        importedAt: now,
      },
    });

  await mirrorRoster(rosterEntry);
  return { rosterEntry, createdOrReactivated: true };
};

const importRoster = async (periodId, rosterList, actorId) => {
  const period = await getPeriodOrThrow(periodId);
  const passwordHash = await bcrypt.hash('password123', 10);

  const importedCodes = [];
  for (const item of rosterList) {
    const { student, user } = await getOrCreateStudent(item, passwordHash, period.facultyId);
    await upsertRosterEntry({
      periodId: period.id,
      studentId: student.id,
      classSection: item.classSection,
      actorId,
    });
    importedCodes.push(student.studentCode);
    await mirrorUser(user);
    await mirrorStudent(student);
  }

  await logWorkflowEvent({
    entityId: period.id,
    fromStatus: '',
    toStatus: 'active',
    actorId,
    action: 'IMPORT_ROSTER',
    reason: `Import thành công danh sách gồm ${importedCodes.length} sinh viên`,
  });

  return importedCodes;
};

const addSingleStudent = async (periodId, studentData, actorId) => {
  const period = await getPeriodOrThrow(periodId);
  const passwordHash = await bcrypt.hash('password123', 10);
  const { student, user } = await getOrCreateStudent(studentData, passwordHash, period.facultyId);

  const { rosterEntry, createdOrReactivated } = await upsertRosterEntry({
    periodId: period.id,
    studentId: student.id,
    classSection: studentData.classSection,
    actorId,
  });

  if (!createdOrReactivated) {
    throw { status: 400, message: 'Sinh viên đã tồn tại trong học phần đồ án này.' };
  }

  await logWorkflowEvent({
    entityId: period.id,
    fromStatus: 'removed',
    toStatus: 'active',
    actorId,
    action: 'ADD_STUDENT_ROSTER',
    reason: `Thêm thủ công sinh viên ${student.studentCode} vào danh sách`,
  });

  return toPublicRoster(rosterEntry, student, user);
};

const getRosterByPeriod = async (periodId) => {
  const roster = await prisma.projectRoster.findMany({
    where: {
      periodId: toId(periodId),
      status: 'active',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const studentIds = roster.map((entry) => entry.studentId);
  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      isDeleted: false,
    },
  });
  const users = await prisma.user.findMany({
    where: {
      id: { in: students.map((student) => student.userId) },
      isDeleted: false,
    },
  });

  const studentById = new Map(students.map((student) => [student.id, student]));
  const userById = new Map(users.map((user) => [user.id, user]));

  return roster.map((entry) => {
    const student = studentById.get(entry.studentId);
    const user = student ? userById.get(student.userId) : null;
    return toPublicRoster(entry, student, user);
  });
};

const assertStudentCanBeRemoved = async (periodId, studentId) => {
  const activeProject = await Project.findOne({
    periodId,
    studentId,
    status: { $ne: 'cancelled' },
  });
  if (activeProject) {
    throw { status: 400, message: 'Sinh viên đang thực hiện dự án hoạt động trong học phần này, không thể xóa khỏi danh sách.' };
  }

  const activeTopic = await ProjectTopic.findOne({
    periodId,
    proposedByStudentId: studentId,
    status: { $in: ['submitted', 'approved', 'assigned', 'locked', 'changed'] },
  });
  if (activeTopic) {
    throw { status: 400, message: 'Sinh viên đang có đề tài hoạt động trong học phần này, không thể xóa khỏi danh sách.' };
  }

  const studentGroups = await ProjectGroup.find({
    periodId,
    isDeleted: { $ne: true },
    status: { $ne: 'cancelled' },
    members: {
      $elemMatch: {
        studentId,
        status: 'accepted',
      },
    },
  });

  if (studentGroups.length === 0) return;

  const groupIds = studentGroups.map((group) => group._id);
  const activeGroupProject = await Project.findOne({
    periodId,
    groupId: { $in: groupIds },
    status: { $ne: 'cancelled' },
  });
  if (activeGroupProject) {
    throw { status: 400, message: 'Sinh viên thuộc nhóm đang thực hiện dự án hoạt động, không thể xóa khỏi danh sách.' };
  }

  const activeGroupTopic = await ProjectTopic.findOne({
    periodId,
    groupId: { $in: groupIds },
    status: { $in: ['submitted', 'approved', 'assigned', 'locked', 'changed'] },
  });
  if (activeGroupTopic) {
    throw { status: 400, message: 'Sinh viên thuộc nhóm có đề tài hoạt động, không thể xóa khỏi danh sách.' };
  }
};

const removeStudentFromRoster = async (periodId, studentId, actorId) => {
  const rosterEntry = await prisma.projectRoster.findUnique({
    where: {
      periodId_studentId: {
        periodId: toId(periodId),
        studentId: toId(studentId),
      },
    },
  });

  if (!rosterEntry) {
    throw { status: 404, message: 'Không tìm thấy sinh viên trong danh sách học phần đồ án.' };
  }

  if (rosterEntry.status === 'removed') {
    throw { status: 400, message: 'Sinh viên đã được rút tên trước đó.' };
  }

  await assertStudentCanBeRemoved(toId(periodId), toId(studentId));

  const updatedRoster = await prisma.projectRoster.update({
    where: { id: rosterEntry.id },
    data: { status: 'removed' },
  });

  await mirrorRoster(updatedRoster);

  await logWorkflowEvent({
    entityId: toId(periodId),
    fromStatus: 'active',
    toStatus: 'removed',
    actorId,
    action: 'REMOVE_STUDENT_ROSTER',
    reason: `Xóa sinh viên ID ${studentId} khỏi danh sách đợt đồ án`,
  });

  return toPublicRoster(updatedRoster);
};

const updateRosterEntry = async (periodId, studentId, updates, actorId) => {
  const { classSection, fullName, studentCode } = updates;

  const rosterEntry = await prisma.projectRoster.findUnique({
    where: {
      periodId_studentId: {
        periodId: toId(periodId),
        studentId: toId(studentId),
      },
    },
  });
  if (!rosterEntry || rosterEntry.status !== 'active') {
    throw { status: 404, message: 'Không tìm thấy sinh viên trong danh sách đợt đồ án.' };
  }

  const student = await prisma.student.findFirst({
    where: {
      id: toId(studentId),
      isDeleted: false,
    },
  });
  if (!student) {
    throw { status: 404, message: 'Không tìm thấy hồ sơ sinh viên.' };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: student.userId,
      isDeleted: false,
    },
  });
  if (!user) {
    throw { status: 404, message: 'Không tìm thấy tài khoản sinh viên.' };
  }

  const studentUpdate = {};
  if (studentCode && studentCode.trim() !== student.studentCode) {
    const trimmedCode = studentCode.trim();
    const existing = await prisma.student.findFirst({
      where: {
        studentCode: trimmedCode,
        isDeleted: false,
      },
    });
    if (existing) {
      throw { status: 409, message: `Mã sinh viên "${trimmedCode}" đã tồn tại trong hệ thống.` };
    }
    studentUpdate.studentCode = trimmedCode;
  }

  const userUpdate = {};
  if (fullName && fullName.trim()) {
    userUpdate.fullName = fullName.trim();
  }

  const rosterUpdate = {};
  if (classSection && classSection.trim()) {
    rosterUpdate.classSection = classSection.trim();
  }

  const [updatedStudent, updatedUser, updatedRoster] = await prisma.$transaction([
    Object.keys(studentUpdate).length
      ? prisma.student.update({ where: { id: student.id }, data: studentUpdate })
      : prisma.student.findUnique({ where: { id: student.id } }),
    Object.keys(userUpdate).length
      ? prisma.user.update({ where: { id: user.id }, data: userUpdate })
      : prisma.user.findUnique({ where: { id: user.id } }),
    Object.keys(rosterUpdate).length
      ? prisma.projectRoster.update({ where: { id: rosterEntry.id }, data: rosterUpdate })
      : prisma.projectRoster.findUnique({ where: { id: rosterEntry.id } }),
  ]);

  await Promise.all([
    mirrorUser(updatedUser),
    mirrorStudent(updatedStudent),
    mirrorRoster(updatedRoster),
  ]);

  await logWorkflowEvent({
    entityId: toId(periodId),
    fromStatus: '',
    toStatus: 'updated',
    actorId,
    action: 'UPDATE_ROSTER_ENTRY',
    reason: `Cập nhật thông tin sinh viên ID ${studentId} trong danh sách`,
  });

  return toPublicRoster(updatedRoster, updatedStudent, updatedUser);
};

module.exports = {
  importRoster,
  addSingleStudent,
  getRosterByPeriod,
  removeStudentFromRoster,
  updateRosterEntry,
};
