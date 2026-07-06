const EvaluationRubric = require('../../models/EvaluationRubric');
const ProjectPeriod = require('../../models/ProjectPeriod');
const prisma = require('../../config/prisma');

const toId = (value) => (value ? value.toString() : null);

const toPrismaRubricData = (rubric) => {
  const source = typeof rubric.toObject === 'function' ? rubric.toObject() : rubric;
  return {
    id: toId(source._id),
    mongoId: toId(source._id),
    name: source.name,
    description: source.description || '',
    version: source.version,
    criteria: source.criteria || {},
    isDeleted: Boolean(source.isDeleted),
    deletedAt: source.deletedAt || null,
    deletedBy: toId(source.deletedBy),
    createdAt: source.createdAt || new Date(),
    updatedAt: source.updatedAt || new Date(),
  };
};

const syncPrismaRubric = async (rubric) => {
  const data = toPrismaRubricData(rubric);
  await prisma.evaluationRubric.upsert({
    where: { mongoId: data.mongoId },
    create: data,
    update: {
      name: data.name,
      description: data.description,
      version: data.version,
      criteria: data.criteria,
      isDeleted: data.isDeleted,
      deletedAt: data.deletedAt,
      deletedBy: data.deletedBy,
      updatedAt: data.updatedAt,
    },
  });
};

const createRubric = async (data, user) => {
  const rubric = new EvaluationRubric({
    ...data,
    createdBy: user._id,
    updatedBy: user._id,
  });
  const saved = await rubric.save();
  await syncPrismaRubric(saved);
  return saved;
};

const getRubrics = async (query = {}) => {
  return await EvaluationRubric.find({ ...query, isDeleted: { $ne: true } })
    .populate('createdBy', 'fullName email')
    .populate('updatedBy', 'fullName email');
};

const getRubricById = async (id) => {
  const rubric = await EvaluationRubric.findOne({ _id: id, isDeleted: { $ne: true } })
    .populate('createdBy', 'fullName email')
    .populate('updatedBy', 'fullName email');
  if (!rubric) {
    throw { status: 404, message: 'Tiêu chí đánh giá (Rubric) không tồn tại hoặc đã bị xóa.' };
  }
  return rubric;
};

const updateRubric = async (id, data, user) => {
  const rubric = await EvaluationRubric.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!rubric) {
    throw { status: 404, message: 'Tiêu chí đánh giá (Rubric) không tồn tại hoặc đã bị xóa.' };
  }

  // Update fields
  if (data.name !== undefined) rubric.name = data.name;
  if (data.description !== undefined) rubric.description = data.description;
  if (data.version !== undefined) rubric.version = data.version;
    if (data.criteria !== undefined) {
      if (data.criteria.SUPERVISOR) rubric.criteria.SUPERVISOR = data.criteria.SUPERVISOR;
      if (data.criteria.REVIEWER) rubric.criteria.REVIEWER = data.criteria.REVIEWER;
      if (data.criteria.SECOND_MARKER) rubric.criteria.SECOND_MARKER = data.criteria.SECOND_MARKER;
    }
  rubric.updatedBy = user._id;

  const saved = await rubric.save();
  await syncPrismaRubric(saved);
  return saved;
};

const deleteRubric = async (id, user) => {
  const rubric = await EvaluationRubric.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!rubric) {
    throw { status: 404, message: 'Tiêu chí đánh giá (Rubric) không tồn tại hoặc đã bị xóa.' };
  }

  // Check if rubric is linked to any active/existing project period
  const periodsCount = await ProjectPeriod.countDocuments({ rubricId: id, isDeleted: { $ne: true } });
  if (periodsCount > 0) {
    throw { status: 400, message: 'Không thể xóa Rubric này vì đang được liên kết với đợt đồ án đang hoạt động.' };
  }

  rubric.isDeleted = true;
  rubric.deletedAt = new Date();
  rubric.deletedBy = user._id;

  const saved = await rubric.save();
  await syncPrismaRubric(saved);
  return saved;
};

module.exports = {
  createRubric,
  getRubrics,
  getRubricById,
  updateRubric,
  deleteRubric,
};
