const prisma = require('../../config/prisma');
const { assertProjectAccess, canAccessProject, isStaff } = require('../../utils/access-control');
const { resolveProjectOwner } = require('../../utils/project-owner');
const { randomBytes } = require('crypto');

const newObjectId = () => randomBytes(12).toString('hex');
const toId = (value) => (value ? value.toString() : null);

const populateGrader = async (graderId) => {
  if (!graderId) return null;
  const lecturer = await prisma.lecturer.findFirst({
    where: { id: toId(graderId) },
    include: { user: true }
  });
  if (!lecturer) return null;
  return {
    ...lecturer,
    _id: lecturer.id,
    userId: lecturer.user ? { ...lecturer.user, _id: lecturer.user.id } : null
  };
};

const populateProject = async (projectId) => {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: toId(projectId) }
  });
  if (!project) return null;
  const topic = project.topicId ? await prisma.projectTopic.findFirst({ where: { id: toId(project.topicId) } }) : null;
  return {
    ...project,
    _id: project.id,
    topicId: topic ? { ...topic, _id: topic.id } : null
  };
};

const populateStudent = async (studentId) => {
  if (!studentId) return null;
  const student = await prisma.student.findFirst({
    where: { id: toId(studentId) },
    include: { user: true }
  });
  if (!student) return null;
  return {
    ...student,
    _id: student.id,
    userId: student.user ? { ...student.user, _id: student.user.id } : null
  };
};

const populateGroup = async (groupId) => {
  if (!groupId) return null;
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(groupId) }
  });
  if (!group) return null;
  
  const members = group.members || [];
  const populatedMembers = [];
  for (const m of members) {
    const populatedStudent = await populateStudent(m.studentId);
    populatedMembers.push({
      ...m,
      studentId: populatedStudent
    });
  }
  
  const leaderStudentId = await populateStudent(group.leaderStudentId);
  return {
    ...group,
    _id: group.id,
    leaderStudentId,
    members: populatedMembers
  };
};

const populateFullProject = async (project) => {
  if (!project) return null;
  const groupId = project.groupId ? await prisma.projectGroup.findFirst({ where: { id: toId(project.groupId) } }) : null;
  const studentId = project.studentId ? await populateStudent(project.studentId) : null;
  const topicId = project.topicId ? await prisma.projectTopic.findFirst({ where: { id: toId(project.topicId) } }) : null;
  const supervisorId = project.supervisorId ? await populateGrader(project.supervisorId) : null;
  const reviewerId = project.reviewerId ? await populateGrader(project.reviewerId) : null;

  return {
    ...project,
    _id: project.id,
    groupId: groupId ? {
      _id: groupId.id,
      name: groupId.name,
      members: groupId.members,
      status: groupId.status
    } : null,
    studentId,
    topicId: topicId ? {
      _id: topicId.id,
      title: topicId.title,
      summary: topicId.summary,
      objectives: topicId.objectives,
      scope: topicId.scope,
      technologies: topicId.technologies
    } : null,
    supervisorId,
    reviewerId,
    toObject() { return this; }
  };
};

const toPublicScoreSheet = async (sheet) => {
  if (!sheet) return null;
  return {
    ...sheet,
    _id: sheet.id,
    graderId: await populateGrader(sheet.graderId),
    projectId: await populateProject(sheet.projectId),
    studentId: await populateStudent(sheet.studentId),
    groupId: await populateGroup(sheet.groupId),
  };
};







const resolveScoreSheetOwnerFields = (data) => {
  const resolved = { ...data };
  if (!resolved.ownerType && resolved.groupId) resolved.ownerType = 'group';
  if (!resolved.ownerId && resolved.ownerType === 'group' && resolved.groupId) resolved.ownerId = resolved.groupId;
  if (!resolved.ownerId && resolved.ownerType === 'student' && resolved.studentId) resolved.ownerId = resolved.studentId;
  if (!resolved.studentId && resolved.ownerType === 'student' && resolved.ownerId) resolved.studentId = resolved.ownerId;
  return resolved;
};

