const mongoose = require('mongoose');
const prisma = require('../../config/prisma');
const ProjectPeriodMirror = require('../../models/ProjectPeriod');
const WorkflowEvent = require('../../models/WorkflowEvent');
const { ACADEMIC_UNIT_DEPARTMENT_IDS, IT_FACULTY_ID } = require('../../constants/academic-units');

const newObjectId = () => new mongoose.Types.ObjectId().toString();
const toId = (value) => (value ? value.toString() : null);

const DATE_FIELDS = [
  'registrationStart',
  'registrationEnd',
  'projectStart',
  'projectEnd',
  'revisionDeadline',
  'archiveDeadline',
  'finalSubmissionDeadline',
  'gradingStart',
  'gradingEnd',
  'resultPublishedAt',
  'topicChangeDeadline',
  'lockedAt',
  'deletedAt',
];

const INT_FIELDS = [
  'groupMinSize',
  'groupMaxSize',
  'appealDaysAfterPublish',
  'appealProcessingDays',
  'minGroupSize',
  'maxGroupSize',
];

const FLOAT_FIELDS = ['varianceThreshold', 'passScore'];

const toPublicPeriod = (period) => {
  if (!period) return null;
  return {
    ...period,
    _id: period.id,
  };
};

const normalizePeriodData = (data = {}) => {
  const normalized = { ...data };

  for (const field of DATE_FIELDS) {
    if (normalized[field] !== undefined) {
      normalized[field] = normalized[field] ? new Date(normalized[field]) : null;
    }
  }

  for (const field of INT_FIELDS) {
    if (normalized[field] !== undefined && normalized[field] !== null && normalized[field] !== '') {
      normalized[field] = parseInt(normalized[field], 10);
    }
  }

  for (const field of FLOAT_FIELDS) {
    if (normalized[field] !== undefined && normalized[field] !== null && normalized[field] !== '') {
      normalized[field] = parseFloat(normalized[field]);
    }
  }

  for (const field of ['facultyId', 'departmentId', 'coordinatorLecturerId', 'rubricId', 'createdBy', 'updatedBy', 'deletedBy']) {
    if (normalized[field] !== undefined) {
      normalized[field] = toId(normalized[field]);
    }
  }

  if (normalized.scoringFormula !== undefined && normalized.scoringFormula instanceof Map) {
    normalized.scoringFormula = Object.fromEntries(normalized.scoringFormula);
  }

  return normalized;
};

const toMongoMirrorData = (period) => ({
  _id: period.id,
  name: period.name,
  schoolYear: period.schoolYear,
  semester: period.semester,
  facultyId: period.facultyId,
  departmentId: period.departmentId,
  type: period.type,
  courseCode: period.courseCode,
  courseName: period.courseName,
  projectType: period.projectType,
  academicUnit: period.academicUnit,
  programId: period.programId,
  programName: period.programName,
  coordinatorLecturerId: period.coordinatorLecturerId,
  allowIndividual: period.allowIndividual,
  allowGroup: period.allowGroup,
  groupMinSize: period.groupMinSize,
  groupMaxSize: period.groupMaxSize,
  registrationStart: period.registrationStart,
  registrationEnd: period.registrationEnd,
  projectStart: period.projectStart,
  projectEnd: period.projectEnd,
  revisionDeadline: period.revisionDeadline,
  archiveDeadline: period.archiveDeadline,
  finalSubmissionDeadline: period.finalSubmissionDeadline,
  gradingStart: period.gradingStart,
  gradingEnd: period.gradingEnd,
  appealDaysAfterPublish: period.appealDaysAfterPublish,
  appealProcessingDays: period.appealProcessingDays,
  resultPublishedAt: period.resultPublishedAt,
  minGroupSize: period.minGroupSize,
  maxGroupSize: period.maxGroupSize,
  topicChangeDeadline: period.topicChangeDeadline,
  varianceThreshold: period.varianceThreshold,
  passScore: period.passScore,
  rubricVersion: period.rubricVersion,
  rubricId: period.rubricId,
  scoringFormula: period.scoringFormula || {},
  status: period.status,
  lockedAt: period.lockedAt,
  createdBy: period.createdBy,
  updatedBy: period.updatedBy,
  isDeleted: period.isDeleted,
  deletedAt: period.deletedAt,
  deletedBy: period.deletedBy,
});

