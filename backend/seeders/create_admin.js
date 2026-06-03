const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const run = async () => {
  try {
    await connectDB();
    const email = 'admin@st.phenikaa-uni.edu.vn';
    
    // Check if exists
    let admin = await User.findOne({ email, isDeleted: false });
    if (admin) {
      console.log(`Tài khoản ${email} đã tồn tại với roles:`, admin.roles);
      if (!admin.roles.includes('SYSTEM_ADMIN')) {
        admin.roles.push('SYSTEM_ADMIN');
        await admin.save();
        console.log('Đã cập nhật thêm vai trò SYSTEM_ADMIN cho tài khoản.');
      }
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);
      
      admin = await User.create({
        fullName: 'Quản trị viên Karl',
        email,
        passwordHash,
        roles: ['SYSTEM_ADMIN'],
        status: 'active',
      });
      console.log(`Đã tạo tài khoản Admin thành công: ${email} / password123`);
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi tạo tài khoản Admin:', error);
    process.exit(1);
  }
};

run();
