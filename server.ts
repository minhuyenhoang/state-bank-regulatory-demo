import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeDb, saveDb } from './server-db';
import { BM25SearchEngine } from './src/lib/searchEngine';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 8080;

// Lazy initialized Gemini Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      throw new Error('GEMINI_API_KEY environment variable is required but not configured. Please configure it in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Reusable Groq API call helper with Gemini fallback
async function callGroqAPI(messages: any[], jsonMode: boolean = false): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'MY_GROQ_API_KEY' || key.trim() === '') {
    console.warn('GROQ_API_KEY is not configured or is placeholder. Attempting fallback to Gemini API...');
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
        throw new Error('Neither GROQ_API_KEY nor GEMINI_API_KEY is configured.');
      }
      const ai = getGeminiClient();
      
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const userMessage = messages.find(m => m.role === 'user')?.content || '';
      const prompt = systemMessage ? `${systemMessage}\n\n${userMessage}` : userMessage;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: jsonMode ? { responseMimeType: 'application/json' } : undefined
      });
      return response.text || '';
    } catch (fallbackErr: any) {
      throw new Error(`Groq API key not configured, and Gemini fallback failed: ${fallbackErr.message}`);
    }
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.1,
      response_format: jsonMode ? { type: 'json_object' } : undefined
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API returned status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Global server-side DB state
let db = initializeDb();

// Helper to update search engine cache
let searchEngineCache = new BM25SearchEngine(db.documents);