const resolveFinalGradeOwnerFields = (data) => {
  const resolved = { ...data };
  if (!resolved.ownerType && resolved.groupId) resolved.ownerType = 'group';
  if (!resolved.ownerId && resolved.ownerType === 'group' && resolved.groupId) resolved.ownerId = resolved.groupId;
  if (!resolved.ownerId && resolved.ownerType === 'student' && resolved.studentId) resolved.ownerId = resolved.studentId;
  if (!resolved.studentId && resolved.ownerType === 'student' && resolved.ownerId) resolved.studentId = resolved.ownerId;
  return resolved;
};

const assertScoreSheetPermission = async (project, rubricRole, user) => {
  if (!project || !user?.lecturerId) {
    throw { status: 403, message: 'Bạn không có quyền chấm điểm dự án này.' };
  }

  const lecturerId = user.lecturerId.toString();
  const supervisorId = project.supervisorId?.toString();
  const reviewerId = project.reviewerId?.toString();

  if (rubricRole === 'SUPERVISOR' && supervisorId === lecturerId) return;
  if ((rubricRole === 'REVIEWER' || rubricRole === 'SECOND_MARKER') && reviewerId === lecturerId) return;

  if (rubricRole === 'RECHECK') {
    const appeal = await prisma.appealRequest.findFirst({
      where: {
        projectId: project.id,
        recheckGraderId: user.lecturerId.toString(),
        status: 'grading',
      }
    });
    if (appeal) return;
  }

  throw { status: 403, message: 'Bạn không được phân công chấm điểm dự án này.' };
};

const assertSheetOwner = (sheet, user) => {
  if (!user?.lecturerId || sheet.graderId.toString() !== user.lecturerId.toString()) {
    throw { status: 403, message: 'Bạn không có quyền chỉnh sửa phiếu điểm này.' };
  }
};

