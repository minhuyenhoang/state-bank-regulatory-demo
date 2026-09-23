import express from "express";
import path from "path";
import { MongoClient, Db, Document as MongoDoc, ObjectId } from "mongodb";
import { BM25SearchEngine } from "./src/lib/searchEngine.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ==========================================
// MongoDB Setup
// ==========================================
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB_NAME || "regulatory";

let mongoClient: MongoClient;
let mongoDb: Db;
let mongoConnectionPromise: Promise<void> | null = null;

// Search engine cache for BM25
let searchEngineCache: BM25SearchEngine;

async function connectToMongo() {
  if (mongoDb) return;
  if (mongoConnectionPromise) return mongoConnectionPromise;

  mongoConnectionPromise = (async () => {
    if (process.env.VERCEL && !process.env.MONGODB_URL) {
      throw new Error("MONGODB_URL is required in the Vercel environment.");
    }

    mongoClient = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(DB_NAME);
    console.log(`Successfully connected to MongoDB database: ${DB_NAME}`);

    // Initial load into BM25 cache
    await refreshSearchEngine();
  })();

  try {
    await mongoConnectionPromise;
  } catch (err) {
    mongoConnectionPromise = null;
    console.error("Failed to connect to MongoDB:", err);
    throw err;
  }
}

function parseObjectId(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  if (typeof value !== "string" || !ObjectId.isValid(value)) return null;
  return new ObjectId(value);
}

function serializeMongoValue(value: any): any {
  if (value instanceof ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map(serializeMongoValue);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeMongoValue(item),
      ]),
    );
  }
  return value;
}

// MongoDB owns record identity through `_id`. The API keeps a string `id`
// alias so browser code never needs to understand BSON ObjectId instances.
function toApiRecord(document: MongoDoc) {
  const { _id, id: _legacyId, ...data } = document;
  return {
    ...serializeMongoValue(data),
    id: _id instanceof ObjectId ? _id.toHexString() : String(_id),
  };
}

function withoutClientIds(document: MongoDoc) {
  const { _id, id, ...data } = document;
  return data;
}

function toMongoFolderId(value: unknown): ObjectId | null {
  if (value === null || value === undefined || value === "") return null;
  const objectId = parseObjectId(value);
  if (!objectId) throw new Error("ID thư mục không hợp lệ.");
  return objectId;
}

// Helper to update search engine cache from MongoDB
async function refreshSearchEngine() {
  const documentsCollection = mongoDb.collection("documents");
  const docs = await documentsCollection.find({}).toArray();
  const cleanDocs = docs.map((doc) => toApiRecord(doc) as any);
  searchEngineCache = new BM25SearchEngine(cleanDocs);
}

// Helper collections accessors
const getDocsCol = () => mongoDb.collection("documents");
const getFoldersCol = () => mongoDb.collection("folders");
const getInspectorsCol = () => mongoDb.collection("inspectors");
const getProposalsCol = () => mongoDb.collection("proposals");
const getChangeRequestsCol = () => mongoDb.collection("change-requests");