function refreshSearchEngine() {
  searchEngineCache = new BM25SearchEngine(db.documents);
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 1. Get all documents, folders, inspectors, proposals
app.get('/api/documents', (req, res) => {
  res.json({
    documents: db.documents,
    folders: db.folders,
  });
});

// 2. Advanced Search Endpoint (using BM25SearchEngine)
app.get('/api/documents/search', (req, res) => {
  const query = (req.query.q as string) || '';
  const category = req.query.category as string;
  const folderId = req.query.folderId as string;
  const tag = req.query.tag as string;
  const agency = req.query.agency as string;
  const specialization = req.query.specialization as string;
  const year = req.query.year ? parseInt(req.query.year as string) : null;
  const status = req.query.status as string;

  // Perform BM25 search
  let results = searchEngineCache.search(query);

  // Apply metadata filters
  if (category) {
    results = results.filter(r => r.document.category === category);
  }
  if (folderId) {
    // If folderId is provided, filter either that folder or child folders
    const getChildFolderIds = (fid: string): string[] => {
      const childs = db.folders.filter(f => f.parentId === fid).map(f => f.id);
      return [fid, ...childs.flatMap(getChildFolderIds)];
    };
    const allowedFolders = getChildFolderIds(folderId);
    results = results.filter(r => allowedFolders.includes(r.document.folderId));
  }
  if (tag) {
    results = results.filter(r => r.document.tags.includes(tag));
  }
  if (agency) {
    results = results.filter(r => r.document.agency.toLowerCase() === agency.toLowerCase());
  }
  if (specialization) {
    results = results.filter(r => r.document.specialization === specialization);
  }
  if (year) {
    results = results.filter(r => {
      const docYear = new Date(r.document.issueDate).getFullYear();
      return docYear === year || r.document.inspectionYear === year;
    });
  }
  if (status) {
    results = results.filter(r => r.document.status === status);
  }

  res.json(results);
});

// 3. Summarize raw text or document content with Groq
app.post('/api/documents/summarize', async (req, res) => {
  const { title, docNumber, fullText, category } = req.body;

  if (!fullText) {
    res.status(400).json({ error: 'Nội dung văn bản trống.' });
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
- Tiêu đề: ${title || 'Không rõ'}
- Số văn bản: ${docNumber || 'Không rõ'}
- Loại văn bản: ${category || 'Không rõ'}
- Nội dung đầy đủ:
${fullText.slice(0, 5000)}`;

    const responseText = await callGroqAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], true);

    const parsedSummary = JSON.parse(responseText || '{}');
    res.json(parsedSummary);
  } catch (error: any) {
    console.error('Groq/LLM API Error:', error);
    res.status(500).json({
      error: 'Không thể tự động tóm tắt văn bản bằng AI.',
      details: error.message || String(error),
      fallback: {
        implications: 'Chưa thể phân tích tác động do cấu hình khóa API chưa khả dụng hoặc gặp sự cố mạng.',
        complianceRequirements: 'Yêu cầu kiểm tra rà soát thủ công nội dung văn bản để thực hiện công tác giám sát tuân thủ.',
        keyTakeaways: ['Xem chi tiết nội dung đầy đủ ở mục văn bản gốc.']
      }
    });
  }
});

// 3.5. Suggest folder location for an uploaded/created document (BM25 Auto-categorizer)
app.post('/api/documents/suggest-folder', (req, res) => {
  const { title, fullText } = req.body;
  if (!title && !fullText) {
    res.json({ folderId: db.folders[0]?.id || '' });
    return;
  }

  // Query search engine using the title and snippet to find similar documents
  const queryStr = `${title} ${fullText ? fullText.slice(0, 500) : ''}`;
  const searchResults = searchEngineCache.search(queryStr);

  const folderScores: { [folderId: string]: number } = {};

  // 1. Score based on folder of matching documents
  searchResults.slice(0, 5).forEach((result, idx) => {
    const doc = result.document;
    const rankWeight = (5 - idx) * 3; // top 1 gets 15, top 2 gets 12...
    folderScores[doc.folderId] = (folderScores[doc.folderId] || 0) + rankWeight + result.score;
  });

  // 2. Score based on folder name direct match in title or content
  const titleLower = (title || '').toLowerCase();
  const contentLower = (fullText || '').toLowerCase();

  db.folders.forEach(folder => {
    const folderNameLower = folder.name.toLowerCase();
    
    // Massive boost for exact match in title
    if (titleLower.includes(folderNameLower)) {
      folderScores[folder.id] = (folderScores[folder.id] || 0) + 60;
    }

    // Boost for partial tokens match
    const tokens = folderNameLower.split(/\s+/).filter(t => t.length > 2);
    let matchCount = 0;
    tokens.forEach(tok => {
      if (titleLower.includes(tok)) matchCount += 4;
      if (contentLower.includes(tok)) matchCount += 1;
    });
    if (matchCount > 0) {
      folderScores[folder.id] = (folderScores[folder.id] || 0) + matchCount;
    }
  });

  // Find folder with highest score
  let bestFolderId = db.folders[0]?.id || '';
  let highestScore = -1;
  Object.keys(folderScores).forEach(fId => {
    if (folderScores[fId] > highestScore) {
      highestScore = folderScores[fId];
      bestFolderId = fId;
    }
  });

  const bestFolder = db.folders.find(f => f.id === bestFolderId);
  res.json({
    folderId: bestFolderId,
    folderName: bestFolder ? bestFolder.name : '',
    score: highestScore,
    reason: bestFolder 
      ? `Tự động phân loại vào thư mục "${bestFolder.name}" dựa trên từ khóa khớp và phân tích BM25.`
      : 'Thư mục mặc định'
  });
});

// 3.6. AI Legal Chat Assistant (RAG Roster with BM25 Search Grounding)
app.post('/api/ai/chat', async (req, res) => {
  const { question, history } = req.body;

  if (!question) {
    res.status(400).json({ error: 'Câu hỏi trống.' });
    return;
  }

  try {
    // Search database to find relevant documents as grounding context
    const searchResults = searchEngineCache.search(question);
    const topMatches = searchResults.slice(0, 4);

    const context = topMatches.map((r, i) => {
      return `[Tài liệu ${i + 1}]
- Tiêu đề: ${r.document.title}
- Số hiệu: ${r.document.docNumber || 'Không rõ'}
- Phân loại: ${r.document.category}
- Cơ quan ban hành: ${r.document.agency || 'Không rõ'}
- Tóm tắt AI: ${r.document.aiSummary ? r.document.aiSummary.keyTakeaways.join('; ') : 'Chưa có'}
- Nội dung gốc trích lục: ${r.document.fullText.slice(0, 1200)}`;
    }).join('\n\n');

    const systemPrompt = `Bạn là "Trợ lý AI Pháp lý" chuyên sâu (RAG Compliance Assistant) của Ngân hàng Nhà nước Việt Nam.
Nhiệm vụ của bạn là giải đáp thắc mắc của cán bộ ngân hàng, thanh tra viên hoặc các nhân viên tuân thủ một cách chuyên nghiệp, chính xác, súc tích dựa trên cơ sở dữ liệu văn bản pháp quy được cung cấp dưới đây.

Dưới đây là các tài liệu pháp quy liên quan nhất trích xuất tự động từ cơ sở dữ liệu:
${context || 'Không tìm thấy tài liệu nào khớp trực tiếp trong cơ sở dữ liệu để đối chiếu.'}

HƯỚNG DẪN TRẢ LỜI QUAN TRỌNG:
1. Hãy trả lời hoàn toàn bằng tiếng Việt, rành mạch, súc tích, trực diện vào thắc mắc. Sử dụng các gạch đầu dòng để làm rõ điều khoản.
2. Bạn PHẢI trích dẫn rõ tên văn bản, số hiệu (ví dụ: Thông tư 27/2025/TT-NHNN) và các nội dung, điều khoản tương ứng từ ngữ cảnh để tăng độ tin cậy tối đa. Không tự bịa ra thông tin không có trong tài liệu.
3. Nếu ngữ cảnh được cung cấp không đủ thông tin để trả lời câu hỏi một cách chắc chắn, hãy nói rõ là "Cơ sở dữ liệu tích hợp hiện chưa chứa thông tin chi tiết đầy đủ cho câu hỏi này, tuy nhiên dựa trên các quy định chung của NHNN..." và hướng dẫn cán bộ cách rà soát.
4. Giữ phong thái lịch thiệp, nghiêm túc và chuyên nghiệp của Ngân hàng Trung ương Việt Nam.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      })),
      { role: 'user', content: question }
    ];

    const answer = await callGroqAPI(messages, false);

    res.json({
      answer,
      citations: topMatches.map(r => r.document)
    });
  } catch (err: any) {
    console.error('Legal Chat API Error:', err);
    res.status(500).json({
      error: 'Không thể xử lý câu hỏi của bạn bằng AI.',
      details: err.message || String(err),
      answer: 'Xin lỗi, tôi gặp sự cố kết nối với hệ thống xử lý Groq LLM. Vui lòng thử lại sau.'
    });
  }
});

