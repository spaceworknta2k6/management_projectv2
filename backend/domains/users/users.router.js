const express = require('express');
const router = express.Router();

const usersController = require('./users.controller');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

// Áp dụng protect và requireRole(['SYSTEM_ADMIN']) cho toàn bộ routes quản lý tài khoản
router.use(protect);
router.use(requireRole(['SYSTEM_ADMIN']));

router.get('/', usersController.getUsers);
router.patch('/:id/role', usersController.updateUserRole);
router.patch('/:id/status', usersController.updateUserStatus);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
