import React, { useState, useEffect } from 'react';
import { ChangeRequest, UserSession } from '../types';
import { 
  CheckCircle2, XCircle, Clock, ShieldCheck, User, FolderPlus, FilePlus, 
  FileText, Trash2, Edit3, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Check, X
} from 'lucide-react';

interface RequestsManagerProps {
  currentUser: UserSession;
  onRequestProcessed: () => void; // Trigger refresh of main documents/folders
}

export default function RequestsManager({ currentUser, onRequestProcessed }: RequestsManagerProps) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReasonModal, setRejectReasonModal] = useState<{ open: boolean; reqId: string; reason: string }>({
    open: false,
    reqId: '',
    reason: ''
  });

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/change-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data || []);
      }
    } catch (err) {
      console.error('Error fetching change requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/change-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        await fetchRequests();
        onRequestProcessed();
      } else {
        const err = await res.json();
        alert(err.error || 'Lỗi khi chấp nhận yêu cầu.');
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReasonModal.reqId || processingId) return;
    setProcessingId(rejectReasonModal.reqId);
    try {
      const res = await fetch(`/api/change-requests/${rejectReasonModal.reqId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReasonModal.reason.trim() || 'Quản trị viên từ chối phê duyệt' })
      });
      if (res.ok) {
        setRejectReasonModal({ open: false, reqId: '', reason: '' });
        await fetchRequests();
        onRequestProcessed();
      } else {
        const err = await res.json();
        alert(err.error || 'Lỗi khi hủy yêu cầu.');
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  const getRequestBadge = (type: string) => {
    switch (type) {
      case 'CREATE_DOCUMENT':
        return {
          label: 'Thêm văn bản mới',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: <FilePlus className="h-3.5 w-3.5 mr-1" />
        };
      case 'EDIT_DOCUMENT':
        return {
          label: 'Sửa văn bản',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <Edit3 className="h-3.5 w-3.5 mr-1" />
        };
      case 'DELETE_DOCUMENT':
        return {
          label: 'Xóa văn bản',
          color: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: <Trash2 className="h-3.5 w-3.5 mr-1" />
        };
      case 'CREATE_FOLDER':
        return {
          label: 'Tạo thư mục mới',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <FolderPlus className="h-3.5 w-3.5 mr-1" />
        };
      case 'DELETE_FOLDER':
        return {
          label: 'Xóa thư mục',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: <Trash2 className="h-3.5 w-3.5 mr-1" />
        };
      default:
        return {
          label: 'Yêu cầu thay đổi',
          color: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: <FileText className="h-3.5 w-3.5 mr-1" />
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Banner Notice */}
      <div className="bg-slate-900 text-white p-5 rounded-xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-amber-400/20 text-amber-300 rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="text-base font-bold uppercase tracking-wide">
              Khu vực quản lý & Tổng hợp yêu cầu phê duyệt
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            {currentUser.role === 'admin' 
              ? 'Trực tiếp rà soát, kiểm tra nội dung và chấp nhận hoặc hủy bỏ các yêu cầu thêm/sửa/xóa văn bản & thư mục từ cán bộ khách.'
              : 'Theo dõi tiến độ phê duyệt từ Quản trị viên đối với các yêu cầu đề xuất thay đổi tài liệu và danh mục thư mục.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 text-xs">
          <span className="text-slate-400 font-medium">Tài khoản hiện tại:</span>
          <span className={`font-bold px-2 py-0.5 rounded text-[11px] flex items-center ${
            currentUser.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {currentUser.role === 'admin' ? <ShieldCheck className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
            {currentUser.name} ({currentUser.role === 'admin' ? 'Admin' : 'Khách'})
          </span>
        </div>
      </div>

      {/* Filter Stats Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setFilterStatus('PENDING')}
          className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
            filterStatus === 'PENDING'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Chờ duyệt</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{pendingCount}</div>
          {pendingCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          )}
        </button>

        <button
          onClick={() => setFilterStatus('APPROVED')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filterStatus === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold uppercase tracking-wider">Đã chấp nhận</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{approvedCount}</div>
        </button>

        <button
          onClick={() => setFilterStatus('REJECTED')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filterStatus === 'REJECTED'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-bold uppercase tracking-wider">Đã hủy bỏ</span>
            <XCircle className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-rose-900 mt-1">{rejectedCount}</div>
        </button>

        <button
          onClick={() => setFilterStatus('ALL')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filterStatus === 'ALL'
              ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Tất cả yêu cầu</span>
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">{requests.length}</div>
        </button>
      </div>

      {/* Main Request List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Danh sách yêu cầu ({filteredRequests.length})
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              Trạng thái: {filterStatus === 'ALL' ? 'Tất cả' : filterStatus === 'PENDING' ? 'Chờ Admin duyệt' : filterStatus === 'APPROVED' ? 'Đã chấp nhận' : 'Đã hủy'}
            </span>
          </div>

          <button
            onClick={fetchRequests}
            className="text-xs text-slate-600 hover:text-brand-primary flex items-center space-x-1 font-medium bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-brand-primary' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-brand-primary" />
            Đang tải dữ liệu yêu cầu phê duyệt...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Không có yêu cầu nào trong danh sách này.</p>
            <p className="text-[11px] text-slate-400">
              {filterStatus === 'PENDING' ? 'Hiện tại không có yêu cầu nào đang chờ xử lý.' : 'Vui lòng chọn bộ lọc khác.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRequests.map((req) => {
              const badge = getRequestBadge(req.requestType);
              const isExpanded = expandedReqId === req.id;

              return (
                <div key={req.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    
                    {/* Left details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.icon}
                          {badge.label}
                        </span>

                        {req.status === 'PENDING' && (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="h-3 w-3 mr-1 animate-pulse" />
                            Chờ Admin duyệt
                          </span>
                        )}
                        {req.status === 'APPROVED' && (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Đã chấp nhận
                          </span>
                        )}
                        {req.status === 'REJECTED' && (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="h-3 w-3 mr-1" />
                            Đã hủy bỏ
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(req.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {req.targetName || req.payload?.title || req.payload?.name || 'Yêu cầu thay đổi'}
                      </h4>

                      <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-mono">
                        <span className="flex items-center text-slate-600">
                          <User className="h-3 w-3 mr-1 text-slate-400" />
                          Người gửi: <strong className="ml-1 text-slate-700 font-sans">{req.requestedBy}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                        className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded font-medium flex items-center space-x-1"
                      >
                        <span>{isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {/* Admin Approve / Reject controls */}
                      {currentUser.role === 'admin' && req.status === 'PENDING' && (
                        <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={processingId === req.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center space-x-1 shadow-2xs transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Chấp nhận</span>
                          </button>
                          <button
                            onClick={() => setRejectReasonModal({ open: true, reqId: req.id, reason: '' })}
                            disabled={processingId === req.id}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center space-x-1 shadow-2xs transition-colors disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Hủy bỏ</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Payload Detail */}
                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2 animate-fade-in">
                      <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-brand-primary border-b border-slate-200 pb-1">
                        Chi tiết nội dung yêu cầu
                      </div>

                      {req.payload ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {req.payload.category && (
                            <div>
                              <span className="text-slate-400 font-mono text-[10px]">Phân loại:</span>{' '}
                              <strong className="text-slate-800">{req.payload.category}</strong>
                            </div>
                          )}
                          {req.payload.docNumber && (
                            <div>
                              <span className="text-slate-400 font-mono text-[10px]">Số văn bản:</span>{' '}
                              <strong className="text-slate-800">{req.payload.docNumber}</strong>
                            </div>
                          )}
                          {req.payload.agency && (
                            <div>
                              <span className="text-slate-400 font-mono text-[10px]">Cơ quan ban hành:</span>{' '}
                              <strong className="text-slate-800">{req.payload.agency}</strong>
                            </div>
                          )}
                          {req.payload.specialization && (
                            <div>
                              <span className="text-slate-400 font-mono text-[10px]">Lĩnh vực chuyên môn:</span>{' '}
                              <strong className="text-indigo-700">{req.payload.specialization}</strong>
                            </div>
                          )}
                          {req.payload.issueDate && (
                            <div>
                              <span className="text-slate-400 font-mono text-[10px]">Ngày ban hành:</span>{' '}
                              <span className="font-mono text-slate-800">{req.payload.issueDate}</span>
                            </div>
                          )}
                          {req.payload.name && req.requestType.includes('FOLDER') && (
                            <div>
                              <span className="text-slate-400 font-mono text-[10px]">Tên thư mục tạo:</span>{' '}
                              <strong className="text-slate-800">{req.payload.name}</strong>
                            </div>
                          )}
                          
                          {req.payload.fullText && (
                            <div className="col-span-1 md:col-span-2 mt-1">
                              <span className="text-slate-400 font-mono text-[10px] block mb-0.5">Trích lục nội dung văn bản:</span>
                              <div className="p-2.5 bg-white rounded border border-slate-200 max-h-36 overflow-y-auto text-[11px] font-mono whitespace-pre-wrap leading-relaxed text-slate-800">
                                {req.payload.fullText}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500 italic text-[11px]">Không có dữ liệu payload mở rộng.</p>
                      )}

                      {req.rejectedReason && (
                        <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">
                          <strong>Lý do từ chối:</strong> {req.rejectedReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectReasonModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 font-sans animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900 flex items-center text-rose-600">
              <XCircle className="h-5 w-5 mr-1.5" />
              Xác nhận hủy bỏ yêu cầu
            </h3>
            <p className="text-xs text-slate-600">
              Vui lòng nhập lý do hủy bỏ yêu cầu để ghi nhận lịch sử xử lý cho cán bộ gửi.
            </p>
            <textarea
              rows={3}
              value={rejectReasonModal.reason}
              onChange={(e) => setRejectReasonModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="VD: Thông tin văn bản chưa đủ điều kiện công bố hoặc trùng lặp..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setRejectReasonModal({ open: false, reqId: '', reason: '' })}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Hủy thao tác
              </button>
              <button
                onClick={handleRejectConfirm}
                className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-md hover:bg-rose-700 shadow-xs"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
