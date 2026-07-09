const express = require('express');
const router = express.Router();

const statsController = require('./stats.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.use(protect);

router.get('/summary', statsController.getSummary);

module.exports = router;
