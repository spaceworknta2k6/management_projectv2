const prisma = require('../../config/prisma');
const { assertProjectAccess } = require('../../utils/access-control');
const { resolveProjectOwner, isStudentOwner } = require('../../utils/project-owner');
const notificationsService = require('../notifications/notifications.service');
const { randomBytes } = require('crypto');

const newObjectId = () => randomBytes(12).toString('hex');
const toId = (value) => (value ? value.toString() : null);

const toPublicPackage = (pkg) => {
  if (!pkg) return null;
  return {
    ...pkg,
    _id: pkg.id,
  };
};

const resolveSubmissionOwnerFields = (data) => {
  const resolved = { ...data };
  if (!resolved.projectOwnerType && resolved.groupId) resolved.projectOwnerType = 'group';
  if (!resolved.projectOwnerId && resolved.projectOwnerType === 'group' && resolved.groupId) resolved.projectOwnerId = resolved.groupId;
  if (!resolved.projectOwnerId && resolved.projectOwnerType === 'student' && resolved.studentId) resolved.projectOwnerId = resolved.studentId;
  if (!resolved.studentId && resolved.projectOwnerType === 'student' && resolved.projectOwnerId) resolved.studentId = resolved.projectOwnerId;
  return resolved;
};

const isAcceptedGroupMember = (group, studentId) => {
  if (!group || !studentId) return false;
  const members = group.members || [];
  return members.some(
    (member) => toId(member.studentId) === toId(studentId) && member.status === 'accepted'
  );
};

const getProjectStudentUserIds = async (projectId) => {
  const project = await prisma.project.findFirst({
    where: { id: toId(projectId) }
  });
  if (!project) return [];

  const userIds = [];
  if (project.studentId) {
    const student = await prisma.student.findFirst({
      where: { id: toId(project.studentId), isDeleted: false }
    });
    if (student && student.userId) {
      userIds.push(student.userId.toString());
    }
  } else if (project.groupId) {
    const group = await prisma.projectGroup.findFirst({
      where: { id: toId(project.groupId), isDeleted: false }
    });
    if (group) {
      const members = group.members || [];
      const studentIds = members.filter(m => m.status === 'accepted' && m.studentId).map(m => toId(m.studentId));
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds }, isDeleted: false }
      });
      for (const s of students) {
        if (s.userId) userIds.push(s.userId.toString());
      }
    }
  }
  return userIds;
};

const getPackageProjectOwner = (pkg) => {
  if (pkg.projectOwnerType === 'student' || pkg.studentId) {
    return {
      ownerType: 'student',
      ownerId: pkg.projectOwnerId || pkg.studentId,
      studentId: pkg.studentId || pkg.projectOwnerId,
    };
  }

  if (pkg.projectOwnerType === 'group' || pkg.groupId) {
    return {
      ownerType: 'group',
      ownerId: pkg.projectOwnerId || pkg.groupId,
      groupId: pkg.groupId || pkg.projectOwnerId,
    };
  }

  return null;
};

const resolvePackageProjectOwner = async (pkg) => {
  const owner = getPackageProjectOwner(pkg);
  if (owner) return owner;

  if (pkg.ownerType !== 'project' || !pkg.ownerId) return null;

  const project = await prisma.project.findFirst({
    where: { id: toId(pkg.ownerId), isDeleted: false }
  });
  return resolveProjectOwner(project);
};

const ensureStudentCanSubmitForOwner = async (owner, actorStudentId) => {
  if (isStudentOwner(owner, actorStudentId)) return;

  if (owner?.ownerType === 'group') {
    const group = await prisma.projectGroup.findFirst({
      where: { id: toId(owner.groupId || owner.ownerId), isDeleted: false }
    });
    if (isAcceptedGroupMember(group, actorStudentId)) return;
  }

  throw { status: 403, message: 'Bạn không thuộc chủ thể sinh viên/nhóm thực hiện dự án này.' };
};

