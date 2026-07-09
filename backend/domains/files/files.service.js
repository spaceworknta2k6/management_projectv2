const crypto = require('crypto');
const prisma = require('../../config/prisma');
const { getJwtSecret } = require('../../config/jwt');
const { uploadFileBuffer } = require('../../config/cloudinary');
const { Readable } = require('stream');

const testFileStore = new Map();

const toId = (value) => (value ? value.toString() : null);

// Keep uploaded names filesystem/cloud-safe before sending them to the storage provider.
const sanitizeFileName = (originalName) => {
  const baseName = (originalName || 'upload.bin').split(/[\\/]/).pop();
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
};

// Trust file content, not only the browser-provided MIME type.
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
  if (hex === '504B0304') return 'application/zip';
  return null;
};

// Allow common office files because DOCX/PPTX/XLSX are ZIP containers internally.
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
    const ext = (originalName || '').substring(originalName.lastIndexOf('.')).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      return true;
    }
  }

  return false;
};

const hasAnyRole = (user, allowedRoles) => {
  const roles = user.roles || (user.role ? [user.role] : []);
  return roles.some((role) => allowedRoles.includes(role));
};

// Chat attachments can only be downloaded by active members of the room.
const checkChatRoomFileAccess = async (asset, user) => {
  if (asset.ownerType !== 'chat_room' || !asset.ownerId) return null;

  const room = await prisma.chatRoom.findFirst({
    where: {
      id: asset.ownerId.toString(),
      isDeleted: false,
    },
  });

  if (!room) {
    throw { status: 403, message: 'Bạn không có quyền tải tệp trong phòng chat này.' };
  }

  const member = await prisma.chatRoomMember.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId: user._id.toString(),
      },
    },
  });

  if (!member || member.status === 'rejected' || (member.role === 'teacher' && member.status === 'pending')) {
    throw { status: 403, message: 'Bạn không có quyền tải tệp trong phòng chat này.' };
  }

  if (room.type === 'direct' && room.status !== 'accepted') {
    throw { status: 403, message: 'Phòng chat riêng chưa được xác nhận.' };
  }

  return asset;
};

// Upload flow: verify MIME, store the file, then create the FileAsset metadata row.
const uploadFile = async (multerFile, ownerType, ownerId, user) => {
  const fileBuffer = multerFile.buffer;
  const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const verifiedMime = detectMimeFromMagicBytes(fileBuffer);
  if (!verifiedMime || !isMimeCompatible(verifiedMime, multerFile.mimetype, multerFile.originalname)) {
    throw {
      status: 400,
      message: 'Mạo danh định dạng tệp tin: Nội dung nhị phân (magic bytes) không trùng khớp với đuôi mở rộng đã khai báo.'
    };
  }

  const newId = crypto.randomBytes(12).toString('hex');
  let storageKey;
  let storageProvider;

  if (process.env.NODE_ENV === 'test') {
    storageKey = `test-memory:${newId}`;
    storageProvider = 'test-memory';
    testFileStore.set(newId, Buffer.from(fileBuffer));
  } else {
    const publicId = `${newId}-${Date.now()}`;
    const uploadResult = await uploadFileBuffer(fileBuffer, {
      folder: 'management-project/files',
      publicId,
      filename: sanitizeFileName(multerFile.originalname),
      resourceType: 'raw',
    });
    storageKey = `cloudinary:${uploadResult.secure_url}`;
    storageProvider = 'cloudinary';
  }

  const fileAsset = await prisma.fileAsset.create({
    data: {
      id: newId,
      mongoId: newId,
      originalName: multerFile.originalname,
      storageKey,
      mimeClient: multerFile.mimetype,
      mimeVerified: verifiedMime,
      size: multerFile.size,
      sha256: sha256Hash,
      ownerType: ownerType || 'project',
      ownerId: ownerId ? ownerId.toString() : null,
      uploadedBy: user._id.toString(),
      scanStatus: 'clean',
      accessPolicy: 'private',
      metadata: { storageProvider },
    }
  });

  return {
    ...fileAsset,
    _id: fileAsset.id,
    uploadedBy: fileAsset.uploadedBy,
  };
};

const getFileById = async (id) => {
  const asset = await prisma.fileAsset.findUnique({
    where: { id: id.toString() }
  });
  if (!asset) {
    throw { status: 404, message: 'Tệp tin không tồn tại.' };
  }
  return {
    ...asset,
    _id: asset.id,
    uploadedBy: asset.uploadedBy,
  };
};

