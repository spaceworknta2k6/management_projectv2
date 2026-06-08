const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const ProjectPeriod = require('../../models/ProjectPeriod');
const ProjectRoster = require('../../models/ProjectRoster');
const User = require('../../models/User');
const Student = require('../../models/Student');
const WorkflowEvent = require('../../models/WorkflowEvent');

const logWorkflowEvent = async ({
  entityId,
  fromStatus,
  toStatus,
  actorId,
  action,
  reason = '',
}) => {
  return await WorkflowEvent.create({
    entityType: 'ProjectRoster',
    entityId,
    fromStatus,
    toStatus,
    actorId,
    actorRoles: ['FACULTY_STAFF'],
    action,
    reason,
  });
};

const getOrCreateStudent = async (studentData, passwordHash, facultyId) => {
  const { studentCode, fullName, email, classSection } = studentData;

  // 1. Check if user already exists
  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      roles: ['STUDENT'],
      status: 'active',
    });
  }

  // 2. Check if student profile exists
  let student = await Student.findOne({ studentCode });
  if (!student) {
    student = await Student.create({
      userId: user._id,
      studentCode,
      className: studentData.className || classSection, // Default classname from section
      cohort: studentData.cohort || 'K67', // Standard cohort fallback
      major: studentData.major || 'Công nghệ thông tin',
      facultyId,
    });
  }

  return student;
};

const importRoster = async (periodId, rosterList, actorId) => {
  const period = await ProjectPeriod.findOne({ _id: periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  // Generate a standard hashed password for new student accounts
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const importedCodes = [];
  let useTransaction = true;
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      for (const item of rosterList) {
        // Retrieve or create student and user profile
        const student = await getOrCreateStudent(item, passwordHash, period.facultyId);

        // Check if already registered in the roster
        let rosterEntry = await ProjectRoster.findOne({ periodId, studentId: student._id });
        
        if (!rosterEntry) {
          rosterEntry = await ProjectRoster.create([{
            periodId,
            studentId: student._id,
            classSection: item.classSection,
            status: 'active',
            importedBy: actorId,
            importedAt: new Date(),
          }], { session });
        } else if (rosterEntry.status === 'removed') {
          rosterEntry.status = 'active';
          rosterEntry.classSection = item.classSection;
          rosterEntry.importedBy = actorId;
          rosterEntry.importedAt = new Date();
          await rosterEntry.save({ session });
        }

        importedCodes.push(student.studentCode);
      }
    });

    console.log(`Successfully imported ${importedCodes.length} students into roster.`);
  } catch (txError) {
    const isStandaloneError = 
      txError.message.includes('Transaction numbers are only allowed') ||
      txError.message.includes('retryable writes') ||
      txError.code === 20;

    if (isStandaloneError) {
      console.warn('⚠️ MongoDB deployment is standalone. Falling back to non-transactional import...');
      useTransaction = false;
    } else {
      throw txError;
    }
  } finally {
    await session.endSession();
  }

  // Sequential non-transactional fallback execution for standalone servers
  if (!useTransaction) {
    importedCodes.length = 0;
    for (const item of rosterList) {
      const student = await getOrCreateStudent(item, passwordHash, period.facultyId);

      let rosterEntry = await ProjectRoster.findOne({ periodId, studentId: student._id });
      
      if (!rosterEntry) {
        rosterEntry = await ProjectRoster.create({
          periodId,
          studentId: student._id,
          classSection: item.classSection,
          status: 'active',
          importedBy: actorId,
          importedAt: new Date(),
        });
      } else if (rosterEntry.status === 'removed') {
        rosterEntry.status = 'active';
        rosterEntry.classSection = item.classSection;
        rosterEntry.importedBy = actorId;
        rosterEntry.importedAt = new Date();
        await rosterEntry.save();
      }

      importedCodes.push(student.studentCode);
    }
    console.log(`Successfully imported ${importedCodes.length} students into roster without transaction fallback.`);
  }

  // Log workflow audit
  await logWorkflowEvent({
    entityId: periodId,
    fromStatus: '',
    toStatus: 'active',
    actorId,
    action: 'IMPORT_ROSTER',
    reason: `Import thành công danh sách gồm ${importedCodes.length} sinh viên`,
  });

  return importedCodes;
};

const addSingleStudent = async (periodId, studentData, actorId) => {
  const period = await ProjectPeriod.findOne({ _id: periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const student = await getOrCreateStudent(studentData, passwordHash, period.facultyId);

  let rosterEntry = await ProjectRoster.findOne({ periodId, studentId: student._id });
  if (!rosterEntry) {
    rosterEntry = await ProjectRoster.create({
      periodId,
      studentId: student._id,
      classSection: studentData.classSection,
      status: 'active',
      importedBy: actorId,
      importedAt: new Date(),
    });
  } else if (rosterEntry.status === 'removed') {
    rosterEntry.status = 'active';
    rosterEntry.classSection = studentData.classSection;
    rosterEntry.importedBy = actorId;
    rosterEntry.importedAt = new Date();
    await rosterEntry.save();
  } else {
    throw { status: 400, message: 'Sinh viên đã tồn tại trong đợt đồ án này.' };
  }

  await logWorkflowEvent({
    entityId: periodId,
    fromStatus: 'removed',
    toStatus: 'active',
    actorId,
    action: 'ADD_STUDENT_ROSTER',
    reason: `Thêm thủ công sinh viên ${student.studentCode} vào danh sách`,
  });

  return student;
};

const getRosterByPeriod = async (periodId) => {
  return await ProjectRoster.find({ periodId, status: 'active' })
    .populate({
      path: 'studentId',
      populate: { path: 'userId', select: 'fullName email status' },
    })
    .sort({ createdAt: -1 });
};

const removeStudentFromRoster = async (periodId, studentId, actorId) => {
  const rosterEntry = await ProjectRoster.findOne({ periodId, studentId });
  if (!rosterEntry) {
    throw { status: 404, message: 'Không tìm thấy sinh viên trong danh sách đợt đồ án.' };
  }

  if (rosterEntry.status === 'removed') {
    throw { status: 400, message: 'Sinh viên đã được rút tên trước đó.' };
  }

  rosterEntry.status = 'removed';
  await rosterEntry.save();

  await logWorkflowEvent({
    entityId: periodId,
    fromStatus: 'active',
    toStatus: 'removed',
    actorId,
    action: 'REMOVE_STUDENT_ROSTER',
    reason: `Xóa sinh viên ID ${studentId} khỏi danh sách đợt đồ án`,
  });

  return rosterEntry;
};

module.exports = {
  importRoster,
  addSingleStudent,
  getRosterByPeriod,
  removeStudentFromRoster,
};
