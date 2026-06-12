const express = require('express');
const router = express.Router({ mergeParams: true });

const rostersController = require('./rosters.controller');
const rostersValidator = require('./rosters.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

// Apply protection & static role check globally for all roster operations
router.use(protect);
router.use(requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']));

// Nested Roster CRUD endpoints
router.get('/', rostersController.getRoster);
router.post('/import', rostersValidator.validateRosterImport, rostersController.importRoster);
router.post('/', rostersValidator.validateRosterSingleAdd, rostersController.addSingleStudent);
router.delete('/:studentId', rostersController.removeStudent);
router.patch('/:studentId', rostersValidator.validateRosterUpdate, rostersController.updateRosterEntry);

module.exports = router;
