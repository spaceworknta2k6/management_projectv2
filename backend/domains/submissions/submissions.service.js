const SubmissionPackage = require('../../models/SubmissionPackage');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const { assertProjectAccess } = require('../../utils/access-control');

const initializePackage = async (projectId, phase, actorUserId, actorStudentId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  // Verify group membership
  const group = await ProjectGroup.findOne({ _id: project.groupId, isDeleted: { $ne: true } });
  if (!group || !group.members.some(m => m.studentId.toString() === actorStudentId.toString() && m.status === 'accepted')) {
    throw { status: 403, message: 'Bạn không thuộc nhóm sinh viên thực hiện dự án này.' };
  }

  // Check if package already exists
  let pkg = await SubmissionPackage.findOne({ ownerType: 'project', ownerId: projectId, phase, isDeleted: { $ne: true } });
  if (pkg) {
    throw { status: 400, message: `Hồ sơ nộp cho giai đoạn [${phase}] đã được khởi tạo trước đó.` };
  }

  // Define default items template based on phase
  const items = [];
  if (phase === 'proposal') {
    items.push(
      { type: 'report_pdf', required: true, status: 'missing' },
      { type: 'slide', required: false, status: 'missing' }
    );
  } else if (phase === 'progress') {
    items.push({ type: 'report_pdf', required: true, status: 'missing' });
  } else if (phase === 'pre_defense') {
    items.push(
      { type: 'report_pdf', required: true, status: 'missing' },
      { type: 'slide', required: true, status: 'missing' },
      { type: 'source_code', required: false, status: 'missing' }
    );
  } else {
    // post_defense or archive
    items.push(
      { type: 'report_pdf', required: true, status: 'missing' },
      { type: 'source_code', required: true, status: 'missing' }
    );
  }

  // Set default deadline to 14 days from now
  const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  pkg = new SubmissionPackage({
    ownerType: 'project',
    ownerId: projectId,
    groupId: project.groupId,
    periodId: project.periodId,
    phase,
    deadline,
    items,
    status: 'draft',
  });

  await pkg.save();
  return pkg;
};

const uploadPackageItem = async (packageId, type, fileId, actorUserId, actorStudentId) => {
  const pkg = await SubmissionPackage.findOne({ _id: packageId, isDeleted: { $ne: true } });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  // Verify group membership
  const group = await ProjectGroup.findOne({ _id: pkg.groupId, isDeleted: { $ne: true } });
  if (!group || !group.members.some(m => m.studentId.toString() === actorStudentId.toString() && m.status === 'accepted')) {
    throw { status: 403, message: 'Bạn không thuộc nhóm sinh viên thực hiện dự án này.' };
  }

  if (!['draft', 'needs_revision'].includes(pkg.status)) {
    throw { status: 400, message: 'Chỉ có thể tải lên tài liệu khi gói hồ sơ ở trạng thái draft hoặc needs_revision.' };
  }

  // Find or insert item with specific type
  let item = pkg.items.find(i => i.type === type);
  if (!item) {
    pkg.items.push({
      type,
      fileId,
      required: false,
      status: 'submitted',
    });
  } else {
    item.fileId = fileId;
    item.status = 'submitted';
  }

  await pkg.save();
  return pkg;
};

const submitPackage = async (packageId, actorUserId, actorStudentId) => {
  const pkg = await SubmissionPackage.findOne({ _id: packageId, isDeleted: { $ne: true } });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  // Verify group membership
  const group = await ProjectGroup.findOne({ _id: pkg.groupId, isDeleted: { $ne: true } });
  if (!group || !group.members.some(m => m.studentId.toString() === actorStudentId.toString() && m.status === 'accepted')) {
    throw { status: 403, message: 'Bạn không thuộc nhóm sinh viên thực hiện dự án này.' };
  }

  if (!['draft', 'needs_revision'].includes(pkg.status)) {
    throw { status: 400, message: 'Không thể nộp gói hồ sơ đã gửi hoặc đã được khóa.' };
  }

  // Validate that all required items are submitted (non-missing, non-rejected)
  const missingRequired = pkg.items.some(i => i.required && ['missing', 'rejected'].includes(i.status));
  if (missingRequired) {
    throw { status: 400, message: 'Không thể nộp bài: Vui lòng tải lên đầy đủ các tài liệu bắt buộc (required).' };
  }

  pkg.status = 'submitted';
  pkg.submittedBy = actorUserId;
  pkg.submittedAt = new Date();
  await pkg.save();

  // If phase is pre_defense, auto transition parent project status to pre_defense_submitted
  if (pkg.phase === 'pre_defense') {
    const project = await Project.findById(pkg.ownerId);
    if (project && project.status === 'in_progress') {
      project.status = 'pre_defense_submitted';
      await project.save();
    }
  }

  return pkg;
};