// 4. Create document (with optional auto-summarization via Groq)
app.post('/api/documents', async (req, res) => {
  const { doc, autoSummarize } = req.body;

  if (!doc.title || !doc.fullText) {
    res.status(400).json({ error: 'Tiêu đề và nội dung văn bản là bắt buộc.' });
    return;
  }

  const newDoc = {
    ...doc,
    id: 'doc_' + Date.now(),
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

      const responseText = await callGroqAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], true);

      newDoc.aiSummary = JSON.parse(responseText || '{}');
    } catch (err: any) {
      console.warn('Auto summarization failed on create. Saving default/fallback. Error:', err.message);
      newDoc.aiSummary = {
        implications: 'Đã lưu văn bản gốc. Chưa thể tạo tóm tắt thông minh do khóa API chưa được cấu hình đầy đủ.',
        complianceRequirements: 'Vui lòng thực hiện đọc rà soát văn bản gốc thủ công.',
        keyTakeaways: ['Xem nội dung văn bản gốc để biết thêm chi tiết.']
      };
    }
  } else if (!newDoc.aiSummary) {
    newDoc.aiSummary = {
      implications: 'Chưa có tóm tắt AI. Bạn có thể bấm nút "Tóm tắt AI" ở trang chi tiết văn bản để tạo tự động.',
      complianceRequirements: 'Yêu cầu đọc văn bản pháp lý gốc để giám sát tuân thủ.',
      keyTakeaways: ['Tài liệu chưa được phân tích bằng AI.']
    };
  }

  db.documents.push(newDoc);
  saveDb(db);
  refreshSearchEngine();

  res.status(201).json(newDoc);
});


// 5. Update document
app.put('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  const index = db.documents.findIndex(d => d.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy văn bản.' });
    return;
  }

  db.documents[index] = {
    ...db.documents[index],
    ...updatedData,
    id, // Preserve ID
  };

  saveDb(db);
  refreshSearchEngine();

  res.json(db.documents[index]);
});