// ==========================================
// Groq Setup
// ==========================================
async function callGroqAPI(
  messages: any[],
  jsonMode: boolean = false,
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === "MY_GROQ_API_KEY" || key.trim() === "") {
    throw new Error("GROQ_API_KEY environment variable is required.");
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages,
        temperature: 0.1,
        response_format: jsonMode ? { type: "json_object" } : undefined,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Groq API returned status ${response.status}: ${errorText}`,
    );
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ==========================================
// API Routes
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Vercel reuses a function instance between requests when possible. Connect
// lazily so importing the handler never starts a process or blocks deployment.
app.use("/api", async (_req, res, next) => {
  try {
    await connectToMongo();
    next();
  } catch (err: any) {
    res.status(503).json({
      error: "Database connection failed: " + (err?.message || "Unknown error"),
    });
  }
});

// 1. Get all documents and folders
app.get("/api/documents", async (req, res) => {
  try {
    const documents = await getDocsCol().find().toArray();
    const folders = await getFoldersCol().find().toArray();

    res.json({
      documents: documents.map(toApiRecord),
      folders: folders.map(toApiRecord),
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch documents and folders: " + err.message });
  }
});

// 2. Advanced Search Endpoint (using BM25SearchEngine)
app.get("/api/documents/search", async (req, res) => {
  try {
    const query = (req.query.q as string) || "";
    const category = req.query.category as string;
    const folderId = req.query.folderId as string;
    const tag = req.query.tag as string;
    const agency = req.query.agency as string;
    const specialization = req.query.specialization as string;
    const year = req.query.year ? parseInt(req.query.year as string) : null;
    const status = req.query.status as string;

    // Perform BM25 search against in-memory index
    let results = searchEngineCache.search(query);

    // Apply metadata filters
    if (category) {
      results = results.filter((r) => r.document.category === category);
    }
    if (folderId) {
      const selectedFolderId = parseObjectId(folderId);
      if (!selectedFolderId) {
        res.status(400).json({ error: "ID thư mục không hợp lệ." });
        return;
      }

      const allFolders = await getFoldersCol().find().toArray();
      const getChildFolderIds = (currentId: string): string[] => {
        const childIds = allFolders
          .filter(
            (folder) =>
              folder.parentId instanceof ObjectId &&
              folder.parentId.toHexString() === currentId,
          )
          .map((folder) => folder._id.toHexString());

        return [
          currentId,
          ...childIds.flatMap((childId) => getChildFolderIds(childId)),
        ];
      };

      const allowedFolders = new Set(
        getChildFolderIds(selectedFolderId.toHexString()),
      );
      results = results.filter(
        (result) =>
          !!result.document.folderId &&
          allowedFolders.has(result.document.folderId.toString()),
      );
    }
    if (tag) {
      results = results.filter(
        (r) => r.document.tags && r.document.tags.includes(tag),
      );
    }
    if (agency) {
      results = results.filter(
        (r) =>
          r.document.agency &&
          r.document.agency.toLowerCase() === agency.toLowerCase(),
      );
    }
    if (specialization) {
      results = results.filter(
        (r) => r.document.specialization === specialization,
      );
    }
    if (year) {
      results = results.filter((r) => {
        const docYear = new Date(r.document.issueDate).getFullYear();
        return docYear === year || r.document.inspectionYear === year;
      });
    }
    if (status) {
      results = results.filter((r) => r.document.status === status);
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: "Search failed: " + err.message });
  }
});

// 3. Summarize raw text or document content with Groq
app.post("/api/documents/summarize", async (req, res) => {
  const { title, docNumber, fullText, category } = req.body;

  if (!fullText) {
    res.status(400).json({ error: "Nội dung văn bản trống." });
    return;
  }

  try {
    const systemPrompt = `Hãy đóng vai trò là Chuyên gia phân tích Pháp lý và Giám sát tuân thủ hàng đầu của Ngân hàng Nhà nước Việt Nam (NHNN).
Bạn được giao nhiệm vụ tóm tắt văn bản pháp lý / tài liệu thanh tra sau đây.
Hãy thực hiện phân tích chuyên sâu và tóm tắt theo cấu trúc JSON quy định. Tất cả nội dung trả về phải bằng TIẾNG VIỆT, chuyên nghiệp, chính xác và có giá trị thực tiễn cao cho State Bankers (cán bộ ngân hàng nhà nước và thanh tra viên ngân hàng).

Bạn PHẢI trả về một đối tượng JSON có đúng cấu trúc sau:
{
  "implications": "Tác động, ảnh hưởng, và hệ quả pháp lý của văn bản đối với hoạt động ngân hàng (bằng tiếng Việt, tối thiểu 2-3 câu chi tiết).",
  "complianceRequirements": "Các yêu cầu tuân thủ cụ thể, hành động bắt buộc, quy trình nghiệp vụ cần điều chỉnh đối với các ngân hàng thương mại (bằng tiếng Việt, tối thiểu 2-3 câu chi tiết).",
  "keyTakeaways": ["Tóm tắt 3-4 điểm cốt lõi nhất của văn bản dưới dạng các gạch đầu dòng ngắn gọn (bằng tiếng Việt)."]
}`;

    const userPrompt = `Văn bản cần phân tích:
- Tiêu đề: ${title || "Không rõ"}
- Số văn bản: ${docNumber || "Không rõ"}
- Loại văn bản: ${category || "Không rõ"}
- Nội dung đầy đủ:
${fullText.slice(0, 5000)}`;

    const responseText = await callGroqAPI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      true,
    );

    const parsedSummary = JSON.parse(responseText || "{}");
    res.json(parsedSummary);
  } catch (error: any) {
    console.error("Groq/LLM API Error:", error);
    res.status(500).json({
      error: "Không thể tự động tóm tắt văn bản bằng AI.",
      details: error.message || String(error),
      fallback: {
        implications:
          "Chưa thể phân tích tác động do cấu hình khóa API chưa khả dụng hoặc gặp sự cố mạng.",
        complianceRequirements:
          "Yêu cầu kiểm tra rà soát thủ công nội dung văn bản để thực hiện công tác giám sát tuân thủ.",
        keyTakeaways: ["Xem chi tiết nội dung đầy đủ ở mục văn bản gốc."],
      },
    });
  }
});

// 3.5. Suggest folder location for an uploaded/created document (BM25 Auto-categorizer)
app.post("/api/documents/suggest-folder", async (req, res) => {
  try {
    const { title, fullText } = req.body;
    const folderDocs = await getFoldersCol().find().toArray();
    const folders = folderDocs.map(toApiRecord);

    if (!title && !fullText) {
      res.json({ folderId: folders[0]?.id || "" });
      return;
    }

    const queryStr = `${title} ${fullText ? fullText.slice(0, 500) : ""}`;
    const searchResults = searchEngineCache.search(queryStr);

    const folderScores: { [folderId: string]: number } = {};

    searchResults.slice(0, 5).forEach((result, idx) => {
      const doc = result.document;
      const rankWeight = (5 - idx) * 3;
      folderScores[doc.folderId] =
        (folderScores[doc.folderId] || 0) + rankWeight + result.score;
    });

    const titleLower = (title || "").toLowerCase();
    const contentLower = (fullText || "").toLowerCase();

    folders.forEach((folder) => {
      const folderNameLower = folder.name.toLowerCase();

      if (titleLower.includes(folderNameLower)) {
        folderScores[folder.id] = (folderScores[folder.id] || 0) + 60;
      }

      const tokens = folderNameLower
        .split(/\s+/)
        .filter((t: any) => t.length > 2);
      let matchCount = 0;
      tokens.forEach((tok: any) => {
        if (titleLower.includes(tok)) matchCount += 4;
        if (contentLower.includes(tok)) matchCount += 1;
      });
      if (matchCount > 0) {
        folderScores[folder.id] = (folderScores[folder.id] || 0) + matchCount;
      }
    });

    let bestFolderId = folders[0]?.id || "";
    let highestScore = -1;
    Object.keys(folderScores).forEach((fId) => {
      if (folderScores[fId] > highestScore) {
        highestScore = folderScores[fId];
        bestFolderId = fId;
      }
    });

    const bestFolder = folders.find((f) => f.id === bestFolderId);
    res.json({
      folderId: bestFolderId,
      folderName: bestFolder ? bestFolder.name : "",
      score: highestScore,
      reason: bestFolder
        ? `Tự động phân loại vào thư mục "${bestFolder.name}" dựa trên từ khóa khớp và phân tích BM25.`
        : "Thư mục mặc định",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Folder suggestion failed: " + err.message });
  }
});

// 3.6. AI Legal Chat Assistant
app.post("/api/ai/chat", async (req, res) => {
  const { question, history } = req.body;

  if (!question) {
    res.status(400).json({ error: "Câu hỏi trống." });
    return;
  }

  try {
    const searchResults = searchEngineCache.search(question);
    const topMatches = searchResults.slice(0, 4);

    const context = topMatches
      .map((r, i) => {
        return `[Tài liệu ${i + 1}]
- Tiêu đề: ${r.document.title}
- Số hiệu: ${r.document.docNumber || "Không rõ"}
- Phân loại: ${r.document.category}
- Cơ quan ban hành: ${r.document.agency || "Không rõ"}
- Tóm tắt AI: ${r.document.aiSummary ? r.document.aiSummary.keyTakeaways.join("; ") : "Chưa có"}
- Nội dung gốc trích lục: ${r.document.fullText.slice(0, 1200)}`;
      })
      .join("\n\n");

    const systemPrompt = `Bạn là "Trợ lý AI Pháp lý" chuyên sâu (RAG Compliance Assistant) của Ngân hàng Nhà nước Việt Nam.
Nhiệm vụ của bạn là giải đáp thắc mắc của cán bộ ngân hàng, thanh tra viên hoặc các nhân viên tuân thủ một cách chuyên nghiệp, chính xác, súc tích dựa trên cơ sở dữ liệu văn bản pháp quy được cung cấp dưới đây.

Dưới đây là các tài liệu pháp quy liên quan nhất trích xuất tự động từ cơ sở dữ liệu:
${context || "Không tìm thấy tài liệu nào khớp trực tiếp trong cơ sở dữ liệu để đối chiếu."}

HƯỚNG DẪN TRẢ LỜI QUAN TRỌNG:
1. Hãy trả lời hoàn toàn bằng tiếng Việt, rành mạch, súc tích, trực diện vào thắc mắc. Sử dụng các gạch đầu dòng để làm rõ điều khoản.
2. Bạn PHẢI trích dẫn rõ tên văn bản, số hiệu (ví dụ: Thông tư 27/2025/TT-NHNN) và các nội dung, điều khoản tương ứng từ ngữ cảnh để tăng độ tin cậy tối đa. Không tự bịa ra thông tin không có trong tài liệu.
3. Nếu ngữ cảnh được cung cấp không đủ thông tin để trả lời câu hỏi một cách chắc chắn, hãy nói rõ là "Cơ sở dữ liệu tích hợp hiện chưa chứa thông tin chi tiết đầy đủ cho câu hỏi này, tuy nhiên dựa trên các quy định chung của NHNN..." và hướng dẫn cán bộ cách rà soát.
4. Giữ phong thái lịch thiệp, nghiêm túc và chuyên nghiệp của Ngân hàng Trung ương Việt Nam.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((h: any) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: h.content,
      })),
      { role: "user", content: question },
    ];

    const answer = await callGroqAPI(messages, false);

    res.json({
      answer,
      citations: topMatches.map((r) => r.document),
    });
  } catch (err: any) {
    console.error("Legal Chat API Error:", err);
    res.status(500).json({
      error: "Không thể xử lý câu hỏi của bạn bằng AI.",
      details: err.message || String(err),
      answer:
        "Xin lỗi, tôi gặp sự cố kết nối với hệ thống xử lý Groq LLM. Vui lòng thử lại sau.",
    });
  }
});

