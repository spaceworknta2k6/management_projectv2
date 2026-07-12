const crypto = require('crypto');
const path = require('path');

module.paths.push(path.join(__dirname, '..', '..', 'backend', 'node_modules'));

require('../../backend/config/env').loadEnv();
const prisma = require('../../backend/config/prisma');

const topicTitle = process.argv[2];
const newObjectId = () => crypto.randomBytes(12).toString('hex');

if (!topicTitle) {
  console.error('Missing topicTitle parameter');
  process.exit(1);
}

async function main() {
  try {
    const topic = await prisma.projectTopic.findFirst({
      where: { title: topicTitle, isDeleted: false },
    });
    const lecturer = await prisma.lecturer.findFirst({
      where: { isDeleted: false, status: 'active' },
    });

    console.log('E2E DB Setup: found topic:', topic ? topic.id : 'null', 'lecturer:', lecturer ? lecturer.id : 'null');
    if (!topic || !lecturer) {
      throw new Error('Required topic or lecturer not found in database.');
    }

    await prisma.projectTopic.update({
      where: { id: topic.id },
      data: { supervisorId: lecturer.id, status: 'assigned' },
    });

    const project = await prisma.project.create({
      data: {
        id: newObjectId(),
        periodId: topic.periodId,
        ownerType: topic.ownerType,
        ownerId: topic.ownerId,
        studentId: topic.studentId || topic.ownerId,
        groupId: topic.groupId,
        topicId: topic.id,
        supervisorId: lecturer.id,
        status: 'in_progress',
      },
    });
    console.log('E2E DB Setup: inserted project:', project.id);

    await prisma.submissionPackage.create({
      data: {
        id: newObjectId(),
        projectOwnerType: topic.ownerType || 'student',
        projectOwnerId: project.id,
        ownerType: topic.ownerType || 'student',
        ownerId: project.id,
        groupId: topic.groupId,
        studentId: topic.studentId || topic.ownerId,
        periodId: topic.periodId,
        phase: 'progress',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'open',
      },
    });
    console.log('E2E DB Setup: inserted submission package.');

    await prisma.milestone.create({
      data: {
        id: newObjectId(),
        projectId: project.id,
        title: 'Báo cáo tiến độ E2E',
        description: 'Nộp báo cáo kiểm thử tự động',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'open',
      },
    });
    console.log('E2E DB Setup: inserted milestone.');
  } catch (error) {
    console.error('E2E Setup script error:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