// 6. Delete document
app.delete('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  const index = db.documents.findIndex(d => d.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy văn bản.' });
    return;
  }

  db.documents.splice(index, 1);
  saveDb(db);
  refreshSearchEngine();

  res.json({ success: true, message: 'Đã xóa văn bản thành công.' });
});

// 7. Folders API
app.post('/api/folders', (req, res) => {
  const { name, parentId } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Tên thư mục trống.' });
    return;
  }

  const newFolder = {
    id: 'f_' + Date.now(),
    name,
    parentId: parentId || null,
  };

  db.folders.push(newFolder);
  saveDb(db);
  res.status(201).json(newFolder);
});

app.delete('/api/folders/:id', (req, res) => {
  const { id } = req.params;
  const index = db.folders.findIndex(f => f.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy thư mục.' });
    return;
  }

  // Prevent deleting if folders have children or active docs
  const hasChildFolders = db.folders.some(f => f.parentId === id);
  const hasDocs = db.documents.some(d => d.folderId === id);

  if (hasChildFolders || hasDocs) {
    res.status(400).json({
      error: 'Thư mục này đang chứa các thư mục con hoặc văn bản bên trong. Vui lòng di chuyển hoặc xóa chúng trước.',
    });
    return;
  }

  db.folders.splice(index, 1);
  saveDb(db);
  res.json({ success: true });
});

// 8. Inspectors API
app.get('/api/inspectors', (req, res) => {
  res.json(db.inspectors);
});

app.post('/api/inspectors', (req, res) => {
  const inspector = req.body;
  if (!inspector.name || !inspector.role) {
    res.status(400).json({ error: 'Tên và chức vụ cán bộ thanh tra là bắt buộc.' });
    return;
  }

  const newInspector = {
    ...inspector,
    id: inspector.id || 'ins_' + Date.now(),
  };

  const existingIdx = db.inspectors.findIndex(i => i.id === newInspector.id);
  if (existingIdx !== -1) {
    db.inspectors[existingIdx] = newInspector;
  } else {
    db.inspectors.push(newInspector);
  }

  saveDb(db);
  res.json(newInspector);
});

app.delete('/api/inspectors/:id', (req, res) => {
  const { id } = req.params;
  db.inspectors = db.inspectors.filter(i => i.id !== id);
  saveDb(db);
  res.json({ success: true });
});

// 9. Proposals API
app.get('/api/proposals', (req, res) => {
  res.json(db.proposals);
});

app.post('/api/proposals', (req, res) => {
  const proposal = req.body;
  if (!proposal.title || !proposal.fullText) {
    res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc.' });
    return;
  }

  const newProposal = {
    ...proposal,
    id: 'prop_' + Date.now(),
    createdAt: new Date().toISOString(),
    status: 'Chờ duyệt',
  };

  db.proposals.push(newProposal);
  saveDb(db);
  res.status(201).json(newProposal);
});

// Approve Proposal and convert to permanent Document
app.post('/api/proposals/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { folderId, tags } = req.body; // Target folder and tags during approval

  const propIndex = db.proposals.findIndex(p => p.id === id);
  if (propIndex === -1) {
    res.status(404).json({ error: 'Không tìm thấy đề xuất.' });
    return;
  }

  const proposal = db.proposals[propIndex];
  proposal.status = 'Đã duyệt';

  // Build the permanent document from proposal
  const newDoc = {
    id: 'doc_' + Date.now(),
    category: proposal.category,
    title: proposal.title,
    docNumber: proposal.docNumber,
    issueDate: proposal.issueDate,
    agency: proposal.agency,
    fullText: proposal.fullText,
    folderId: folderId || 'f1', // Fallback to root QPPL
    tags: tags || ['Đề xuất duyệt'],
    createdAt: new Date().toISOString(),
    sourceLink: '',
    aiSummary: {
      implications: 'Đang chờ cập nhật tóm tắt chuyên sâu từ hệ thống chính thức.',
      complianceRequirements: 'Đang chờ phân tích tự động.',
      keyTakeaways: ['Tài liệu được duyệt đăng tải từ đề xuất của cán bộ: ' + proposal.proposedBy]
    }
  };

  // Attempt auto summarization
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Hãy đóng vai trò là Chuyên gia tuân thủ NHNN. Tóm tắt tài liệu đề xuất này:\nTiêu đề: ${newDoc.title}\nNội dung: ${newDoc.fullText.slice(0, 5000)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            implications: { type: Type.STRING },
            complianceRequirements: { type: Type.STRING },
            keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['implications', 'complianceRequirements', 'keyTakeaways']
        },
      }
    });
    newDoc.aiSummary = JSON.parse(response.text || '{}');
  } catch (err) {
    console.warn('Could not auto-summarize on proposal approval:', err);
  }

  db.documents.push(newDoc);
  saveDb(db);
  refreshSearchEngine();

  res.json({ success: true, document: newDoc });
});