// 4. Create document
app.post("/api/documents", async (req, res) => {
  const { doc, autoSummarize } = req.body;

  if (!doc.title || !doc.fullText) {
    res.status(400).json({ error: "Tiêu đề và nội dung văn bản là bắt buộc." });
    return;
  }

  let folderObjectId: ObjectId | null;
  try {
    folderObjectId = toMongoFolderId(doc.folderId);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  const newDoc: MongoDoc = {
    ...withoutClientIds(doc),
    folderId: folderObjectId,
    createdAt: new Date().toISOString(),
    tags: doc.tags || [],
  };

  if (autoSummarize) {
    try {
      const systemPrompt = `Hãy đóng vai trò là Chuyên gia phân tích Pháp lý và Giám sát tuân thủ hàng đầu của Ngân hàng Nhà nước Việt Nam (NHNN).
Hãy tóm tắt văn bản pháp lý / báo cáo thanh tra này và trả về cấu trúc JSON đúng chuẩn bằng tiếng Việt:
{
  "implications": "Tác động pháp lý đối với hoạt động ngân hàng...",
  "complianceRequirements": "Yêu cầu tuân thủ đối với ngân hàng...",
  "keyTakeaways": ["Tóm tắt cốt lõi 1", "Tóm tắt cốt lõi 2"]
}`;

      const userPrompt = `- Tiêu đề: ${doc.title}
- Nội dung đầy đủ:
${doc.fullText.slice(0, 5000)}`;

      const responseText = await callGroqAPI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        true,
      );

      newDoc.aiSummary = JSON.parse(responseText || "{}");
    } catch (err: any) {
      console.warn(
        "Auto summarization failed on create. Saving default/fallback. Error:",
        err.message,
      );
      newDoc.aiSummary = {
        implications:
          "Đã lưu văn bản gốc. Chưa thể tạo tóm tắt thông minh do khóa API chưa được cấu hình đầy đủ.",
        complianceRequirements:
          "Vui lòng thực hiện đọc rà soát văn bản gốc thủ công.",
        keyTakeaways: ["Xem nội dung văn bản gốc để biết thêm chi tiết."],
      };
    }
  } else if (!newDoc.aiSummary) {
    newDoc.aiSummary = {
      implications:
        'Chưa có tóm tắt AI. Bạn có thể bấm nút "Tóm tắt AI" ở trang chi tiết văn bản để tạo tự động.',
      complianceRequirements:
        "Yêu cầu đọc văn bản pháp lý gốc để giám sát tuân thủ.",
      keyTakeaways: ["Tài liệu chưa được phân tích bằng AI."],
    };
  }

  try {
    const result = await getDocsCol().insertOne(newDoc);
    await refreshSearchEngine();

    res.status(201).json(toApiRecord({ ...newDoc, _id: result.insertedId }));
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to create document: " + err.message });
  }
});

