const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const EvaluationRubric = require('../models/EvaluationRubric');

const seedRubrics = async () => {
  try {
    await connectDB();

    console.log('--- Cleaning Old Rubrics ---');
    await EvaluationRubric.deleteMany({});
    console.log('✅ Cleaned EvaluationRubric collection.');

    const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });
    const creatorId = staffUser ? staffUser._id : new mongoose.Types.ObjectId();

    console.log('\n--- Seeding Evaluation Rubrics ---');

    // 1. Rubric for Graduation Project (Đồ án tốt nghiệp / Đồ án cơ sở)
    const graduationRubric = await EvaluationRubric.create({
      name: 'Bảng tiêu chuẩn chấm đồ án tốt nghiệp ngành Công nghệ thông tin',
      version: '1.0-DATN-HUST',
      description: 'Tiêu chí chấm điểm chi tiết chuẩn hóa dành cho Đồ án tốt nghiệp ngành CNTT. Tổng trọng số của từng vai trò được chuẩn hóa bằng 1.0 (tương ứng 100% trên thang điểm 10).',
      criteria: {
        SUPERVISOR: [
          { criteriaCode: 'C1', criteriaName: 'Thái độ làm việc, tính chủ động và chuyên cần', maxScore: 10, weight: 0.2 },
          { criteriaCode: 'C2', criteriaName: 'Mức độ hoàn thành khối lượng công việc được giao', maxScore: 10, weight: 0.3 },
          { criteriaCode: 'C3', criteriaName: 'Chất lượng nội dung báo cáo và tính học thuật', maxScore: 10, weight: 0.3 },
          { criteriaCode: 'C4', criteriaName: 'Kỹ năng giải quyết vấn đề và tính sáng tạo', maxScore: 10, weight: 0.2 },
        ],
        REVIEWER: [
          { criteriaCode: 'C1', criteriaName: 'Bố cục, hình thức trình bày quyển báo cáo', maxScore: 10, weight: 0.2 },
          { criteriaCode: 'C2', criteriaName: 'Chất lượng tài liệu tham khảo và trích dẫn khoa học', maxScore: 10, weight: 0.1 },
          { criteriaCode: 'C3', criteriaName: 'Ý nghĩa thực tiễn, tính mới và độ phức tạp của đề tài', maxScore: 10, weight: 0.3 },
          { criteriaCode: 'C4', criteriaName: 'Kết quả thực nghiệm, mức độ hoàn thiện sản phẩm', maxScore: 10, weight: 0.4 },
        ],
        COMMITTEE_MEMBER: [
          { criteriaCode: 'C1', criteriaName: 'Bố cục và tính khoa học của nội dung báo cáo', maxScore: 10, weight: 0.2 },
          { criteriaCode: 'C2', criteriaName: 'Chất lượng sản phẩm thực tế / Source code / Thực nghiệm', maxScore: 10, weight: 0.3 },
          { criteriaCode: 'C3', criteriaName: 'Kỹ năng thuyết trình, slide báo cáo chuyên nghiệp', maxScore: 10, weight: 0.25 },
          { criteriaCode: 'C4', criteriaName: 'Kỹ năng vấn đáp, trả lời câu hỏi phản biện hội đồng', maxScore: 10, weight: 0.25 },
        ]
      },
      createdBy: creatorId,
      updatedBy: creatorId
    });
    console.log('✅ Seeded Rubric: ' + graduationRubric.name);

    // 2. Rubric for Interdisciplinary Project (Đồ án liên ngành)
    const interdisciplinaryRubric = await EvaluationRubric.create({
      name: 'Bảng tiêu chuẩn chấm đồ án liên ngành Khoa học máy tính & Kỹ thuật máy tính',
      version: '1.0-DALN-HUST',
      description: 'Tiêu chí chấm điểm chi tiết chuyên sâu cho Đồ án liên ngành, chú trọng vào sự tích hợp đa ngành, làm việc nhóm và đóng góp cá nhân.',
      criteria: {
        SUPERVISOR: [
          { criteriaCode: 'C1', criteriaName: 'Thái độ làm việc nhóm, chuyên cần và chủ động', maxScore: 10, weight: 0.2 },
          { criteriaCode: 'C2', criteriaName: 'Mức độ tích hợp kiến thức liên ngành trong nhiệm vụ', maxScore: 10, weight: 0.3 },
          { criteriaCode: 'C3', criteriaName: 'Chất lượng nội dung phân tích & thiết kế báo cáo', maxScore: 10, weight: 0.3 },
          { criteriaCode: 'C4', criteriaName: 'Đóng góp cá nhân thực tế vào sản phẩm chung', maxScore: 10, weight: 0.2 },
        ],
        REVIEWER: [
          { criteriaCode: 'C1', criteriaName: 'Hình thức báo cáo, tính khoa học và cấu trúc tài liệu', maxScore: 10, weight: 0.2 },
          { criteriaCode: 'C2', criteriaName: 'Tính mới, độ phức tạp và khả năng ứng dụng thực tế', maxScore: 10, weight: 0.2 },
          { criteriaCode: 'C3', criteriaName: 'Khối lượng công việc và mức độ hoàn thành sản phẩm liên ngành', maxScore: 10, weight: 0.3 },
          { criteriaCode: 'C4', criteriaName: 'Chất lượng giải pháp kỹ thuật tích hợp liên ngành', maxScore: 10, weight: 0.3 },
        ],
        COMMITTEE_MEMBER: [
          { criteriaCode: 'C1', criteriaName: 'Mức độ tích hợp liên ngành và phối hợp nhóm', maxScore: 10, weight: 0.2 },
          { criteriaCode: 'C2', criteriaName: 'Chất lượng sản phẩm chung và Source code nhóm', maxScore: 10, weight: 0.3 },
          { criteriaCode: 'C3', criteriaName: 'Kỹ năng thuyết trình nhóm, sự phối hợp báo cáo', maxScore: 10, weight: 0.2 },
          { criteriaCode: 'C4', criteriaName: 'Đóng góp cá nhân và trả lời câu hỏi chuyên sâu', maxScore: 10, weight: 0.3 },
        ]
      },
      createdBy: creatorId,
      updatedBy: creatorId
    });
    console.log('✅ Seeded Rubric: ' + interdisciplinaryRubric.name);

    console.log('\n✅ Rubrics Database Seeding Completed!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
    process.exit(1);
  }
};

seedRubrics();
