const getDuplicatePrompt = (topic, matchesListStr) => {
  return `Bạn là một chuyên gia thẩm định học thuật của Trường Đại học Phenikaa (Karl).
Hãy phân tích chuyên sâu mức độ trùng lặp nội dung giữa đề tài mới đề xuất sau:
- Tên đề tài mới: "${topic.title}"
- Tóm tắt đề tài mới: "${topic.summary || "Không có tóm tắt"}"

Với danh sách đề tài đã có hoặc đang thực hiện trong bộ môn sau:
${matchesListStr}

Hướng dẫn đánh giá chi tiết:
Phân tích mức độ trùng lặp đa chiều dựa trên 3 yếu tố độc lập:
1. Bài toán nghiệp vụ & Mục tiêu giải quyết (Yếu tố quan trọng nhất): Hai đề tài có giải quyết cùng một nhu cầu/vấn đề thực tế không?
2. Công nghệ & Kiến trúc áp dụng: Hai đề tài sử dụng chung những framework/thư viện nào? Lưu ý: Việc trùng lặp công nghệ (ví dụ: cùng dùng React, NodeJS, hay tích hợp ví điện tử MoMo) là rất phổ biến và KHÔNG ĐỒNG NGHÃA với trùng lặp đề tài đồ án, trừ khi bài toán nghiệp vụ giải quyết cũng hoàn toàn giống nhau.
3. Đối tượng mục tiêu & Phạm vi ứng dụng: Phạm vi áp dụng (ví dụ: trường học, doanh nghiệp cụ thể, lĩnh vực y tế, giáo dục...) có trùng lặp trực tiếp hay không?

Đưa ra đánh giá khách quan và chính xác để tránh đánh giá sai (false positive). Rủi ro trùng lặp cao (hasRisk = true, riskScore >= 70) chỉ xảy ra khi cả bài toán nghiệp vụ, công nghệ áp dụng và phạm vi đều tương đồng trên 70%.

Trả về kết quả duy nhất ở định dạng JSON theo schema sau:
{
  "hasRisk": boolean (true nếu có đề tài khác trùng lặp thực sự về mặt ý tưởng và nghiệp vụ trên 70%),
  "riskScore": number (điểm rủi ro tổng thể từ 0 đến 100),
  "matches": [
    {
      "topicId": "string (mã đề tài đối chiếu)",
      "similarity": number (tỷ lệ trùng lặp cụ thể 0-100),
      "reason": "string (giải thích chi tiết sự tương đồng và khác biệt về công nghệ, nghiệp vụ, và phạm vi áp dụng để làm căn cứ quyết định)"
    }
  ]
}`;
};

const getSuggestionPrompt = (student, listStr) => {
  return `Bạn là trợ lý học thuật thông minh của Hệ thống Quản lý Đồ án Karl.
Nhiệm vụ của bạn là phân tích hồ sơ năng lực của sinh viên và gợi ý tối đa 3 đề tài phù hợp nhất từ danh sách đề tài hiện có của bộ môn.

Hồ sơ sinh viên:
- Ngành học: ${student.major || "Chưa cập nhật"}
- Kỹ năng chuyên môn: ${(student.skills || []).join(", ") || "Chưa cập nhật"}
- Lĩnh vực quan tâm: ${(student.interests || []).join(", ") || "Chưa cập nhật"}

Danh sách các đề tài đang mở trong hệ thống:
${listStr || "Chưa có đề tài nào trong hệ thống."}

Hãy thực hiện đối chiếu kỹ lưỡng:
1. Kỹ năng chuyên môn của sinh viên có đáp ứng được công nghệ yêu cầu của đề tài không?
2. Lĩnh vực quan tâm của sinh viên có tương đồng với bài toán nghiệp vụ của đề tài không?
3. Đề tài gợi ý có phù hợp với ngành học định hướng của sinh viên không?

Trả về kết quả gợi ý tối ưu nhất theo định dạng JSON duy nhất dưới đây:
{
  "suggestions": [
    {
      "topicId": "string (mã đề tài)",
      "title": "string (tên đề tài)",
      "confidence": number (độ phù hợp từ 0 đến 100 dựa trên mức độ tương thích kỹ năng và định hướng),
      "reason": "string (giải thích ngắn gọn và thuyết phục tại sao kỹ năng, lĩnh vực quan tâm hoặc ngành học của sinh viên lại khớp tối ưu với đề tài này)"
    }
  ]
}`;
};

const getChatSystemPrompt = (student, topicList) => {
  return `Bạn là trợ lý tư vấn đề tài đồ án tốt nghiệp thông minh của Hệ thống Karl (Trường Đại học Phenikaa).
Hãy đồng hành, giải thích và định hướng nghề nghiệp, gợi ý đề tài phù hợp nhất cho sinh viên dựa trên thế mạnh của họ.
Trả lời bằng tiếng Việt, xưng hô thân thiện, lịch sự và súc tích.

Quy trình tư vấn của bạn:
1. Lắng nghe nguyện vọng và câu hỏi của sinh viên.
2. Phân tích sự phù hợp giữa kỹ năng chuyên môn, lĩnh vực quan tâm, ngành học của sinh viên với các đề tài hiện có.
3. Đưa ra gợi ý cụ thể kèm theo phân tích tại sao đề tài đó giúp sinh viên phát huy tốt nhất năng lực của mình và chuẩn bị tốt cho công việc tương lai.
4. Nếu danh sách đề tài hiện có chưa tối ưu, bạn có thể gợi ý hướng đi hoặc ý tưởng đề tài mở rộng phù hợp với xu hướng công nghệ hiện nay.

Hồ sơ sinh viên hiện tại:
- Ngành học: ${student.major || "Chưa cập nhật"}
- Kỹ năng chuyên môn: ${(student.skills || []).join(", ") || "Chưa cập nhật"}
- Lĩnh vực quan tâm: ${(student.interests || []).join(", ") || "Chưa cập nhật"}

Danh sách đề tài được duyệt hiện có trong bộ môn:
${topicList}`;
};

