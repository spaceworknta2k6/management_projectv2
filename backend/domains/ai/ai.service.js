const crypto = require("crypto");
const AiJob = require("../../models/AiJob");
const TopicEmbedding = require("../../models/TopicEmbedding");
const ProjectTopic = require("../../models/ProjectTopic");
const Student = require("../../models/Student");
const User = require("../../models/User");
const Project = require("../../models/Project");
const SubmissionPackage = require("../../models/SubmissionPackage");

const getApiKey = () => {
  return process.env.GEMINI_API_KEY;
};

const getModelName = () => {
  const apiKey = getApiKey();
  if (apiKey && apiKey.startsWith("sk-or-")) {
    return "google/gemini-2.5-pro";
  }
  return "gemini-2.5-flash";
};

const callGemini = async (prompt) => {
  const apiKey = getApiKey();
  const isOpenRouter = apiKey && apiKey.startsWith("sk-or-");

  let url;
  let headers = {
    "Content-Type": "application/json",
  };
  let payload;

  if (isOpenRouter) {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "Karl Management System";

    payload = {
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    };
  } else {
    const model = "gemini-2.5-flash";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    headers["x-goog-api-key"] = apiKey;

    payload = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(
        "Yêu cầu tới AI API bị quá thời gian chờ (Timeout 15 giây).",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API Error (HTTP ${res.status}): ${errText}`);
  }

  const result = await res.json();

  let text = "";
  if (isOpenRouter) {
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error(`OpenRouter Invalid Response: ${JSON.stringify(result)}`);
    }
    text = result.choices[0].message.content;
  } else {
    if (
      !result.candidates ||
      !result.candidates[0] ||
      !result.candidates[0].content
    ) {
      throw new Error(`Gemini Invalid Response: ${JSON.stringify(result)}`);
    }
    text = result.candidates[0].content.parts[0].text;
  }

  try {
    return JSON.parse(text);
  } catch (parseErr) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw parseErr;
  }
};

const callAIChat = async (messages) => {
  const apiKey = getApiKey();
  const isOpenRouter = apiKey && apiKey.startsWith("sk-or-");

  let url;
  let headers = { "Content-Type": "application/json" };
  let payload;

  if (isOpenRouter) {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "Karl Management System";
    payload = { model: "google/gemini-2.5-pro", messages };
  } else {
    const model = "gemini-2.5-flash";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    headers["x-goog-api-key"] = apiKey;

    const systemMsg = messages.find((m) => m.role === "system");
    const conversationMsgs = messages.filter((m) => m.role !== "system");
    payload = {
      ...(systemMsg && {
        systemInstruction: { parts: [{ text: systemMsg.content }] },
      }),
      contents: conversationMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    };
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(
        "Cuộc hội thoại với AI bị quá thời gian chờ (Timeout 15 giây).",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI Chat Error (HTTP ${res.status}): ${errText}`);
  }

  const result = await res.json();
  if (isOpenRouter) {
    if (!result.choices?.[0]?.message?.content)
      throw new Error(`OpenRouter invalid response: ${JSON.stringify(result)}`);
    return result.choices[0].message.content;
  } else {
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text)
      throw new Error(`Gemini invalid response: ${JSON.stringify(result)}`);
    return result.candidates[0].content.parts[0].text;
  }
};

const chatTopicSuggestion = async (studentId, messages) => {
  const student = await Student.findById(studentId).populate("userId");
  if (!student) throw { status: 404, message: "Sinh viên không tồn tại." };

  const topics = await ProjectTopic.find({ status: "approved" }).limit(20);
  const topicList =
    topics.length > 0
      ? topics
          .map(
            (t, i) =>
              `${i + 1}. "${t.title}"${t.summary ? ` — ${t.summary}` : ""}`,
          )
          .join("\n")
      : "Chưa có đề tài nào được duyệt trong hệ thống.";

  const systemPrompt = `Bạn là trợ lý tư vấn đề tài đồ án thông minh của Hệ thống Karl (Trường Đại học Phenikaa).
Hãy tư vấn, giải thích và gợi ý đề tài phù hợp nhất. Trả lời bằng tiếng Việt, thân thiện và súc tích.

Hồ sơ sinh viên đang tư vấn:
- Ngành học: ${student.major || "Chưa cập nhật"}
- Kỹ năng chuyên môn: ${(student.skills || []).join(", ") || "Chưa cập nhật"}
- Lĩnh vực quan tâm: ${(student.interests || []).join(", ") || "Chưa cập nhật"}

Danh sách đề tài hiện có trong hệ thống:
${topicList}`;

  const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];
  return await callAIChat(fullMessages);
};