const submitScoreSheet = async (data, user) => {
  const { projectId, groupId, periodId, rubricRole, targetType, targetId, criteriaScores, comment } = data;
  
  if (!user.lecturerId) {
    throw { status: 403, message: 'Người dùng không được liên kết với hồ sơ Giảng viên.' };
  }
  const graderId = user.lecturerId;

  const project = await prisma.project.findFirst({
    where: { id: toId(projectId), isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }
  
  const isGroup = project.ownerType === 'group';
  if ((isGroup && toId(project.groupId) !== toId(groupId)) || toId(project.periodId) !== toId(periodId)) {
    throw { status: 400, message: 'Thông tin projectId, groupId và periodId không khớp.' };
  }
  await assertScoreSheetPermission(project, rubricRole, user);

  const period = await prisma.projectPeriod.findFirst({
    where: { id: toId(periodId), isDeleted: false }
  });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  let rubricIdToSave = data.rubricId || period.rubricId;
  let rubricVersionToSave = data.rubricVersion || '1.0';
  let finalCriteriaScores = criteriaScores;

  if (period.rubricId) {
    const activeRubric = await prisma.evaluationRubric.findFirst({
      where: { id: toId(period.rubricId), isDeleted: false }
    });
    if (activeRubric) {
      rubricIdToSave = activeRubric.id;
      rubricVersionToSave = activeRubric.version;
      const criteria = activeRubric.criteria || {};
      const rubricCriteria = criteria[rubricRole]
        || (rubricRole === 'RECHECK' ? criteria.REVIEWER || criteria.SECOND_MARKER : null);
      if (!rubricCriteria || rubricCriteria.length === 0) {
        throw { status: 400, message: `Không tìm thấy tiêu chí chấm điểm nào cho vai trò ${rubricRole} trong Rubric.` };
      }

      const validatedCriteriaScores = [];
      for (const item of rubricCriteria) {
        const clientItem = criteriaScores.find(c => c.criteriaCode === item.criteriaCode);
        if (!clientItem) {
          throw { status: 400, message: `Thiếu điểm cho tiêu chí: ${item.criteriaName} (${item.criteriaCode})` };
        }
        const scoreNum = Number(clientItem.score);
        if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > item.maxScore) {
          throw { status: 400, message: `Điểm tiêu chí "${item.criteriaName}" không hợp lệ. Phải từ 0 đến ${item.maxScore}.` };
        }
        validatedCriteriaScores.push({
          criteriaCode: item.criteriaCode,
          criteriaName: item.criteriaName,
          maxScore: item.maxScore,
          weight: item.weight,
          score: scoreNum
        });
      }
      finalCriteriaScores = validatedCriteriaScores;
    }
  }

  const rawTotal = finalCriteriaScores.reduce((acc, c) => acc + (c.score * (c.weight !== undefined ? c.weight : 1.0)), 0);
  const roundedTotal = Math.round(rawTotal * 100) / 100;

  const existing = await prisma.scoreSheet.findFirst({
    where: { targetType, targetId: toId(targetId), graderId: toId(graderId), rubricRole }
  });

  if (existing) {
    if (existing.lockedAt) {
      throw { status: 400, message: 'Phiếu điểm này đã được khóa và không thể chỉnh sửa.' };
    }

    const clientVersion = data.version;
    if (clientVersion === undefined) {
      throw { status: 400, message: 'Cập nhật yêu cầu cung cấp trường version để thực hiện Khóa lạc quan (Optimistic Locking).' };
    }

    if (existing.version !== Number(clientVersion)) {
      throw {
        status: 409,
        message: 'Xung đột phiên bản: Dữ liệu phiếu điểm đã được thay đổi bởi một phiên làm việc khác. Vui lòng tải lại.'
      };
    }

    const updated = await prisma.scoreSheet.update({
      where: { id: existing.id },
      data: {
        criteriaScores: finalCriteriaScores,
        rawTotal,
        roundedTotal,
        comment,
        rubricId: rubricIdToSave,
        rubricVersion: rubricVersionToSave,
        consentForDefense: data.consentForDefense !== undefined ? data.consentForDefense : existing.consentForDefense,
        version: existing.version + 1
      }
    });

    return await toPublicScoreSheet(updated);
  } else {
    let graderRole = data.graderRole;
    if (!graderRole) {
      if (rubricRole === 'SUPERVISOR') {
        graderRole = 'SUPERVISOR';
      } else if (rubricRole === 'REVIEWER' || rubricRole === 'SECOND_MARKER') {
        graderRole = 'REVIEWER';
      }
    }

    if (!graderRole) {
      graderRole = user.roles && user.roles.length > 0 ? user.roles[0] : 'LECTURER';
    }

    const owner = resolveProjectOwner(project);
    const id = newObjectId();
    const rawPayload = {
      id,
      mongoId: id,
      rubricId: rubricIdToSave,
      rubricRole,
      rubricVersion: rubricVersionToSave,
      targetType,
      targetId: toId(targetId),
      projectId: toId(projectId),
      ownerType: owner?.ownerType,
      ownerId: owner?.ownerId,
      studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : null,
      groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : null,
      periodId: toId(periodId),
      graderId: toId(graderId),
      graderRole,
      criteriaScores: finalCriteriaScores,
      rawTotal,
      roundedTotal,
      comment,
      consentForDefense: data.consentForDefense !== undefined ? data.consentForDefense : true,
      version: 0
    };

    const payload = resolveScoreSheetOwnerFields(rawPayload);
    const savedSheet = await prisma.scoreSheet.create({
      data: payload
    });


    if (targetType === 'RECHECK') {
      try {
        const appealsService = require('../appeals/appeals.service');
        const appeal = await prisma.appealRequest.findFirst({
          where: {
            projectId: toId(projectId),
            recheckGraderId: toId(graderId),
            status: 'grading',
          }
        });
        if (appeal) {
          await appealsService.linkRecheckScoreSheet(appeal.id, savedSheet.id);
        }
      } catch (linkErr) {
        console.error('Lỗi khi link phiếu RECHECK vào đơn phúc khảo:', linkErr.message);
      }
    }

    return await toPublicScoreSheet(savedSheet);
  }
};

const getScoreSheets = async (query = {}, user = {}) => {
  const where = {};
  if (query.projectId) where.projectId = toId(query.projectId);
  if (query.periodId) where.periodId = toId(query.periodId);
  if (query.graderId) where.graderId = toId(query.graderId);
  if (query.targetType) where.targetType = query.targetType;
  if (query.targetId) where.targetId = toId(query.targetId);

  const sheets = await prisma.scoreSheet.findMany({ where });

  const visibleSheets = [];
  for (const sheet of sheets) {
    const populated = await toPublicScoreSheet(sheet);
    if (isStaff(user) || await canAccessProject(populated.projectId, user)) {
      visibleSheets.push(populated);
    }
  }

  return visibleSheets;
};

const getProjectsSummary = async (query = {}, user = {}) => {
  const projectQuery = { isDeleted: false };
  if (query.periodId) {
    projectQuery.periodId = toId(query.periodId);
  }

  const projects = await prisma.project.findMany({
    where: projectQuery,
    orderBy: { createdAt: 'desc' }
  });

  const visibleProjects = [];
  for (const project of projects) {
    const populated = await populateFullProject(project);
    if (isStaff(user) || await canAccessProject(populated, user)) {
      visibleProjects.push(populated);
    }
  }

  if (visibleProjects.length === 0) {
    return [];
  }

  const projectIds = visibleProjects.map((project) => project.id);
  
  const sheets = await prisma.scoreSheet.findMany({
    where: { projectId: { in: projectIds } }
  });

  const grades = await prisma.finalGrade.findMany({
    where: { projectId: { in: projectIds } }
  });

  const sheetsByProjectId = new Map();
  for (const sheet of sheets) {
    const key = sheet.projectId;
    const bucket = sheetsByProjectId.get(key) || [];
    const populatedSheet = await toPublicScoreSheet(sheet);
    bucket.push(populatedSheet);
    sheetsByProjectId.set(key, bucket);
  }

  const gradesByProjectId = new Map();
  for (const grade of grades) {
    gradesByProjectId.set(grade.projectId, { ...grade, _id: grade.id });
  }

  return visibleProjects.map((project) => {
    const finalGrade = gradesByProjectId.get(project.id) || null;
    const canSeeFinalGrade = !user.studentId || finalGrade?.publishedAt;

    return {
      ...project,
      sheets: sheetsByProjectId.get(project.id) || [],
      finalGrade: canSeeFinalGrade ? finalGrade : null,
    };
  });
};

const getScoreSheetById = async (id, user = {}) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: toId(id) }
  });
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }
  const populated = await toPublicScoreSheet(sheet);
  await assertProjectAccess(populated.projectId, user);
  return populated;
};