// Reject Proposal
app.post('/api/proposals/:id/reject', (req, res) => {
  const { id } = req.params;
  const propIndex = db.proposals.findIndex(p => p.id === id);
  if (propIndex === -1) {
    res.status(404).json({ error: 'Không tìm thấy đề xuất.' });
    return;
  }

  db.proposals[propIndex].status = 'Từ chối';
  saveDb(db);
  res.json({ success: true });
});

// 9.5. Auth & Change Requests API

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { role, password, name } = req.body;

  if (role === 'admin') {
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    if (password === adminPass) {
      res.json({
        success: true,
        user: { role: 'admin', name: name || 'Quản trị viên (Admin)' }
      });
    } else {
      res.status(401).json({ error: 'Mật khẩu Admin không chính xác.' });
    }
  } else if (role === 'guest') {
    const guestName = (name && name.trim()) ? name.trim() : 'Cán bộ Khách';
    res.json({
      success: true,
      user: { role: 'guest', name: guestName }
    });
  } else {
    res.status(400).json({ error: 'Loại tài khoản không hợp lệ.' });
  }
});

// Get Change Requests
app.get('/api/change-requests', (req, res) => {
  if (!db.changeRequests) {
    db.changeRequests = [];
  }
  res.json(db.changeRequests);
});

// Submit a Change Request (from Guest)
app.post('/api/change-requests', (req, res) => {
  const { requestType, targetId, targetName, payload, requestedBy } = req.body;

  if (!requestType || !requestedBy) {
    res.status(400).json({ error: 'Thiếu thông tin loại yêu cầu hoặc người gửi.' });
    return;
  }

  const newRequest = {
    id: 'cr_' + Date.now(),
    requestType,
    targetId: targetId || null,
    targetName: targetName || 'Văn bản / Thư mục',
    payload: payload || null,
    requestedBy,
    createdAt: new Date().toISOString(),
    status: 'PENDING'
  };

  if (!db.changeRequests) db.changeRequests = [];
  db.changeRequests.unshift(newRequest); // Latest first
  saveDb(db);

  res.status(201).json(newRequest);
});

// Approve Change Request (by Admin)
app.post('/api/change-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  if (!db.changeRequests) db.changeRequests = [];

  const reqIdx = db.changeRequests.findIndex((cr: any) => cr.id === id);
  if (reqIdx === -1) {
    res.status(404).json({ error: 'Không tìm thấy yêu cầu.' });
    return;
  }

  const changeReq = db.changeRequests[reqIdx];
  if (changeReq.status !== 'PENDING') {
    res.status(400).json({ error: 'Yêu cầu này đã được xử lý trước đó.' });
    return;
  }

  try {
    if (changeReq.requestType === 'CREATE_DOCUMENT') {
      const docData = changeReq.payload || {};
      const newDoc = {
        ...docData,
        id: 'doc_' + Date.now(),
        createdAt: new Date().toISOString(),
        tags: docData.tags || [],
        aiSummary: docData.aiSummary || {
          implications: 'Chưa có tóm tắt AI. Có thể tự động tạo ở trang chi tiết.',
          complianceRequirements: 'Đọc văn bản gốc để tuân thủ.',
          keyTakeaways: ['Tài liệu được duyệt đăng từ yêu cầu của ' + changeReq.requestedBy]
        }
      };
      db.documents.push(newDoc);
      refreshSearchEngine();
    } else if (changeReq.requestType === 'EDIT_DOCUMENT') {
      const docData = changeReq.payload || {};
      const targetId = changeReq.targetId || docData.id;
      const index = db.documents.findIndex(d => d.id === targetId);
      if (index !== -1) {
        db.documents[index] = {
          ...db.documents[index],
          ...docData,
          id: targetId
        };
        refreshSearchEngine();
      }
    } else if (changeReq.requestType === 'DELETE_DOCUMENT') {
      const targetId = changeReq.targetId;
      const index = db.documents.findIndex(d => d.id === targetId);
      if (index !== -1) {
        db.documents.splice(index, 1);
        refreshSearchEngine();
      }
    } else if (changeReq.requestType === 'CREATE_FOLDER') {
      const folderData = changeReq.payload || {};
      const newFolder = {
        id: 'f_' + Date.now(),
        name: folderData.name || 'Thư mục mới',
        parentId: folderData.parentId || null,
      };
      db.folders.push(newFolder);
    } else if (changeReq.requestType === 'DELETE_FOLDER') {
      const targetId = changeReq.targetId;
      const index = db.folders.findIndex(f => f.id === targetId);
      if (index !== -1) {
        db.folders.splice(index, 1);
      }
    }

    changeReq.status = 'APPROVED';
    changeReq.processedAt = new Date().toISOString();

    saveDb(db);
    res.json({ success: true, message: 'Đã chấp nhận và thực thi yêu cầu thành công.', changeRequest: changeReq });
  } catch (err: any) {
    console.error('Approval execution error:', err);
    res.status(500).json({ error: 'Không thể thực thi yêu cầu: ' + err.message });
  }
});

