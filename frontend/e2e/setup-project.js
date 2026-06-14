const path = require('path');
// Add backend node_modules to resolve mongoose and dotenv
module.paths.push(path.join(__dirname, '..', '..', 'backend', 'node_modules'));

// Load env configurations from backend
require('../../backend/config/env').loadEnv();
const mongoose = require('mongoose');

const topicTitle = process.argv[2];
if (!topicTitle) {
  console.error('Missing topicTitle parameter');
  process.exit(1);
}

console.log('Connecting to database...');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    const topic = await db.collection('projecttopics').findOne({ title: topicTitle });
    const lecturer = await db.collection('lecturers').findOne({});
    
    console.log('E2E DB Setup: found topic:', topic ? topic._id : 'null', 'lecturer:', lecturer ? lecturer._id : 'null');
    if (!topic || !lecturer) {
      throw new Error('Required topic or lecturer not found in database.');
    }
    
    await db.collection('projecttopics').updateOne({ _id: topic._id }, { $set: { supervisorId: lecturer._id, status: 'assigned' } });
    
    const insertProject = await db.collection('projects').insertOne({
      periodId: topic.periodId,
      ownerType: topic.ownerType,
      ownerId: topic.ownerId,
      studentId: topic.studentId || topic.ownerId,
      groupId: topic.groupId,
      topicId: topic._id,
      supervisorId: lecturer._id,
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });
    console.log('E2E DB Setup: inserted project:', insertProject.insertedId);

    await db.collection('submissionpackages').insertOne({
      projectId: insertProject.insertedId,
      ownerId: insertProject.insertedId,
      ownerType: 'student',
      phase: 'progress',
      status: 'open',
      submissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });
    console.log('E2E DB Setup: inserted submission package');

    await db.collection('milestones').insertOne({
      projectId: insertProject.insertedId,
      title: 'Báo cáo tiến độ E2E',
      description: 'Nộp báo cáo kiểm thử tự động',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'open',
      submissions: [],
      feedback: [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('E2E DB Setup: inserted milestone');
    process.exit(0);
  } catch (err) {
    console.error('E2E Setup script error:', err);
    process.exit(1);
  } finally {
    mongoose.disconnect();
  }
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