const updateScoreSheet = async (id, data, user) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: toId(id) }
  });
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }

  assertSheetOwner(sheet, user);

  if (sheet.lockedAt) {
    throw { status: 400, message: 'Phiếu điểm này đã được khóa và không thể chỉnh sửa.' };
  }

  const clientVersion = data.version;
  if (clientVersion === undefined) {
    throw { status: 400, message: 'Cập nhật yêu cầu cung cấp trường version để thực hiện Khóa lạc quan.' };
  }

  if (sheet.version !== Number(clientVersion)) {
    throw {
      status: 409,
      message: 'Xung đột phiên bản: Dữ liệu phiếu điểm đã được thay đổi bởi một phiên làm việc khác.'
    };
  }

  const updateData = { version: sheet.version + 1 };

  if (data.criteriaScores) {
    let finalCriteriaScores = data.criteriaScores;
    const period = await prisma.projectPeriod.findFirst({
      where: { id: sheet.periodId }
    });
    if (period && period.rubricId) {
      const activeRubric = await prisma.evaluationRubric.findFirst({
        where: { id: toId(period.rubricId), isDeleted: false }
      });
      if (activeRubric) {
        const criteria = activeRubric.criteria || {};
        const rubricCriteria = criteria[sheet.rubricRole]
          || (sheet.rubricRole === 'RECHECK' ? criteria.REVIEWER || criteria.SECOND_MARKER : null);
        if (!rubricCriteria || rubricCriteria.length === 0) {
          throw { status: 400, message: `Không tìm thấy tiêu chí chấm điểm nào cho vai trò ${sheet.rubricRole} trong Rubric.` };
        }

        const validatedCriteriaScores = [];
        for (const item of rubricCriteria) {
          const clientItem = data.criteriaScores.find(c => c.criteriaCode === item.criteriaCode);
          if (!clientItem) {
            throw { status: 400, message: `Thiếu điểm cho tiêu chí: ${item.criteriaName} (${item.criteriaCode})` };
          }
          const scoreNum = Number(clientItem.score);
          if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > item.maxScore) {
            throw { status: 400, message: `Điểm tiêu chí "${item.criteriaName}" không hợp lệ. Phải từ 0 đến ${item.maxScore}.` };
          }
          validatedCriteriaScores.push({
            criteriaCode: item.criteriaCode,
            criteriaName: item.criteriaName,
            maxScore: item.maxScore,
            weight: item.weight,
            score: scoreNum
          });
        }
        finalCriteriaScores = validatedCriteriaScores;
      }
    }
    updateData.criteriaScores = finalCriteriaScores;
    const rawTotal = finalCriteriaScores.reduce((acc, c) => acc + (c.score * (c.weight !== undefined ? c.weight : 1.0)), 0);
    updateData.rawTotal = rawTotal;
    updateData.roundedTotal = Math.round(rawTotal * 100) / 100;
  }
  if (data.comment !== undefined) updateData.comment = data.comment;
  if (data.consentForDefense !== undefined) updateData.consentForDefense = data.consentForDefense;

  const updated = await prisma.scoreSheet.update({
    where: { id: sheet.id },
    data: updateData
  });

  return await toPublicScoreSheet(updated);
};

