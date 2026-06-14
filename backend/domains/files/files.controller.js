const filesService = require('./files.service');

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Yêu cầu tệp tin tải lên (file) là bắt buộc.' });
    }
    const { ownerType, ownerId } = req.body;
    const asset = await filesService.uploadFile(req.file, ownerType, ownerId, req.user);
    
    res.status(201).json({
      success: true,
      message: 'Tải lên tệp tin và xác thực bảo mật thành công.',
      data: asset,
    });
  } catch (error) {
    next(error);
  }
};

const getFileById = async (req, res, next) => {
  try {
    const asset = await filesService.checkFileAccess(req.params.id, req.user);
    res.status(200).json({
      success: true,
      data: asset,
    });
  } catch (error) {
    next(error);
  }
};

const generateSignedUrl = async (req, res, next) => {
  try {
    const result = await filesService.generateSignedUrl(req.params.id, req.user);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const downloadFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { token, expires } = req.query;

    if (token && expires) {
      // 1. Verify Signed URL signatures
      await filesService.verifySignedUrl(id, token, expires);
    } else {
      // 2. Fallback to active logged-in session permissions checking
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Yêu cầu xác thực tài khoản hoặc mã Signed URL tải xuống hợp lệ.' });
      }
      await filesService.checkFileAccess(id, req.user);
    }

    const asset = await filesService.getFileById(id);
    const fileStream = await filesService.createStoredFileReadStream(asset);
    res.setHeader('Content-Type', asset.mimeVerified || asset.mimeClient);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.originalName)}"`);

    fileStream.on('error', (streamError) => {
      if (res.headersSent) {
        res.destroy(streamError);
        return;
      }
      next(streamError);
    });
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

const updateScanStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['clean', 'infected', 'failed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái scanStatus không hợp lệ.' });
    }
    const asset = await filesService.updateScanStatus(req.params.id, status);
    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái quét mã độc thành công.',
      data: asset,
    });
  } catch (error) {
    next(error);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    const result = await filesService.deleteFile(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  getFileById,
  generateSignedUrl,
  downloadFile,
  updateScanStatus,
  deleteFile,
};
