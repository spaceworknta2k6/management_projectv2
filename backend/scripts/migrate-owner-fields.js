require('../config/env').loadEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const ProjectTopic = require('../models/ProjectTopic');
const Project = require('../models/Project');
const ExtensionRequest = require('../models/ExtensionRequest');
const DefenseSession = require('../models/DefenseSession');
const ScoreSheet = require('../models/ScoreSheet');
const FinalGrade = require('../models/FinalGrade');
const TopicChangeRequest = require('../models/TopicChangeRequest');
const SubmissionPackage = require('../models/SubmissionPackage');

const groupOwnerFilter = {
  groupId: { $exists: true, $ne: null },
  $or: [
    { ownerType: { $exists: false } },
    { ownerType: null },
    { ownerId: { $exists: false } },
    { ownerId: null },
  ],
};

const packageOwnerFilter = {
  groupId: { $exists: true, $ne: null },
  $or: [
    { projectOwnerType: { $exists: false } },
    { projectOwnerType: null },
    { projectOwnerId: { $exists: false } },
    { projectOwnerId: null },
  ],
};

const migrateGroupOwner = async (model) => {
  const result = await model.updateMany(groupOwnerFilter, [
    {
      $set: {
        ownerType: 'group',
        ownerId: '$groupId',
      },
    },
  ]);

  return result.modifiedCount || 0;
};

const migrateSubmissionPackageOwner = async () => {
  const result = await SubmissionPackage.updateMany(packageOwnerFilter, [
    {
      $set: {
        projectOwnerType: 'group',
        projectOwnerId: '$groupId',
      },
    },
  ]);

  return result.modifiedCount || 0;
};

const run = async () => {
  await connectDB();

  const models = [
    ['ProjectTopic', ProjectTopic],
    ['Project', Project],
    ['ExtensionRequest', ExtensionRequest],
    ['DefenseSession', DefenseSession],
    ['ScoreSheet', ScoreSheet],
    ['FinalGrade', FinalGrade],
    ['TopicChangeRequest', TopicChangeRequest],
  ];

  for (const [name, model] of models) {
    const modified = await migrateGroupOwner(model);
    console.log(`${name}: ${modified} document(s) backfilled`);
  }

  const packageModified = await migrateSubmissionPackageOwner();
  console.log(`SubmissionPackage: ${packageModified} document(s) backfilled`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