const lockScoreSheet = async (id, user = {}) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: toId(id) }
  });
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }

  assertSheetOwner(sheet, user);

  const updated = await prisma.scoreSheet.update({
    where: { id: sheet.id },
    data: { lockedAt: new Date() }
  });

  return await toPublicScoreSheet(updated);
};

const getLetterGrade = (score) => {
  if (score >= 8.5) return 'A';
  if (score >= 8.0) return 'B+';
  if (score >= 7.0) return 'B';
  if (score >= 6.5) return 'C+';
  if (score >= 5.5) return 'C';
  if (score >= 5.0) return 'D+';
  if (score >= 4.0) return 'D';
  return 'F';
};

const aggregateFinalGrade = async (projectId, user) => {
  const project = await prisma.project.findFirst({
    where: { id: toId(projectId), isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }
  await assertProjectAccess(project, user);

  const period = await prisma.projectPeriod.findFirst({
    where: { id: project.periodId, isDeleted: false }
  });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const threshold = period.varianceThreshold || 2.0;

  const sheets = await prisma.scoreSheet.findMany({
    where: { projectId: toId(projectId) }
  });
  
  const supervisorSheet = sheets.find(s => s.rubricRole === 'SUPERVISOR');
  const reviewerSheet = sheets.find(s => s.rubricRole === 'REVIEWER' || s.rubricRole === 'SECOND_MARKER');

  if (!supervisorSheet) {
    throw { status: 400, message: 'Chưa có phiếu chấm điểm của Giảng viên hướng dẫn.' };
  }
  if (!reviewerSheet) {
    throw { status: 400, message: 'Chưa có phiếu chấm điểm của Giảng viên chấm thứ hai.' };
  }

  if (!supervisorSheet.lockedAt || !reviewerSheet.lockedAt) {
    throw { status: 400, message: 'Chưa thể tổng hợp điểm do còn phiếu chấm chưa được khóa.' };
  }

  const supervisorRaw = supervisorSheet.rawTotal;
  const reviewerRaw = reviewerSheet.rawTotal;
  
  let fSupervisor = 0.5;
  let fReviewer = 0.5;

  if (period.scoringFormula) {
    const formula = period.scoringFormula || {};
    const hasSupervisor = formula.supervisor !== undefined;
    const hasReviewer = formula.reviewer !== undefined;
    const hasSecondMarker = formula.secondMarker !== undefined;
    
    if (hasSupervisor) {
      fSupervisor = formula.supervisor;
    }
    if (hasSecondMarker) {
      fReviewer = formula.secondMarker;
    } else if (hasReviewer) {
      fReviewer = formula.reviewer;
    }
  }

  const finalScoreRaw = (supervisorRaw * fSupervisor) + (reviewerRaw * fReviewer);
  const finalScore = Math.round(finalScoreRaw * 10) / 10;
  const letterGrade = getLetterGrade(finalScore);

  const passScore = period.passScore || 5.0;
  const passStatus = finalScore >= passScore ? 'passed' : 'failed';

  const varianceFlags = [];
  if (Math.abs(supervisorRaw - reviewerRaw) >= threshold) {
    varianceFlags.push({
      type: 'supervisor_reviewer_variance',
      maxDifference: Math.abs(supervisorRaw - reviewerRaw)
    });
  }

  const componentScores = {
    supervisor: supervisorRaw,
    reviewer: reviewerRaw
  };

  const existingGrade = await prisma.finalGrade.findFirst({
    where: { projectId: toId(projectId) }
  });

  let grade;
  if (existingGrade) {
    grade = await prisma.finalGrade.update({
      where: { id: existingGrade.id },
      data: {
        componentScores,
        finalScore,
        letterGrade,
        passStatus,
        varianceFlags,
        formulaVersion: period.rubricVersion || '1.0',
        evaluationMode: 'standard'
      }
    });
  } else {
    const owner = resolveProjectOwner(project);
    const id = newObjectId();
    const rawPayload = {
      id,
      mongoId: id,
      projectId: toId(projectId),
      ownerType: owner?.ownerType,
      ownerId: owner?.ownerId,
      studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : null,
      groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : null,
      periodId: toId(project.periodId),
      evaluationMode: 'standard',
      componentScores,
      finalScore,
      letterGrade,
      passStatus,
      varianceFlags,
      formulaVersion: period.rubricVersion || '1.0'
    };
    const payload = resolveFinalGradeOwnerFields(rawPayload);
    grade = await prisma.finalGrade.create({
      data: payload
    });
  }

  return { ...grade, _id: grade.id };
};

const getFinalGrade = async (id, user = {}) => {
  const grade = await prisma.finalGrade.findFirst({
    where: { id: toId(id) }
  });
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }
  const populatedProject = await populateProject(grade.projectId);
  await assertProjectAccess(populatedProject, user);

  if (user.studentId && !grade.publishedAt) {
    throw { status: 403, message: 'Điểm số của dự án này chưa được công bố.' };
  }

  return { ...grade, _id: grade.id, projectId: populatedProject };
};

const getFinalGradeByProjectId = async (projectId, user = {}) => {
  const grade = await prisma.finalGrade.findFirst({
    where: { projectId: toId(projectId) }
  });
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }
  const populatedProject = await populateProject(grade.projectId);
  await assertProjectAccess(populatedProject, user);

  if (user.studentId && !grade.publishedAt) {
    throw { status: 403, message: 'Điểm số của dự án này chưa được công bố.' };
  }

  return { ...grade, _id: grade.id, projectId: populatedProject };
};