const initializePackage = async (projectId, phase, actorUserId, actorStudentId) => {
  const project = await prisma.project.findFirst({
    where: { id: toId(projectId), isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const projectOwner = resolveProjectOwner(project);
  await ensureStudentCanSubmitForOwner(projectOwner, actorStudentId);

  let pkg = await prisma.submissionPackage.findFirst({
    where: { ownerType: 'project', ownerId: toId(projectId), phase, isDeleted: false }
  });
  if (pkg) {
    throw { status: 400, message: `Hồ sơ nộp cho giai đoạn [${phase}] đã được khởi tạo trước đó.` };
  }

  const items = [];
  if (phase === 'proposal') {
    items.push(
      { type: 'report_pdf', required: true, status: 'missing' },
      { type: 'slide', required: false, status: 'missing' }
    );
  } else if (phase === 'progress') {
    items.push({ type: 'report_pdf', required: true, status: 'missing' });
  } else if (phase === 'final_report') {
    items.push(
      { type: 'report_pdf', required: true, status: 'missing' },
      { type: 'slide', required: true, status: 'missing' },
      { type: 'source_code', required: false, status: 'missing' }
    );
  } else {
    items.push(
      { type: 'report_pdf', required: true, status: 'missing' },
      { type: 'source_code', required: true, status: 'missing' }
    );
  }

  const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const id = newObjectId();
  const rawPayload = {
    id,
    mongoId: id,
    ownerType: 'project',
    ownerId: toId(projectId),
    projectOwnerType: projectOwner.ownerType,
    projectOwnerId: projectOwner.ownerId,
    groupId: projectOwner.ownerType === 'group' ? projectOwner.groupId : null,
    studentId: projectOwner.ownerType === 'student' ? projectOwner.studentId : null,
    periodId: toId(project.periodId),
    phase,
    deadline,
    items,
    status: 'draft',
  };

  const payload = resolveSubmissionOwnerFields(rawPayload);

  pkg = await prisma.submissionPackage.create({
    data: payload
  });

  return toPublicPackage(pkg);
};

const uploadPackageItem = async (packageId, type, fileId, actorUserId, actorStudentId) => {
  const pkg = await prisma.submissionPackage.findFirst({
    where: { id: toId(packageId), isDeleted: false }
  });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  await ensureStudentCanSubmitForOwner(await resolvePackageProjectOwner(pkg), actorStudentId);

  if (!['draft', 'needs_revision'].includes(pkg.status)) {
    throw { status: 400, message: 'Chỉ có thể tải lên tài liệu khi gói hồ sơ ở trạng thái draft hoặc needs_revision.' };
  }

  const items = Array.isArray(pkg.items) ? [...pkg.items] : [];
  let item = items.find(i => i.type === type);
  if (!item) {
    items.push({
      type,
      fileId: toId(fileId),
      required: false,
      status: 'submitted',
    });
  } else {
    item.fileId = toId(fileId);
    item.status = 'submitted';
  }

  const updatedPkg = await prisma.submissionPackage.update({
    where: { id: pkg.id },
    data: { items }
  });

  return toPublicPackage(updatedPkg);
};

const submitPackage = async (packageId, actorUserId, actorStudentId) => {
  const pkg = await prisma.submissionPackage.findFirst({
    where: { id: toId(packageId), isDeleted: false }
  });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  await ensureStudentCanSubmitForOwner(await resolvePackageProjectOwner(pkg), actorStudentId);

  if (!['draft', 'needs_revision'].includes(pkg.status)) {
    throw { status: 400, message: 'Không thể nộp gói hồ sơ đã gửi hoặc đã được khóa.' };
  }

  const items = pkg.items || [];
  const missingRequired = items.some(i => i.required && ['missing', 'rejected'].includes(i.status));
  if (missingRequired) {
    throw { status: 400, message: 'Không thể nộp bài: Vui lòng tải lên đầy đủ các tài liệu bắt buộc (required).' };
  }

  const updatedPkg = await prisma.submissionPackage.update({
    where: { id: pkg.id },
    data: {
      status: 'submitted',
      submittedBy: toId(actorUserId),
      submittedAt: new Date(),
    }
  });

  if (pkg.phase === 'final_report') {
    const project = await prisma.project.findFirst({
      where: { id: pkg.ownerId }
    });
    if (project && project.status === 'in_progress') {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'final_report_submitted' }
      });
    }
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: pkg.ownerId }
    });
    if (project && project.supervisorId) {
      const supervisor = await prisma.lecturer.findFirst({
        where: { id: project.supervisorId },
        include: { user: true }
      });
      if (supervisor && supervisor.user) {
        const ownerGroup = pkg.groupId ? await prisma.projectGroup.findFirst({ where: { id: pkg.groupId } }) : null;
        const ownerStudent = pkg.studentId ? await prisma.student.findFirst({ where: { id: pkg.studentId }, include: { user: true } }) : null;
        const senderName = ownerGroup ? ownerGroup.name : (ownerStudent?.user?.fullName || 'Sinh viên');

        await notificationsService.createNotification({
          recipientId: supervisor.user.id,
          type: 'SUBMISSION_SUBMITTED',
          title: 'Sinh viên nộp báo cáo/sản phẩm mới',
          body: `${senderName} đã nộp báo cáo giai đoạn "${pkg.phase}" và đang chờ thầy/cô nhận xét.`,
          entityType: 'SubmissionPackage',
          entityId: pkg.id,
          actionUrl: `/dashboard/submissions`,
        });
      }
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo nộp bài:', notifyErr.message);
  }

  return toPublicPackage(updatedPkg);
};

