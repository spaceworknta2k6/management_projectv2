const { randomBytes } = require('crypto');
const prisma = require('../../config/prisma');

const resolveUser = async (id) => {
  if (!id || typeof id !== 'string') return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id },
        { mongoId: id },
      ],
      isDeleted: false,
    },
    select: { id: true, fullName: true, email: true }
  });

  return user ? { ...user, _id: user.id } : null;
};

const mapRubric = async (rubric) => ({
  ...rubric,
  _id: rubric.id,
  createdBy: await resolveUser(rubric.createdBy),
  updatedBy: await resolveUser(rubric.updatedBy),
});

const createRubric = async (data, user) => {
  const newId = randomBytes(12).toString('hex');
  const now = new Date();
  const rubric = await prisma.evaluationRubric.create({
    data: {
      id: newId,
      mongoId: newId,
      name: data.name,
      description: data.description || '',
      version: data.version,
      criteria: data.criteria || {},
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    }
  });

  return mapRubric(rubric);
};

const getRubrics = async (query = {}) => {
  const where = { isDeleted: false };
  if (query.name) where.name = { contains: query.name, mode: 'insensitive' };

  const rubrics = await prisma.evaluationRubric.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  const mappedRubrics = [];
  for (const rub of rubrics) {
    mappedRubrics.push(await mapRubric(rub));
  }

  return mappedRubrics;
};

const getRubricById = async (id) => {
  const rubric = await prisma.evaluationRubric.findFirst({
    where: { id: id.toString(), isDeleted: false }
  });
  if (!rubric) {
    throw { status: 404, message: 'Tiêu chí đánh giá (Rubric) không tồn tại hoặc đã bị xóa.' };
  }

  return mapRubric(rubric);
};

const updateRubric = async (id, data, user) => {
  const rubric = await prisma.evaluationRubric.findFirst({
    where: { id: id.toString(), isDeleted: false }
  });
  if (!rubric) {
    throw { status: 404, message: 'Tiêu chí đánh giá (Rubric) không tồn tại hoặc đã bị xóa.' };
  }

  const updatePayload = { updatedAt: new Date() };
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.version !== undefined) updatePayload.version = data.version;

  if (data.criteria !== undefined) {
    const criteria = { ...rubric.criteria };
    if (data.criteria.SUPERVISOR) criteria.SUPERVISOR = data.criteria.SUPERVISOR;
    if (data.criteria.REVIEWER) criteria.REVIEWER = data.criteria.REVIEWER;
    if (data.criteria.SECOND_MARKER) criteria.SECOND_MARKER = data.criteria.SECOND_MARKER;
    updatePayload.criteria = criteria;
  }

  const updated = await prisma.evaluationRubric.update({
    where: { id: id.toString() },
    data: updatePayload
  });

  return mapRubric(updated);
};

const deleteRubric = async (id, user) => {
  const rubric = await prisma.evaluationRubric.findFirst({
    where: { id: id.toString(), isDeleted: false }
  });
  if (!rubric) {
    throw { status: 404, message: 'Tiêu chí đánh giá (Rubric) không tồn tại hoặc đã bị xóa.' };
  }

  const periodsCount = await prisma.projectPeriod.count({
    where: {
      rubricId: id.toString(),
      isDeleted: false
    }
  });
  if (periodsCount > 0) {
    throw { status: 400, message: 'Không thể xóa Rubric này vì đang được liên kết với đợt đồ án đang hoạt động.' };
  }

  const deleted = await prisma.evaluationRubric.update({
    where: { id: id.toString() },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user._id.toString()
    }
  });

  return {
    ...deleted,
    _id: deleted.id
  };
};

module.exports = {
  createRubric,
  getRubrics,
  getRubricById,
  updateRubric,
  deleteRubric,
};