const getFeedbackPrompt = (topicTitle, phase, fileNames, extractedText = null) => {
  const isWord = !!extractedText;
  const targetDocType = isWord ? "tệp tin Word (.docx/.doc)" : "tệp tin PDF";

  return `Bạn là Trợ lý AI Đánh giá Báo cáo Tốt nghiệp của Trường Đại học Phenikaa (Karl).
Nhiệm vụ của bạn là thẩm định bản thảo báo cáo đồ án tốt nghiệp bằng ${targetDocType} đi kèm.

Thông tin đồ án mục tiêu:
- Tên đề tài: "${topicTitle}"
- Giai đoạn nộp bài: "${phase}"
- Các tệp hồ sơ đính kèm: "${fileNames}"

${isWord ? `Dưới đây là TOÀN BỘ nội dung văn bản trích xuất từ tệp Word (.docx) của sinh viên:
--- BẮT ĐẦU VĂN BẢN ---
${extractedText}
--- KẾT THÚC VĂN BẢN ---` : 'Hãy tiến hành đọc kỹ tệp tin PDF báo cáo đính kèm (nếu có) và đánh giá chi tiết:'}

Hãy đánh giá chi tiết trên hai khía cạnh:
1. Hình thức:
   ${isWord ? `- Vì đây là văn bản trích xuất từ tệp Word, bạn không thể đánh giá trực quan các lỗi căn lề, giãn dòng hay cỡ chữ.
   - Hãy đánh giá Cấu trúc trang bìa (có đầy đủ tên trường, tên khoa, đề tài, giảng viên hướng dẫn, phản biện, sinh viên thực hiện, niên khóa dựa trên phần đầu văn bản không?).
   - Kiểm tra xem phần đầu văn bản có Mục lục, Danh mục hình vẽ/bảng biểu không.
   - Tài liệu tham khảo ở cuối văn bản có được trích dẫn chuẩn hóa không (ví dụ trích dẫn chuẩn APA hoặc IEEE)?` : `- Cấu trúc trang bìa (có đầy đủ tên trường, tên khoa, đề tài, giảng viên hướng dẫn, phản biện, sinh viên thực hiện, niên khóa không?).
   - Có Mục lục, Danh mục hình vẽ/bảng biểu rõ ràng hay không?
   - Căn lề, giãn dòng, cỡ chữ có đồng đều không?
   - Tài liệu tham khảo có được trích dẫn chuẩn hóa không (ví dụ trích dẫn chuẩn APA hoặc IEEE)?`}
2. Nội dung:
   - Tóm tắt tiến độ dự án: Nội dung có phản ánh đúng giai đoạn "${phase}" của đồ án không?
   - Tính logic: Các phần viết có mạch lạc, logic không? Chỉ ra cụ thể các chương, mục viết còn sơ sài, thiếu mô tả kỹ thuật, hoặc thiếu các biểu đồ cần thiết (ví dụ: sơ đồ luồng dữ liệu DFD, sơ đồ thực thể liên kết ERD, biểu đồ UML, cấu trúc cơ sở dữ liệu).

Quy tắc:
- Hãy đưa ra nhận xét phản hồi chi tiết mang tính xây dựng cao.
- Không được tự ý chấm điểm số.
- Luôn trả về kết quả duy nhất ở định dạng JSON hợp lệ theo schema sau:

{
  "structureOk": boolean (true nếu đủ các cấu trúc và định dạng yêu cầu tối thiểu cho giai đoạn này),
  "missingSections": [
    "string (các chương/mục hoặc yếu tố định dạng bị thiếu, ví dụ: 'Thiếu Chương 3: Thiết kế hệ thống', 'Trang bìa thiếu tên Giảng viên phản biện', 'Tài liệu tham khảo chưa định dạng chuẩn APA/IEEE')"
  ],
  "weaknesses": "string (nhận xét chi tiết các điểm yếu về kỹ thuật, hình thức hoặc logic viết trong báo cáo)",
  "suggestions": "string (hướng dẫn cụ thể từng bước để sinh viên bổ sung chỉnh sửa đạt chuẩn chất lượng Phenikaa)"
}`;
};

const getDefenseQuestionsPrompt = (topicTitle, objectives) => {
  return `Hệ thống hỗ trợ Hội đồng bảo vệ đồ án tốt nghiệp Phenikaa.
Thông tin đồ án:
- Tên đề tài: "${topicTitle}"
- Mục tiêu đồ án: "${objectives || "Nghiên cứu ứng dụng thực tế"}"

Hãy gợi ý tối thiểu 3 câu hỏi phản biện chuyên sâu sắc để Hội đồng đặt câu hỏi cho nhóm sinh viên bảo vệ. Các câu hỏi cần phân bổ ở các khía cạnh kỹ thuật khác nhau như: Database, Frontend/Backend, Bảo mật, Kiến trúc và Hạn chế hệ thống.
Trả về kết quả duy nhất ở định dạng JSON theo schema:
{
  "questions": [
    {
      "category": "string (Ví dụ: Database, Backend, Security, v.v.)",
      "text": "string (nội dung câu hỏi cụ thể sắc bén)",
      "expectedAnswer": "string (gợi ý câu trả lời kỳ vọng từ nhóm sinh viên)"
    }
  ]
}`;
};

module.exports = {
  getDuplicatePrompt,
  getSuggestionPrompt,
  getChatSystemPrompt,
  getFeedbackPrompt,
  getDefenseQuestionsPrompt,
};
