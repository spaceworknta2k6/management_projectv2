require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const User = require('../models/User');
const Student = require('../models/Student');
const Lecturer = require('../models/Lecturer');

const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);

const migrateUsers = async () => {
  const users = await User.find({}, null, { includeDeleted: true }).lean();

  for (const user of users) {
    const id = toId(user._id);
    await prisma.user.upsert({
      where: { mongoId: id },
      create: {
        id,
        mongoId: id,
        fullName: user.fullName,
        email: user.email,
        passwordHash: user.passwordHash,
        roles: user.roles || ['STUDENT'],
        status: user.status || 'active',
        phoneNumber: user.phoneNumber || '',
        cohort: user.cohort || '',
        avatarUrl: user.avatarUrl || '',
        isDeleted: Boolean(user.isDeleted),
        deletedAt: toDate(user.deletedAt),
        deletedBy: toId(user.deletedBy),
        createdAt: toDate(user.createdAt) || new Date(),
        updatedAt: toDate(user.updatedAt) || new Date(),
      },
      update: {
        fullName: user.fullName,
        email: user.email,
        passwordHash: user.passwordHash,
        roles: user.roles || ['STUDENT'],
        status: user.status || 'active',
        phoneNumber: user.phoneNumber || '',
        cohort: user.cohort || '',
        avatarUrl: user.avatarUrl || '',
        isDeleted: Boolean(user.isDeleted),
        deletedAt: toDate(user.deletedAt),
        deletedBy: toId(user.deletedBy),
        updatedAt: toDate(user.updatedAt) || new Date(),
      },
    });
  }

  return users.length;
};

const migrateStudents = async () => {
  const students = await Student.find({}, null, { includeDeleted: true }).lean();

  for (const student of students) {
    const id = toId(student._id);
    const userId = toId(student.userId);

    await prisma.student.upsert({
      where: { mongoId: id },
      create: {
        id,
        mongoId: id,
        userId,
        studentCode: student.studentCode,
        className: student.className,
        cohort: student.cohort,
        major: student.major,
        facultyId: toId(student.facultyId),
        skills: student.skills || [],
        interests: student.interests || [],
        technologies: student.technologies || [],
        isDeleted: Boolean(student.isDeleted),
        deletedAt: toDate(student.deletedAt),
        deletedBy: toId(student.deletedBy),
        createdAt: toDate(student.createdAt) || new Date(),
        updatedAt: toDate(student.updatedAt) || new Date(),
      },
      update: {
        userId,
        studentCode: student.studentCode,
        className: student.className,
        cohort: student.cohort,
        major: student.major,
        facultyId: toId(student.facultyId),
        skills: student.skills || [],
        interests: student.interests || [],
        technologies: student.technologies || [],
        isDeleted: Boolean(student.isDeleted),
        deletedAt: toDate(student.deletedAt),
        deletedBy: toId(student.deletedBy),
        updatedAt: toDate(student.updatedAt) || new Date(),
      },
    });
  }

  return students.length;
};

const migrateLecturers = async () => {
  const lecturers = await Lecturer.find({}, null, { includeDeleted: true }).lean();

  for (const lecturer of lecturers) {
    const id = toId(lecturer._id);
    const userId = toId(lecturer.userId);

    await prisma.lecturer.upsert({
      where: { mongoId: id },
      create: {
        id,
        mongoId: id,
        userId,
        lecturerCode: lecturer.lecturerCode,
        facultyId: toId(lecturer.facultyId),
        departmentId: toId(lecturer.departmentId),
        academicDegree: lecturer.academicDegree || 'master',
        expertise: lecturer.expertise || [],
        maxProjects: lecturer.maxProjects || 5,
        isExternal: Boolean(lecturer.isExternal),
        organization: lecturer.organization || 'PHENIKAA',
        status: lecturer.status || 'active',
        isDeleted: Boolean(lecturer.isDeleted),
        deletedAt: toDate(lecturer.deletedAt),
        deletedBy: toId(lecturer.deletedBy),
        createdAt: toDate(lecturer.createdAt) || new Date(),
        updatedAt: toDate(lecturer.updatedAt) || new Date(),
      },
      update: {
        userId,
        lecturerCode: lecturer.lecturerCode,
        facultyId: toId(lecturer.facultyId),
        departmentId: toId(lecturer.departmentId),
        academicDegree: lecturer.academicDegree || 'master',
        expertise: lecturer.expertise || [],
        maxProjects: lecturer.maxProjects || 5,
        isExternal: Boolean(lecturer.isExternal),
        organization: lecturer.organization || 'PHENIKAA',
        status: lecturer.status || 'active',
        isDeleted: Boolean(lecturer.isDeleted),
        deletedAt: toDate(lecturer.deletedAt),
        deletedBy: toId(lecturer.deletedBy),
        updatedAt: toDate(lecturer.updatedAt) || new Date(),
      },
    });
  }

  return lecturers.length;
};

const main = async () => {
  await connectDB();

  const userCount = await migrateUsers();
  const studentCount = await migrateStudents();
  const lecturerCount = await migrateLecturers();

  console.log('Auth data migrated to PostgreSQL.');
  console.log(`Users: ${userCount}`);
  console.log(`Students: ${studentCount}`);
  console.log(`Lecturers: ${lecturerCount}`);
};

main()
  .catch((error) => {
    console.error('Auth migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
