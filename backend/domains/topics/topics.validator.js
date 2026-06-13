const mongoose = require('mongoose');
const ProjectGroup = require('../../models/ProjectGroup');
const ProjectRoster = require('../../models/ProjectRoster');
const Lecturer = require('../../models/Lecturer');

const OWNER_TYPES = ['student', 'group'];

const validateTopicPropose = async (req, res, next) => {
  try {
    if (!req.body.ownerType) {
      req.body.ownerType = req.body.groupId ? 'group' : undefined;
    }

    if (req.body.ownerType !== 'student' && !req.body.groupId && req.user.studentId) {
      const group = await ProjectGroup.findOne({
        periodId: req.body.periodId,
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        members: {
          $elemMatch: {
            studentId: req.user.studentId,
            status: 'accepted',
          },
        },
      });

      if (group) {
        req.body.ownerType = 'group';
        req.body.groupId = group._id.toString();
      }
    }

    if (!req.body.ownerType) {
      req.body.ownerType = 'student';
    }

    if (!req.body.proposedSupervisorId) {
      const supervisor = await Lecturer.findOne({ isDeleted: false });
      if (supervisor) {
        req.body.proposedSupervisorId = supervisor._id.toString();
      }
    }

    if (!req.body.objectives) {
      req.body.objectives = 'Phat trien va hoan thien he thong nghien cuu de xuat dat hieu nang cao.';
    }
    if (!req.body.scope) {
      req.body.scope = 'Phan tich ly thuyet, thiet ke kien truc he thong va xay dung phien ban thu nghiem.';
    }
    if (!req.body.expectedResult) {
      req.body.expectedResult = 'Bao cao ky thuat chi tiet cung ma nguon chuong trinh ung dung hoan chinh.';
    }
    if (!req.body.plan) {
      req.body.plan = 'Tuan 1-4: Nghien cuu tai lieu. Tuan 5-10: Thiet ke va lap trinh. Tuan 11-15: Viet bao cao.';
    }

    const {
      periodId,
      ownerType,
      groupId,
      technologies,
      proposedSupervisorId,
    } = req.body;

    const errors = [];

    if (!periodId || !mongoose.Types.ObjectId.isValid(periodId)) {
      errors.push({ field: 'periodId', code: 'PERIOD_ID_INVALID', message: 'Ma dot do an (periodId) khong hop le.' });
    }

    if (!OWNER_TYPES.includes(ownerType)) {
      errors.push({ field: 'ownerType', code: 'OWNER_TYPE_INVALID', message: 'Hinh thuc thuc hien phai la ca nhan hoac theo nhom.' });
    }

    if (ownerType === 'group') {
      if (!groupId) {
        errors.push({ field: 'groupId', code: 'GROUP_REQUIRED', message: 'Ban can chon mot nhom da tham gia trong dot do an nay truoc khi de xuat de tai.' });
      } else if (!mongoose.Types.ObjectId.isValid(groupId)) {
        errors.push({ field: 'groupId', code: 'GROUP_ID_INVALID', message: 'Ma nhom do an (groupId) khong hop le.' });
      }
    }

    if (ownerType === 'student' && periodId && mongoose.Types.ObjectId.isValid(periodId) && req.user.studentId) {
      const roster = await ProjectRoster.findOne({
        periodId,
        studentId: req.user.studentId,
        status: 'active',
      });

      if (!roster) {
        errors.push({ field: 'periodId', code: 'ROSTER_REQUIRED', message: 'Ban chua co trong danh sach tham gia dot nay.' });
      }
    }

    if (!proposedSupervisorId || !mongoose.Types.ObjectId.isValid(proposedSupervisorId)) {
      errors.push({ field: 'proposedSupervisorId', code: 'SUPERVISOR_ID_INVALID', message: 'Ma giang vien de xuat huong dan khong hop le.' });
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
    const ProjectTopic = require('../../models/ProjectTopic');
    const topic = await ProjectTopic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, message: 'De tai khong ton tai.' });
    }

    if (!req.body.periodId) req.body.periodId = topic.periodId.toString();
    if (!req.body.ownerType) req.body.ownerType = topic.ownerType || (topic.groupId ? 'group' : 'student');
    if (!req.body.groupId && topic.groupId) req.body.groupId = topic.groupId.toString();
    if (!req.body.proposedSupervisorId && topic.proposedSupervisorId) {
      req.body.proposedSupervisorId = topic.proposedSupervisorId.toString();
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
