const mongoose = require('mongoose');

const validateScheduleSession = (req, res, next) => {
  const { projectId, committeeId, mode, room, meetingUrl, defenseDate, startTime, endTime, orderNumber } = req.body;
  const errors = [];

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    errors.push({ field: 'projectId', code: 'PROJECT_ID_INVALID', message: 'Mã dự án (projectId) không hợp lệ.' });
  }

  if (!committeeId || !mongoose.Types.ObjectId.isValid(committeeId)) {
    errors.push({ field: 'committeeId', code: 'COMMITTEE_ID_INVALID', message: 'Mã hội đồng (committeeId) không hợp lệ.' });
  }

  if (!mode || !['offline', 'online'].includes(mode)) {
    errors.push({ field: 'mode', code: 'MODE_INVALID', message: 'Hình thức bảo vệ phải là offline hoặc online.' });
  } else {
    if (mode === 'offline' && (!room || typeof room !== 'string' || room.trim() === '')) {
      errors.push({ field: 'room', code: 'ROOM_REQUIRED', message: 'Phòng bảo vệ (room) là bắt buộc khi bảo vệ offline.' });
    }
    if (mode === 'online' && (!meetingUrl || typeof meetingUrl !== 'string' || meetingUrl.trim() === '')) {
      errors.push({ field: 'meetingUrl', code: 'MEETING_URL_REQUIRED', message: 'Đường dẫn phòng họp trực tuyến (meetingUrl) là bắt buộc khi bảo vệ online.' });
    }
  }

  if (!defenseDate || isNaN(new Date(defenseDate).getTime())) {
    errors.push({ field: 'defenseDate', code: 'DEFENSE_DATE_INVALID', message: 'Ngày bảo vệ không hợp lệ.' });
  }

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!startTime || !timeRegex.test(startTime)) {
    errors.push({ field: 'startTime', code: 'START_TIME_INVALID', message: 'Giờ bắt đầu không hợp lệ (định dạng HH:MM).' });
  }

  if (!endTime || !timeRegex.test(endTime)) {
    errors.push({ field: 'endTime', code: 'END_TIME_INVALID', message: 'Giờ kết thúc không hợp lệ (định dạng HH:MM).' });
  }

  if (orderNumber === undefined || typeof orderNumber !== 'number' || orderNumber < 1) {
    errors.push({ field: 'orderNumber', code: 'ORDER_NUMBER_INVALID', message: 'Thứ tự bảo vệ phải là số nguyên dương.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu phiên bảo vệ không hợp lệ.',
      errors,
    });
  }

  next();
};

const validateReportIncident = (req, res, next) => {
  const { type, resolution } = req.body;
  const errors = [];

  if (!type || !['power', 'network', 'device', 'health', 'other'].includes(type)) {
    errors.push({ field: 'type', code: 'INCIDENT_TYPE_INVALID', message: 'Loại sự cố không hợp lệ.' });
  }

  if (!resolution || typeof resolution !== 'string' || resolution.trim() === '') {
    errors.push({ field: 'resolution', code: 'RESOLUTION_REQUIRED', message: 'Biện pháp khắc phục sự cố là bắt buộc.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: 'Dữ liệu báo cáo sự cố không hợp lệ.',
      errors,
    });
  }

  next();
};

module.exports = {
  validateScheduleSession,
  validateReportIncident,
};
