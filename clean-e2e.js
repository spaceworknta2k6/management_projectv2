/**
 * clean-e2e.js - Clean up E2E records from previous runs.
 * Hard deletion is scoped to test data only.
 */

const path = require('path');
module.paths.push(path.join(__dirname, 'backend', 'node_modules'));

require('./backend/config/env').loadEnv();
const prisma = require('./backend/config/prisma');

const inList = (values) => ({ in: values });
const hasValues = (values) => Array.isArray(values) && values.length > 0;

async function collectIds() {
  const periods = await prisma.projectPeriod.findMany({
    where: { name: { contains: 'E2E' } },
    select: { id: true },
  });
  const periodIds = periods.map((item) => item.id);

  const topics = await prisma.projectTopic.findMany({
    where: {
      OR: [
        { title: { contains: 'E2E' } },
        ...(hasValues(periodIds) ? [{ periodId: inList(periodIds) }] : []),
      ],
    },
    select: { id: true },
  });
  const topicIds = topics.map((item) => item.id);

  const groups = await prisma.projectGroup.findMany({
    where: {
      OR: [
        { name: { contains: 'E2E' } },
        ...(hasValues(periodIds) ? [{ periodId: inList(periodIds) }] : []),
      ],
    },
    select: { id: true },
  });
  const groupIds = groups.map((item) => item.id);

  const projectFilters = [
    ...(hasValues(periodIds) ? [{ periodId: inList(periodIds) }] : []),
    ...(hasValues(topicIds) ? [{ topicId: inList(topicIds) }] : []),
    ...(hasValues(groupIds) ? [{ groupId: inList(groupIds) }] : []),
  ];

  const projects = projectFilters.length
    ? await prisma.project.findMany({
      where: { OR: projectFilters },
      select: { id: true },
    })
    : [];
  const projectIds = projects.map((item) => item.id);

  return { periodIds, topicIds, groupIds, projectIds };
}

async function cleanE2E() {
  try {
    const { periodIds, topicIds, groupIds, projectIds } = await collectIds();
    console.log(
      `Found E2E data: ${periodIds.length} periods, ${topicIds.length} topics, ${groupIds.length} groups, ${projectIds.length} projects.`
    );

    if (hasValues(projectIds)) {
      const projectWhere = { projectId: inList(projectIds) };
      const targetWhere = { targetId: inList(projectIds) };
      const [milestones, extensionRequests, scoreSheets, finalGrades, appealRequests] = await prisma.$transaction([
        prisma.milestone.deleteMany({ where: projectWhere }),
        prisma.extensionRequest.deleteMany({ where: { OR: [projectWhere, targetWhere] } }),
        prisma.scoreSheet.deleteMany({ where: projectWhere }),
        prisma.finalGrade.deleteMany({ where: projectWhere }),
        prisma.appealRequest.deleteMany({ where: projectWhere }),
      ]);

      console.log(`Deleted ${milestones.count} milestones.`);
      console.log(`Deleted ${extensionRequests.count} extension requests.`);
      console.log(`Deleted ${scoreSheets.count} score sheets.`);
      console.log(`Deleted ${finalGrades.count} final grades.`);
      console.log(`Deleted ${appealRequests.count} appeal requests.`);
    }

    const submissionFilters = [
      ...(hasValues(projectIds) ? [{ ownerId: inList(projectIds) }, { projectOwnerId: inList(projectIds) }] : []),
      ...(hasValues(periodIds) ? [{ periodId: inList(periodIds) }] : []),
      ...(hasValues(groupIds) ? [{ groupId: inList(groupIds) }] : []),
    ];
    if (submissionFilters.length) {
      const submissions = await prisma.submissionPackage.deleteMany({ where: { OR: submissionFilters } });
      console.log(`Deleted ${submissions.count} submission packages.`);
    }

    if (hasValues(topicIds)) {
      const topicChanges = await prisma.topicChangeRequest.deleteMany({ where: { topicId: inList(topicIds) } });
      console.log(`Deleted ${topicChanges.count} topic change requests.`);
    }

    if (hasValues(periodIds)) {
      const rosters = await prisma.projectRoster.deleteMany({ where: { periodId: inList(periodIds) } });
      console.log(`Deleted ${rosters.count} rosters.`);
    }

    if (hasValues(projectIds)) {
      const projects = await prisma.project.deleteMany({ where: { id: inList(projectIds) } });
      console.log(`Deleted ${projects.count} projects.`);
    }

    if (hasValues(topicIds)) {
      const topics = await prisma.projectTopic.deleteMany({ where: { id: inList(topicIds) } });
      console.log(`Deleted ${topics.count} topics.`);
    }

    if (hasValues(groupIds)) {
      const groups = await prisma.projectGroup.deleteMany({ where: { id: inList(groupIds) } });
      console.log(`Deleted ${groups.count} groups.`);
    }

    if (hasValues(periodIds)) {
      const periods = await prisma.projectPeriod.deleteMany({ where: { id: inList(periodIds) } });
      console.log(`Deleted ${periods.count} periods.`);
    }

    console.log('Database cleanup completed successfully.');
  } catch (error) {
    console.error('Database cleanup failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

cleanE2E();
