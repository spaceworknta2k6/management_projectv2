const prisma = require('../../config/prisma');

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getSummary = async () => {
  const monthStart = getMonthStart();

  const [
    users,
    periods,
    projects,
    topics,
    submissions,
    monthlyProjects,
    monthlyTopics,
    monthlySubmissions,
    recentProjects,
    recentTopics,
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.projectPeriod.count({ where: { isDeleted: false } }),
    prisma.project.count({ where: { isDeleted: false } }),
    prisma.projectTopic.count({ where: { isDeleted: false } }),
    prisma.submissionPackage.count({ where: { isDeleted: false } }),
    prisma.project.count({ where: { isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.projectTopic.count({ where: { isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.submissionPackage.count({ where: { isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.project.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, status: true, createdAt: true },
    }),
    prisma.projectTopic.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
  ]);

  return {
    total: {
      users,
      periods,
      projects,
      topics,
      submissions,
    },
    monthly: {
      projects: monthlyProjects,
      topics: monthlyTopics,
      submissions: monthlySubmissions,
    },
    recent: {
      projects: recentProjects.map((project) => ({ ...project, _id: project.id })),
      topics: recentTopics.map((topic) => ({ ...topic, _id: topic.id })),
    },
  };
};

module.exports = {
  getSummary,
};