const publishFinalGrade = async (id, userId) => {
  const grade = await prisma.finalGrade.findFirst({
    where: { id: toId(id) }
  });
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }

  const flags = grade.varianceFlags || [];
  const activeVariance = flags.find(f => !f.resolvedAt);
  if (activeVariance) {
    throw {
      status: 400,
      message: 'Không thể công bố điểm khi còn cờ cảnh báo chênh lệch điểm (Variance Flag) chưa được xử lý.'
    };
  }

  const updatedGrade = await prisma.finalGrade.update({
    where: { id: grade.id },
    data: { publishedAt: new Date() }
  });

  const project = await prisma.project.findFirst({
    where: { id: grade.projectId }
  });
  if (project) {
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'finalized' }
    });
  }

  return { ...updatedGrade, _id: updatedGrade.id };
};

const lockFinalGrade = async (id) => {
  const grade = await prisma.finalGrade.findFirst({
    where: { id: toId(id) }
  });
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }

  const updatedGrade = await prisma.finalGrade.update({
    where: { id: grade.id },
    data: { lockedAt: new Date() }
  });

  return { ...updatedGrade, _id: updatedGrade.id };
};

const resolveVariance = async (id, flagType, resolution, userId) => {
  const grade = await prisma.finalGrade.findFirst({
    where: { id: toId(id) }
  });
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }

  const flags = grade.varianceFlags || [];
  const flag = flags.find(f => f.type === flagType);
  if (!flag) {
    throw { status: 404, message: 'Cờ cảnh báo chênh lệch điểm không tồn tại.' };
  }

  flag.resolvedBy = toId(userId);
  flag.resolvedAt = new Date();
  flag.resolution = resolution;

  const updatedGrade = await prisma.finalGrade.update({
    where: { id: grade.id },
    data: { varianceFlags: flags }
  });

  return { ...updatedGrade, _id: updatedGrade.id };
};