// Reject Change Request (by Admin)
app.post('/api/change-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!db.changeRequests) db.changeRequests = [];

  const reqIdx = db.changeRequests.findIndex((cr: any) => cr.id === id);
  if (reqIdx === -1) {
    res.status(404).json({ error: 'Không tìm thấy yêu cầu.' });
    return;
  }

  const changeReq = db.changeRequests[reqIdx];
  changeReq.status = 'REJECTED';
  changeReq.rejectedReason = reason || 'Quản trị viên hủy bỏ yêu cầu.';
  changeReq.processedAt = new Date().toISOString();

  saveDb(db);
  res.json({ success: true, message: 'Đã hủy bỏ yêu cầu thành công.', changeRequest: changeReq });
});

// 10. Stats / Aggregates Endpoint
app.get('/api/stats', (req, res) => {
  const docs = db.documents;
  
  const totalQPPL = docs.filter(d => d.category === 'QPPL').length;
  const activeQPPL = docs.filter(d => d.category === 'QPPL' && d.status === 'Còn hiệu lực').length;
  const totalQuyetDinhThanhTra = docs.filter(d => d.category === 'QuyetDinhThanhTra').length;
  const totalKetLuanThanhTra = docs.filter(d => d.category === 'KetLuanThanhTra').length;
  const totalChiDaoNHNN = docs.filter(d => d.category === 'ChiDaoNHNN').length;
  const totalInspectors = db.inspectors.length;

  // Group inspection conclusions by year
  const yearsMap: { [year: number]: number } = {};
  docs.forEach(d => {
    if (d.category === 'KetLuanThanhTra' && d.inspectionYear) {
      yearsMap[d.inspectionYear] = (yearsMap[d.inspectionYear] || 0) + 1;
    }
  });

  const conclusionsByYear = Object.keys(yearsMap)
    .map(yr => ({ year: parseInt(yr), count: yearsMap[parseInt(yr)] }))
    .sort((a, b) => a.year - b.year);

  // Default value in case no data
  if (conclusionsByYear.length === 0) {
    conclusionsByYear.push({ year: 2024, count: 1 });
    conclusionsByYear.push({ year: 2025, count: 1 });
  }

  const categoryDistribution = [
    { name: 'Văn bản QPPL', value: totalQPPL },
    { name: 'Quyết định thanh tra', value: totalQuyetDinhThanhTra },
    { name: 'Kết luận thanh tra', value: totalKetLuanThanhTra },
    { name: 'Chỉ đạo NHNN', value: totalChiDaoNHNN }
  ];

  res.json({
    totalQPPL,
    activeQPPL,
    totalQuyetDinhThanhTra,
    totalKetLuanThanhTra,
    totalChiDaoNHNN,
    totalInspectors,
    conclusionsByYear,
    categoryDistribution
  });
});

// Vite Middleware for development, or serve built assets in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