const checkFileAccess = async (id, user) => {
  const asset = await prisma.fileAsset.findUnique({
    where: { id: id.toString() }
  });
  if (!asset) {
    throw { status: 404, message: 'Tệp tin không tồn tại.' };
  }

  const assetWithMongoProps = {
    ...asset,
    _id: asset.id,
    uploadedBy: asset.uploadedBy,
  };

  if (hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF'])) {
    return assetWithMongoProps;
  }

  const chatRoomAsset = await checkChatRoomFileAccess(assetWithMongoProps, user);
  if (chatRoomAsset) return chatRoomAsset;

  if (asset.uploadedBy === user._id.toString()) {
    return assetWithMongoProps;
  }

  // Project files are readable by project members, supervisor, reviewer, and staff.
  let project = null;
  const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(asset.ownerId || '');
  if (asset.ownerId && isValidObjectId) {
    project = await prisma.project.findFirst({
      where: { id: asset.ownerId.toString(), isDeleted: false }
    });
  }

  if (!project) {
    const student = await prisma.student.findFirst({
      where: { userId: asset.uploadedBy.toString(), isDeleted: false }
    });
    if (student) {
      const activeGroups = await prisma.projectGroup.findMany({
        where: { isDeleted: false, status: { not: 'cancelled' } }
      });
      const group = activeGroups.find(g => {
        const members = g.members || [];
        return members.some(m => toId(m.studentId) === toId(student.id));
      });
      if (group) {
        project = await prisma.project.findFirst({
          where: { groupId: group.id, isDeleted: false }
        });
      }
    }
  }

  if (project) {
    if (user.roles && user.roles.includes('STUDENT') && user.studentId) {
      const group = await prisma.projectGroup.findFirst({
        where: { id: project.groupId, isDeleted: false }
      });
      if (group) {
        const members = group.members || [];
        const isMember = members.some(m => m.studentId.toString() === user.studentId.toString());
        if (isMember) return assetWithMongoProps;
      }
    }

    if (project.supervisorId && user.lecturerId && project.supervisorId.toString() === user.lecturerId.toString()) {
      return assetWithMongoProps;
    }

    if (project.reviewerId && user.lecturerId && project.reviewerId.toString() === user.lecturerId.toString()) {
      return assetWithMongoProps;
    }
  }

  throw { status: 403, message: 'Quyền truy cập bị từ chối: Bạn không có quyền tải xuống tệp tin này.' };
};

// Abstract storage reads so tests can use memory while production uses Cloudinary.
const createStoredFileReadStream = async (asset) => {
  if (asset.storageKey.startsWith('test-memory:')) {
    const fileId = asset.storageKey.slice('test-memory:'.length);
    const buffer = testFileStore.get(fileId);
    if (!buffer) {
      throw { status: 404, message: 'Tệp tin không tồn tại trên hệ thống lưu trữ kiểm thử.' };
    }
    return Readable.from(buffer);
  }

  if (asset.storageKey.startsWith('cloudinary:')) {
    const url = asset.storageKey.slice('cloudinary:'.length);
    const response = await fetch(url);
    if (!response.ok) {
      throw { status: 404, message: 'Tệp tin không tồn tại trên hệ thống lưu trữ Cloudinary.' };
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return Readable.from(buffer);
  }

  throw { status: 500, message: 'Phương thức lưu trữ tệp tin không được hỗ trợ.' };
};

// Signed URLs let the frontend download private files without exposing the JWT in the URL.
const generateSignedUrl = async (id, user) => {
  await checkFileAccess(id, user);

  const expires = Date.now() + 15 * 60 * 1000;
  const secret = getJwtSecret();

  const token = crypto
    .createHmac('sha256', secret)
    .update(`${id}-${expires}`)
    .digest('hex');

  const downloadUrl = `/api/v1/files/${id}/download?token=${token}&expires=${expires}`;
  return { downloadUrl, expires };
};

// Download endpoint validates the short-lived HMAC signature before streaming the file.
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
  const asset = await prisma.fileAsset.update({
    where: { id: id.toString() },
    data: { scanStatus: status }
  });
  return {
    ...asset,
    _id: asset.id,
    uploadedBy: asset.uploadedBy,
  };
};

// Business delete is soft delete so old submissions/history still keep their audit trail.
const deleteFile = async (id, user) => {
  const asset = await prisma.fileAsset.findUnique({
    where: { id: id.toString() }
  });
  if (!asset) {
    throw { status: 404, message: 'Tệp tin không tồn tại.' };
  }

  const isStaff = hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF']);
  const isOwner = asset.uploadedBy === user._id.toString();

  if (!isStaff && !isOwner) {
    throw { status: 403, message: 'Quyền truy cập bị từ chối: Bạn không có quyền xóa tệp tin này.' };
  }

  await prisma.fileAsset.update({
    where: { id: id.toString() },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user._id.toString()
    }
  });

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
