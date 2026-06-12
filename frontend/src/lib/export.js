/**
 * Hỗ trợ xuất mảng dữ liệu ra tệp tin CSV mã hóa UTF-8 có BOM
 * giúp Excel hiển thị tiếng Việt có dấu chuẩn xác.
 *
 * @param {Array<Array<any>>} data - Mảng các dòng dữ liệu (mỗi dòng là một mảng giá trị)
 * @param {Array<string>} headers - Mảng tiêu đề cột
 * @param {string} filename - Tên file tải về (không kèm phần mở rộng)
 */
export const exportToCSV = (data, headers, filename) => {
  if (!data || !headers) return;

  // Ghép tiêu đề cột và các dòng dữ liệu
  const rows = [headers, ...data];

  // Chuyển đổi sang chuỗi CSV chuẩn
  const csvContent = rows
    .map((row) =>
      row
        .map((val) => {
          // Xử lý ký tự đặc biệt, dấu nháy kép, dấu phẩy, xuống dòng theo chuẩn Excel
          const stringVal = String(val ?? '').replace(/"/g, '""');
          if (
            stringVal.includes(',') ||
            stringVal.includes('"') ||
            stringVal.includes('\n') ||
            stringVal.includes('\r')
          ) {
            return `"${stringVal}"`;
          }
          return stringVal;
        })
        .join(',')
    )
    .join('\n');

  // Sử dụng Byte Order Mark (BOM) \uFEFF cho mã hóa UTF-8 để Excel hiển thị đúng tiếng Việt
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename || 'export'}.csv`);
  document.body.appendChild(link);
  
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
