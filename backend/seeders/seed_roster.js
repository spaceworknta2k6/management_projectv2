const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const mongoose = require('mongoose');

const Student = require('../models/Student');
const ProjectPeriod = require('../models/ProjectPeriod');
const ProjectRoster = require('../models/ProjectRoster');
const User = require('../models/User');

const seedRoster = async () => {
  try {
    await connectDB();

    const student = await Student.findOne();
    if (!student) {
      console.log('No student found in DB.');
      process.exit(1);
    }

    const periods = await ProjectPeriod.find();
    if (periods.length === 0) {
      console.log('No periods found in DB.');
      process.exit(1);
    }

    const staffUser = await User.findOne({ roles: 'FACULTY_STAFF' });
    if (!staffUser) {
      console.log('No staff user found in DB.');
      process.exit(1);
    }

    for (const p of periods) {
      p.status = 'registration_open';
      await p.save();
      
      await ProjectRoster.findOneAndUpdate(
        { periodId: p._id, studentId: student._id },
        {
          periodId: p._id,
          studentId: student._id,
          classSection: 'CNTT-K67',
          status: 'active',
          importedBy: staffUser._id,
        },
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`✅ Rostered and activated period: ${p.name}`);
    }

    console.log('✅ Student rostered successfully for all periods!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed roster:', error);
    process.exit(1);
  }
};

seedRoster();
