const express = require('express');
const router = express.Router();
const multer = require('multer');

const filesController = require('./files.controller');
const filesValidator = require('./files.validator');
const { protect, requireRole } = require('../../middlewares/auth.middleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const optionalProtect = async (req, res, next) => {
  const { token, expires } = req.query;
  if (token && expires) {
    // If download has Signed URL credentials, bypass immediate JWT check
    return next();
  }
  return protect(req, res, next);
};

// Administrative updates
router.post('/:id/scan-result', protect, requireRole(['SYSTEM_ADMIN', 'FACULTY_STAFF']), filesValidator.validateFileId, filesController.updateScanStatus);

// Session secured routes
router.post('/upload', protect, upload.single('file'), filesController.uploadFile);
router.get('/:id', protect, filesValidator.validateFileId, filesController.getFileById);
router.get('/:id/download-url', protect, filesValidator.validateFileId, filesController.generateSignedUrl);
router.delete('/:id', protect, filesValidator.validateFileId, filesController.deleteFile);

// Dual authentication download endpoint (supports signed URL OR active JWT)
router.get('/:id/download', optionalProtect, filesValidator.validateFileId, filesController.downloadFile);

module.exports = router;
