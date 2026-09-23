/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Proposal, Folder } from '../types';
import { Mail, Check, X, FileText, AlertCircle, FolderSymlink, Sparkles, User, Tag, Calendar, Building } from 'lucide-react';

interface ProposalsManagerProps {
  proposals: Proposal[];
  folders: Folder[];
  onApproveProposal: (id: string, folderId: string, tags: string[]) => void;
  onRejectProposal: (id: string) => void;
  onSubmitNewProposal: (prop: any) => void;
}

export default function ProposalsManager({
  proposals,
  folders,
  onApproveProposal,
  onRejectProposal,
  onSubmitNewProposal,
}: ProposalsManagerProps) {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [targetFolderId, setTargetFolderId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [submittingApprove, setSubmittingApprove] = useState(false);

  // New proposal submit state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'QPPL' | 'QuyetDinhThanhTra' | 'KetLuanThanhTra' | 'ChiDaoNHNN'>('QPPL');
  const [newDocNumber, setNewDocNumber] = useState('');
  const [newIssueDate, setNewIssueDate] = useState('');
  const [newAgency, setNewAgency] = useState('');
  const [newFullText, setNewFullText] = useState('');
  const [proposedByEmail, setProposedByEmail] = useState('canbo.tuantu@sbv.gov.vn');

  const handleOpenApproval = (prop: Proposal) => {
    setSelectedProposal(prop);
    setTargetFolderId(folders.length > 0 ? folders[0].id : '');
    setTagsInput('Đề xuất duyệt, Cần rà soát');
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProposal) return;

    setSubmittingApprove(true);
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    try {
      await onApproveProposal(selectedProposal.id, targetFolderId, tags);
      setSelectedProposal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingApprove(false);
    }
  };

  const handleNewProposalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newFullText.trim()) {
      alert('Vui lòng điền đủ Tiêu đề và Nội dung đề xuất.');
      return;
    }

    onSubmitNewProposal({
      title: newTitle.trim(),
      category: newCategory,
      docNumber: newDocNumber.trim(),
      issueDate: newIssueDate || new Date().toISOString().slice(0, 10),
      agency: newAgency.trim(),
      fullText: newFullText.trim(),
      proposedBy: proposedByEmail.trim(),
    });

    // Reset Form
    setNewTitle('');
    setNewCategory('QPPL');
    setNewDocNumber('');
    setNewIssueDate('');
    setNewAgency('');
    setNewFullText('');
    setShowSubmitForm(false);
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'Chờ duyệt':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Đã duyệt':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Từ chối':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6" id="proposals_manager_section">
      
      {/* Module introduction banner */}
      <div className="bg-slate-900 p-5 rounded-md text-white border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-amber-500">
        <div className="space-y-1 text-left">
          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold rounded-xs uppercase tracking-wider border border-amber-500/20 font-mono">
            Cấp độ liên kết đề xuất
          </span>
          <h2 className="text-sm md:text-base font-extrabold font-sans uppercase tracking-wider pt-1">
            Hộp thư tiếp nhận & Đăng tải đề xuất tự động
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-2xl">
            Cho phép các cán bộ đầu mối từ vụ cục địa phương gửi đề xuất điều chỉnh hoặc đăng tải tài liệu mới lên hệ thống. Quản trị viên phê duyệt có thể liên kết trực tiếp vào cơ sở dữ liệu chung.
          </p>
        </div>
        <button
          onClick={() => setShowSubmitForm(true)}
          className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold px-4 py-2.5 rounded-sm transition-colors cursor-pointer shrink-0 flex items-center justify-center space-x-1.5"
        >
          <Mail className="h-4 w-4" />
          <span>Gửi đề xuất mới</span>
        </button>
      </div>

      {/* Main Proposals List */}
      <div className="bg-white rounded-md border border-slate-200 overflow-hidden" id="proposals_list_card">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">
            Danh sách đề xuất từ cán bộ đầu mối
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm font-mono border border-slate-250">
            Tổng: {proposals.length} đề xuất
          </span>
        </div>

        <div className="divide-y divide-slate-150">
          {proposals.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs font-medium space-y-1 font-sans">
              <AlertCircle className="h-6 w-6 text-slate-300 mx-auto" />
              <p>Hiện không có đề xuất nào trong hàng đợi.</p>
            </div>
          ) : (
            proposals.map(prop => (
              <div
                key={prop.id}
                className="p-4 hover:bg-slate-50/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                id={`proposal_item_${prop.id}`}
              >
                {/* Proposal general info */}
                <div className="space-y-1.5 flex-1 text-left">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 text-[9px] font-bold rounded-xs font-mono uppercase tracking-wider">
                      {prop.category}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-xs border uppercase tracking-wider font-mono ${statusBadge(prop.status)}`}>
                      {prop.status}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">SỐ HIỆU: {prop.docNumber}</span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-xs md:text-sm leading-snug">
                    {prop.title}
                  </h4>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center text-slate-500 font-bold">
                      <User className="h-3.5 w-3.5 mr-1 text-slate-400" />
                      NGƯỜI GỬI: {prop.proposedBy}
                    </span>
                    <span>•</span>
                    <span className="flex items-center font-bold">
                      <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
                      NGÀY GỬI: {new Date(prop.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>

                {/* Proposal actions */}
                {prop.status === 'Chờ duyệt' && (
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => onRejectProposal(prop.id)}
                      className="border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-sm transition-colors cursor-pointer"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => handleOpenApproval(prop)}
                      className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold px-4 py-2 rounded-sm transition-colors cursor-pointer flex items-center space-x-1"
                    >
                      <Check className="h-4 w-4" />
                      <span>Xét duyệt & Đăng tải</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Approval/Promotion Overlay Form */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-md border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs md:text-sm uppercase tracking-wider font-sans flex items-center">
                <Check className="h-4 w-4 text-emerald-600 mr-2" />
                Duyệt & Đăng tải văn bản
              </h3>
              <button onClick={() => setSelectedProposal(null)} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="p-5 space-y-4">
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-1 text-left border-l-4 border-l-amber-500">
                <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block font-mono">Văn bản đang duyệt</span>
                <h4 className="font-extrabold text-slate-900 text-xs font-sans">{selectedProposal.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-h-24 overflow-y-auto italic font-sans pt-1">
                  "{selectedProposal.fullText}"
                </p>
              </div>

              {/* Set Destination Folder */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Chọn Thư mục đích trong kho dữ liệu</label>
                <select
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white"
                  required
                >
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Assign Tags */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Gán Nhãn lưu trữ (phân tách bằng dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: thanh toán, thẻ POS, luật tín dụng"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-md flex items-start space-x-2.5 text-left">
                <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-indigo-900 block font-sans">Kích hoạt Phân tích Groq AI</span>
                  <p className="text-[10px] text-indigo-600 leading-relaxed font-sans">
                    Hệ thống sẽ tự động gửi tài liệu đến Groq để trích lọc các tác động pháp lý & yêu cầu tuân thủ cho Banker trên trang tìm kiếm chung.
                  </p>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setSelectedProposal(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 px-4 py-2 rounded-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingApprove}
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold px-5 py-2.5 rounded-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>Phê duyệt & Xuất bản ngay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Proposal Submission Portal */}
      {showSubmitForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-md border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-xs md:text-sm uppercase tracking-wider font-sans">
                Gửi đề xuất tài liệu mới (Focal Point Portal)
              </h3>
              <button onClick={() => setShowSubmitForm(false)} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleNewProposalSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Proposed By Email */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Email cán bộ đầu mối</label>
                  <input
                    type="email"
                    value={proposedByEmail}
                    onChange={(e) => setProposedByEmail(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono bg-slate-50"
                    required
                  />
                </div>

                {/* Category selection */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Phân loại tài liệu</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-sans"
                  >
                    <option value="QPPL">Văn bản QPPL</option>
                    <option value="QuyetDinhThanhTra">Quyết định thanh tra</option>
                    <option value="KetLuanThanhTra">Kết luận thanh tra</option>
                    <option value="ChiDaoNHNN">Chỉ đạo hành chính NHNN</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Tiêu đề đề xuất</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đề xuất dự thảo nâng mức thanh toán hạn mức tín dụng..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-slate-50/50"
                  required
                />
              </div>

              {/* Row: Doc Number & Agency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Số hiệu / Dự thảo</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Công văn 3512/NHNN"
                    value={newDocNumber}
                    onChange={(e) => setNewDocNumber(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Cơ quan kiến nghị / đề xuất</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Vụ Thanh toán NHNN"
                    value={newAgency}
                    onChange={(e) => setNewAgency(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 focus:outline-hidden focus:ring-1 focus:ring-brand-primary bg-slate-50/50 font-sans"
                  />
                </div>
              </div>

              {/* Content Textarea */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Nội dung văn bản chi tiết đề xuất</label>
                <textarea
                  placeholder="Dán toàn văn tài liệu gốc cần được đưa vào lưu trữ..."
                  value={newFullText}
                  onChange={(e) => setNewFullText(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-3 h-40 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono leading-relaxed bg-slate-50/50"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-150 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSubmitForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 px-4 py-2 rounded-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold px-5 py-2.5 rounded-sm transition-colors flex items-center cursor-pointer"
                >
                  <Mail className="h-4 w-4 mr-1.5" />
                  Gửi đề xuất
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
