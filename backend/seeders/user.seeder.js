const path = require('path');
// Load environment variables dynamically
require('../config/env').loadEnv();

const connectDB = require('../config/db');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Student = require('../models/Student');
const Lecturer = require('../models/Lecturer');

const seedData = async () => {
  try {
    await connectDB();

    console.log('--- Cleaning Existing Users Data ---');
    await User.deleteMany({});
    await Student.deleteMany({});
    await Lecturer.deleteMany({});
    console.log('✅ Cleaned User, Student, and Lecturer collections.');

    console.log('\n--- Hashing Password ---');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    console.log('✅ Password "password123" hashed successfully.');

    // Mock ObjectIds for scopes
    const itFacultyId = new mongoose.Types.ObjectId();
    const softwareDeptId = new mongoose.Types.ObjectId();

    console.log('\n--- Seeding Users and Profiles ---');

    // 1. Seed Student: Hoàng Anh
    const studentUser = await User.create({
      fullName: 'Hoàng Anh',
      email: 'hoanganh@hust.edu.vn',
      passwordHash,
      roles: ['STUDENT'],
      status: 'active',
    });

    await Student.create({
      userId: studentUser._id,
      studentCode: '22021435',
      className: 'CNTT-K67',
      cohort: 'K67',
      major: 'Công nghệ thông tin',
      facultyId: itFacultyId,
      skills: ['Node.js', 'React', 'Tailwind CSS'],
      interests: ['Microservices', 'AI Chatbots', 'Cloud Architectures'],
      technologies: ['Docker', 'MongoDB', 'Next.js'],
    });
    console.log('🎓 Seeded Student: Hoàng Anh (hoanganh@hust.edu.vn / 22021435)');

    // 2. Seed Lecturer/Supervisor: Kiều Tuấn Hải
    const supervisorUser = await User.create({
      fullName: 'Kiều Tuấn Hải',
      email: 'haikt@hust.edu.vn',
      passwordHash,
      roles: ['LECTURER'],
      status: 'active',
    });

    await Lecturer.create({
      userId: supervisorUser._id,
      lecturerCode: 'GV001',
      facultyId: itFacultyId,
      departmentId: softwareDeptId,
      academicDegree: 'associate_professor',
      expertise: ['Microservices', 'AI Systems', 'Cloud Computing', 'OAuth2 Security'],
      maxProjects: 5,
      isExternal: false,
      organization: 'HUST',
    });
    console.log('👨‍🏫 Seeded Supervisor: Kiều Tuấn Hải (haikt@hust.edu.vn / GV001)');

    // 3. Seed Lecturer/Reviewer: Nguyễn Thị Hồng
    const reviewerUser = await User.create({
      fullName: 'Nguyễn Thị Hồng',
      email: 'hongnt@hust.edu.vn',
      passwordHash,
      roles: ['LECTURER'],
      status: 'active',
    });

    await Lecturer.create({
      userId: reviewerUser._id,
      lecturerCode: 'GV003',
      facultyId: itFacultyId,
      departmentId: softwareDeptId,
      academicDegree: 'phd',
      expertise: ['Machine Learning', 'Data Mining', 'IoT Systems'],
      maxProjects: 3,
      isExternal: false,
      organization: 'HUST',
    });
    console.log('🔬 Seeded Reviewer: Nguyễn Thị Hồng (hongnt@hust.edu.vn / GV003)');

    // 4. Seed Faculty Staff: Lê Thị Hương
    const staffUser = await User.create({
      fullName: 'Lê Thị Hương',
      email: 'huonglt@hust.edu.vn',
      passwordHash,
      roles: ['FACULTY_STAFF'],
      status: 'active',
    });

    await Lecturer.create({
      userId: staffUser._id,
      lecturerCode: 'GV002',
      facultyId: itFacultyId,
      departmentId: softwareDeptId,
      academicDegree: 'master',
      expertise: ['Academic Coordinator', 'Operations'],
      maxProjects: 0,
      isExternal: false,
      organization: 'Khoa CNTT - HUST',
    });
    console.log('🏢 Seeded Faculty Staff: Lê Thị Hương (huonglt@hust.edu.vn / GV002)');

    // 5. Seed System Admin: Quản trị viên Karl
    await User.create({
      fullName: 'Quản trị viên Karl',
      email: 'admin@st.phenikaa-uni.edu.vn',
      passwordHash,
      roles: ['SYSTEM_ADMIN'],
      status: 'active',
    });
    console.log('👑 Seeded System Admin: Quản trị viên Karl (admin@st.phenikaa-uni.edu.vn / password123)');

    console.log('\n✅ Database Seeding Completed SUCCESSFUL!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
    process.exit(1);
  }
};

seedData();
