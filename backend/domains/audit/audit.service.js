const WorkflowEvent = require('../../models/WorkflowEvent');

const getAuditEvents = async (query = {}) => {
  return await WorkflowEvent.find(query).populate('actorId').sort({ createdAt: -1 });
};

const getEntityHistory = async (entityType, entityId) => {
  return await WorkflowEvent.find({ entityType, entityId }).populate('actorId').sort({ createdAt: -1 });
};

module.exports = {
  getAuditEvents,
  getEntityHistory,
};
