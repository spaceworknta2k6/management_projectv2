const auditService = require('./audit.service');

const getAuditEvents = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.actorId) filter.actorId = req.query.actorId;
    if (req.query.action) filter.action = req.query.action;

    const events = await auditService.getAuditEvents(filter);
    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

const getEntityHistory = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const history = await auditService.getEntityHistory(entityType, entityId);
    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditEvents,
  getEntityHistory,
};
