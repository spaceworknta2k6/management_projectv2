const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const periodsService = require('./domains/periods/periods.service');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const user = await User.findOne({ email: 'huonglt@hust.edu.vn' });
  console.log('User found:', user ? user._id : 'null');

  if (user) {
    const periodPayload = {
      name: 'Đợt Đồ án Tốt nghiệp Kỳ 20252',
      schoolYear: '2025-2026',
      semester: '2',
      type: 'foundation_project',
      rubricVersion: 'HUST-SET-2026',
      minGroupSize: 1,
      maxGroupSize: 3,
      scoringFormula: {
        supervisor: 0.3,
        reviewer: 0.2,
        committee: 0.5,
      },
      registrationStart: new Date('2026-06-05T08:00').toISOString(),
      registrationEnd: new Date('2026-06-15T18:00').toISOString(),
      topicChangeDeadline: new Date('2026-06-20T18:00').toISOString(),
      projectStart: new Date('2026-06-25T08:00').toISOString(),
      projectEnd: new Date('2026-09-15T18:00').toISOString(),
      preDefenseSubmissionDeadline: new Date('2026-09-01T18:00').toISOString(),
      defenseStart: new Date('2026-09-05T08:00').toISOString(),
      defenseEnd: new Date('2026-09-10T18:00').toISOString(),
      postDefenseRevisionDeadline: new Date('2026-09-20T18:00').toISOString(),
      archiveDeadline: new Date('2026-09-30T18:00').toISOString(),
    };

    try {
      const res = await periodsService.createPeriod(periodPayload, user._id);
      console.log('Period created successfully:', res);
    } catch (err) {
      console.error('Error creating period:', err);
    }
  }

  await mongoose.disconnect();
}

test();