// 5. Update document
app.put("/api/documents/:id", async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body.doc ?? req.body;
  const objectId = parseObjectId(id);

  if (!objectId) {
    res.status(400).json({ error: "ID văn bản không hợp lệ." });
    return;
  }

  try {
    const existingDoc = await getDocsCol().findOne({ _id: objectId });
    if (!existingDoc) {
      res.status(404).json({ error: "Không tìm thấy văn bản." });
      return;
    }

    const docToUpdate = withoutClientIds(updatedData);
    if ("folderId" in docToUpdate) {
      docToUpdate.folderId = toMongoFolderId(docToUpdate.folderId);
    }

    await getDocsCol().updateOne(
      { _id: objectId },
      { $set: docToUpdate, $unset: { id: "" } },
    );
    await refreshSearchEngine();

    const resultDoc = await getDocsCol().findOne({ _id: objectId });
    res.json(resultDoc ? toApiRecord(resultDoc) : null);
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to update document: " + err.message });
  }
});

// 6. Delete document
app.delete("/api/documents/:id", async (req, res) => {
  const { id } = req.params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    res.status(400).json({ error: "ID văn bản không hợp lệ." });
    return;
  }

  try {
    const result = await getDocsCol().deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Không tìm thấy văn bản." });
      return;
    }

    await refreshSearchEngine();
    res.json({ success: true, message: "Đã xóa văn bản thành công." });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to delete document: " + err.message });
  }
});