const reviewPackageItem = async (packageId, type, status, actorUserId, actorLecturerId) => {
  const pkg = await prisma.submissionPackage.findFirst({
    where: { id: toId(packageId), isDeleted: false }
  });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: pkg.ownerId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  const isSupervisor = actorLecturerId && toId(project.supervisorId) === toId(actorLecturerId);
  const isReviewer = actorLecturerId && project.reviewerId && toId(project.reviewerId) === toId(actorLecturerId);
  if (!isSupervisor && !isReviewer) {
    throw { status: 403, message: 'Bạn không phải Giảng viên hướng dẫn hoặc Phản biện của dự án này.' };
  }

  const items = Array.isArray(pkg.items) ? [...pkg.items] : [];
  const item = items.find(i => i.type === type);
  if (!item) {
    throw { status: 404, message: `Không tìm thấy tài liệu loại [${type}] trong gói hồ sơ.` };
  }

  item.status = status;

  let nextStatus = pkg.status;
  let reviewedBy = pkg.reviewedBy;
  let reviewedAt = pkg.reviewedAt;

  const anyRejectedRequired = items.some(i => i.required && i.status === 'rejected');
  const allRequiredAccepted = items.filter(i => i.required).every(i => i.status === 'accepted');

  if (anyRejectedRequired) {
    nextStatus = 'needs_revision';
  } else if (allRequiredAccepted) {
    nextStatus = 'accepted';
    reviewedBy = toId(actorUserId);
    reviewedAt = new Date();
  }

  const updatedPkg = await prisma.submissionPackage.update({
    where: { id: pkg.id },
    data: {
      items,
      status: nextStatus,
      reviewedBy,
      reviewedAt
    }
  });

  if (updatedPkg.phase === 'final_report' && updatedPkg.status === 'accepted') {
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'supervisor_reviewed' }
    });
  }

  try {
    const studentUserIds = await getProjectStudentUserIds(pkg.ownerId);
    const statusLabel = updatedPkg.status === 'accepted' ? 'chấp nhận' : updatedPkg.status === 'needs_revision' ? 'yêu cầu chỉnh sửa' : 'cập nhật';
    
    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: updatedPkg.status === 'accepted' ? 'SUBMISSION_ACCEPTED' : 'SUBMISSION_REVISION_REQUESTED',
        title: `Hồ sơ nộp ${updatedPkg.phase} đã được đánh giá`,
        body: `Gói hồ sơ nộp giai đoạn "${updatedPkg.phase}" của bạn đã được Giảng viên đánh giá và ${statusLabel}.`,
        entityType: 'SubmissionPackage',
        entityId: updatedPkg.id,
        actionUrl: `/dashboard/submissions`,
      });
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo đánh giá bài nộp:', notifyErr.message);
  }

  return toPublicPackage(updatedPkg);
};

const canManagePackage = (pkg, user) => {
  const isStaff = user.roles && user.roles.some(role => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(role));
  return {
    isStaff,
    isStudent: Boolean(user.studentId),
  };
};

const ensureStudentInPackageGroup = async (pkg, studentId) => {
  await ensureStudentCanSubmitForOwner(await resolvePackageProjectOwner(pkg), studentId);
};

const updatePackage = async (packageId, data, user) => {
  const pkg = await prisma.submissionPackage.findFirst({
    where: { id: toId(packageId), isDeleted: false }
  });
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

  const updateData = {};
  if (data.deadline !== undefined) {
    if (!isStaff) {
      throw { status: 403, message: 'Chỉ giáo vụ hoặc quản trị viên mới có quyền chỉnh hạn nộp.' };
    }
    updateData.deadline = new Date(data.deadline);
  }
  if (data.status !== undefined) {
    if (!isStaff) {
      throw { status: 403, message: 'Chỉ giáo vụ hoặc quản trị viên mới có quyền chỉnh trạng thái gói nộp.' };
    }
    updateData.status = data.status;
  }
  if (data.items !== undefined) {
    updateData.items = data.items;
  }

  const updatedPkg = await prisma.submissionPackage.update({
    where: { id: pkg.id },
    data: updateData
  });

  return toPublicPackage(updatedPkg);
};

const deletePackage = async (packageId, user) => {
  const pkg = await prisma.submissionPackage.findFirst({
    where: { id: toId(packageId), isDeleted: false }
  });
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

  const updatedPkg = await prisma.submissionPackage.update({
    where: { id: pkg.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: toId(user._id)
    }
  });

  return { success: true, message: 'Gói hồ sơ nộp đã được xóa thành công.' };
};

const getPackageById = async (id, user = {}) => {
  const pkg = await prisma.submissionPackage.findFirst({
    where: { id: toId(id), isDeleted: false }
  });
  if (!pkg) {
    throw { status: 404, message: 'Gói hồ sơ nộp không tồn tại.' };
  }
  const project = await prisma.project.findFirst({
    where: { id: pkg.ownerId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }
  await assertProjectAccess(project, user);

  return toPublicPackage(pkg);
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
