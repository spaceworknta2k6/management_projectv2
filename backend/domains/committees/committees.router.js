const express = require('express');
const router = express.Router();

const committeesController = require('./committees.controller');
const committeesValidator = require('./committees.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

router.use(protect);

router.get('/', committeesController.getCommittees);
router.post('/', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF']), committeesValidator.validateCommitteeCreate, committeesController.createCommittee);
router.get('/:id', committeesController.getCommitteeById);

router.patch('/:id', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF']), committeesValidator.validateCommitteeUpdate, committeesController.updateCommittee);
router.post('/:id/approve', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF']), committeesController.approveCommittee);
router.post('/:id/activate', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF']), committeesController.activateCommittee);
router.post('/:id/finish', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF']), committeesController.finishCommittee);
router.delete('/:id', requireRole(['FACULTY_STAFF', 'DEPARTMENT_STAFF']), committeesController.deleteCommittee);

module.exports = router;