// 7. Folders API
app.post("/api/folders", async (req, res) => {
  const { name, parentId, path } = req.body;
  if (!name) {
    res.status(400).json({ error: "Tên thư mục trống." });
    return;
  }

  try {
    const parentObjectId = toMongoFolderId(parentId);
    const pathObjectIds = Array.isArray(path)
      ? path.map((item) => {
          const objectId = parseObjectId(item);
          if (!objectId) throw new Error("Đường dẫn thư mục không hợp lệ.");
          return objectId;
        })
      : null;
    const newFolder = {
      name,
      parentId: parentObjectId,
      path: pathObjectIds,
    };

    const result = await getFoldersCol().insertOne(newFolder);
    res.status(201).json(toApiRecord({ ...newFolder, _id: result.insertedId }));
  } catch (err: any) {
    const status = err.message.includes("không hợp lệ") ? 400 : 500;
    res
      .status(status)
      .json({ error: "Failed to create folder: " + err.message });
  }
});

app.delete("/api/folders/:id", async (req, res) => {
  const { id } = req.params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    res.status(400).json({ error: "ID thư mục không hợp lệ." });
    return;
  }

  try {
    const folderExists = await getFoldersCol().findOne({ _id: objectId });
    if (!folderExists) {
      res.status(404).json({ error: "Không tìm thấy thư mục." });
      return;
    }

    const hasChildFolders = await getFoldersCol().findOne({
      parentId: objectId,
    });
    const hasDocs = await getDocsCol().findOne({ folderId: objectId });

    if (hasChildFolders || hasDocs) {
      res.status(400).json({
        error:
          "Thư mục này đang chứa các thư mục con hoặc văn bản bên trong. Vui lòng di chuyển hoặc xóa chúng trước.",
      });
      return;
    }

    await getFoldersCol().deleteOne({ _id: objectId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete folder: " + err.message });
  }
});

// 8. Inspectors API
app.get("/api/inspectors", async (req, res) => {
  try {
    const inspectors = await getInspectorsCol().find().toArray();
    res.json(inspectors.map(toApiRecord));
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch inspectors: " + err.message });
  }
});

app.post("/api/inspectors", async (req, res) => {
  const inspector = req.body;
  if (!inspector.name || !inspector.role) {
    res
      .status(400)
      .json({ error: "Tên và chức vụ cán bộ thanh tra là bắt buộc." });
    return;
  }

  const inspectorData = withoutClientIds(inspector);

  try {
    const result = await getInspectorsCol().insertOne(inspectorData);
    res
      .status(201)
      .json(toApiRecord({ ...inspectorData, _id: result.insertedId }));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save inspector: " + err.message });
  }
});

app.put("/api/inspectors/:id", async (req, res) => {
  const objectId = parseObjectId(req.params.id);
  const inspectorData = withoutClientIds(req.body);

  if (!objectId) {
    res.status(400).json({ error: "ID cán bộ thanh tra không hợp lệ." });
    return;
  }
  if (!inspectorData.name || !inspectorData.role) {
    res
      .status(400)
      .json({ error: "Tên và chức vụ cán bộ thanh tra là bắt buộc." });
    return;
  }

  try {
    const result = await getInspectorsCol().updateOne(
      { _id: objectId },
      { $set: inspectorData, $unset: { id: "" } },
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ error: "Không tìm thấy cán bộ thanh tra." });
      return;
    }
    res.json(toApiRecord({ ...inspectorData, _id: objectId }));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save inspector: " + err.message });
  }
});

app.delete("/api/inspectors/:id", async (req, res) => {
  const { id } = req.params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    res.status(400).json({ error: "ID cán bộ thanh tra không hợp lệ." });
    return;
  }

  try {
    const result = await getInspectorsCol().deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Không tìm thấy cán bộ thanh tra." });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to delete inspector: " + err.message });
  }
});

