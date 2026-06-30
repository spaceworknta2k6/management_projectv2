const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const FileAsset = require('../../models/FileAsset');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const { getJwtSecret } = require('../../config/jwt');

const PRIVATE_UPLOAD_DIR = path.join(__dirname, '../../uploads/private');
const GRIDFS_STORAGE_PREFIX = 'gridfs:';
const STORAGE_PROVIDERS = new Set(['local', 'gridfs']);

const getStorageProvider = () => {
  const provider = (process.env.STORAGE_PROVIDER || 'local').trim().toLowerCase();
  if (!STORAGE_PROVIDERS.has(provider)) {
    throw { status: 500, message: 'Cấu hình STORAGE_PROVIDER không hợp lệ. Chỉ hỗ trợ local hoặc gridfs.' };
  }
  return provider;
};

const sanitizeFileName = (originalName) => {
  const baseName = path.basename(originalName || 'upload.bin');
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const getGridFsBucket = () => {
  if (!mongoose.connection.db) {
    throw { status: 500, message: 'Kết nối MongoDB chưa sẵn sàng để lưu tệp tin.' };
  }

  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: process.env.GRIDFS_BUCKET_NAME || 'fileAssets',
  });
};

const uploadToGridFs = (multerFile, sha256Hash, verifiedMime, ownerType, ownerId, user) => (
  new Promise((resolve, reject) => {
    const bucket = getGridFsBucket();
    const uploadStream = bucket.openUploadStream(sanitizeFileName(multerFile.originalname), {
      contentType: verifiedMime || multerFile.mimetype,
      metadata: {
        originalName: multerFile.originalname,
        mimeClient: multerFile.mimetype,
        mimeVerified: verifiedMime,
        sha256: sha256Hash,
        ownerType: ownerType || 'project',
        ownerId: (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) ? new mongoose.Types.ObjectId(ownerId) : null,
        uploadedBy: user._id,
      },
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(`${GRIDFS_STORAGE_PREFIX}${uploadStream.id.toString()}`));
    uploadStream.end(multerFile.buffer);
  })
);

const saveToLocalStorage = (multerFile) => {
  if (!fs.existsSync(PRIVATE_UPLOAD_DIR)) {
    fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
  }

  const uniqueFileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${sanitizeFileName(multerFile.originalname)}`;
  const relativePath = path.join('uploads/private', uniqueFileName);
  const absolutePath = path.join(PRIVATE_UPLOAD_DIR, uniqueFileName);

  fs.writeFileSync(absolutePath, multerFile.buffer);
  return relativePath;
};

const resolveStoredFilePath = (storageKey) => {
  const backendRoot = path.join(__dirname, '../..');
  const absolutePath = path.resolve(backendRoot, storageKey);

  if (!absolutePath.startsWith(backendRoot + path.sep)) {
    throw { status: 400, message: 'Đường dẫn tệp tin không hợp lệ.' };
  }

  return absolutePath;
};

const getGridFsObjectId = (storageKey) => {
  const fileId = storageKey.slice(GRIDFS_STORAGE_PREFIX.length);
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw { status: 400, message: 'Mã lưu trữ GridFS không hợp lệ.' };
  }
  return new mongoose.Types.ObjectId(fileId);
};

const createStoredFileReadStream = async (asset) => {
  if (asset.storageKey.startsWith(GRIDFS_STORAGE_PREFIX)) {
    const bucket = getGridFsBucket();
    const fileObjectId = getGridFsObjectId(asset.storageKey);
    const [storedFile] = await bucket.find({ _id: fileObjectId }).limit(1).toArray();
    if (!storedFile) {
      throw { status: 404, message: 'Tệp tin GridFS không tồn tại trên hệ thống lưu trữ.' };
    }
    return bucket.openDownloadStream(fileObjectId);
  }

  const absolutePath = resolveStoredFilePath(asset.storageKey);
  if (!fs.existsSync(absolutePath)) {
    throw { status: 404, message: 'Tệp tin vật lý không tồn tại trên hệ thống lưu trữ.' };
  }

  return fs.createReadStream(absolutePath);
};

const hasAnyRole = (user, allowedRoles) => {
  const roles = user.roles || (user.role ? [user.role] : []);
  return roles.some((role) => allowedRoles.includes(role));
};

const detectMimeFromMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 4) return null;
  const hex = buffer.toString('hex', 0, 4).toUpperCase();

  if (hex === '25504446') return 'application/pdf';
  if (hex === '89504E47') return 'image/png';
  if (hex.startsWith('FFD8FF')) return 'image/jpeg';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp';
  if (hex === '504B0304') return 'application/zip'; // Standard ZIP / DOCX / PPTX PK header
  return null;
};

const isMimeCompatible = (verifiedMime, clientMime, originalName) => {
  if (!verifiedMime) return false;

  if (verifiedMime === 'application/pdf' && clientMime === 'application/pdf') {
    return true;
  }
  if (verifiedMime === 'image/png' && clientMime === 'image/png') return true;
  if (verifiedMime === 'image/jpeg' && (clientMime === 'image/jpeg' || clientMime === 'image/jpg')) return true;
  if (verifiedMime === 'image/webp' && clientMime === 'image/webp') return true;

  if (verifiedMime === 'application/zip') {
    const allowedExtensions = ['.zip', '.docx', '.pptx', '.xlsx'];
    const ext = path.extname(originalName).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      return true;
    }
  }

  return false;
};

const checkChatRoomFileAccess = async (asset, user) => {
  if (asset.ownerType !== 'chat_room' || !asset.ownerId) return null;

  const ChatRoom = require('../../models/ChatRoom');
  const room = await ChatRoom.findOne({
    _id: asset.ownerId,
    isDeleted: { $ne: true },
    memberIds: user._id,
  });

  if (!room) {
    throw { status: 403, message: 'Bạn không có quyền tải tệp trong phòng chat này.' };
  }

  if (room.type === 'direct' && room.status !== 'accepted') {
    throw { status: 403, message: 'Phòng chat riêng chưa được xác nhận.' };
  }

  return asset;
};

const uploadFile = async (multerFile, ownerType, ownerId, user) => {
  const fileBuffer = multerFile.buffer;

  // 1. Calculate SHA-256 Hashing for Integrity Check
  const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // 2. Binary Magic Bytes Analysis
  const verifiedMime = detectMimeFromMagicBytes(fileBuffer);
  if (!verifiedMime || !isMimeCompatible(verifiedMime, multerFile.mimetype, multerFile.originalname)) {
    throw {
      status: 400,
      message: 'Mạo danh định dạng tệp tin: Nội dung nhị phân (magic bytes) không trùng khớp với đuôi mở rộng đã khai báo.'
    };
  }

  // 3. Save file in the configured private storage backend.
  const storageProvider = getStorageProvider();
  const storageKey = storageProvider === 'gridfs'
    ? await uploadToGridFs(multerFile, sha256Hash, verifiedMime, ownerType, ownerId, user)
    : saveToLocalStorage(multerFile);

  // 4. Create FileAsset Record
  const fileAsset = new FileAsset({
    originalName: multerFile.originalname,
    storageKey,
    mimeClient: multerFile.mimetype,
    mimeVerified: verifiedMime,
    size: multerFile.size,
    sha256: sha256Hash,
    ownerType: ownerType || 'project',
    ownerId: (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) ? ownerId : null,
    uploadedBy: user._id,
    scanStatus: 'clean', // Automatically clean for mock context
    accessPolicy: 'private',
    metadata: {
      storageProvider,
    },
  });

  return await fileAsset.save();
};

const getFileById = async (id) => {
  const asset = await FileAsset.findOne({ _id: id });
  if (!asset) {
    throw { status: 404, message: 'Tệp tin không tồn tại.' };
  }
  return asset;
};

const checkFileAccess = async (id, user) => {
  const asset = await FileAsset.findOne({ _id: id });
  if (!asset) {
    throw { status: 404, message: 'Tệp tin không tồn tại.' };
  }

  // Case 1: Global Admin or Faculty Staff bypass
  if (hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF'])) {
    return asset;
  }

  const chatRoomAsset = await checkChatRoomFileAccess(asset, user);
  if (chatRoomAsset) return chatRoomAsset;

  // Case 2: Uploader is the owner
  if (asset.uploadedBy.toString() === user._id.toString()) {
    return asset;
  }

  // Case 3: Project context scoping
  let project = null;
  if (asset.ownerId && mongoose.Types.ObjectId.isValid(asset.ownerId)) {
    project = await Project.findById(asset.ownerId);
  }
  
  // Fallback: Nếu không tìm thấy Project bằng ownerId (ví dụ trường hợp ownerId là null hoặc không khớp dự án nào)
  if (!project) {
    const Student = require('../../models/Student');
    const student = await Student.findOne({ userId: asset.uploadedBy });
    if (student) {
      const group = await ProjectGroup.findOne({
        'members.studentId': student._id,
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' }
      });
      if (group) {
        project = await Project.findOne({ groupId: group._id });
      }
    }
  }

  if (project) {
    // If student is part of the project group
    if (user.roles && user.roles.includes('STUDENT') && user.studentId) {
      const group = await ProjectGroup.findOne({ _id: project.groupId, isDeleted: { $ne: true } });
      if (group) {
        const isMember = group.members.some(m => m.studentId.toString() === user.studentId.toString());
        if (isMember) return asset;
      }
    }

    // If user is the Supervisor
    if (project.supervisorId && user.lecturerId && project.supervisorId.toString() === user.lecturerId.toString()) {
      return asset;
    }

    // If user is the Reviewer
    if (project.reviewerId && user.lecturerId && project.reviewerId.toString() === user.lecturerId.toString()) {
      return asset;
    }


  }

  throw { status: 403, message: 'Quyền truy cập bị từ chối: Bạn không có quyền tải xuống tệp tin này.' };
};

const generateSignedUrl = async (id, user) => {
  // Enforce access control check before URL signing
  await checkFileAccess(id, user);

  const expires = Date.now() + 15 * 60 * 1000; // 15 minutes validity
  const secret = getJwtSecret();
  
  const token = crypto
    .createHmac('sha256', secret)
    .update(`${id}-${expires}`)
    .digest('hex');

  const downloadUrl = `/api/v1/files/${id}/download?token=${token}&expires=${expires}`;
  return { downloadUrl, expires };
};

const verifySignedUrl = async (id, token, expires) => {
  if (!token || !expires) {
    throw { status: 403, message: 'Quyền truy cập bị từ chối: Thiếu tham số xác thực Signed URL.' };
  }

  if (Date.now() > Number(expires)) {
    throw { status: 403, message: 'Quyền truy cập bị từ chối: Liên kết tải xuống đã hết hạn.' };
  }

  const secret = getJwtSecret();
  const expectedToken = crypto
    .createHmac('sha256', secret)
    .update(`${id}-${expires}`)
    .digest('hex');

  if (token !== expectedToken) {
    throw { status: 403, message: 'Quyền truy cập bị từ chối: Chữ ký xác thực tệp tin không hợp lệ.' };
  }

  return true;
};

const updateScanStatus = async (id, status) => {
  const asset = await FileAsset.findOne({ _id: id });
  if (!asset) {
    throw { status: 404, message: 'Tệp tin không tồn tại.' };
  }

  asset.scanStatus = status;
  return await asset.save();
};

const deleteFile = async (id, user) => {
  const asset = await FileAsset.findOne({ _id: id });
  if (!asset) {
    throw { status: 404, message: 'Tệp tin không tồn tại.' };
  }

  const isStaff = hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF']);
  const isOwner = asset.uploadedBy.toString() === user._id.toString();

  if (!isStaff && !isOwner) {
    throw { status: 403, message: 'Quyền truy cập bị từ chối: Bạn không có quyền xóa tệp tin này.' };
  }

  asset.isDeleted = true;
  asset.deletedAt = new Date();
  asset.deletedBy = user._id;
  await asset.save();

  return { success: true, message: 'Tệp tin đã được xóa thành công.' };
};

module.exports = {
  uploadFile,
  getFileById,
  checkFileAccess,
  createStoredFileReadStream,
  generateSignedUrl,
  verifySignedUrl,
  updateScanStatus,
  deleteFile,
};
