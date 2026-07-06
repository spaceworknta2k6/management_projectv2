const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const WorkflowEvent = require('../../utils/workflow-event');
const { randomBytes } = require('crypto');

const newObjectId = () => randomBytes(12).toString('hex');
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
      isDeleted: false,
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
  const activeProject = await prisma.project.findFirst({
    where: {
      periodId,
      studentId,
      status: { not: 'cancelled' },
      isDeleted: false,
    }
  });
  if (activeProject) {
    throw { status: 400, message: 'Sinh viên đang thực hiện dự án hoạt động trong học phần này, không thể xóa khỏi danh sách.' };
  }

  const activeTopic = await prisma.projectTopic.findFirst({
    where: {
      periodId,
      proposedByStudentId: studentId,
      status: { in: ['submitted', 'approved', 'assigned', 'locked', 'changed'] },
      isDeleted: false,
    }
  });
  if (activeTopic) {
    throw { status: 400, message: 'Sinh viên đang có đề tài hoạt động trong học phần này, không thể xóa khỏi danh sách.' };
  }

  const studentGroups = await prisma.projectGroup.findMany({
    where: {
      periodId,
      status: { not: 'cancelled' },
      isDeleted: false,
    }
  });

  const studentGroupIds = studentGroups
    .filter((group) => {
      const members = group.members || [];
      return members.some((m) => toId(m.studentId) === toId(studentId) && m.status === 'accepted');
    })
    .map((group) => group.id);

  if (studentGroupIds.length === 0) return;

  const activeGroupProject = await prisma.project.findFirst({
    where: {
      periodId,
      groupId: { in: studentGroupIds },
      status: { not: 'cancelled' },
      isDeleted: false,
    }
  });
  if (activeGroupProject) {
    throw { status: 400, message: 'Sinh viên thuộc nhóm đang thực hiện dự án hoạt động, không thể xóa khỏi danh sách.' };
  }

  const activeGroupTopic = await prisma.projectTopic.findFirst({
    where: {
      periodId,
      groupId: { in: studentGroupIds },
      status: { in: ['submitted', 'approved', 'assigned', 'locked', 'changed'] },
      isDeleted: false,
    }
  });
  if (activeGroupTopic) {
    throw { status: 400, message: 'Sinh viên thuộc nhóm có đề tài hoạt động, không thể xóa khỏi danh sách.' };
  }
};

const PERIOD_EDITABLE_STATUSES = ['draft', 'open'];

const removeStudentFromRoster = async (periodId, studentId, actorId) => {
  const period = await getPeriodOrThrow(periodId);

  if (!PERIOD_EDITABLE_STATUSES.includes(period.status)) {
    throw {
      status: 400,
      message: `Không thể rút sinh viên khỏi danh sách khi đợt đồ án đang ở trạng thái "${period.status}". Chỉ cho phép khi đợt ở trạng thái đang mở đăng ký.`,
    };
  }

  const rosterEntry = await prisma.projectRoster.findUnique({
    where: {
      periodId_studentId: {
        periodId: toId(periodId),
        studentId: toId(studentId),
      },
    },
  });

  if (!rosterEntry || rosterEntry.isDeleted) {
    throw { status: 404, message: 'Không tìm thấy sinh viên trong danh sách học phần đồ án.' };
  }

  if (rosterEntry.status === 'removed') {
    throw { status: 400, message: 'Sinh viên đã được rút tên trước đó.' };
  }

  await assertStudentCanBeRemoved(toId(periodId), toId(studentId));

  const now = new Date();
  const updatedRoster = await prisma.projectRoster.update({
    where: { id: rosterEntry.id },
    data: {
      status: 'removed',
      isDeleted: true,
      deletedAt: now,
      deletedBy: toId(actorId),
    },
  });

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
