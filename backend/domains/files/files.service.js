const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const FileAsset = require('../../models/FileAsset');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const DefenseSession = require('../../models/DefenseSession');
const Committee = require('../../models/Committee');
const { getJwtSecret } = require('../../config/jwt');

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

  if (verifiedMime === 'application/zip') {
    const allowedExtensions = ['.zip', '.docx', '.pptx', '.xlsx'];
    const ext = path.extname(originalName).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      return true;
    }
  }

  return false;
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

  // 3. Save file locally in private upload folder
  const uploadDir = path.join(__dirname, '../../public/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const uniqueFileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${multerFile.originalname}`;
  const relativePath = path.join('public/uploads', uniqueFileName);
  const absolutePath = path.join(uploadDir, uniqueFileName);

  fs.writeFileSync(absolutePath, fileBuffer);

  // 4. Create FileAsset Record
  const fileAsset = new FileAsset({
    originalName: multerFile.originalname,
    storageKey: relativePath,
    mimeClient: multerFile.mimetype,
    mimeVerified: verifiedMime,
    size: multerFile.size,
    sha256: sha256Hash,
    ownerType: ownerType || 'project',
    ownerId: (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) ? ownerId : null,
    uploadedBy: user._id,
    scanStatus: 'clean', // Automatically clean for mock context
    accessPolicy: 'private'
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
  if (hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF'])) {
    return asset;
  }

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

    // If user is a Committee member
    if (user.lecturerId) {
      const session = await DefenseSession.findOne({ projectId: project._id, isDeleted: { $ne: true } });
      if (session) {
        const committee = await Committee.findOne({ _id: session.committeeId, isDeleted: { $ne: true } });
        if (committee) {
          const isCommitteeMember = committee.members.some(m => m.lecturerId.toString() === user.lecturerId.toString());
          if (isCommitteeMember) return asset;
        }
      }
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

  const isStaff = hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF']);
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
  generateSignedUrl,
  verifySignedUrl,
  updateScanStatus,
  deleteFile,
};