// 9. Proposals API
app.get("/api/proposals", async (req, res) => {
  try {
    const proposals = await getProposalsCol().find().toArray();
    res.json(proposals.map(toApiRecord));
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch proposals: " + err.message });
  }
});

app.post("/api/proposals", async (req, res) => {
  const proposal = req.body;
  if (!proposal.title || !proposal.fullText) {
    res.status(400).json({ error: "Tiêu đề và nội dung là bắt buộc." });
    return;
  }

  const newProposal = {
    ...withoutClientIds(proposal),
    createdAt: new Date().toISOString(),
    status: "Chờ duyệt",
  };

  try {
    const result = await getProposalsCol().insertOne(newProposal);
    res
      .status(201)
      .json(toApiRecord({ ...newProposal, _id: result.insertedId }));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save proposal: " + err.message });
  }
});

// Approve Proposal and convert to permanent Document
app.post("/api/proposals/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { folderId, tags } = req.body;
  const proposalObjectId = parseObjectId(id);
  const folderObjectId = parseObjectId(folderId);

  if (!proposalObjectId) {
    res.status(400).json({ error: "ID đề xuất không hợp lệ." });
    return;
  }
  if (folderId && !folderObjectId) {
    res.status(400).json({ error: "ID thư mục không hợp lệ." });
    return;
  }

  try {
    const proposal = await getProposalsCol().findOne({
      _id: proposalObjectId,
    });
    if (!proposal) {
      res.status(404).json({ error: "Không tìm thấy đề xuất." });
      return;
    }

    await getProposalsCol().updateOne(
      { _id: proposalObjectId },
      { $set: { status: "Đã duyệt" }, $unset: { id: "" } },
    );

    const defaultFolder = folderObjectId
      ? null
      : await getFoldersCol().findOne({}, { projection: { _id: 1 } });

    const newDoc: any = {
      category: proposal.category,
      title: proposal.title,
      docNumber: proposal.docNumber,
      issueDate: proposal.issueDate,
      agency: proposal.agency,
      fullText: proposal.fullText,
      folderId: folderObjectId || defaultFolder?._id || null,
      tags: tags || ["Đề xuất duyệt"],
      createdAt: new Date().toISOString(),
      sourceLink: "",
      aiSummary: {
        implications:
          "Đang chờ cập nhật tóm tắt chuyên sâu từ hệ thống chính thức.",
        complianceRequirements: "Đang chờ phân tích tự động.",
        keyTakeaways: [
          "Tài liệu được duyệt đăng tải từ đề xuất của cán bộ: " +
            proposal.proposedBy,
        ],
      },
    };

    try {
      const responseText = await callGroqAPI(
        [
          {
            role: "system",
            content:
              "Bạn là chuyên gia tuân thủ NHNN. Hãy trả về JSON gồm implications (string), complianceRequirements (string), và keyTakeaways (string[]).",
          },
          {
            role: "user",
            content: `Tóm tắt tài liệu đề xuất sau:\nTiêu đề: ${newDoc.title}\nNội dung: ${newDoc.fullText.slice(0, 5000)}`,
          },
        ],
        true,
      );
      newDoc.aiSummary = JSON.parse(responseText || "{}");
    } catch (err) {
      console.warn("Could not auto-summarize on proposal approval:", err);
    }

    const insertResult = await getDocsCol().insertOne(newDoc);
    await refreshSearchEngine();

    res.json({
      success: true,
      document: toApiRecord({ ...newDoc, _id: insertResult.insertedId }),
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to approve proposal: " + err.message });
  }
});

// Reject Proposal
app.post("/api/proposals/:id/reject", async (req, res) => {
  const { id } = req.params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    res.status(400).json({ error: "ID đề xuất không hợp lệ." });
    return;
  }

  try {
    const result = await getProposalsCol().updateOne(
      { _id: objectId },
      { $set: { status: "Từ chối" }, $unset: { id: "" } },
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ error: "Không tìm thấy đề xuất." });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to reject proposal: " + err.message });
  }
});

// 9.5. Auth & Change Requests API

app.post("/api/auth/login", (req, res) => {
  const { role, password, name } = req.body;

  if (role === "admin") {
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    if (password === adminPass) {
      res.json({
        success: true,
        user: { role: "admin", name: name || "Quản trị viên (Admin)" },
      });
    } else {
      res.status(401).json({ error: "Mật khẩu Admin không chính xác." });
    }
  } else if (role === "guest") {
    const guestName = name && name.trim() ? name.trim() : "Cán bộ Khách";
    res.json({
      success: true,
      user: { role: "guest", name: guestName },
    });
  } else {
    res.status(400).json({ error: "Loại tài khoản không hợp lệ." });
  }
});

