const express = require('express');
const router = express.Router();

const projectsController = require('./projects.controller');
const projectsValidator = require('./projects.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

// Apply protection globally
router.use(protect);

router.get('/', projectsController.getProjects);
router.get('/:id', projectsController.getProjectById);
router.post('/:id/mark-in-progress', projectsController.markInProgress);

// Staff administrative actions
router.post('/:id/assign-reviewer', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), projectsValidator.validateAssignReviewer, projectsController.assignReviewer);
router.post('/:id/mark-ready-for-grading', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), projectsController.markReadyForGrading);
router.post('/:id/finalize', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), projectsController.finalizeProject);
router.post('/:id/cancel', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), projectsController.cancelProject);

// Nest Milestones Router under /projects/:projectId/milestones
const milestonesRouter = require('../milestones/milestones.router');
router.use('/:projectId/milestones', milestonesRouter);

module.exports = router;
