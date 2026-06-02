const express = require('express');
const router = express.Router();

const auditController = require('./audit.controller');
const auditValidator = require('./audit.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

router.use(protect);
router.use(requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF']));

router.get('/events', auditController.getAuditEvents);
router.get('/entities/:entityType/:entityId', auditValidator.validateEntityHistory, auditController.getEntityHistory);

module.exports = router;
