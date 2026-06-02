const path = require('path');
// Load environment variables from backend/.env (adjusted for tests subfolder)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const mongoose = require('mongoose');

// Import all models to verify Mongoose compiles and registers them successfully
console.log('--- Phase 1: Compiling Mongoose Models ---');
try {
  const User = require('../models/User');
  const Student = require('../models/Student');
  const Lecturer = require('../models/Lecturer');
  const ProjectPeriod = require('../models/ProjectPeriod');
  const ProjectRoster = require('../models/ProjectRoster');
  const ProjectGroup = require('../models/ProjectGroup');
  const ProjectTopic = require('../models/ProjectTopic');
  const Project = require('../models/Project');
  const Milestone = require('../models/Milestone');
  const TopicChangeRequest = require('../models/TopicChangeRequest');
  const ExtensionRequest = require('../models/ExtensionRequest');
  const SubmissionPackage = require('../models/SubmissionPackage');
  const Committee = require('../models/Committee');
  const DefenseSession = require('../models/DefenseSession');
  const ScoreSheet = require('../models/ScoreSheet');
  const FinalGrade = require('../models/FinalGrade');
  const FileAsset = require('../models/FileAsset');
  const AiJob = require('../models/AiJob');
  const TopicEmbedding = require('../models/TopicEmbedding');
  const Notification = require('../models/Notification');
  const WorkflowEvent = require('../models/WorkflowEvent');

  console.log('✅ All Mongoose models compiled and registered successfully!');
} catch (error) {
  console.error('❌ Mongoose Model Compilation Failed:', error);
  process.exit(1);
}

// Phase 2: Connecting and executing verification query
console.log('\n--- Phase 2: Connecting to MongoDB ---');
const verifyDatabase = async () => {
  try {
    const conn = await connectDB();
    
    console.log('\n--- Phase 3: Executing Test Query ---');
    // Check user count (or zero if new db)
    const userCount = await mongoose.model('User').countDocuments();
    console.log(`✅ Database query executed successfully! Found ${userCount} users in the database.`);

    console.log('\n--- Phase 4: Graceful Shutdown ---');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB. Verification SUCCESSFUL!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database Connection/Query Verification Failed:', error);
    process.exit(1);
  }
};

verifyDatabase();