// Get Change Requests
app.get("/api/change-requests", async (req, res) => {
  try {
    const changeRequests = await getChangeRequestsCol()
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json(changeRequests.map(toApiRecord));
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch change requests: " + err.message });
  }
});

// Submit a Change Request
app.post("/api/change-requests", async (req, res) => {
  const { requestType, targetId, targetName, payload, requestedBy } = req.body;

  if (!requestType || !requestedBy) {
    res
      .status(400)
      .json({ error: "Thiếu thông tin loại yêu cầu hoặc người gửi." });
    return;
  }

  const targetObjectId = targetId ? parseObjectId(targetId) : null;
  if (targetId && !targetObjectId) {
    res.status(400).json({ error: "ID đối tượng yêu cầu không hợp lệ." });
    return;
  }

  const newRequest = {
    requestType,
    targetId: targetObjectId,
    targetName: targetName || "Văn bản / Thư mục",
    payload:
      payload && typeof payload === "object"
        ? withoutClientIds(payload)
        : payload || null,
    requestedBy,
    createdAt: new Date().toISOString(),
    status: "PENDING",
  };

  try {
    const result = await getChangeRequestsCol().insertOne(newRequest);
    res
      .status(201)
      .json(toApiRecord({ ...newRequest, _id: result.insertedId }));
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to submit change request: " + err.message });
  }
});

// Approve Change Request
app.post("/api/change-requests/:id/approve", async (req, res) => {
  const { id } = req.params;
  const requestObjectId = parseObjectId(id);
  if (!requestObjectId) {
    res.status(400).json({ error: "ID yêu cầu không hợp lệ." });
    return;
  }

  try {
    const changeReq = await getChangeRequestsCol().findOne({
      _id: requestObjectId,
    });
    if (!changeReq) {
      res.status(404).json({ error: "Không tìm thấy yêu cầu." });
      return;
    }

    if (changeReq.status !== "PENDING") {
      res.status(400).json({ error: "Yêu cầu này đã được xử lý trước đó." });
      return;
    }

    if (changeReq.requestType === "CREATE_DOCUMENT") {
      const docData = changeReq.payload || {};
      const newDoc = {
        ...withoutClientIds(docData),
        folderId: toMongoFolderId(docData.folderId),
        createdAt: new Date().toISOString(),
        tags: docData.tags || [],
        aiSummary: docData.aiSummary || {
          implications:
            "Chưa có tóm tắt AI. Có thể tự động tạo ở trang chi tiết.",
          complianceRequirements: "Đọc văn bản gốc để tuân thủ.",
          keyTakeaways: [
            "Tài liệu được duyệt đăng từ yêu cầu của " + changeReq.requestedBy,
          ],
        },
      };
      await getDocsCol().insertOne(newDoc);
      await refreshSearchEngine();
    } else if (changeReq.requestType === "EDIT_DOCUMENT") {
      const docData = changeReq.payload || {};
      const targetId = changeReq.targetId || docData.id;
      const targetObjectId = parseObjectId(targetId);
      if (!targetObjectId) throw new Error("ID văn bản không hợp lệ.");
      const updateData = withoutClientIds(docData);
      if ("folderId" in updateData) {
        updateData.folderId = toMongoFolderId(updateData.folderId);
      }

      await getDocsCol().updateOne(
        { _id: targetObjectId },
        { $set: updateData, $unset: { id: "" } },
      );
      await refreshSearchEngine();
    } else if (changeReq.requestType === "DELETE_DOCUMENT") {
      const targetObjectId = parseObjectId(changeReq.targetId);
      if (!targetObjectId) throw new Error("ID văn bản không hợp lệ.");
      await getDocsCol().deleteOne({ _id: targetObjectId });
      await refreshSearchEngine();
    } else if (changeReq.requestType === "CREATE_FOLDER") {
      const folderData = changeReq.payload || {};
      const newFolder = {
        name: folderData.name || "Thư mục mới",
        parentId: toMongoFolderId(folderData.parentId),
        path: Array.isArray(folderData.path)
          ? folderData.path.map((item: unknown) => {
              const objectId = parseObjectId(item);
              if (!objectId) throw new Error("Đường dẫn thư mục không hợp lệ.");
              return objectId;
            })
          : null,
      };
      await getFoldersCol().insertOne(newFolder);
    } else if (changeReq.requestType === "DELETE_FOLDER") {
      const targetObjectId = parseObjectId(changeReq.targetId);
      if (!targetObjectId) throw new Error("ID thư mục không hợp lệ.");
      await getFoldersCol().deleteOne({ _id: targetObjectId });
    }

    const updatedStatus = {
      status: "APPROVED",
      processedAt: new Date().toISOString(),
    };

    await getChangeRequestsCol().updateOne(
      { _id: requestObjectId },
      { $set: updatedStatus, $unset: { id: "" } },
    );

    const updatedRequest = await getChangeRequestsCol().findOne({
      _id: requestObjectId,
    });
    res.json({
      success: true,
      message: "Đã chấp nhận và thực thi yêu cầu thành công.",
      changeRequest: updatedRequest ? toApiRecord(updatedRequest) : null,
    });
  } catch (err: any) {
    console.error("Approval execution error:", err);
    res
      .status(500)
      .json({ error: "Không thể thực thi yêu cầu: " + err.message });
  }
});