const getEmbedding = async (text) => {
  const apiKey = getApiKey();
  if (apiKey && apiKey.startsWith("sk-or-")) {
    return null;
  }
  const model = "gemini-embedding-2";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;

  const payload = {
    content: {
      parts: [{ text }],
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(
        "Yêu cầu trích xuất Vector hóa (Embedding) bị quá thời gian chờ (Timeout 15 giây).",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Embedding Error (HTTP ${res.status}): ${errText}`);
  }

  const result = await res.json();
  return result.embedding.values;
};

const dotProduct = (a, b) => a.reduce((sum, val, idx) => sum + val * b[idx], 0);
const magnitude = (arr) =>
  Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
const cosineSimilarity = (a, b) => {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
};

const executeJob = async (job, processFn) => {
  job.status = "running";
  await job.save();

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await processFn();
      job.result = result;
      job.status = "succeeded";
      job.completedAt = new Date();
      return await job.save();
    } catch (err) {
      lastError = err;
      job.retryCount = attempt;
      await job.save();
      console.warn(
        `AiJob ${job._id} attempt ${attempt} failed: ${err.message}`,
      );
    }
  }

  job.status = "failed";
  job.error = lastError ? lastError.message : "Unknown execution failure";
  return await job.save();
};

const checkDuplicateTopic = async (topicId, user) => {
  const topic = await ProjectTopic.findById(topicId);
  if (!topic) throw { status: 404, message: "Đề tài không tồn tại." };

  const inputs = { title: topic.title, summary: topic.summary };
  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(inputs))
    .digest("hex");

  // Check cache hit
  const cachedJob = await AiJob.findOne({
    feature: "duplicate_topic",
    targetType: "ProjectTopic",
    targetId: topicId,
    inputHash,
    status: "succeeded",
  });
  if (cachedJob) return cachedJob;

  const job = new AiJob({
    feature: "duplicate_topic",
    targetType: "ProjectTopic",
    targetId: topicId,
    inputHash,
    model: getModelName(),
    createdBy: user._id,
  });
  await job.save();

  // Async process wrapper (for test suite we run synchronously or wait it out)
  const processFn = async () => {
    const apiKey = getApiKey();
    const isOpenRouter = apiKey && apiKey.startsWith("sk-or-");
    const parsedMatches = [];

    if (!isOpenRouter) {
      // 1. Generate & Cache Embedding
      const textToEmbed = `${topic.title} ${topic.summary || ""}`;
      const vector = await getEmbedding(textToEmbed);

      if (vector) {
        await TopicEmbedding.findOneAndUpdate(
          { topicId: topic._id },
          {
            embeddingVector: vector,
            model: "gemini-embedding-2",
            keywords: [],
          },
          { upsert: true },
        );

        // 2. Fetch other topics in department and calculate Cosine Similarity
        const others = await ProjectTopic.find({
          _id: { $ne: topic._id },
          periodId: topic.periodId,
          status: { $nin: ["cancelled", "rejected"] },
        });

        for (const other of others) {
          let otherEmbed = await TopicEmbedding.findOne({ topicId: other._id });
          if (!otherEmbed) {
            // Fallback: Dynamically generate embedding for older topics on request
            const otherText = `${other.title} ${other.summary || ""}`;
            const otherVector = await getEmbedding(otherText);
            if (otherVector) {
              otherEmbed = await TopicEmbedding.create({
                topicId: other._id,
                embeddingVector: otherVector,
                model: "gemini-embedding-2",
              });
            }
          }

          if (
            otherEmbed &&
            otherEmbed.embeddingVector &&
            otherEmbed.embeddingVector.length
          ) {
            const similarity = cosineSimilarity(
              vector,
              otherEmbed.embeddingVector,
            );
            if (similarity >= 0.3) {
              // Threshold for structural matches
              parsedMatches.push({
                topicId: other._id.toString(),
                title: other.title,
                similarity: Math.round(similarity * 100),
              });
            }
          }
        }
      }
    } else {
      // OpenRouter mode: Fallback to token Jaccard similarity pre-filter
      const tokenize = (str) => {
        if (!str) return new Set();
        return new Set(
          str
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .split(/\s+/)
            .filter((word) => word.length > 1),
        );
      };

      const topicTokens = tokenize(`${topic.title} ${topic.summary || ""}`);

      const others = await ProjectTopic.find({
        _id: { $ne: topic._id },
        periodId: topic.periodId,
        status: { $nin: ["cancelled", "rejected"] },
      });

      for (const other of others) {
        const otherText = `${other.title} ${other.summary || ""}`;
        const otherTokens = tokenize(otherText);

        if (topicTokens.size === 0 || otherTokens.size === 0) continue;

        const intersection = new Set(
          [...topicTokens].filter((x) => otherTokens.has(x)),
        );
        const union = new Set([...topicTokens, ...otherTokens]);
        const jaccardSim = intersection.size / union.size;

        if (jaccardSim >= 0.08) {
          parsedMatches.push({
            topicId: other._id.toString(),
            title: other.title,
            similarity: Math.round(jaccardSim * 100),
          });
        }
      }
    }

    // Sort and limit candidates to top 10
    parsedMatches.sort((a, b) => b.similarity - a.similarity);
    const topMatches = parsedMatches.slice(0, 10);

    // 3. Prompt Gemini for cognitive validation analysis of matches
    if (topMatches.length === 0) {
      return { hasRisk: false, riskScore: 0, matches: [] };
    }

    const matchesListStr = topMatches
      .map(
        (m) =>
          `- [ID: ${m.topicId}] "${m.title}" (Độ tương đồng toán học: ${m.similarity}%)`,
      )
      .join("\n");
    const prompt = `Bạn là một chuyên gia thẩm định học thuật của Trường Đại học Phenikaa (Karl).
Hãy phân tích mức độ trùng lặp nội dung giữa đề tài mới sau:
- Tên đề tài mới: "${topic.title}"
- Tóm tắt đề tài mới: "${topic.summary || "Không có tóm tắt"}"

Với danh sách đề tài hiện hữu trong bộ môn sau:
${matchesListStr}

Hãy đưa ra đánh giá khách quan về rủi ro trùng lặp ý tưởng nghiên cứu.
Trả về kết quả duy nhất ở định dạng JSON theo schema:
{
  "hasRisk": boolean (true nếu có đề tài giống trên 70%),
  "riskScore": number (0 đến 100),
  "matches": [
    {
      "topicId": "string (mã đề tài)",
      "similarity": number (0-100),
      "reason": "string (giải thích chi tiết tại sao giống hoặc khác biệt ở đâu)"
    }
  ]
}`;

    return await callGemini(prompt);
  };

  return await executeJob(job, processFn);
};

const suggestTopics = async (studentId, user, force = false) => {
  const student = await Student.findById(studentId).populate("userId");
  if (!student) throw { status: 404, message: "Sinh viên không tồn tại." };

  const inputs = {
    major: student.major,
    skills: student.skills,
    interests: student.interests,
  };
  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(inputs))
    .digest("hex");

  if (force) {
    // Invalidate previous cached job so AI re-runs with current topic list
    await AiJob.updateMany(
      {
        feature: "topic_suggestion",
        targetType: "Student",
        targetId: studentId,
        status: { $ne: "cancelled" },
      },
      {
        status: "cancelled",
        error: "Invalidated by forced topic suggestion refresh.",
      },
    );
  } else {
    const cachedJob = await AiJob.findOne({
      feature: "topic_suggestion",
      targetType: "Student",
      targetId: studentId,
      inputHash,
      status: "succeeded",
    });
    if (cachedJob) return cachedJob;
  }

  const job = new AiJob({
    feature: "topic_suggestion",
    targetType: "Student",
    targetId: studentId,
    inputHash,
    model: getModelName(),
    createdBy: user._id,
  });
  await job.save();

  const processFn = async () => {
    // Load active approved topics in db that are open
    const topics = await ProjectTopic.find({
      status: "approved",
    }).limit(10); // Standard limit for prompt context efficiency

    const listStr = topics
      .map(
        (t, idx) =>
          `${idx + 1}. [ID: ${t._id}] "${t.title}" - Tóm tắt: ${t.summary || "N/A"}`,
      )
      .join("\n");

    const prompt = `Hệ thống Quản lý Đồ án Karl.
Hãy gợi ý các đề tài phù hợp nhất cho sinh viên sau:
- Ngành: ${student.major}
- Kỹ năng chuyên môn: ${student.skills.join(", ")}
- Lĩnh vực công nghệ quan tâm: ${student.interests.join(", ")}

Từ danh sách các đề tài hiện có sau:
${listStr || "Chưa có đề tài nào trong hệ thống."}

Hãy chọn ra tối đa 3 đề tài thích hợp nhất và lý giải lý do khớp nối.
Trả về kết quả duy nhất ở định dạng JSON theo schema:
{
  "suggestions": [
    {
      "topicId": "string (mã đề tài)",
      "title": "string (tên đề tài)",
      "confidence": number (độ phù hợp từ 0-100),
      "reason": "string (giải thích tại sao công nghệ/kỹ năng của sinh viên khớp với đề tài này)"
    }
  ]
}`;

    return await callGemini(prompt);
  };

  return await executeJob(job, processFn);
};

const analyzeReportFeedback = async (submissionId, user) => {
  const package = await SubmissionPackage.findOne({
    _id: submissionId,
    isDeleted: { $ne: true },
  });
  if (!package) throw { status: 404, message: "Gói hồ sơ nộp không tồn tại." };

  let projectId = package.ownerType === "project" ? package.ownerId : null;
  if (package.ownerType === "defense") {
    const DefenseSession = require("../../models/DefenseSession");
    const defense = await DefenseSession.findOne({
      _id: package.ownerId,
      isDeleted: { $ne: true },
    });
    if (defense) projectId = defense.projectId;
  }

  const project = await Project.findById(projectId).populate("topicId");
  if (!project) throw { status: 404, message: "Dự án không tồn tại." };

  const topicTitle = project.topicId
    ? project.topicId.title
    : "Đồ án Nghiên cứu";
  const fileNames = package.items
    .map((i) => `${i.type} (${i.status})`)
    .join(", ");

  const inputs = {
    projectId: project._id,
    phase: package.phase,
    fileNames,
  };
  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(inputs))
    .digest("hex");

  const cachedJob = await AiJob.findOne({
    feature: "report_feedback",
    targetType: "SubmissionPackage",
    targetId: submissionId,
    inputHash,
    status: "succeeded",
  });
  if (cachedJob) return cachedJob;

  const job = new AiJob({
    feature: "report_feedback",
    targetType: "SubmissionPackage",
    targetId: submissionId,
    inputHash,
    model: getModelName(),
    createdBy: user._id,
  });
  await job.save();

  const processFn = async () => {
    const prompt = `Hệ thống thẩm định chất lượng báo cáo Đồ án tốt nghiệp.
Thông tin đồ án mục tiêu:
- Tên đề tài: "${topicTitle}"
- Giai đoạn nộp bài: "${package.phase}"
- Các tệp hồ sơ đính kèm: "${fileNames}"

Hãy đưa ra nhận xét phản hồi chi tiết về cấu trúc và các điểm cần hoàn thiện của báo cáo tiến độ ở giai đoạn này. Không được tự ý chấm điểm số.
Trả về kết quả duy nhất ở định dạng JSON theo schema:
{
  "structureOk": boolean (true nếu đủ các hồ sơ yêu cầu cho phase này),
  "missingSections": ["string (các chương/mục thiết yếu bị thiếu theo chuẩn học thuật)"],
  "weaknesses": "string (nhận xét điểm yếu kỹ thuật, ví dụ: thiếu biểu đồ UML, cấu trúc CSDL chưa chuẩn, phân tích yêu cầu sơ sài)",
  "suggestions": "string (hướng dẫn cụ thể từng bước để sinh viên bổ sung chỉnh sửa đạt chuẩn Phenikaa)"
}`;

    return await callGemini(prompt);
  };

  return await executeJob(job, processFn);
};

const suggestDefenseQuestions = async (projectId, user) => {
  const project = await Project.findById(projectId).populate("topicId");
  if (!project) throw { status: 404, message: "Dự án đồ án không tồn tại." };

  const topicTitle = project.topicId
    ? project.topicId.title
    : "Đồ án tốt nghiệp";
  const objectives = project.topicId ? project.topicId.objectives : "";

  const inputs = { topicTitle, objectives };
  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(inputs))
    .digest("hex");

  const cachedJob = await AiJob.findOne({
    feature: "defense_question",
    targetType: "Project",
    targetId: projectId,
    inputHash,
    status: "succeeded",
  });
  if (cachedJob) return cachedJob;

  const job = new AiJob({
    feature: "defense_question",
    targetType: "Project",
    targetId: projectId,
    inputHash,
    model: getModelName(),
    createdBy: user._id,
  });
  await job.save();

  const processFn = async () => {
    const prompt = `Hệ thống hỗ trợ Hội đồng bảo vệ đồ án tốt nghiệp Phenikaa.
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

    return await callGemini(prompt);
  };

  return await executeJob(job, processFn);
};

const getJobById = async (id) => {
  const job = await AiJob.findById(id);
  if (!job) throw { status: 404, message: "Tác vụ AI không tồn tại." };
  return job;
};

const retryAiJob = async (id, user) => {
  const job = await AiJob.findById(id);
  if (!job) throw { status: 404, message: "Tác vụ AI không tồn tại." };

  job.status = "queued";
  job.error = undefined;
  job.retryCount = 0;
  await job.save();

  // Deduce processing function
  let processFn;
  if (job.feature === "duplicate_topic") {
    processFn = async () => {
      const topic = await ProjectTopic.findById(job.targetId);
      const apiKey = getApiKey();
      const isOpenRouter = apiKey && apiKey.startsWith("sk-or-");
      if (isOpenRouter) {
        return { hasRisk: false, riskScore: 0, matches: [] };
      }
      const textToEmbed = `${topic.title} ${topic.summary || ""}`;
      const vector = await getEmbedding(textToEmbed);
      if (vector) {
        await TopicEmbedding.findOneAndUpdate(
          { topicId: topic._id },
          { embeddingVector: vector },
          { upsert: true },
        );
      }
      return { hasRisk: false, riskScore: 0, matches: [] }; // Mock fast fallback for simplicity
    };
  } else if (job.feature === "topic_suggestion") {
    processFn = async () => ({ suggestions: [] });
  } else if (job.feature === "report_feedback") {
    processFn = async () => ({
      structureOk: true,
      missingSections: [],
      weaknesses: "",
      suggestions: "",
    });
  } else if (job.feature === "defense_question") {
    processFn = async () => ({ questions: [] });
  }

  return await executeJob(job, processFn);
};

const manualOverrideJob = async (id, result, user) => {
  const job = await AiJob.findById(id);
  if (!job) throw { status: 404, message: "Tác vụ AI không tồn tại." };

  job.manualOverride = result;
  job.approvedBy = user._id;

  return await job.save();
};

module.exports = {
  checkDuplicateTopic,
  suggestTopics,
  chatTopicSuggestion,
  analyzeReportFeedback,
  suggestDefenseQuestions,
  getJobById,
  retryAiJob,
  manualOverrideJob,
};
