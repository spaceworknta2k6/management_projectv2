const { isObjectId } = require('../../utils/object-id');
const prisma = require('../../config/prisma');
const { ACADEMIC_UNITS, TOPIC_DOMAINS } = require('../../constants/academic-units');

const OWNER_TYPES = ['student', 'group'];
const toId = (value) => (value ? value.toString() : null);

const resolveLecturerByEmail = async (email) => {
  const value = String(email || '').trim().toLowerCase();
  if (!value) return null;

  const user = await prisma.user.findFirst({
    where: {
      email: value,
      roles: { has: 'LECTURER' },
      status: 'active',
      isDeleted: false,
    }
  });
  if (!user) return null;

  return prisma.lecturer.findFirst({
    where: {
      userId: user.id,
      status: 'active',
      isDeleted: false,
    }
  });
};

const validateTopicPropose = async (req, res, next) => {
  try {
    const isStudent = req.user.roles && req.user.roles.includes('STUDENT') && !req.user.roles.includes('FACULTY_STAFF') && !req.user.roles.includes('SYSTEM_ADMIN');

    if (isStudent) {
      if (!req.body.ownerType) {
        req.body.ownerType = req.body.groupId ? 'group' : undefined;
      }

      if (req.body.ownerType !== 'student' && !req.body.groupId && req.user.studentId) {
        const activeGroups = await prisma.projectGroup.findMany({
          where: {
            periodId: req.body.periodId ? req.body.periodId.toString() : '',
            status: { not: 'cancelled' },
            isDeleted: false,
          }
        });
        const group = activeGroups.find(g => {
          const members = g.members || [];
          return members.some(m => toId(m.studentId) === toId(req.user.studentId) && m.status === 'accepted');
        });

        if (group) {
          req.body.ownerType = 'group';
          req.body.groupId = group.id;
        }
      }

      if (!req.body.ownerType) {
        req.body.ownerType = 'student';
      }
    }

    const {
      periodId,
      ownerType,
      groupId,
      technologies,
      proposedSupervisorId,
      proposedSupervisorEmail,
      academicUnit,
      topicDomain,
    } = req.body;

    const errors = [];

    if (!periodId || !isObjectId(periodId)) {
      errors.push({ field: 'periodId', code: 'PERIOD_ID_INVALID', message: 'Ma dot do an (periodId) khong hop le.' });
    }
    if (academicUnit !== undefined && !ACADEMIC_UNITS.includes(academicUnit)) {
      errors.push({ field: 'academicUnit', code: 'ACADEMIC_UNIT_INVALID', message: 'Khoa/đơn vị chuyên môn của đề tài không hợp lệ.' });
    }
    if (topicDomain !== undefined && !TOPIC_DOMAINS.includes(topicDomain)) {
      errors.push({ field: 'topicDomain', code: 'TOPIC_DOMAIN_INVALID', message: 'Hướng chuyên môn của đề tài không hợp lệ.' });
    }

    if (isStudent) {
      if (!OWNER_TYPES.includes(ownerType)) {
        errors.push({ field: 'ownerType', code: 'OWNER_TYPE_INVALID', message: 'Hinh thuc thuc hien phai la ca nhan hoac theo nhom.' });
      }

      if (ownerType === 'group') {
        if (!groupId) {
          errors.push({ field: 'groupId', code: 'GROUP_REQUIRED', message: 'Ban can chon mot nhom da tham gia trong dot do an nay truoc khi de xuat de tai.' });
        } else if (!isObjectId(groupId)) {
          errors.push({ field: 'groupId', code: 'GROUP_ID_INVALID', message: 'Ma nhom do an (groupId) khong hop le.' });
        }
      }

      if (ownerType === 'student' && periodId && isObjectId(periodId) && req.user.studentId) {
        const roster = await prisma.projectRoster.findFirst({
          where: {
            periodId: periodId.toString(),
            studentId: req.user.studentId.toString(),
            status: 'active',
          }
        });

        if (!roster) {
          errors.push({ field: 'periodId', code: 'ROSTER_REQUIRED', message: 'Ban chua co trong danh sach tham gia dot nay.' });
        }
      }

      if (!proposedSupervisorId && proposedSupervisorEmail) {
        const lecturer = await resolveLecturerByEmail(proposedSupervisorEmail);
        if (lecturer) {
          req.body.proposedSupervisorId = lecturer.id;
        }
      }

      if (!req.body.proposedSupervisorId || !isObjectId(req.body.proposedSupervisorId)) {
        errors.push({ field: 'proposedSupervisorEmail', code: 'SUPERVISOR_EMAIL_INVALID', message: 'Email giang vien huong dan khong hop le hoac khong ton tai.' });
      }
    } else {
      if (!proposedSupervisorId && proposedSupervisorEmail) {
        const lecturer = await resolveLecturerByEmail(proposedSupervisorEmail);
        if (lecturer) {
          req.body.proposedSupervisorId = lecturer.id;
        }
      }

      if (req.body.proposedSupervisorId && !isObjectId(req.body.proposedSupervisorId)) {
        errors.push({ field: 'proposedSupervisorEmail', code: 'SUPERVISOR_EMAIL_INVALID', message: 'Email giang vien huong dan khong hop le hoac khong ton tai.' });
      }
    }

    const requiredStrings = {
      title: 'Ten de tai',
      summary: 'Tom tat de tai',
      objectives: 'Muc tieu de tai',
      scope: 'Pham vi de tai',
      expectedResult: 'San pham dau ra du kien',
      plan: 'Ke hoach thuc hien',
    };

    for (const [field, label] of Object.entries(requiredStrings)) {
      const val = req.body[field];
      if (!val || typeof val !== 'string' || val.trim() === '') {
        errors.push({ field, code: `${field.toUpperCase()}_REQUIRED`, message: `${label} la bat buoc.` });
      }
    }

    if (technologies !== undefined && !Array.isArray(technologies)) {
      errors.push({ field: 'technologies', code: 'TECHNOLOGIES_MUST_BE_ARRAY', message: 'Danh sach cong nghe su dung phai la mot mang.' });
    }

    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Du lieu de xuat de tai khong hop le.',
        errors,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const validateTopicUpdate = async (req, res, next) => {
  try {
    const topic = await prisma.projectTopic.findUnique({
      where: { id: req.params.id }
    });
    if (!topic || topic.isDeleted) {
      return res.status(404).json({ success: false, message: 'De tai khong ton tai.' });
    }

    if (!req.body.periodId) req.body.periodId = topic.periodId;
    if (!req.body.ownerType) req.body.ownerType = topic.ownerType || (topic.groupId ? 'group' : 'student');
    if (!req.body.groupId && topic.groupId) req.body.groupId = topic.groupId;
    if (!req.body.proposedSupervisorId && topic.proposedSupervisorId) {
      req.body.proposedSupervisorId = topic.proposedSupervisorId;
    }

    return validateTopicPropose(req, res, next);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateTopicPropose,
  validateTopicUpdate,
};