// Reject Change Request
app.post("/api/change-requests/:id/reject", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const requestObjectId = parseObjectId(id);
  if (!requestObjectId) {
    res.status(400).json({ error: "ID yêu cầu không hợp lệ." });
    return;
  }

  try {
    const changeReq = await getChangeRequestsCol().findOne({
      _id: requestObjectId,
    });
    if (!changeReq) {
      res.status(404).json({ error: "Không tìm thấy yêu cầu." });
      return;
    }

    const rejectionData = {
      status: "REJECTED",
      rejectedReason: reason || "Quản trị viên hủy bỏ yêu cầu.",
      processedAt: new Date().toISOString(),
    };

    await getChangeRequestsCol().updateOne(
      { _id: requestObjectId },
      { $set: rejectionData, $unset: { id: "" } },
    );

    const updatedRequest = await getChangeRequestsCol().findOne({
      _id: requestObjectId,
    });
    res.json({
      success: true,
      message: "Đã hủy bỏ yêu cầu thành công.",
      changeRequest: updatedRequest ? toApiRecord(updatedRequest) : null,
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to reject change request: " + err.message });
  }
});

// 10. Stats / Aggregates Endpoint
app.get("/api/stats", async (req, res) => {
  try {
    const docs = await getDocsCol()
      .find({}, { projection: { _id: 0 } })
      .toArray();
    const inspectorCount = await getInspectorsCol().countDocuments();

    const totalQPPL = docs.filter((d) => d.category === "QPPL").length;
    const activeQPPL = docs.filter(
      (d) => d.category === "QPPL" && d.status === "Còn hiệu lực",
    ).length;
    const totalQuyetDinhThanhTra = docs.filter(
      (d) => d.category === "QuyetDinhThanhTra",
    ).length;
    const totalKetLuanThanhTra = docs.filter(
      (d) => d.category === "KetLuanThanhTra",
    ).length;
    const totalChiDaoNHNN = docs.filter(
      (d) => d.category === "ChiDaoNHNN",
    ).length;

    // Group inspection conclusions by year
    const yearsMap: { [year: number]: number } = {};
    docs.forEach((d) => {
      if (d.category === "KetLuanThanhTra" && d.inspectionYear) {
        yearsMap[d.inspectionYear] = (yearsMap[d.inspectionYear] || 0) + 1;
      }
    });

    const conclusionsByYear = Object.keys(yearsMap)
      .map((yr) => ({ year: parseInt(yr), count: yearsMap[parseInt(yr)] }))
      .sort((a, b) => a.year - b.year);

    if (conclusionsByYear.length === 0) {
      conclusionsByYear.push({ year: 2024, count: 1 });
      conclusionsByYear.push({ year: 2025, count: 1 });
    }

    const categoryDistribution = [
      { name: "Văn bản QPPL", value: totalQPPL },
      { name: "Quyển định thanh tra", value: totalQuyetDinhThanhTra },
      { name: "Kết luận thanh tra", value: totalKetLuanThanhTra },
      { name: "Chỉ đạo NHNN", value: totalChiDaoNHNN },
    ];

    res.json({
      totalQPPL,
      activeQPPL,
      totalQuyetDinhThanhTra,
      totalKetLuanThanhTra,
      totalChiDaoNHNN,
      totalInspectors: inspectorCount,
      conclusionsByYear,
      categoryDistribution,
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to aggregate stats: " + err.message });
  }
});

// Vercel's Express runtime does not automatically serve files generated by
// the Vite build. These files are included in the function via vercel.json.
if (process.env.NODE_ENV !== "development") {
  const publicPath = path.join(process.cwd(), "public");

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  app.get("/assets/:file", (req, res) => {
    res.sendFile(req.params.file, { root: path.join(publicPath, "assets") });
  });

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile("index.html", { root: publicPath });
  });
}

export { connectToMongo };
export default app;
