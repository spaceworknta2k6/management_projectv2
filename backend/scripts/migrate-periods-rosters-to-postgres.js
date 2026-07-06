require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const ProjectPeriod = require('../models/ProjectPeriod');
const ProjectRoster = require('../models/ProjectRoster');

const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);
const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const migratePeriods = async () => {
  const periods = await ProjectPeriod.find({}, null, { includeDeleted: true }).lean();

  for (const period of periods) {
    const id = toId(period._id);
    const data = {
      id,
      mongoId: id,
      name: period.name,
      schoolYear: period.schoolYear,
      semester: period.semester,
      facultyId: toId(period.facultyId),
      departmentId: toId(period.departmentId),
      type: period.type || null,
      courseCode: period.courseCode || null,
      courseName: period.courseName || null,
      projectType: period.projectType || null,
      academicUnit: period.academicUnit || 'computer_science',
      programId: period.programId || null,
      programName: period.programName || null,
      coordinatorLecturerId: toId(period.coordinatorLecturerId),
      allowIndividual: period.allowIndividual !== false,
      allowGroup: period.allowGroup !== false,
      groupMinSize: period.groupMinSize ?? 2,
      groupMaxSize: period.groupMaxSize ?? 5,
      registrationStart: toDate(period.registrationStart),
      registrationEnd: toDate(period.registrationEnd),
      projectStart: toDate(period.projectStart),
      projectEnd: toDate(period.projectEnd),
      revisionDeadline: toDate(period.revisionDeadline),
      archiveDeadline: toDate(period.archiveDeadline),
      finalSubmissionDeadline: toDate(period.finalSubmissionDeadline),
      gradingStart: toDate(period.gradingStart),
      gradingEnd: toDate(period.gradingEnd),
      appealDaysAfterPublish: period.appealDaysAfterPublish ?? 7,
      appealProcessingDays: period.appealProcessingDays ?? 7,
      resultPublishedAt: toDate(period.resultPublishedAt),
      minGroupSize: period.minGroupSize ?? 1,
      maxGroupSize: period.maxGroupSize ?? 3,
      topicChangeDeadline: toDate(period.topicChangeDeadline),
      varianceThreshold: period.varianceThreshold ?? 2.0,
      passScore: period.passScore ?? 5.0,
      rubricVersion: period.rubricVersion,
      rubricId: toId(period.rubricId),
      scoringFormula: toPlainObject(period.scoringFormula),
      status: period.status || 'draft',
      lockedAt: toDate(period.lockedAt),
      createdBy: toId(period.createdBy),
      updatedBy: toId(period.updatedBy),
      isDeleted: Boolean(period.isDeleted),
      deletedAt: toDate(period.deletedAt),
      deletedBy: toId(period.deletedBy),
      createdAt: toDate(period.createdAt) || new Date(),
      updatedAt: toDate(period.updatedAt) || new Date(),
    };

    await prisma.projectPeriod.upsert({
      where: { mongoId: id },
      create: data,
      update: {
        ...data,
        id: undefined,
        mongoId: undefined,
        createdAt: undefined,
      },
    });
  }

  return periods.length;
};

const migrateRosters = async () => {
  const rosters = await ProjectRoster.find({}).lean();

  for (const roster of rosters) {
    const id = toId(roster._id);
    const data = {
      id,
      mongoId: id,
      periodId: toId(roster.periodId),
      studentId: toId(roster.studentId),
      classSection: roster.classSection,
      status: roster.status || 'active',
      importedBy: toId(roster.importedBy),
      importedAt: toDate(roster.importedAt) || new Date(),
      createdAt: toDate(roster.createdAt) || new Date(),
      updatedAt: toDate(roster.updatedAt) || new Date(),
    };

    await prisma.projectRoster.upsert({
      where: { mongoId: id },
      create: data,
      update: {
        ...data,
        id: undefined,
        mongoId: undefined,
        createdAt: undefined,
      },
    });
  }

  return rosters.length;
};

const main = async () => {
  await connectDB();
  const periodCount = await migratePeriods();
  const rosterCount = await migrateRosters();
  console.log('Periods and rosters migrated to PostgreSQL.');
  console.log(`ProjectPeriods: ${periodCount}`);
  console.log(`ProjectRosters: ${rosterCount}`);
};

main()
  .catch((error) => {
    console.error('Periods/rosters migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
