/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Document, DocumentCategory } from '../types';
import { X, Sparkles, AlertCircle, FileText, Calendar, ShieldCheck, ExternalLink, RefreshCw, Edit2, Trash2, Tag, Copy, Check } from 'lucide-react';

interface DocumentDetailProps {
  document: Document | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (doc: Document) => void;
  onUpdateDocument: (doc: Document) => void;
}

export default function DocumentDetail({
  document,
  onClose,
  onDelete,
  onEdit,
  onUpdateDocument,
}: DocumentDetailProps) {
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'fulltext'>('summary');

  if (!document) return null;

  const handleCopyText = () => {
    navigator.clipboard.writeText(document.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateSummary = async () => {
    setLoadingSummary(true);
    try {
      const response = await fetch('/api/documents/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: document.title,
          docNumber: document.docNumber,
          category: document.category,
          fullText: document.fullText,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        // Save back to db
        const updatedDoc = {
          ...document,
          aiSummary: data,
        };
        onUpdateDocument(updatedDoc);
      } else {
        alert(data.error || 'Có lỗi xảy ra khi tóm tắt văn bản.');
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const categoryLabel = (cat: DocumentCategory) => {
    switch (cat) {
      case 'QPPL': return 'Văn bản QPPL';
      case 'QuyetDinhThanhTra': return 'Quyết định thanh tra';
      case 'KetLuanThanhTra': return 'Kết luận thanh tra';
      case 'ChiDaoNHNN': return 'Chỉ đạo điều hành';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col z-50 overflow-hidden font-sans animate-fade-in" id="document_detail_slideover">
      {/* Header Panel */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <FileText className="h-4.5 w-4.5 text-brand-primary" />
          <span className="font-bold text-slate-900 text-xs uppercase tracking-wider font-sans">Chi tiết tài liệu pháp lý</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onEdit(document)}
            title="Sửa văn bản"
            className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Bạn có chắc chắn muốn xóa văn bản này khỏi cơ sở dữ liệu?')) {
                onDelete(document.id);
              }
            }}
            title="Xóa văn bản"
            className="p-1.5 rounded-sm hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Title & Metadata Header */}
        <div className="space-y-2.5" id="doc_detail_meta_header">
          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20 uppercase tracking-wider font-sans">
            {categoryLabel(document.category)}
          </span>
          <h2 className="text-left text-base md:text-lg font-extrabold text-slate-950 leading-snug">
            {document.title}
          </h2>

          {/* Metadata Badges Grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-md border border-slate-200 text-xs text-slate-600">
            <div className="space-y-1 text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Số hiệu văn bản</span>
              <strong className="text-slate-800 font-mono text-xs block">{document.docNumber}</strong>
            </div>
            <div className="space-y-1 text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Cơ quan ban hành</span>
              <strong className="text-slate-850 block">{document.agency}</strong>
            </div>
            <div className="space-y-1 text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Ngày ban hành</span>
              <strong className="text-slate-850 flex items-center font-mono">
                <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
                {document.issueDate}
              </strong>
            </div>
            {document.category === 'QPPL' ? (
              <div className="space-y-1 text-left">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Ngày hiệu lực & Trạng thái</span>
                <div className="flex items-center space-x-2">
                  <strong className="text-slate-850 font-mono">{document.effectiveDate || 'Chưa cập nhật'}</strong>
                  {document.status && (
                    <span className={`px-1.5 py-0.25 rounded-xs text-[9px] font-bold uppercase tracking-wider ${
                      document.status === 'Còn hiệu lực' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-105'
                    }`}>
                      {document.status}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-left">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Đối tượng & Năm thanh tra</span>
                <strong className="text-slate-850 block">
                  {document.inspectionTarget || 'N/A'} {document.inspectionYear ? `(Năm ${document.inspectionYear})` : ''}
                </strong>
              </div>
            )}
            {document.specialization && (
              <div className="space-y-1 text-left col-span-2 border-t border-slate-100 pt-2 mt-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Lĩnh vực chuyên môn</span>
                <strong className="text-indigo-700 font-sans block">{document.specialization}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200" id="detail_tab_selectors">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-2.5 text-center text-xs font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
              activeTab === 'summary' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="flex items-center justify-center space-x-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Phân tích & Tóm tắt AI</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('fulltext')}
            className={`flex-1 py-2.5 text-center text-xs font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
              activeTab === 'fulltext' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Văn bản gốc
          </button>
        </div>

        {/* Tab 1: AI Summary Content */}
        {activeTab === 'summary' && (
          <div className="space-y-4 animate-fade-in" id="ai_summary_tab_pane">
            {/* Summary Regeneration Status Bar */}
            <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-md border border-indigo-100/50">
              <div className="flex items-center space-x-2 text-[11px] text-indigo-700 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>Phân tích pháp lý tự động bởi <strong>Gemini 3.5 Flash</strong></span>
              </div>
              <button
                disabled={loadingSummary}
                onClick={handleRegenerateSummary}
                className="flex items-center text-[10px] text-brand-primary font-bold uppercase tracking-wider hover:text-brand-secondary transition-colors disabled:opacity-50 cursor-pointer font-mono"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loadingSummary ? 'animate-spin' : ''}`} />
                {loadingSummary ? 'Đang tóm tắt...' : 'Phân tích lại'}
              </button>
            </div>

            {loadingSummary ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                <span className="text-xs text-slate-500 font-medium">Gemini đang phân tích tác động & yêu cầu tuân thủ...</span>
              </div>
            ) : document.aiSummary ? (
              <div className="space-y-4">
                {/* Implications Card */}
                <div className="bg-slate-50/50 p-4 rounded-md border border-slate-200 space-y-2 border-l-4 border-l-amber-600">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center">
                    <AlertCircle className="h-4 w-4 text-brand-secondary mr-1.5" />
                    Tác động & Hệ quả pháp lý (Implications)
                  </h4>
                  <p className="text-left text-xs md:text-sm text-slate-700 leading-relaxed font-sans">
                    {document.aiSummary.implications}
                  </p>
                </div>

                {/* Compliance Requirements Card */}
                <div className="bg-amber-50/30 p-4 rounded-md border border-amber-150 space-y-2 border-l-4 border-l-amber-500">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center">
                    <ShieldCheck className="h-4 w-4 text-amber-600 mr-1.5" />
                    Yêu cầu tuân thủ cho Bankers (Compliance)
                  </h4>
                  <p className="text-left text-xs md:text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line">
                    {document.aiSummary.complianceRequirements}
                  </p>
                </div>

                {/* Key Takeaways Card */}
                <div className="bg-slate-50/50 p-4 rounded-md border border-slate-200 space-y-2 border-l-4 border-l-blue-600">
                  <h4 className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Điểm cốt lõi cần nhớ (Key Takeaways)
                  </h4>
                  <ul className="space-y-1.5 text-left">
                    {document.aiSummary.keyTakeaways.map((item, index) => (
                      <li key={index} className="flex items-start text-xs md:text-sm text-slate-700">
                        <span className="text-brand-secondary mr-2 select-none font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-md border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 mb-3">Tài liệu này chưa có tóm tắt thông minh từ AI.</p>
                <button
                  onClick={handleRegenerateSummary}
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold px-4 py-2 rounded-sm transition-colors cursor-pointer"
                >
                  Tạo tóm tắt AI ngay
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Full Regulatory Text */}
        {activeTab === 'fulltext' && (
          <div className="space-y-4 animate-fade-in" id="fulltext_tab_pane">
            {/* Actions Panel */}
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Tổng số ký tự: {document.fullText.length}</span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleCopyText}
                  className="flex items-center text-[11px] text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-sm font-bold transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                      Đã sao chép
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1 text-slate-400" />
                      Sao chép văn bản
                    </>
                  )}
                </button>
                {document.sourceLink && (
                  <a
                    href={document.sourceLink}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="flex items-center text-[11px] text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-sm font-bold transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1 text-slate-400" />
                    Nguồn liên kết
                  </a>
                )}
              </div>
            </div>

            {/* Content block */}
            <div className="bg-slate-950 text-slate-200 p-5 rounded-md border border-slate-800 font-mono text-xs md:text-sm leading-relaxed overflow-x-auto whitespace-pre-line max-h-[380px] text-left" id="raw_full_text_container">
              {document.fullText}
            </div>

            {/* Key inspection specific details if available */}
            {document.inspectionContent && (
              <div className="p-4 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-600 space-y-1.5 text-left border-l-4 border-l-amber-600">
                <strong className="text-slate-800 text-xs block font-sans">Nội dung thanh tra chuyên đề:</strong>
                <p className="font-sans italic leading-relaxed">"{document.inspectionContent}"</p>
                {document.keyContent && (
                  <>
                    <strong className="text-slate-800 text-xs block pt-2 font-sans">Nội dung khắc phục chính:</strong>
                    <p className="font-sans leading-relaxed text-red-600 font-semibold">{document.keyContent}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Displaying tags */}
        <div className="space-y-2 pt-4 border-t border-slate-100 shrink-0 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Nhãn phân loại</span>
          <div className="flex flex-wrap gap-1">
            {document.tags.map((tag, idx) => (
              <span key={idx} className="flex items-center text-[10px] text-slate-600 bg-slate-50 px-2.5 py-0.75 rounded-xs border border-slate-200 font-medium font-mono">
                <Tag className="h-2.5 w-2.5 mr-1 text-slate-400" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
