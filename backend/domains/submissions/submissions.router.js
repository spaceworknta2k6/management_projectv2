const express = require('express');
const router = express.Router();

const submissionsController = require('./submissions.controller');
const submissionsValidator = require('./submissions.validator');
const { protect } = require('../../middlewares/auth.middleware');

// Apply protection globally
router.use(protect);

router.post('/packages', submissionsValidator.validatePackageInitialize, submissionsController.initializePackage);
router.get('/packages/:id', submissionsController.getPackageById);
router.patch('/packages/:id', submissionsValidator.validatePackageUpdate, submissionsController.updatePackage);
router.delete('/packages/:id', submissionsController.deletePackage);
router.post('/packages/:id/items', submissionsValidator.validateItemUpload, submissionsController.uploadPackageItem);
router.post('/packages/:id/submit', submissionsController.submitPackage);
router.post('/packages/:id/review', submissionsValidator.validateItemReview, submissionsController.reviewPackageItem);

module.exports = router;