const reviewPackageItem = async (packageId, type, status, actorUserId, actorLecturerId) => {
  const pkg = await SubmissionPackage.findOne({ _id: packageId, isDeleted: { $ne: true } });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  const project = await Project.findById(pkg.ownerId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  // Verify actor lecturer is supervisor or reviewer
  const isSupervisor = actorLecturerId && project.supervisorId.toString() === actorLecturerId.toString();
  const isReviewer = actorLecturerId && project.reviewerId && project.reviewerId.toString() === actorLecturerId.toString();
  if (!isSupervisor && !isReviewer) {
    throw { status: 403, message: 'Bạn không phải Giảng viên hướng dẫn hoặc Phản biện của dự án này.' };
  }

  // Find item and update its status
  const item = pkg.items.find(i => i.type === type);
  if (!item) {
    throw { status: 404, message: `Không tìm thấy tài liệu loại [${type}] trong gói hồ sơ.` };
  }

  item.status = status; // 'accepted' or 'rejected'

  // Audit package status:
  // If any required item is rejected, set status to needs_revision.
  // If all required items are accepted, set status to accepted.
  const anyRejectedRequired = pkg.items.some(i => i.required && i.status === 'rejected');
  const allRequiredAccepted = pkg.items.filter(i => i.required).every(i => i.status === 'accepted');

  if (anyRejectedRequired) {
    pkg.status = 'needs_revision';
  } else if (allRequiredAccepted) {
    pkg.status = 'accepted';
    pkg.reviewedBy = actorUserId;
    pkg.reviewedAt = new Date();
  }

  await pkg.save();

  // Link status change to Project workspace
  if (pkg.phase === 'pre_defense' && pkg.status === 'accepted') {
    project.status = 'supervisor_reviewed';
    await project.save();
  }

  return pkg;
};

const canManagePackage = (pkg, user) => {
  const isStaff = user.roles && user.roles.some(role => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(role));
  return {
    isStaff,
    isStudent: Boolean(user.studentId),
  };
};

const ensureStudentInPackageGroup = async (pkg, studentId) => {
  const group = await ProjectGroup.findOne({ _id: pkg.groupId, isDeleted: { $ne: true } });
  if (!group || !group.members.some(m => m.studentId.toString() === studentId.toString() && m.status === 'accepted')) {
    throw { status: 403, message: 'Bạn không thuộc nhóm sinh viên thực hiện dự án này.' };
  }
};

const updatePackage = async (packageId, data, user) => {
  const pkg = await SubmissionPackage.findOne({ _id: packageId, isDeleted: { $ne: true } });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  const { isStaff, isStudent } = canManagePackage(pkg, user);
  if (!isStaff) {
    if (!isStudent) {
      throw { status: 403, message: 'Bạn không có quyền chỉnh sửa gói hồ sơ nộp này.' };
    }
    await ensureStudentInPackageGroup(pkg, user.studentId);
    if (!['draft', 'needs_revision'].includes(pkg.status)) {
      throw { status: 400, message: 'Sinh viên chỉ được chỉnh sửa gói hồ sơ khi còn nháp hoặc cần chỉnh sửa.' };
    }
  }

  if (data.deadline !== undefined) {
    if (!isStaff) {
      throw { status: 403, message: 'Chỉ giáo vụ hoặc quản trị viên mới có quyền chỉnh hạn nộp.' };
    }
    pkg.deadline = data.deadline;
  }
  if (data.status !== undefined) {
    if (!isStaff) {
      throw { status: 403, message: 'Chỉ giáo vụ hoặc quản trị viên mới có quyền chỉnh trạng thái gói nộp.' };
    }
    pkg.status = data.status;
  }
  if (data.items !== undefined) {
    pkg.items = data.items;
  }

  return await pkg.save();
};

const deletePackage = async (packageId, user) => {
  const pkg = await SubmissionPackage.findOne({ _id: packageId, isDeleted: { $ne: true } });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại hoặc đã bị xóa.' };
  }

  const { isStaff, isStudent } = canManagePackage(pkg, user);
  if (!isStaff) {
    if (!isStudent) {
      throw { status: 403, message: 'Bạn không có quyền xóa gói hồ sơ nộp này.' };
    }
    await ensureStudentInPackageGroup(pkg, user.studentId);
    if (!['draft', 'needs_revision'].includes(pkg.status)) {
      throw { status: 400, message: 'Sinh viên chỉ được xóa gói hồ sơ khi còn nháp hoặc cần chỉnh sửa.' };
    }
  }

  if (pkg.status === 'accepted' && !isStaff) {
    throw { status: 400, message: 'Gói hồ sơ đã được duyệt nên không thể xóa.' };
  }

  pkg.isDeleted = true;
  pkg.deletedAt = new Date();
  pkg.deletedBy = user._id;
  await pkg.save();

  return { success: true, message: 'Gói hồ sơ nộp đã được xóa thành công.' };
};

const getPackageById = async (id, user = {}) => {
  const pkg = await SubmissionPackage.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }
  const project = await Project.findById(pkg.ownerId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }
  await assertProjectAccess(project, user);

  return pkg;
};

module.exports = {
  initializePackage,
  uploadPackageItem,
  submitPackage,
  reviewPackageItem,
  updatePackage,
  deletePackage,
  getPackageById,
};
