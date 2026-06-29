const mongoose = require('mongoose');

const AppealRequestSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectPeriod',
    required: true,
  },
  finalGradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinalGrade',
    required: true,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'grading', 'completed', 'cancelled'],
    default: 'pending',
  },
  // Giáo vụ xác nhận sinh viên đã nộp lệ phí
  feePaidAt: {
    type: Date,
  },
  // GV được phân công chấm lại — phải khác GVHD và GV chấm ban đầu
  recheckGraderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecturer',
  },
  // ScoreSheet được tạo bởi GV chấm lại (targetType='RECHECK')
  recheckScoreSheetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScoreSheet',
  },
  // Ghi chú của giáo vụ khi phân công
  adminNote: {
    type: String,
    trim: true,
  },
  resolvedAt: {
    type: Date,
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Mỗi sinh viên chỉ được nộp 1 đơn phúc khảo cho 1 dự án trong 1 đợt
AppealRequestSchema.index({ projectId: 1, studentId: 1, periodId: 1 }, { unique: true });

// Lọc soft delete mặc định
AppealRequestSchema.pre(/^find/, function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

module.exports = mongoose.model('AppealRequest', AppealRequestSchema);
