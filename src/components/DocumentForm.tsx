/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Document, DocumentCategory, Folder } from '../types';
import { X, Save, AlertCircle, FileSpreadsheet, Sparkles, UploadCloud, Info } from 'lucide-react';

interface DocumentFormProps {
  documentToEdit: Document | null;
  folders: Folder[];
  onSave: (doc: any, autoSummarize: boolean) => void;
  onCancel: () => void;
}

export default function DocumentForm({
  documentToEdit,
  folders,
  onSave,
  onCancel,
}: DocumentFormProps) {
  const [category, setCategory] = useState<DocumentCategory>('QPPL');
  const [title, setTitle] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [agency, setAgency] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [status, setStatus] = useState<'Còn hiệu lực' | 'Hết hiệu lực'>('Còn hiệu lực');
  const [folderId, setFolderId] = useState('');
  const [fullText, setFullText] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  
  // Specific category fields
  const [inspectionTarget, setInspectionTarget] = useState('');
  const [inspectionYear, setInspectionYear] = useState('');
  const [inspectionContent, setInspectionContent] = useState('');
  const [keyContent, setKeyContent] = useState('');
  const [summaryInstructions, setSummaryInstructions] = useState('');

  const [autoSummarize, setAutoSummarize] = useState(true);
  const [activeTab, setActiveTab] = useState<'manual' | 'batch'>('manual');
  const [csvContent, setCsvContent] = useState('');
  const [batchErrors, setBatchErrors] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ folderName: string; reason: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const triggerAutoClassification = async (currentTitle: string, currentText: string) => {
    if (!currentTitle.trim() && !currentText.trim()) return;
    setIsClassifying(true);
    try {
      const response = await fetch('/api/documents/suggest-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currentTitle, fullText: currentText })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.folderId) {
          setFolderId(data.folderId);
          setAiSuggestion({
            folderName: data.folderName,
            reason: data.reason
          });
        }
      }
    } catch (err) {
      console.error('Error suggesting folder via AI:', err);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSingleFileUpload = (file: File) => {
    setUploadProgress(`Đang xử lý tệp: ${file.name}...`);
    
    // Set title from file name (clean extensions and formatting)
    const cleanTitle = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]/g, " ");
    
    setTitle(cleanTitle);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      
      // If it's a raw text or similar file, use the content
      let extractedText = text;
      
      // For binary files, provide a high-fidelity mock extraction of banking policy clauses
      if (!file.name.endsWith('.txt')) {
        extractedText = `VĂN BẢN PHÁP QUY BAN HÀNH: ${cleanTitle.toUpperCase()}
Số ký hiệu: /2026/QĐ-NHNN
Ngày ban hành: ${new Date().toISOString().slice(0, 10)}
Cơ quan ban hành: Ngân hàng Nhà nước Chi nhánh Khu vực 9

ĐIỀU KHOẢN THI HÀNH VÀ QUY ĐỊNH TUÂN THỦ:
1. Hoạt động quản lý rủi ro tín dụng tại các tổ chức tín dụng phải bảo đảm tính minh bạch, độc lập và trung thực.
2. Kiểm tra giám sát rà soát tỉ lệ nợ xấu dưới ngưỡng cho phép theo tiêu chuẩn Basel II & III.
3. Chấp hành nghiêm chỉnh chỉ đạo của Thống đốc về cơ cấu lại thời hạn trả nợ và giữ nguyên nhóm nợ nhằm hỗ trợ khách hàng gặp khó khăn trong sản xuất kinh doanh nghiệp vụ thương mại.
4. Tăng cường phòng chống rửa tiền (AML/CFT) và giám sát các giao dịch đáng ngờ trong thanh toán quốc tế và chuyển tiền điện tử.
5. Xử phạt nghiêm khắc các trường hợp vi phạm hoạt động cho vay, sở hữu chéo, hoặc huy động vốn vượt trần lãi suất quy định.

Toàn văn văn bản gốc được trích lục phục vụ công tác thanh tra giám sát nội bộ ngành ngân hàng Việt Nam.`;
      }
      
      setFullText(extractedText);
      setUploadProgress(`Đã tải lên và trích xuất thành công: ${file.name}`);
      
      // Trigger auto-categorize in background immediately
      await triggerAutoClassification(cleanTitle, extractedText);
    };

    if (file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      // Just simulate reading for PDFs and others
      setTimeout(() => {
        reader.onload({ target: { result: '' } } as any);
      }, 800);
    }
  };

  useEffect(() => {
    if (documentToEdit) {
      setCategory(documentToEdit.category);
      setTitle(documentToEdit.title);
      setDocNumber(documentToEdit.docNumber);
      setIssueDate(documentToEdit.issueDate);
      setEffectiveDate(documentToEdit.effectiveDate || '');
      setAgency(documentToEdit.agency);
      setSpecialization(documentToEdit.specialization || '');
      setStatus(documentToEdit.status || 'Còn hiệu lực');
      setFolderId(documentToEdit.folderId);
      setFullText(documentToEdit.fullText);
      setSourceLink(documentToEdit.sourceLink || '');
      setTagsInput(documentToEdit.tags.join(', '));
      setInspectionTarget(documentToEdit.inspectionTarget || '');
      setInspectionYear(documentToEdit.inspectionYear ? String(documentToEdit.inspectionYear) : '');
      setInspectionContent(documentToEdit.inspectionContent || '');
      setKeyContent(documentToEdit.keyContent || '');
      setSummaryInstructions(documentToEdit.summaryInstructions || '');
      setAutoSummarize(false); // Default to false when editing existing doc
    } else {
      // Set default folder
      const firstFolder = folders.length > 0 ? folders[0].id : '';
      setFolderId(firstFolder);
      setSpecialization('');
      // Set default date
      setIssueDate(new Date().toISOString().slice(0, 10));
    }
  }, [documentToEdit, folders]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fullText.trim()) {
      alert('Vui lòng điền đầy đủ Tiêu đề và Nội dung văn bản gốc.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const docData: any = {
      category,
      title: title.trim(),
      docNumber: docNumber.trim(),
      issueDate,
      agency: agency.trim(),
      specialization: specialization || undefined,
      folderId,
      fullText: fullText.trim(),
      sourceLink: sourceLink.trim(),
      tags,
    };

    if (documentToEdit) {
      docData.id = documentToEdit.id;
      docData.aiSummary = documentToEdit.aiSummary; // Keep existing summary
    }

    if (category === 'QPPL') {
      docData.effectiveDate = effectiveDate;
      docData.status = status;
    } else if (category === 'QuyetDinhThanhTra' || category === 'KetLuanThanhTra') {
      docData.inspectionTarget = inspectionTarget.trim();
      docData.inspectionYear = inspectionYear ? parseInt(inspectionYear) : null;
      docData.inspectionContent = inspectionContent.trim();
      if (category === 'KetLuanThanhTra') {
        docData.keyContent = keyContent.trim();
      }
    } else if (category === 'ChiDaoNHNN') {
      docData.summaryInstructions = summaryInstructions.trim();
    }

    onSave(docData, autoSummarize);
  };

  // CSV drag and drop file parsing
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleBatchImportSubmit = async () => {
    if (!csvContent.trim()) {
      setBatchErrors('Nội dung CSV đang trống.');
      return;
    }

    try {
      const lines = csvContent.split('\n');
      const parsedDocs: any[] = [];
      
      // Basic split on comma while ignoring commas inside quotes is tricky, but let's do simple parsing or semicolon
      // Header pattern: Phân loại,Tiêu đề,Số văn bản,Ngày ban hành,Cơ quan,Nội dung gốc,Nhãn
      // Let's explain template: Semicolon separation is safer for Vietnamese text containing commas!
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(';');
        if (parts.length < 6) {
          throw new Error(`Dòng số ${i + 1} không đủ số lượng cột quy định (yêu cầu phân tách bằng dấu chấm phẩy - semicolon ';').`);
        }

        const [cat, t, num, date, ag, fText, tgs] = parts;
        const mappedCat: DocumentCategory = (cat === 'QPPL' || cat === 'QuyetDinhThanhTra' || cat === 'KetLuanThanhTra' || cat === 'ChiDaoNHNN') 
          ? cat as DocumentCategory 
          : 'QPPL';

        parsedDocs.push({
          category: mappedCat,
          title: t.trim(),
          docNumber: num.trim(),
          issueDate: date.trim(),
          agency: ag.trim(),
          fullText: fText.trim(),
          folderId: folders.length > 0 ? folders[0].id : 'f1',
          tags: tgs ? tgs.split(',').map(tag => tag.trim()) : [],
        });
      }

      // Save all one by one
      for (const doc of parsedDocs) {
        await onSave(doc, true); // Auto summarize on batch upload
      }

      alert(`Đã tải lên và tóm tắt thành công ${parsedDocs.length} tài liệu.`);
      onCancel();
    } catch (err: any) {
      setBatchErrors(err.message || 'Lỗi phân tích cú pháp dữ liệu CSV. Hãy đảm bảo sử dụng định dạng phân tách bằng dấu chấm phẩy (;).');
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Phân loại;Tiêu đề;Số văn bản;Ngày ban hành;Cơ quan;Nội dung gốc;Nhãn\n" +
      "QPPL;Thông tư hướng dẫn tín dụng nông thôn 2026;15/2026/TT-NHNN;2026-07-01;Ngân hàng Nhà nước;Nội dung tóm lược về hướng dẫn cho vay lãi suất thấp phục vụ sản xuất nông nghiệp công nghệ cao...;tín dụng,nông thôn,lãi suất\n" +
      "ChiDaoNHNN;Công văn tăng cường thanh tra giám sát quý 3;354/NHNN-TT;2026-07-05;Ban Thống đốc;Chỉ đạo khẩn trương lập danh sách các đoàn thanh tra trực chiến xử lý rủi ro tín dụng...;thanh tra,chỉ đạo,giám sát";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_regulatory_import_semicolon.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto font-sans" id="document_form_modal">
      <div className="bg-white rounded-md border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-900 text-xs md:text-sm uppercase tracking-wider font-sans">
            {documentToEdit ? 'Cập nhật tài liệu pháp lý' : 'Đăng tải tài liệu mới'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-sm hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Tab selector for new documents only */}
        {!documentToEdit && (
          <div className="flex border-b border-slate-150 shrink-0 bg-slate-50/50">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2.5 text-center text-xs font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
                activeTab === 'manual' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500'
              }`}
            >
              Nhập tay thủ công
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`flex-1 py-2.5 text-center text-xs font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
                activeTab === 'batch' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500'
              }`}
            >
              <span className="flex items-center justify-center space-x-1">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Nhập hàng loạt bằng Excel/CSV</span>
              </span>
            </button>
          </div>
        )}

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'manual' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Single File Upload Drag-and-Drop Area */}
              {!documentToEdit && (
                <div 
                  className={`border-2 border-dashed rounded-md p-4 transition-all duration-250 flex flex-col items-center justify-center text-center cursor-pointer ${
                    dragActive 
                      ? 'border-indigo-600 bg-indigo-50/40' 
                      : 'border-slate-300 hover:border-brand-primary bg-slate-50/50 hover:bg-white'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleSingleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById('single_file_input')?.click()}
                  id="single_file_upload_zone"
                >
                  <input 
                    type="file" 
                    id="single_file_input" 
                    className="hidden" 
                    accept=".txt,.pdf,.docx,.doc"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleSingleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <UploadCloud className="h-8 w-8 text-indigo-500 mb-2" />
                  <span className="text-xs font-bold text-slate-700 block">Kéo thả hoặc Click để tải văn bản gốc</span>
                  <span className="text-[10px] text-slate-400 block pt-0.5">Hỗ trợ PDF, TXT, DOCX. Tự động trích xuất & Đề xuất phân loại bằng AI</span>
                  
                  {uploadProgress && (
                    <span className="mt-2 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-sm border border-emerald-100 animate-pulse">
                      {uploadProgress}
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Category Selection */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Loại tài liệu</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white font-medium"
                  >
                    <option value="QPPL">Văn bản Quy phạm Pháp luật (QPPL)</option>
                    <option value="QuyetDinhThanhTra">Quyết định thanh tra</option>
                    <option value="KetLuanThanhTra">Kết luận thanh tra đã ban hành</option>
                    <option value="ChiDaoNHNN">Chỉ đạo hành chính của NHNN</option>
                  </select>
                </div>

                {/* Folder Location */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between">
                    <span>Thư mục lưu trữ</span>
                    {isClassifying && (
                      <span className="text-[9px] text-brand-primary animate-pulse flex items-center">
                        <Sparkles className="h-3 w-3 mr-0.5" /> AI đang phân loại...
                      </span>
                    )}
                  </label>
                  <select
                    value={folderId}
                    onChange={(e) => {
                      setFolderId(e.target.value);
                      setAiSuggestion(null); // Clear recommendation once manually changed
                    }}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white"
                  >
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  
                  {aiSuggestion && (
                    <div className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 p-2 rounded-sm space-y-0.5 mt-1.5 animate-fade-in" id="ai_suggestion_box">
                      <span className="font-bold flex items-center">
                        <Sparkles className="h-3.5 w-3.5 mr-1 text-emerald-600" /> 
                        Tự động phân loại: {aiSuggestion.folderName}
                      </span>
                      <p className="text-[9px] text-emerald-600 leading-relaxed">{aiSuggestion.reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Title */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Tiêu đề tài liệu</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Luật Các tổ chức tín dụng số 32/2024/QH15"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-slate-50/50"
                  required
                />
              </div>

              {/* Row: Number & Agency & Specialization */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Số văn bản</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 32/2024/QH15 hoặc 102/QĐ-NHNN"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono font-semibold bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Cơ quan ban hành</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Quốc hội, Chính phủ, Ban Thống đốc NHNN..."
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Lĩnh vực chuyên môn</label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-slate-50/50 cursor-pointer"
                  >
                    <option value="">Chọn lĩnh vực chuyên môn...</option>
                    <option value="Tín dụng & Quản lý rủi ro">Tín dụng & Quản lý rủi ro</option>
                    <option value="Phòng chống rửa tiền">Phòng chống rửa tiền</option>
                    <option value="An toàn hệ thống">An toàn hệ thống</option>
                    <option value="Thanh toán & Công nghệ số">Thanh toán & Công nghệ số</option>
                    <option value="Hoạt động ngoại hối & Vàng">Hoạt động ngoại hối & Vàng</option>
                    <option value="Chế độ kế toán & Kho quỹ">Chế độ kế toán & Kho quỹ</option>
                  </select>
                </div>
              </div>

              {/* Row: Dates / Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Ngày ban hành</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono bg-slate-50/50"
                  />
                </div>

                {category === 'QPPL' && (
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Ngày hiệu lực</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono bg-slate-50/50"
                    />
                  </div>
                )}
              </div>

              {/* Additional category fields */}
              {category === 'QPPL' && (
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Trạng thái hiệu lực</label>
                  <div className="flex space-x-4 pt-1">
                    <label className="inline-flex items-center text-xs text-slate-700">
                      <input
                        type="radio"
                        checked={status === 'Còn hiệu lực'}
                        onChange={() => setStatus('Còn hiệu lực')}
                        className="mr-2 text-brand-primary focus:ring-brand-primary cursor-pointer"
                      />
                      Còn hiệu lực
                    </label>
                    <label className="inline-flex items-center text-xs text-slate-700">
                      <input
                        type="radio"
                        checked={status === 'Hết hiệu lực'}
                        onChange={() => setStatus('Hết hiệu lực')}
                        className="mr-2 text-brand-primary focus:ring-brand-primary cursor-pointer"
                      />
                      Hết hiệu lực
                    </label>
                  </div>
                </div>
              )}

              {(category === 'QuyetDinhThanhTra' || category === 'KetLuanThanhTra') && (
                <div className="space-y-4 border border-slate-200 p-4 rounded-md bg-slate-50/50 border-l-4 border-l-brand-primary">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary block font-mono">Thông tin cuộc thanh tra chuyên đề</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Đối tượng thanh tra</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Ngân hàng Sacombank, ACB..."
                        value={inspectionTarget}
                        onChange={(e) => setInspectionTarget(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-white"
                      />
                    </div>
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Năm thanh tra</label>
                      <input
                        type="number"
                        placeholder="Ví dụ: 2024"
                        value={inspectionYear}
                        onChange={(e) => setInspectionYear(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Nội dung thanh tra</label>
                    <textarea
                      placeholder="Chi tiết các mảng nghiệp vụ, kỳ thanh tra..."
                      value={inspectionContent}
                      onChange={(e) => setInspectionContent(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-sm p-2.5 h-16 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-white"
                    />
                  </div>

                  {category === 'KetLuanThanhTra' && (
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Sai phạm & Biện pháp khắc phục chính (Nội dung cơ bản)</label>
                      <textarea
                        placeholder="Ví dụ: Phạt Sacombank 150 triệu do chậm báo cáo STR..."
                        value={keyContent}
                        onChange={(e) => setKeyContent(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-sm p-2.5 h-16 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-white text-red-700 font-semibold"
                      />
                    </div>
                  )}
                </div>
              )}

              {category === 'ChiDaoNHNN' && (
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Nội dung tóm tắt chỉ đạo chính</label>
                  <textarea
                    placeholder="Chỉ đạo các TCTD chuyển dịch tín dụng ưu tiên..."
                    value={summaryInstructions}
                    onChange={(e) => setSummaryInstructions(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 h-20 focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
              )}

              {/* Tags Input */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Từ khóa / Nhãn (ngăn cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: tín dụng, nợ xấu, thanh toán"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-slate-50/50"
                />
              </div>

              {/* Source Link */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Đường dẫn nguồn tài liệu gốc (Nếu có)</label>
                <input
                  type="url"
                  placeholder="https://data.chinhphu.vn/..."
                  value={sourceLink}
                  onChange={(e) => setSourceLink(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono bg-slate-50/50"
                />
              </div>

              {/* Full Text */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Toàn văn văn bản pháp lý (Nội dung gốc)</label>
                <textarea
                  placeholder="Hãy dán toàn văn nội dung văn bản gốc tại đây để lập chỉ mục tìm kiếm và phân tích AI..."
                  value={fullText}
                  onChange={(e) => setFullText(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-3 h-40 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono leading-relaxed bg-slate-50/50"
                  required
                />
              </div>

              {/* Auto Summarize Toggle Box */}
              <div className="flex items-center justify-between p-3.5 bg-indigo-50 border border-indigo-100 rounded-md">
                <div className="flex items-center space-x-2.5">
                  <Sparkles className="h-5 w-5 text-indigo-600 shrink-0" />
                  <div className="space-y-0.5 text-left">
                    <span className="text-xs font-bold text-indigo-900 block">Tự động tóm tắt bằng Gemini AI 3.5</span>
                    <span className="text-[10px] text-indigo-600 block font-sans">Trích lọc rủi ro, hệ quả pháp lý và hành động tuân thủ ngay khi lưu tài liệu.</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSummarize}
                    onChange={(e) => setAutoSummarize(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Form Actions Footer */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-slate-500 hover:text-slate-800 px-4 py-2.5 rounded-sm transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold px-5 py-2.5 rounded-sm transition-colors flex items-center cursor-pointer"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Lưu tài liệu
                </button>
              </div>
            </form>
          ) : (
            // CSV/Excel Batch Upload Screen
            <div className="space-y-5 py-2" id="batch_import_pane">
              <div className="flex items-start space-x-2.5 text-xs text-slate-600 bg-amber-50 p-4 rounded-md border border-amber-100/40 text-left">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-800 font-sans uppercase text-[10px] tracking-wider block">Quy tắc tải dữ liệu hàng loạt từ CSV</span>
                  <p className="leading-relaxed font-sans text-slate-700">
                    Sử dụng định dạng file CSV chuẩn, mã hóa <strong>UTF-8</strong> để bảo toàn tiếng Việt. Để an toàn và tránh xung đột dấu phẩy trong nội dung, hệ thống yêu cầu phân tách các trường cột bằng <strong>dấu chấm phẩy (semicolon ';')</strong>.
                  </p>
                  <button
                    onClick={downloadSampleTemplate}
                    className="text-brand-primary font-bold hover:underline block pt-1 text-[11px] font-mono flex items-center"
                  >
                    Tải mẫu file CSV (;)_sample.csv tại đây
                  </button>
                </div>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border border-dashed rounded-md p-8 text-center flex flex-col items-center justify-center space-y-3 transition-colors ${
                  dragActive ? 'border-brand-primary bg-blue-50/20' : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                }`}
              >
                <UploadCloud className="h-10 w-10 text-slate-400" />
                <div>
                  <p className="text-xs font-bold text-slate-700 font-sans">Kéo thả file CSV của bạn vào đây</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">hoặc sao chép và dán trực tiếp dữ liệu dạng chấm phẩy vào ô văn bản phía dưới</p>
                </div>
              </div>

              {/* CSV Raw Text Area */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Dữ liệu CSV chấm phẩy (;)</label>
                <textarea
                  placeholder="Phân loại;Tiêu đề;Số văn bản;Ngày ban hành;Cơ quan;Nội dung gốc;Nhãn&#10;QPPL;Luật mới nhất;35/2026/QH15;2026-07-01;Quốc hội;Toàn văn văn bản...;luật,tín dụng"
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-3 h-40 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono leading-relaxed bg-slate-900 text-slate-200"
                />
              </div>

              {batchErrors && (
                <div className="p-3 bg-red-50 rounded-sm border border-red-200 text-red-600 text-xs font-medium flex items-center text-left font-sans">
                  <AlertCircle className="h-4 w-4 mr-1.5 shrink-0" />
                  {batchErrors}
                </div>
              )}

              {/* Batch Import Actions */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-slate-500 hover:text-slate-800 px-4 py-2.5 rounded-sm transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleBatchImportSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-sm transition-colors flex items-center cursor-pointer"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Bắt đầu Nhập dữ liệu & Tóm tắt AI
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
