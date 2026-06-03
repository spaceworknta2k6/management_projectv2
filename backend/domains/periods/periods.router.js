const express = require('express');
const router = express.Router();

const periodsController = require('./periods.controller');
const periodsValidator = require('./periods.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

// Apply protection globally for all period operations
router.use(protect);

// Publicly readable for all authenticated users (Students, Lecturers, Staff)
router.get('/', periodsController.getPeriods);
router.get('/:id', periodsController.getPeriodById);

// Administrative operations restrict to staff only
router.use(requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']));

router.post('/', periodsValidator.validatePeriodCreate, periodsController.createPeriod);
router.patch('/:id', periodsValidator.validatePeriodUpdate, periodsController.updatePeriod);

// Lifecycle Transition Hooks
router.post('/:id/open-registration', periodsController.openRegistration);
router.post('/:id/start', periodsController.startPeriod);
router.post('/:id/lock-results', periodsController.lockResults);
router.post('/:id/archive', periodsController.archivePeriod);

// Nest Rosters Router under /periods/:periodId/rosters
const rostersRouter = require('../rosters/rosters.router');
router.use('/:periodId/rosters', rostersRouter);

module.exports = router;
