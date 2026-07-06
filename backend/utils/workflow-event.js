const prisma = require('../config/prisma');
const { randomBytes } = require('crypto');

const newObjectId = () => randomBytes(12).toString('hex');
const toId = (value) => (value ? value.toString() : null);

const toPublicEvent = (event) => {
  if (!event) return null;
  return {
    ...event,
    _id: event.id,
  };
};

const toPlainMetadata = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const toWhere = (filter = {}) => {
  const where = {};

  if (filter._id) where.id = toId(filter._id);
  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.entityId) where.entityId = toId(filter.entityId);
  if (filter.action) where.action = filter.action;
  if (filter.actorId) where.actorId = toId(filter.actorId);

  return where;
};

const toOrderBy = (sortSpec = {}) => {
  const [[field, direction] = []] = Object.entries(sortSpec);
  if (!field) return undefined;
  return { [field]: direction === -1 || direction === 'desc' ? 'desc' : 'asc' };
};

const create = async (data) => {
  const id = data._id ? toId(data._id) : newObjectId();
  const event = await prisma.workflowEvent.create({
    data: {
      id,
      mongoId: id,
      entityType: data.entityType,
      entityId: toId(data.entityId),
      fromStatus: data.fromStatus || null,
      toStatus: data.toStatus,
      actorId: toId(data.actorId),
      actorRoles: data.actorRoles || [],
      action: data.action,
      reason: data.reason || null,
      metadata: toPlainMetadata(data.metadata),
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    },
  });

  return toPublicEvent(event);
};

const findOne = async (filter = {}) => {
  const event = await prisma.workflowEvent.findFirst({
    where: toWhere(filter),
    orderBy: { createdAt: 'desc' },
  });
  return toPublicEvent(event);
};

const find = (filter = {}) => ({
  sort: async (sortSpec = {}) => {
    const events = await prisma.workflowEvent.findMany({
      where: toWhere(filter),
      orderBy: toOrderBy(sortSpec),
    });
    return events.map(toPublicEvent);
  },
  then: (resolve, reject) => {
    prisma.workflowEvent.findMany({ where: toWhere(filter) })
      .then((events) => events.map(toPublicEvent))
      .then(resolve, reject);
  },
});

const deleteMany = async (filter = {}) => {
  const result = await prisma.workflowEvent.deleteMany({
    where: toWhere(filter),
  });
  return { acknowledged: true, deletedCount: result.count };
};

module.exports = {
  create,
  findOne,
  find,
  deleteMany,
};