const syncMongoMirror = async (period) => {
  await ProjectPeriodMirror.updateOne(
    { _id: period.id },
    { $set: toMongoMirrorData(period) },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

const logWorkflowEvent = async ({
  entityId,
  fromStatus,
  toStatus,
  actorId,
  actorRoles,
  action,
  reason = '',
}) => WorkflowEvent.create({
  entityType: 'ProjectPeriod',
  entityId,
  fromStatus,
  toStatus,
  actorId,
  actorRoles,
  action,
  reason,
});

const resolveAcademicScope = async (periodData, actorId) => {
  let { facultyId, departmentId } = periodData;

  if (!facultyId || !departmentId) {
    const lecturer = await prisma.lecturer.findFirst({
      where: {
        userId: actorId,
        isDeleted: false,
      },
      select: {
        facultyId: true,
        departmentId: true,
      },
    });
    if (lecturer) {
      facultyId = facultyId || lecturer.facultyId;
      departmentId = departmentId || lecturer.departmentId;
    }
  }

  if (!facultyId || !departmentId) {
    const academicUnit = periodData.academicUnit || 'computer_science';
    facultyId = facultyId || IT_FACULTY_ID;
    departmentId = departmentId || ACADEMIC_UNIT_DEPARTMENT_IDS[academicUnit] || ACADEMIC_UNIT_DEPARTMENT_IDS.computer_science;
  }

  return { facultyId: toId(facultyId), departmentId: toId(departmentId) };
};

const createPeriod = async (periodData, actorId) => {
  const id = newObjectId();
  const { facultyId, departmentId } = await resolveAcademicScope(periodData, actorId);
  const normalized = normalizePeriodData({
    ...periodData,
    facultyId,
    departmentId,
    status: 'draft',
    createdBy: actorId,
    updatedBy: actorId,
  });

  const period = await prisma.projectPeriod.create({
    data: {
      id,
      mongoId: id,
      ...normalized,
    },
  });

  await syncMongoMirror(period);

  await logWorkflowEvent({
    entityId: period.id,
    fromStatus: '',
    toStatus: 'draft',
    actorId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'CREATE_PERIOD',
    reason: 'Khởi tạo đợt đồ án mới',
  });

  return toPublicPeriod(period);
};

const buildPeriodWhere = (query = {}) => {
  const where = { isDeleted: false };
  for (const field of ['status', 'academicUnit', 'schoolYear', 'semester', 'type', 'projectType']) {
    if (query[field]) where[field] = query[field];
  }
  if (query.courseCode) {
    where.courseCode = { contains: query.courseCode, mode: 'insensitive' };
  }
  return where;
};

const getAllPeriods = async (query = {}) => {
  const periods = await prisma.projectPeriod.findMany({
    where: buildPeriodWhere(query),
    orderBy: { createdAt: 'desc' },
  });
  return periods.map(toPublicPeriod);
};

const getPeriodById = async (id) => {
  const period = await prisma.projectPeriod.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }
  return toPublicPeriod(period);
};

const updatePeriod = async (id, updateData, actorId) => {
  const current = await prisma.projectPeriod.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });
  if (!current) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  if (['result_locked', 'archived'].includes(current.status)) {
    throw { status: 400, message: `Không thể chỉnh sửa đợt đồ án đã ở trạng thái [${current.status}].` };
  }

  const data = normalizePeriodData({
    ...updateData,
    updatedBy: actorId,
  });

  const period = await prisma.projectPeriod.update({
    where: { id },
    data,
  });

  await syncMongoMirror(period);

  await logWorkflowEvent({
    entityId: period.id,
    fromStatus: current.status,
    toStatus: period.status,
    actorId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'UPDATE_PERIOD',
    reason: 'Cập nhật cấu hình đợt đồ án',
  });

  return toPublicPeriod(period);
};

const deletePeriod = async (id, actorId) => {
  const current = await prisma.projectPeriod.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });
  if (!current) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại hoặc đã bị xóa.' };
  }

  if (['result_locked', 'archived'].includes(current.status)) {
    throw { status: 400, message: 'Không thể xóa đợt đồ án đã khóa kết quả hoặc lưu trữ.' };
  }

  const period = await prisma.projectPeriod.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
    },
  });

  await syncMongoMirror(period);

  await logWorkflowEvent({
    entityId: period.id,
    fromStatus: current.status,
    toStatus: period.status,
    actorId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'SOFT_DELETE_PERIOD',
    reason: 'Xóa mềm đợt đồ án',
  });

  return { success: true, message: 'Đợt đồ án đã được xóa thành công.' };
};

const transitionStatus = async (id, toStatus, action, actorId, actorRoles = ['FACULTY_STAFF'], reason = '') => {
  const current = await prisma.projectPeriod.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });
  if (!current) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const allowedTransitions = {
    draft: ['registration_open', 'cancelled'],
    registration_open: ['topic_review', 'in_progress', 'cancelled'],
    topic_review: ['in_progress', 'cancelled'],
    in_progress: ['grading', 'cancelled'],
    grading: ['results_published', 'result_locked', 'cancelled'],
    results_published: ['appeal_open', 'result_locked', 'cancelled'],
    appeal_open: ['result_locked', 'cancelled'],
    result_locked: ['archived'],
    archived: [],
  };

  if (!allowedTransitions[current.status] || !allowedTransitions[current.status].includes(toStatus)) {
    throw {
      status: 400,
      message: `Chuyển đổi trạng thái không hợp lệ: Không thể chuyển từ trạng thái [${current.status}] sang [${toStatus}].`,
    };
  }

  const period = await prisma.projectPeriod.update({
    where: { id },
    data: {
      status: toStatus,
      updatedBy: actorId,
      ...(toStatus === 'result_locked' ? { lockedAt: new Date() } : {}),
      ...(toStatus === 'results_published' ? { resultPublishedAt: new Date() } : {}),
    },
  });

  await syncMongoMirror(period);

  await logWorkflowEvent({
    entityId: period.id,
    fromStatus: current.status,
    toStatus,
    actorId,
    actorRoles,
    action,
    reason,
  });

  return toPublicPeriod(period);
};

module.exports = {
  createPeriod,
  getAllPeriods,
  getPeriodById,
  updatePeriod,
  deletePeriod,
  transitionStatus,
};