const getStudentDisplay = (student) => {
  const user = student?.userId || {};
  return {
    studentId: student?._id?.toString() || '',
    fullName: user.fullName || '',
    email: user.email || '',
    studentCode: student?.studentCode || '',
    className: student?.className || '',
  };
};

const buildVerificationSubject = (sheet) => {
  if (sheet.studentId) {
    const student = getStudentDisplay(sheet.studentId);
    return {
      ownerType: 'student',
      displayName: student.fullName || student.studentCode || 'Sinh viên',
      primaryStudent: student,
      students: student.studentId ? [student] : [],
    };
  }

  const group = sheet.groupId;
  if (!group) {
    return {
      ownerType: sheet.ownerType || 'unknown',
      displayName: 'Chưa xác định',
      primaryStudent: null,
      students: [],
    };
  }

  const members = (group.members || [])
    .filter((member) => member.status === 'accepted')
    .map((member) => getStudentDisplay(member.studentId))
    .filter((student) => student.studentId);
  const leader = group.leaderStudentId ? getStudentDisplay(group.leaderStudentId) : members[0] || null;

  return {
    ownerType: 'group',
    displayName: group.name || 'Nhóm sinh viên',
    groupId: group._id?.toString() || '',
    groupName: group.name || '',
    primaryStudent: leader,
    students: members.length > 0 ? members : (leader ? [leader] : []),
  };
};

const getVerifyHashSecret = () => {
  const secret = process.env.SCORE_VERIFY_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw { status: 500, message: 'Thiếu khóa ký xác thực phiếu điểm.' };
  }
  return secret || 'test-score-verify-secret';
};

