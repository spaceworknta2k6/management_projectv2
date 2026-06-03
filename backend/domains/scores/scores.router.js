const express = require('express');
const router = express.Router();

const scoresController = require('./scores.controller');
const scoresValidator = require('./scores.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

router.use(protect);

router.get('/score-sheets', scoresController.getScoreSheets);
router.post('/score-sheets', requireRole(['LECTURER']), scoresValidator.validateScoreSheetSubmit, scoresController.submitScoreSheet);
router.get('/score-sheets/:id', scoresController.getScoreSheetById);
router.patch('/score-sheets/:id', requireRole(['LECTURER']), scoresController.updateScoreSheet);
router.post('/score-sheets/:id/lock', requireRole(['LECTURER']), scoresController.lockScoreSheet);

router.post('/final-grades/aggregate/:projectId', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN', 'LECTURER']), scoresController.aggregateFinalGrade);
router.get('/final-grades/:id', scoresController.getFinalGrade);
router.get('/final-grades/project/:projectId', scoresController.getFinalGradeByProjectId);
router.post('/final-grades/:id/publish', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), scoresController.publishFinalGrade);
router.post('/final-grades/:id/lock', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), scoresController.lockFinalGrade);
router.post('/final-grades/:id/resolve-variance', requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']), scoresController.resolveVariance);

module.exports = router;
