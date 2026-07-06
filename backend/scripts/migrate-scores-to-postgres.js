require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const prisma = require('../config/prisma');
const EvaluationRubric = require('../models/EvaluationRubric');
const ScoreSheet = require('../models/ScoreSheet');
const FinalGrade = require('../models/FinalGrade');

const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);
const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const migrateRubrics = async () => {
  const rubrics = await EvaluationRubric.find({}, null, { includeDeleted: true }).lean();

  for (const r of rubrics) {
    const id = toId(r._id);

    const criteria = r.criteria || {};
    const formattedCriteria = {
      SUPERVISOR: Array.isArray(criteria.SUPERVISOR)
        ? criteria.SUPERVISOR.map((item) => ({
            criteriaCode: item.criteriaCode,
            criteriaName: item.criteriaName,
            maxScore: item.maxScore,
            weight: item.weight ?? 1.0,
          }))
        : [],
      REVIEWER: Array.isArray(criteria.REVIEWER)
        ? criteria.REVIEWER.map((item) => ({
            criteriaCode: item.criteriaCode,
            criteriaName: item.criteriaName,
            maxScore: item.maxScore,
            weight: item.weight ?? 1.0,
          }))
        : [],
      SECOND_MARKER: Array.isArray(criteria.SECOND_MARKER)
        ? criteria.SECOND_MARKER.map((item) => ({
            criteriaCode: item.criteriaCode,
            criteriaName: item.criteriaName,
            maxScore: item.maxScore,
            weight: item.weight ?? 1.0,
          }))
        : [],
    };

    const data = {
      id,
      mongoId: id,
      name: r.name,
      description: r.description || '',
      version: r.version,
      criteria: formattedCriteria,
      isDeleted: Boolean(r.isDeleted),
      deletedAt: toDate(r.deletedAt),
      deletedBy: toId(r.deletedBy),
      createdAt: toDate(r.createdAt) || new Date(),
      updatedAt: toDate(r.updatedAt) || new Date(),
    };

    await prisma.evaluationRubric.upsert({
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

  return rubrics.length;
};

const migrateScoreSheets = async () => {
  const sheets = await ScoreSheet.find({}).lean();

  for (const s of sheets) {
    const id = toId(s._id);

    const criteriaScores = Array.isArray(s.criteriaScores)
      ? s.criteriaScores.map((item) => ({
          criteriaCode: item.criteriaCode,
          criteriaName: item.criteriaName,
          maxScore: item.maxScore,
          score: item.score,
          weight: item.weight ?? 1.0,
        }))
      : [];

    const data = {
      id,
      mongoId: id,
      rubricId: toId(s.rubricId),
      rubricRole: s.rubricRole,
      rubricVersion: s.rubricVersion,
      targetType: s.targetType,
      targetId: toId(s.targetId),
      projectId: toId(s.projectId),
      ownerType: s.ownerType || null,
      ownerId: toId(s.ownerId),
      studentId: toId(s.studentId),
      groupId: toId(s.groupId),
      periodId: toId(s.periodId),
      graderId: toId(s.graderId),
      graderRole: s.graderRole,
      criteriaScores,
      rawTotal: s.rawTotal || 0,
      roundedTotal: s.roundedTotal || 0,
      comment: s.comment || '',
      consentForDefense: s.consentForDefense !== false,
      lockedAt: toDate(s.lockedAt),
      digitalSignature: s.digitalSignature || null,
      version: s.version || 0,
      createdAt: toDate(s.createdAt) || new Date(),
      updatedAt: toDate(s.updatedAt) || new Date(),
    };

    await prisma.scoreSheet.upsert({
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

  return sheets.length;
};

const migrateFinalGrades = async () => {
  const grades = await FinalGrade.find({}).lean();

  for (const g of grades) {
    const id = toId(g._id);

    const componentScores = toPlainObject(g.componentScores);
    const varianceFlags = Array.isArray(g.varianceFlags)
      ? g.varianceFlags.map((item) => ({
          type: item.type,
          maxDifference: item.maxDifference,
          resolvedBy: toId(item.resolvedBy),
          resolvedAt: toDate(item.resolvedAt),
          resolution: item.resolution || '',
        }))
      : [];

    const data = {
      id,
      mongoId: id,
      projectId: toId(g.projectId),
      ownerType: g.ownerType || null,
      ownerId: toId(g.ownerId),
      studentId: toId(g.studentId),
      groupId: toId(g.groupId),
      periodId: toId(g.periodId),
      evaluationMode: g.evaluationMode || 'standard',
      componentScores,
      finalScore: g.finalScore || 0,
      letterGrade: g.letterGrade,
      passStatus: g.passStatus || 'pending',
      varianceFlags,
      formulaVersion: g.formulaVersion,
      publishedAt: toDate(g.publishedAt),
      lockedAt: toDate(g.lockedAt),
      createdAt: toDate(g.createdAt) || new Date(),
      updatedAt: toDate(g.updatedAt) || new Date(),
    };

    await prisma.finalGrade.upsert({
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

  return grades.length;
};

const main = async () => {
  await connectDB();
  const rubricCount = await migrateRubrics();
  const sheetCount = await migrateScoreSheets();
  const gradeCount = await migrateFinalGrades();
  console.log('Scores and Rubrics migrated to PostgreSQL.');
  console.log(`EvaluationRubrics: ${rubricCount}`);
  console.log(`ScoreSheets: ${sheetCount}`);
  console.log(`FinalGrades: ${gradeCount}`);
};

main()
  .catch((error) => {
    console.error('Scores migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