const getPublicScoreSheetVerify = async (id) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: toId(id) }
  });
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }

  const populated = await toPublicScoreSheet(sheet);
  const verificationSubject = buildVerificationSubject(populated);
  const crypto = require('crypto');
  const hashPayload = {
    scoreSheetId: populated._id.toString(),
    projectId: populated.projectId?._id?.toString() || '',
    projectTitle: populated.projectId?.topicId?.title || '',
    periodId: populated.periodId?.toString() || '',
    periodName: '', // wait, we can populate period name if needed, but not strictly required
    rubricId: populated.rubricId?.toString() || '',
    rubricRole: populated.rubricRole,
    rubricVersion: populated.rubricVersion,
    graderId: populated.graderId?._id?.toString() || '',
    graderName: populated.graderId?.userId?.fullName || '',
    graderRole: populated.graderRole,
    owner: verificationSubject,
    criteriaScores: (populated.criteriaScores || []).map((item) => ({
      criteriaCode: item.criteriaCode,
      criteriaName: item.criteriaName,
      maxScore: item.maxScore,
      weight: item.weight,
      score: item.score,
    })),
    rawTotal: populated.rawTotal,
    roundedTotal: populated.roundedTotal,
    comment: populated.comment || '',
    lockedAt: populated.lockedAt ? new Date(populated.lockedAt).toISOString() : '',
  };
  const integrityHash = crypto
    .createHash('sha256')
    .update(`${JSON.stringify(hashPayload)}.${getVerifyHashSecret()}`)
    .digest('hex');

  return {
    sheet: populated,
    verificationSubject,
    integrityHash,
  };
};

const publishFinalGradesByPeriod = async (periodId, userId) => {
  const grades = await prisma.finalGrade.findMany({
    where: { periodId: toId(periodId) }
  });
  if (!grades || grades.length === 0) {
    return { publishedCount: 0, totalCount: 0, message: 'Không tìm thấy điểm tổng kết nào cần công bố.' };
  }

  let publishedCount = 0;
  for (const grade of grades) {
    const flags = grade.varianceFlags || [];
    const activeVariance = flags.find(f => !f.resolvedAt);
    if (!activeVariance) {
      if (!grade.publishedAt) {
        const updatedGrade = await prisma.finalGrade.update({
          where: { id: grade.id },
          data: { publishedAt: new Date() }
        });

        const project = await prisma.project.findFirst({
          where: { id: grade.projectId }
        });
        if (project) {
          await prisma.project.update({
            where: { id: project.id },
            data: { status: 'finalized' }
          });
        }
        publishedCount++;
      }
    }
  }

  const totalGradesCount = await prisma.finalGrade.count({
    where: { periodId: toId(periodId) }
  });
  const publishedGradesCount = await prisma.finalGrade.count({
    where: { periodId: toId(periodId), publishedAt: { not: null } }
  });
  
  if (totalGradesCount > 0 && totalGradesCount === publishedGradesCount) {
    const period = await prisma.projectPeriod.findFirst({
      where: { id: toId(periodId) }
    });
    if (period && period.status !== 'results_published' && period.status !== 'result_locked') {
      const updatedPeriod = await prisma.projectPeriod.update({
        where: { id: period.id },
        data: {
          status: 'results_published',
          resultPublishedAt: new Date()
        }
      });
    }
  }

  return {
    success: true,
    publishedCount,
    totalCount: grades.length,
    message: `Đã công bố thành công ${publishedCount}/${grades.length} điểm tổng kết.`,
  };
};

module.exports = {
  submitScoreSheet,
  getScoreSheets,
  getProjectsSummary,
  getScoreSheetById,
  updateScoreSheet,
  lockScoreSheet,
  aggregateFinalGrade,
  getFinalGrade,
  getFinalGradeByProjectId,
  publishFinalGrade,
  lockFinalGrade,
  resolveVariance,
  getPublicScoreSheetVerify,
  publishFinalGradesByPeriod,
};
