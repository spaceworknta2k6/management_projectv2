const SubmissionPackage = require('../../models/SubmissionPackage');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');

const initializePackage = async (projectId, phase, actorUserId, actorStudentId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  // Verify group membership
  const group = await ProjectGroup.findById(project.groupId);
  if (!group || !group.members.some(m => m.studentId.toString() === actorStudentId.toString() && m.status === 'accepted')) {
    throw { status: 403, message: 'Bạn không thuộc nhóm sinh viên thực hiện dự án này.' };
  }

  // Check if package already exists
  let pkg = await SubmissionPackage.findOne({ ownerType: 'project', ownerId: projectId, phase });
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
  const pkg = await SubmissionPackage.findById(packageId);
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  // Verify group membership
  const group = await ProjectGroup.findById(pkg.groupId);
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
  const pkg = await SubmissionPackage.findById(packageId);
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  // Verify group membership
  const group = await ProjectGroup.findById(pkg.groupId);
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
  const pkg = await SubmissionPackage.findById(packageId);
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

const getPackageById = async (id) => {
  const pkg = await SubmissionPackage.findById(id);
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }
  return pkg;
};

module.exports = {
  initializePackage,
  uploadPackageItem,
  submitPackage,
  reviewPackageItem,
  getPackageById,
};
