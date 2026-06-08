const express = require('express');
const router = express.Router({ mergeParams: true });

const milestonesController = require('./milestones.controller');
const milestonesValidator = require('./milestones.validator');
const { protect } = require('../../middlewares/auth.middleware');

// Apply protection globally for all milestone actions
router.use(protect);

router.get('/', milestonesController.getMilestones);
router.post('/', milestonesValidator.validateMilestoneCreate, milestonesController.createMilestone);
router.patch('/:id', milestonesValidator.validateMilestoneUpdate, milestonesController.updateMilestone);
router.delete('/:id', milestonesController.deleteMilestone);
router.post('/:id/submit', milestonesValidator.validateMilestoneSubmit, milestonesController.submitMilestoneWork);
router.post('/:id/feedback', milestonesValidator.validateMilestoneFeedback, milestonesController.submitFeedback);
router.post('/:id/lock', milestonesController.lockMilestone);
router.post('/:id/unlock', milestonesController.unlockMilestone);


module.exports = router;
