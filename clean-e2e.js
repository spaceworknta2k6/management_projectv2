/**
 * clean-e2e.js - Clean up E2E records from previous runs
 * Located at workspace root
 */

const path = require('path');
module.paths.push(path.join(__dirname, 'backend', 'node_modules'));

require('./backend/config/env').loadEnv();
const mongoose = require('mongoose');
const connectDB = require('./backend/config/db');

// Import all relevant models
const ProjectPeriod = require('./backend/models/ProjectPeriod');
const ProjectRoster = require('./backend/models/ProjectRoster');
const ProjectGroup = require('./backend/models/ProjectGroup');
const ProjectTopic = require('./backend/models/ProjectTopic');
const Project = require('./backend/models/Project');
const Milestone = require('./backend/models/Milestone');
const SubmissionPackage = require('./backend/models/SubmissionPackage');
const ExtensionRequest = require('./backend/models/ExtensionRequest');
const Committee = require('./backend/models/Committee');
const DefenseSession = require('./backend/models/DefenseSession');
const ScoreSheet = require('./backend/models/ScoreSheet');
const FinalGrade = require('./backend/models/FinalGrade');

const cleanE2E = async () => {
  try {
    await connectDB();
    console.log('Connected to database for cleanup.');

    // 1. Find all periods containing "E2E"
    const e2ePeriods = await ProjectPeriod.find({ name: /E2E/ });
    const periodIds = e2ePeriods.map(p => p._id);
    console.log(`Found ${periodIds.length} E2E project periods to delete.`);

    if (periodIds.length > 0) {
      // 2. Find all projects in these periods
      const e2eProjects = await Project.find({ periodId: { $in: periodIds } });
      const projectIds = e2eProjects.map(p => p._id);
      console.log(`Found ${projectIds.length} E2E projects.`);

      // Delete dependent records for projects
      if (projectIds.length > 0) {
        const delMilestones = await Milestone.deleteMany({ projectId: { $in: projectIds } });
        console.log(`Deleted ${delMilestones.deletedCount} milestones.`);

        const delSubmissions = await SubmissionPackage.deleteMany({ ownerId: { $in: projectIds } });
        console.log(`Deleted ${delSubmissions.deletedCount} submission packages.`);

        const delExtensions = await ExtensionRequest.deleteMany({ projectId: { $in: projectIds } });
        console.log(`Deleted ${delExtensions.deletedCount} extension requests.`);

        const delDefense = await DefenseSession.deleteMany({ projectId: { $in: projectIds } });
        console.log(`Deleted ${delDefense.deletedCount} defense sessions.`);

        const delScores = await ScoreSheet.deleteMany({ projectId: { $in: projectIds } });
        console.log(`Deleted ${delScores.deletedCount} score sheets.`);

        const delFinalGrades = await FinalGrade.deleteMany({ projectId: { $in: projectIds } });
        console.log(`Deleted ${delFinalGrades.deletedCount} final grades.`);
      }

      // Delete other period-dependent records
      const delRosters = await ProjectRoster.deleteMany({ periodId: { $in: periodIds } });
      console.log(`Deleted ${delRosters.deletedCount} rosters.`);

      const delGroups = await ProjectGroup.deleteMany({ periodId: { $in: periodIds } });
      console.log(`Deleted ${delGroups.deletedCount} groups.`);

      const delTopics = await ProjectTopic.deleteMany({ periodId: { $in: periodIds } });
      console.log(`Deleted ${delTopics.deletedCount} topics.`);

      const delCommittees = await Committee.deleteMany({ periodId: { $in: periodIds } });
      console.log(`Deleted ${delCommittees.deletedCount} committees.`);

      const delProjects = await Project.deleteMany({ periodId: { $in: periodIds } });
      console.log(`Deleted ${delProjects.deletedCount} projects.`);

      const delPeriods = await ProjectPeriod.deleteMany({ _id: { $in: periodIds } });
      console.log(`Deleted ${delPeriods.deletedCount} periods.`);
    }

    // Delete any remaining orphaned groups/topics/projects that contain "E2E" in their name or title
    const delOrphGroups = await ProjectGroup.deleteMany({ name: /E2E/ });
    console.log(`Deleted ${delOrphGroups.deletedCount} orphaned E2E groups.`);

    const delOrphTopics = await ProjectTopic.deleteMany({ title: /E2E/ });
    console.log(`Deleted ${delOrphTopics.deletedCount} orphaned E2E topics.`);

    const delOrphCommittees = await Committee.deleteMany({ name: /E2E/ });
    console.log(`Deleted ${delOrphCommittees.deletedCount} orphaned E2E committees.`);

    // Clean up defense sessions or score sheets that might be referencing E2E items (e.g. by room or note)
    const delOrphDefenses = await DefenseSession.deleteMany({ room: /E2E/ });
    console.log(`Deleted ${delOrphDefenses.deletedCount} orphaned E2E defense sessions.`);

    console.log('Database cleanup completed successfully!');
  } catch (error) {
    console.error('Database cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
};

cleanE2E();
