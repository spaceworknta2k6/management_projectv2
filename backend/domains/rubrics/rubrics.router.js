const express = require('express');
const router = express.Router();

const rubricsController = require('./rubrics.controller');
const rubricsValidator = require('./rubrics.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

router.use(protect);

// Allowed for all authenticated users to read rubrics
router.get('/', rubricsController.getRubrics);
router.get('/:id', rubricsController.getRubricById);

// Restricted to staff only to modify rubrics
router.use(requireRole(['FACULTY_STAFF', 'SYSTEM_ADMIN']));

router.post('/', rubricsValidator.validateRubricSubmit, rubricsController.createRubric);
router.patch('/:id', rubricsValidator.validateRubricSubmit, rubricsController.updateRubric);
router.delete('/:id', rubricsController.deleteRubric);

module.exports = router;
