/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Document, Folder, Inspector, Proposal, DashboardStats, UserSession, SearchResult } from './types';
import DashboardOverview from './components/DashboardOverview';
import FolderTree, { getSafeIdStr } from './components/FolderTree';
import DocumentSearch from './components/DocumentSearch';
import DocumentDetail from './components/DocumentDetail';
import DocumentForm from './components/DocumentForm';
import InspectorRoster from './components/InspectorRoster';
import ProposalsManager from './components/ProposalsManager';
import RequestsManager from './components/RequestsManager';
import LoginModal from './components/LoginModal';
import { 
  LayoutDashboard, FolderSearch, Users, MailOpen, PlusCircle, Sparkles, Database, ShieldAlert,
  MessageSquare, Home, Heart, User, Smartphone, Laptop, ChevronRight, FileText, Filter, 
  ArrowLeft, Clock, Send, Share2, Search, Mic, Activity, Trash2, Edit2, ShieldCheck, Download,
  Lock, LogIn
} from 'lucide-react';

const withoutId = <T extends { id?: unknown }>(record: T): Omit<T, 'id'> => {
  const { id, ...data } = record;
  return data;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explorer' | 'inspectors' | 'proposals' | 'requests'>('dashboard');
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    const saved = localStorage.getItem('nhnn_user_session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { role: 'guest', name: 'Cán bộ Khách' };
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingChangeRequestsCount, setPendingChangeRequestsCount] = useState(0);

  // View Modes & UI States
  const [deviceMode, setDeviceMode] = useState<'laptop' | 'mobile'>('laptop');
  const [mobileTab, setMobileTab] = useState<'home' | 'search' | 'chat' | 'inspectors' | 'profile'>('home');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Xin kính chào Thống đốc và các đồng chí cán bộ Ngân hàng Nhà nước! Tôi là **Trợ lý AI Pháp lý chuyên ngành**. Bạn cần tra cứu điều khoản, hành vi hay quy định tuân thủ nào hôm nay?',
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Data State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  // Search state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<any>({});

  // Active item details states
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<Document | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // UI States
  const [loading, setLoading] = useState(true);

  // 1. Initial Data Fetch
  const fetchData = async () => {
    try {
      const docsRes = await fetch('/api/documents');
      const docsData = await docsRes.json();
      setDocuments(docsData.documents || []);
      setFolders(docsData.folders || []);

      const insRes = await fetch('/api/inspectors');
      const insData = await insRes.json();
      setInspectors(insData || []);

      const propRes = await fetch('/api/proposals');
      const propData = await propRes.json();
      setProposals(propData || []);

      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch pending change requests count
      fetchPendingRequestsCount();

      // Trigger initial empty search to populate results list
      handleSearch('', { folderId: selectedFolderId });

    } catch (err) {
      console.error('Error fetching dashboard database records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequestsCount = async () => {
    try {
      const res = await fetch('/api/change-requests');
      if (res.ok) {
        const data = await res.json();
        const pending = (data || []).filter((r: any) => r.status === 'PENDING').length;
        setPendingChangeRequestsCount(pending);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update search results whenever folder or docs change
  useEffect(() => {
    handleSearch(currentSearchQuery, { ...currentFilters, folderId: selectedFolderId });
  }, [selectedFolderId, documents]);

  // Compute live document counts per folder (including child folder contents)
  const getDocumentCounts = () => {
    const counts: { [fid: string]: number } = {};

    // 1. Initialize counts using safe string IDs
    folders.forEach(f => {
      const fIdStr = getSafeIdStr(f.id);
      counts[fIdStr] = 0;
    });

    // 2. Count direct documents
    documents.forEach(doc => {
      const docFolderIdStr = getSafeIdStr(doc.folderId);
      if (counts[docFolderIdStr] !== undefined) {
        counts[docFolderIdStr]++;
      }
    });

    // 3. Bubble counts up to parent folders recursively
    const bubbleUp = (folderId: string, count: number) => {
      if (count === 0) return; // Quick optimization: skip bubbling if there's nothing to add

      const folder = folders.find(f => getSafeIdStr(f.id) === folderId);

      if (folder) {
        const parentIdStr = getSafeIdStr(folder.parentId);

        if (parentIdStr && parentIdStr !== '') {
          counts[parentIdStr] = (counts[parentIdStr] || 0) + count;
          bubbleUp(parentIdStr, count);
        }
      }
    };

    // 4. Trigger the bubble up for each folder's direct document count
    folders.forEach(f => {
      const fIdStr = getSafeIdStr(f.id);
      const directCount = documents.filter(d => getSafeIdStr(d.folderId) === fIdStr).length;

      bubbleUp(fIdStr, directCount);
    });

    return counts;
  };

  // 2. Search trigger
  const handleSearch = async (query: string, filters: any) => {
    setCurrentSearchQuery(query);
    setCurrentFilters(filters);
    
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (filters.category) params.append('category', filters.category);
      if (filters.folderId) params.append('folderId', filters.folderId);
      if (filters.status) params.append('status', filters.status);
      if (filters.agency) params.append('agency', filters.agency);
      if (filters.specialization) params.append('specialization', filters.specialization);
      if (filters.year) params.append('year', String(filters.year));

      const response = await fetch(`/api/documents/search?${params.toString()}`);
      const data = await response.json();
      setSearchResults(data || []);
    } catch (err) {
      console.error('BM25 backend query error:', err);
    }
  };

  // 3. Document operations
  const handleSaveDocument = async (docData: any, autoSummarize: boolean) => {
    setLoading(true);
    try {
      const documentId = docData.id as string | undefined;
      const documentPayload = withoutId(docData);

      // Guest Role check -> Submit Change Request
      if (currentUser.role === 'guest') {
        const isEdit = !!documentId;
        const reqType = isEdit ? 'EDIT_DOCUMENT' : 'CREATE_DOCUMENT';
        const res = await fetch('/api/change-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: reqType,
            ...(documentId ? { targetId: documentId } : {}),
            targetName: docData.title,
            payload: documentPayload,
            requestedBy: currentUser.name
          })
        });

        if (res.ok) {
          alert(`Đã gửi yêu cầu ${isEdit ? 'chỉnh sửa' : 'thêm mới'} văn bản "${docData.title}" tới Admin phê duyệt. Văn bản sẽ chính thức xuất hiện sau khi Admin chấp nhận.`);
          setDocumentToEdit(null);
          setShowCreateForm(false);
          fetchPendingRequestsCount();
        } else {
          alert('Không thể gửi yêu cầu phê duyệt.');
        }
        setLoading(false);
        return;
      }

      // Admin Role -> Direct Save
      const url = documentId ? `/api/documents/${documentId}` : '/api/documents';
      const method = documentId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc: documentPayload,
          autoSummarize,
        }),
      });

      if (response.ok) {
        const savedDoc = await response.json();
        // Update local list
        if (documentId) {
          setDocuments(prev => prev.map(d => d.id === savedDoc.id ? savedDoc : d));
          if (selectedDocument?.id === savedDoc.id) setSelectedDocument(savedDoc);
        } else {
          setDocuments(prev => [...prev, savedDoc]);
        }
        
        // Refresh dashboard statistics
        const statsRes = await fetch('/api/stats');
        const statsData = await statsRes.json();
        setStats(statsData);

        setDocumentToEdit(null);
        setShowCreateForm(false);
      } else {
        alert('Có lỗi xảy ra khi lưu tài liệu.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    const docToDelete = documents.find(d => d.id === id);
    if (!docToDelete) return;

    if (currentUser.role === 'guest') {
      try {
        const res = await fetch('/api/change-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: 'DELETE_DOCUMENT',
            targetId: id,
            targetName: docToDelete.title,
            requestedBy: currentUser.name
          })
        });

        if (res.ok) {
          alert(`Đã gửi yêu cầu xóa văn bản "${docToDelete.title}" tới Admin phê duyệt.`);
          setSelectedDocument(null);
          fetchPendingRequestsCount();
        } else {
          alert('Không thể gửi yêu cầu xóa.');
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Admin direct delete
    try {
      const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setDocuments(prev => prev.filter(d => d.id !== id));
        setSelectedDocument(null);
        
        const statsRes = await fetch('/api/stats');
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateDocumentDirect = (updatedDoc: Document) => {
    setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    setSelectedDocument(updatedDoc);
  };

  // 4. Folder operations
  const handleCreateFolder = async (name: string, parentId: string | null, path: string[] | null) => {
    if (currentUser.role === 'guest') {
      try {
        const res = await fetch('/api/change-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: 'CREATE_FOLDER',
            targetName: name,
            payload: { name, parentId, path },
            requestedBy: currentUser.name
          })
        });

        if (res.ok) {
          alert(`Đã gửi yêu cầu tạo thư mục "${name}" tới Admin phê duyệt.`);
          fetchPendingRequestsCount();
        } else {
          alert('Không thể gửi yêu cầu tạo thư mục.');
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Admin direct create
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId, path }),
      });
      if (response.ok) {
        const newFolder = await response.json();
        setFolders(prev => [...prev, newFolder]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const targetFolder = folders.find(f => f.id === folderId);
    if (!targetFolder) return;

    if (currentUser.role === 'guest') {
      try {
        const res = await fetch('/api/change-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: 'DELETE_FOLDER',
            targetId: folderId,
            targetName: targetFolder.name,
            requestedBy: currentUser.name
          })
        });

        if (res.ok) {
          alert(`Đã gửi yêu cầu xóa thư mục "${targetFolder.name}" tới Admin phê duyệt.`);
          fetchPendingRequestsCount();
        } else {
          alert('Không thể gửi yêu cầu xóa thư mục.');
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Admin direct delete
    try {
      const response = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      if (response.ok) {
        setFolders(prev => prev.filter(f => f.id !== folderId));
        if (selectedFolderId === folderId) setSelectedFolderId(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Không thể xóa thư mục này.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Inspectors operations
  const handleSaveInspector = async (ins: Inspector) => {
    try {
      const isEdit = inspectors.some(existing => existing.id === ins.id);
      const inspectorPayload = withoutId(ins);
      const response = await fetch(
        isEdit ? `/api/inspectors/${ins.id}` : '/api/inspectors',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inspectorPayload),
        },
      );
      if (response.ok) {
        const savedIns = await response.json();
        const exists = inspectors.some(i => i.id === savedIns.id);
        if (exists) {
          setInspectors(prev => prev.map(i => i.id === savedIns.id ? savedIns : i));
        } else {
          setInspectors(prev => [...prev, savedIns]);
        }
        
        // Refresh stats
        const statsRes = await fetch('/api/stats');
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteInspector = async (id: string) => {
    try {
      const response = await fetch(`/api/inspectors/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setInspectors(prev => prev.filter(i => i.id !== id));
        
        const statsRes = await fetch('/api/stats');
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 6. Proposals operations
  const handleApproveProposal = async (id: string, folderId: string, tags: string[]) => {
    try {
      const response = await fetch(`/api/proposals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, tags }),
      });
      if (response.ok) {
        const data = await response.json();
        // Update proposal status
        setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'Đã duyệt' } : p));
        // Add new permanent doc
        setDocuments(prev => [...prev, data.document]);
        
        // Refresh statistics
        const statsRes = await fetch('/api/stats');
        const statsData = await statsRes.json();
        setStats(statsData);

        alert('Đã phê duyệt và xuất bản văn bản thành công!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectProposal = async (id: string) => {
    try {
      const response = await fetch(`/api/proposals/${id}/reject`, { method: 'POST' });
      if (response.ok) {
        setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'Từ chối' } : p));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitNewProposal = async (prop: any) => {
    try {
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withoutId(prop)),
      });
      if (response.ok) {
        const newProp = await response.json();
        setProposals(prev => [...prev, newProp]);
        alert('Đã gửi đề xuất cập nhật tài liệu lên hệ thống ban ngành!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNavigateToCategory = (cat: string) => {
    setActiveTab('explorer');
    setSelectedFolderId(null);
    handleSearch('', { category: cat });
  };

  const handleSendChatMessage = async (msgText: string) => {
    if (!msgText.trim()) return;
    
    const userMsg = { id: 'user_' + Date.now(), role: 'user', content: msgText };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: msgText,
          history: chatMessages.slice(-6).map(m => ({ role: m.role, content: m.content })) // limit history context slightly
        })
      });
      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, {
          id: 'ai_' + Date.now(),
          role: 'assistant',
          content: data.answer,
          citations: data.citations
        }]);
      } else {
        const errData = await response.json();
        setChatMessages(prev => [...prev, {
          id: 'ai_err_' + Date.now(),
          role: 'assistant',
          content: `❌ Gặp sự cố kết nối: ${errData.error || 'Vui lòng kiểm tra lại cấu hình GROQ_API_KEY.'}`
        }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, {
        id: 'ai_err_' + Date.now(),
        role: 'assistant',
        content: '❌ Lỗi kết nối máy chủ dịch vụ. Vui lòng thử lại sau.'
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const renderMobileHome = () => {
    const latestDocs = [...documents].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()).slice(0, 3);
    
    return (
      <div className="space-y-4 animate-fade-in font-sans">
        {/* Hero Banner Area */}
        <div className="bg-brand-primary text-white px-4 pt-5 pb-6 text-center shadow-md relative" id="mobile_hero_banner">
          <span className="text-[9px] uppercase tracking-widest text-amber-300 font-bold block mb-1">Thanh tra Ngân hàng Nhà nước Khu vực 9</span>
          <h2 className="text-sm font-extrabold tracking-tight uppercase leading-snug">Tra cứu văn bản pháp luật</h2>
          <p className="text-[10px] text-slate-200 mt-1 font-medium">Ngân hàng Nhà nước Chi nhánh Khu vực 9</p>
          
          {/* Embedded Input triggering Search Tab */}
          <div 
            onClick={() => setMobileTab('search')}
            className="mt-4 bg-white rounded-full p-2.5 flex items-center shadow-md border border-slate-100 text-slate-400 cursor-pointer"
          >
            <Search className="h-4 w-4 text-slate-400 mr-2" />
            <span className="text-[11px] font-medium flex-1 text-left">Nhập số ký hiệu, tiêu đề hoặc từ khóa...</span>
            <Mic className="h-4 w-4 text-brand-primary shrink-0" />
          </div>
        </div>

        {/* Quick Bento Grid Actions */}
        <div className="px-4 space-y-2 text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Truy cập nhanh</span>
          <div className="grid grid-cols-2 gap-2">
            <div 
              onClick={() => setMobileTab('chat')}
              className="bg-white border border-slate-200/80 p-3 rounded-xl flex items-center space-x-2.5 shadow-xs hover:bg-slate-50 cursor-pointer text-left"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold text-slate-800 block">Hỏi AI</span>
                <span className="text-[9px] text-slate-400 block font-sans">Trợ lý Pháp lý</span>
              </div>
            </div>

            <div 
              onClick={() => setMobileTab('search')}
              className="bg-white border border-slate-200/80 p-3 rounded-xl flex items-center space-x-2.5 shadow-xs hover:bg-slate-50 cursor-pointer text-left"
            >
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                <FolderSearch className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold text-slate-800 block">Tra cứu</span>
                <span className="text-[9px] text-slate-400 block font-sans">Kho tài liệu</span>
              </div>
            </div>

            <div 
              onClick={() => {
                setMobileTab('search');
                handleSearch('', { year: 2025 });
              }}
              className="bg-white border border-slate-200/80 p-3 rounded-xl flex items-center space-x-2.5 shadow-xs hover:bg-slate-50 cursor-pointer text-left"
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold text-slate-800 block">Mới nhất</span>
                <span className="text-[9px] text-slate-400 block font-sans">Năm 2025</span>
              </div>
            </div>

            <div 
              onClick={() => setMobileTab('inspectors')}
              className="bg-white border border-slate-200/80 p-3 rounded-xl flex items-center space-x-2.5 shadow-xs hover:bg-slate-50 cursor-pointer text-left"
            >
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold text-slate-800 block">Cán bộ</span>
                <span className="text-[9px] text-slate-400 block font-sans">Trực đoàn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Grid List */}
        <div className="px-4 space-y-2 text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Danh mục tra cứu</span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Lãi suất', query: 'lãi suất' },
              { label: 'Cho vay', query: 'cho vay' },
              { label: 'Rửa tiền', query: 'rửa tiền' },
              { label: 'Quỹ TDND', query: 'quỹ tín dụng' },
              { label: 'Thanh tra', query: 'thanh tra' },
              { label: 'Xử phạt', query: 'xử phạt' },
              { label: 'NHNN', agency: 'Ngân hàng Nhà nước' },
              { label: 'Công văn', category: 'ChiDaoNHNN' }
            ].map((cat, i) => (
              <button
                key={i}
                onClick={() => {
                  setMobileTab('search');
                  if (cat.query) {
                    handleSearch(cat.query, {});
                  } else if (cat.agency) {
                    handleSearch('', { agency: cat.agency });
                  } else if (cat.category) {
                    handleSearch('', { category: cat.category });
                  }
                }}
                className="bg-white border border-slate-200 rounded-lg p-2 flex flex-col items-center justify-center text-center shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-brand-primary text-xs font-bold mb-1">
                  {cat.label.slice(0, 2)}
                </div>
                <span className="text-[9px] font-bold text-slate-700 leading-tight block truncate w-full">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Latest Documents Feed */}
        <div className="px-4 space-y-2 text-left">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Mới cập nhật</span>
            <button 
              onClick={() => {
                setMobileTab('search');
                handleSearch('', {});
              }}
              className="text-[10px] text-brand-primary font-bold hover:underline"
            >
              Xem tất cả
            </button>
          </div>
          <div className="space-y-2">
            {latestDocs.map(doc => (
              <div 
                key={doc.id}
                onClick={() => setSelectedDocument(doc)}
                className="bg-white border border-slate-150 p-3 rounded-lg flex items-start space-x-3 shadow-xs hover:border-brand-primary transition-colors cursor-pointer text-left"
              >
                <div className="p-1.5 rounded bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                      {doc.category === 'QPPL' ? 'Thông tư' : 'Chỉ đạo'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-medium">{doc.issueDate}</span>
                  </div>
                  <h4 className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-snug mt-1">{doc.title}</h4>
                  <p className="text-[9px] text-slate-500 mt-1 font-mono">Số hiệu: {doc.docNumber || 'Không rõ'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMobileSearch = () => {
    return (
      <div className="px-4 pt-3 space-y-3 animate-fade-in font-sans text-left">
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center">
          <FolderSearch className="h-4.5 w-4.5 mr-1.5 text-brand-primary" />
          Kho văn bản tra cứu
        </h3>

        {/* Input & Filter Controls */}
        <div className="flex space-x-2">
          <div className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center">
            <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Tìm theo số hiệu, tên, nội dung..."
              value={currentSearchQuery}
              onChange={(e) => handleSearch(e.target.value, currentFilters)}
              className="text-xs bg-transparent focus:outline-hidden w-full placeholder-slate-400 font-medium text-slate-800"
            />
          </div>
          <button 
            onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
            className={`p-2 border rounded-lg shrink-0 transition-colors ${
              isMobileFilterOpen || Object.keys(currentFilters).length > 0
                ? 'border-brand-primary bg-blue-50 text-brand-primary'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {isMobileFilterOpen && (
          <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-3 text-xs animate-fade-in" id="mobile_advanced_filters">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[9px] font-mono">Bộ lọc chuyên sâu</span>
              <button 
                onClick={() => {
                  handleSearch('', {});
                  setIsMobileFilterOpen(false);
                }}
                className="text-[9px] text-red-600 font-bold hover:underline"
              >
                Xóa bộ lọc
              </button>
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Loại văn bản</label>
              <select
                value={currentFilters.category || ''}
                onChange={(e) => handleSearch(currentSearchQuery, { ...currentFilters, category: e.target.value || undefined })}
                className="w-full text-xs border border-slate-200 rounded-sm p-1.5 bg-slate-50"
              >
                <option value="">Tất cả phân loại</option>
                <option value="QPPL">Văn bản Quy phạm Pháp luật (QPPL)</option>
                <option value="QuyetDinhThanhTra">Quyết định thanh tra</option>
                <option value="KetLuanThanhTra">Kết luận thanh tra</option>
                <option value="ChiDaoNHNN">Chỉ đạo NHNN</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Cơ quan ban hành</label>
              <input
                type="text"
                placeholder="Ví dụ: Quốc hội, Chính phủ, NHNN..."
                value={currentFilters.agency || ''}
                onChange={(e) => handleSearch(currentSearchQuery, { ...currentFilters, agency: e.target.value || undefined })}
                className="w-full text-xs border border-slate-200 rounded-sm p-1.5 bg-slate-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Lĩnh vực chuyên môn</label>
              <select
                value={currentFilters.specialization || ''}
                onChange={(e) => handleSearch(currentSearchQuery, { ...currentFilters, specialization: e.target.value || undefined })}
                className="w-full text-xs border border-slate-200 rounded-sm p-1.5 bg-slate-50"
              >
                <option value="">Tất cả lĩnh vực</option>
                <option value="Tín dụng & Quản lý rủi ro">Tín dụng & Quản lý rủi ro</option>
                <option value="Phòng chống rửa tiền">Phòng chống rửa tiền</option>
                <option value="An toàn hệ thống">An toàn hệ thống</option>
                <option value="Thanh toán & Công nghệ số">Thanh toán & Công nghệ số</option>
                <option value="Hoạt động ngoại hối & Vàng">Hoạt động ngoại hối & Vàng</option>
                <option value="Chế độ kế toán & Kho quỹ">Chế độ kế toán & Kho quỹ</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Năm ban hành</label>
              <input
                type="number"
                placeholder="Ví dụ: 2024, 2025"
                value={currentFilters.year || ''}
                onChange={(e) => handleSearch(currentSearchQuery, { ...currentFilters, year: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full text-xs border border-slate-200 rounded-sm p-1.5 bg-slate-50 font-mono"
              />
            </div>
          </div>
        )}

        {/* Found statistics */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium px-0.5">
          <span>Tìm thấy <strong>{searchResults.length}</strong> kết quả phù hợp</span>
          {Object.keys(currentFilters).length > 0 && (
            <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold font-mono">Đang áp dụng bộ lọc</span>
          )}
        </div>

        {/* Results List */}
        <div className="space-y-2 pb-6">
          {searchResults.map(result => {
            const doc = result.document;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocument(doc)}
                className="bg-white border border-slate-150 p-3.5 rounded-lg text-left shadow-xs hover:border-brand-primary transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[8px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {doc.category === 'QPPL' ? 'QPPL' : doc.category === 'QuyetDinhThanhTra' ? 'QĐ Thanh tra' : doc.category === 'KetLuanThanhTra' ? 'KL Thanh tra' : 'Chỉ đạo NHNN'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">{doc.issueDate}</span>
                </div>
                <h4 className="text-[11px] font-extrabold text-slate-900 leading-snug">{doc.title}</h4>
                <div className="flex flex-wrap items-center justify-between text-[9px] text-slate-400 font-mono pt-1 gap-1">
                  <div className="flex items-center space-x-2">
                    <span>Số: {doc.docNumber || 'N/A'}</span>
                    {doc.specialization && (
                      <span className="text-[8px] font-sans font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {doc.specialization}
                      </span>
                    )}
                  </div>
                  <span className="font-sans font-semibold text-slate-500">{doc.agency}</span>
                </div>
                
                {/* Result Snippet Highlight */}
                {result.matchSnippet && (
                  <p className="text-[9px] bg-slate-50 p-1.5 rounded text-slate-600 italic border-l-2 border-l-slate-300 leading-normal">
                    {result.matchSnippet}
                  </p>
                )}
              </div>
            );
          })}
          {searchResults.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              <FolderSearch className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <span>Không tìm thấy tài liệu phù hợp</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMobileChat = () => {
    return (
      <div className="flex flex-col h-full bg-slate-50 text-left font-sans animate-fade-in relative">
        {/* Chat Banner Info */}
        <div className="bg-brand-primary text-white p-3 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4.5 w-4.5 text-amber-300 animate-pulse" />
            <div>
              <span className="text-[11px] font-extrabold block">Trợ lý AI Pháp lý NHNN</span>
              <span className="text-[8px] text-slate-200 block font-sans">Đã nạp {documents.length} văn bản • Groq AI</span>
            </div>
          </div>
          <button 
            onClick={() => setChatMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content: 'Hệ thống đã làm mới hội thoại. Tôi sẵn sàng hỗ trợ các câu hỏi của Thống đốc!',
              }
            ])}
            className="text-[9px] bg-white/15 px-2 py-1 rounded text-white font-bold hover:bg-white/20"
          >
            Làm mới
          </button>
        </div>

        {/* Conversation Logs */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 max-h-[500px]" id="chat_scroll_area">
          {chatMessages.map((msg, idx) => (
            <div 
              key={msg.id || idx}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
            >
              <span className="text-[8px] text-slate-400 font-mono font-bold uppercase tracking-wider px-1">
                {msg.role === 'user' ? 'Cán bộ Tuân thủ' : 'Hệ thống AI'}
              </span>
              <div 
                className={`max-w-[85%] rounded-2xl p-3 text-[11px] leading-relaxed shadow-xs ${
                  msg.role === 'user'
                    ? 'bg-brand-primary text-white rounded-tr-none'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-line prose max-w-none text-[11px]">
                  {msg.content}
                </div>
                
                {/* Citations list inside message */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-left">
                    <span className="text-[8px] font-bold text-slate-400 block uppercase tracking-wider font-mono">Nguồn trích dẫn:</span>
                    {msg.citations.slice(0, 2).map((cit: Document) => (
                      <button
                        key={cit.id}
                        onClick={() => setSelectedDocument(cit)}
                        className="text-[9px] font-bold text-indigo-600 hover:underline block text-left leading-tight"
                      >
                        • {cit.title} ({cit.docNumber})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isChatLoading && (
            <div className="flex items-center space-x-2 bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-xs max-w-[60%] animate-pulse">
              <Sparkles className="h-4 w-4 text-brand-primary animate-spin" />
              <span className="text-[10px] font-bold text-slate-500">AI đang tra cứu tài liệu...</span>
            </div>
          )}
        </div>

        {/* Recommended Starter Questions */}
        {chatMessages.length === 1 && (
          <div className="p-3 space-y-1.5 shrink-0 bg-slate-50/50 border-t border-slate-150">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Gợi ý chủ đề hỏi AI:</span>
            {[
              'Quy định về sở hữu chéo tại Luật các TCTD 2024 là gì?',
              'Sai phạm và mức phạt của Sacombank về rửa tiền?',
              'Điều kiện cơ cấu nợ theo Thông tư 02?'
            ].map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendChatMessage(q)}
                className="w-full text-left bg-white border border-slate-200 hover:border-brand-primary p-2 rounded-lg text-[10px] text-slate-700 font-medium shadow-xs transition-colors cursor-pointer leading-snug"
              >
                💡 {q}
              </button>
            ))}
          </div>
        )}

        {/* Chat input form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendChatMessage(chatInput);
          }}
          className="p-2 border-t border-slate-200 bg-white flex space-x-1.5 shrink-0"
        >
          <input
            type="text"
            placeholder="Hỏi AI về chính sách, rủi ro, tuân thủ..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isChatLoading}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-[11px] focus:outline-hidden focus:border-brand-primary text-slate-800"
          />
          <button
            type="submit"
            disabled={isChatLoading || !chatInput.trim()}
            className="p-2 bg-brand-primary text-white rounded-full hover:bg-brand-primary/95 transition-colors disabled:bg-slate-200 disabled:text-slate-400"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    );
  };

  const renderMobileInspectors = () => {
    return (
      <div className="px-4 pt-3 space-y-4 animate-fade-in font-sans text-left">
        {/* Tab Header */}
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center">
          <Users className="h-4.5 w-4.5 mr-1.5 text-brand-primary" />
          Cán bộ & Văn bản yêu thích
        </h3>

        {/* Section 1: Staff Online */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Đoàn thanh tra thường trực ({inspectors.length})</span>
          <div className="space-y-2">
            {inspectors.map(ins => (
              <div 
                key={ins.id}
                className="bg-white border border-slate-200 p-3 rounded-lg flex items-center justify-between shadow-xs"
              >
                <div>
                  <h4 className="text-[11px] font-bold text-slate-800">{ins.name}</h4>
                  <p className="text-[9px] text-slate-400 font-medium">{ins.role}</p>
                  <p className="text-[8px] text-slate-500 font-mono mt-0.5">{ins.department}</p>
                </div>
                <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold font-sans ${
                  ins.status === 'Sẵn sàng' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : ins.status === 'Đang công tác'
                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {ins.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Bookmarks */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Văn bản ưa thích lưu trữ</span>
          <div className="space-y-2">
            {documents.slice(0, 2).map(doc => (
              <div
                key={doc.id}
                onClick={() => setSelectedDocument(doc)}
                className="bg-white border border-slate-200 p-3 rounded-lg shadow-xs hover:border-brand-primary cursor-pointer text-left flex justify-between items-center"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <h4 className="text-[10px] font-bold text-slate-800 truncate">{doc.title}</h4>
                  <p className="text-[8px] text-slate-400 font-mono mt-0.5">{doc.docNumber || 'Không số hiệu'}</p>
                </div>
                <Heart className="h-3.5 w-3.5 text-red-500 fill-current shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMobileProfile = () => {
    return (
      <div className="px-4 pt-3 space-y-4 animate-fade-in font-sans text-left">
        {/* Profile Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-3 shadow-xs">
          <div className="h-10 w-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-extrabold text-sm">
            NV
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Nguyễn Văn A</h4>
            <p className="text-[9px] text-slate-400">Cán bộ Giám sát Tuân thủ Chuyên ban</p>
            <span className="text-[8px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-bold uppercase tracking-wider mt-1 inline-block">
              ● Kết nối nội bộ
            </span>
          </div>
        </div>

        {/* Aggregate Counters */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white border border-slate-200 p-2 rounded-lg text-center shadow-xs">
            <span className="text-sm font-extrabold text-brand-primary font-mono block">{documents.length}</span>
            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-wider font-mono">Văn bản gốc</span>
          </div>
          <div className="bg-white border border-slate-200 p-2 rounded-lg text-center shadow-xs">
            <span className="text-sm font-extrabold text-amber-600 font-mono block">{proposals.length}</span>
            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-wider font-mono">Đề xuất</span>
          </div>
          <div className="bg-white border border-slate-200 p-2 rounded-lg text-center shadow-xs">
            <span className="text-sm font-extrabold text-indigo-600 font-mono block">{inspectors.length}</span>
            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-wider font-mono">Cán bộ ban</span>
          </div>
        </div>

        {/* Actions Button */}
        <div className="space-y-2">
          <button 
            onClick={() => {
              setDocumentToEdit(null);
              setShowCreateForm(true);
            }}
            className="w-full bg-brand-primary hover:bg-brand-primary/95 text-white font-bold p-3 rounded-lg text-[11px] flex items-center justify-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Đăng tải tài liệu mới (AI Phân loại)</span>
          </button>
        </div>

        {/* Proposals review log status */}
        <div className="space-y-2 pb-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Nhật ký đề xuất của tôi ({proposals.length})</span>
          <div className="space-y-2">
            {proposals.map(p => (
              <div 
                key={p.id}
                className="bg-white border border-slate-200 p-3 rounded-lg flex items-center justify-between shadow-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <h4 className="text-[10px] font-bold text-slate-800 truncate">{p.title}</h4>
                  <p className="text-[8px] text-slate-400 font-mono mt-0.5">Người đề xuất: {p.proposedBy}</p>
                </div>
                <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold font-sans shrink-0 ${
                  p.status === 'Đã duyệt' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : p.status === 'Từ chối'
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                }`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMobileTabBar = () => {
    const tabsList = [
      { id: 'home' as const, label: 'Trang chủ', icon: Home },
      { id: 'search' as const, label: 'Tìm kiếm', icon: Search },
      { id: 'chat' as const, label: 'Hỏi AI', icon: Sparkles },
      { id: 'inspectors' as const, label: 'Cán bộ', icon: Users },
      { id: 'profile' as const, label: 'Cá nhân', icon: User }
    ];

    return (
      <div className="bg-white border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shrink-0 z-30 shadow-lg" id="phone_tabbar">
        {tabsList.map(tab => {
          const IconComponent = tab.icon;
          const isActive = mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setMobileTab(tab.id);
                if (tab.id === 'search') {
                  handleSearch(currentSearchQuery, currentFilters);
                }
              }}
              className="flex flex-col items-center justify-center text-center py-1 flex-1 cursor-pointer"
            >
              <IconComponent className={`h-4.5 w-4.5 mb-0.5 transition-all ${
                isActive ? 'text-brand-primary scale-110 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`} />
              <span className={`text-[8.5px] tracking-wide font-sans leading-none ${
                isActive ? 'text-brand-primary font-extrabold' : 'text-slate-400 font-medium'
              }`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col font-sans text-slate-800" id="main_app_wrapper">
      
      {/* Top Controls Viewport Bar (Sticky above standard application) */}
      <div className="bg-slate-900 text-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs shrink-0 font-sans font-medium" id="viewport_control_panel">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          <span>Hệ thống Giám sát & Tra cứu Văn bản Pháp quy NHNN</span>
        </div>
        <div className="flex items-center bg-slate-800 p-1 rounded-md border border-slate-700 shrink-0">
          <button
            onClick={() => setDeviceMode('laptop')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-sm text-[11px] font-bold transition-all cursor-pointer ${
              deviceMode === 'laptop' 
                ? 'bg-brand-primary text-white shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Laptop className="h-3.5 w-3.5" />
            <span>💻 Laptop View</span>
          </button>
          <button
            onClick={() => {
              setDeviceMode('mobile');
              setMobileTab('home');
            }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-sm text-[11px] font-bold transition-all cursor-pointer ${
              deviceMode === 'mobile' 
                ? 'bg-brand-primary text-white shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>📱 Mobile Preview</span>
          </button>
        </div>
      </div>

      {deviceMode === 'mobile' ? (
        <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 md:p-8 overflow-y-auto font-sans" id="mobile_preview_container">
          {/* Phone Chassis Container */}
          <div className="relative w-full max-w-[390px] h-[812px] bg-slate-900 rounded-[50px] shadow-[0_0_40px_rgba(0,0,0,0.8)] border-[12px] border-slate-800 flex flex-col overflow-hidden text-slate-900" id="phone_chassis">
            {/* iOS Dynamic Island / Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-center" id="phone_notch">
              <div className="w-2.5 h-2.5 bg-slate-900 rounded-full ml-auto mr-4" />
            </div>
            
            {/* Mobile Screen Wrapper */}
            <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden relative text-left" id="phone_screen">
              
              {/* Mobile StatusBar */}
              <div className="bg-brand-primary text-white px-6 pt-3 pb-1 flex justify-between items-center text-[10px] font-bold font-mono tracking-wider select-none z-30 shrink-0" id="phone_statusbar">
                <span>9:41</span>
                <div className="flex items-center space-x-1.5">
                  <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L16.35 6.22C15.13 4.19 13.72 3 12 3zm0 18c4.97 0 9-4.03 9-9 0-2.12-.74-4.07-1.97-5.61L7.65 17.78C8.87 19.81 10.28 21 12 21z"/></svg>
                  <span>5G</span>
                  <span className="border border-white/80 px-0.5 rounded-xs text-[7px] leading-none">100%</span>
                </div>
              </div>

              {/* SCREEN CONTENTS BASED ON ACTIVE TAB */}
              <div className="flex-1 overflow-y-auto pb-4" id="phone_content">
                {mobileTab === 'home' && renderMobileHome()}
                {mobileTab === 'search' && renderMobileSearch()}
                {mobileTab === 'chat' && renderMobileChat()}
                {mobileTab === 'inspectors' && renderMobileInspectors()}
                {mobileTab === 'profile' && renderMobileProfile()}
              </div>

              {/* Bottom sticky tab navigation bar */}
              {renderMobileTabBar()}

            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Main Navigation Header */}
          <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-40 shrink-0" id="app_header">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* National emblem-like dynamic badge */}
                <div className="h-10 w-10 rounded-full bg-amber-500/15 border-2 border-amber-500 flex items-center justify-center text-amber-400">
                  <Database className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-amber-400 font-bold tracking-widest uppercase block">Hệ thống tra cứu QPPL</span>
                  <h1 className="text-base md:text-lg font-extrabold tracking-tight font-sans">
                    State Bank Regulatory Database
                  </h1>
                </div>
              </div>

              {/* Quick Stats Indicator & Auth Badge (Desktop) */}
              <div className="hidden md:flex items-center space-x-5 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Cơ sở dữ liệu: <strong>{documents.length} văn bản</strong></span>
                </div>
                <div className="border-l border-slate-700 h-4" />

                {/* User Auth Badge & Switch Modal Button */}
                <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                    currentUser.role === 'admin' 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {currentUser.role === 'admin' ? <ShieldCheck className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                    {currentUser.role === 'admin' ? 'ADMIN' : 'KHÁCH'}
                  </span>
                  <span className="font-bold text-slate-100 text-xs truncate max-w-[120px]">
                    {currentUser.name}
                  </span>
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="ml-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold hover:underline flex items-center space-x-1 pl-1.5 border-l border-slate-700"
                  >
                    <LogIn className="h-3 w-3" />
                    <span>Đổi tài khoản</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Grid: Left Navigation / Right Content Container */}
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex-1 py-6 flex flex-col md:flex-row gap-6">
            
            {/* Left Side Tab Roster Panel */}
            <aside className="w-full md:w-60 shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0" id="app_aside_menu">
              
              {/* Dashboard Tab */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer w-full text-left shrink-0 md:shrink ${
                  activeTab === 'dashboard'
                    ? 'bg-brand-primary text-white shadow-xs font-medium'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Trang Tổng quan</span>
              </button>

              {/* Document Explorer Tab */}
              <button
                onClick={() => {
                  setActiveTab('explorer');
                  setSelectedFolderId(null);
                  handleSearch('', {});
                }}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer w-full text-left shrink-0 md:shrink ${
                  activeTab === 'explorer'
                    ? 'bg-brand-primary text-white shadow-xs font-medium'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60'
                }`}
              >
                <FolderSearch className="h-4 w-4" />
                <span>Kho tài liệu & Tra cứu</span>
              </button>

              {/* Inspector Directory Tab */}
              <button
                onClick={() => setActiveTab('inspectors')}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer w-full text-left shrink-0 md:shrink ${
                  activeTab === 'inspectors'
                    ? 'bg-brand-primary text-white shadow-xs font-medium'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Danh sách cán bộ</span>
              </button>

              {/* Proposals / Multi-level Sync Tab */}
              <button
                onClick={() => setActiveTab('proposals')}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer w-full text-left shrink-0 md:shrink ${
                  activeTab === 'proposals'
                    ? 'bg-brand-primary text-white shadow-xs font-medium'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <MailOpen className="h-4 w-4" />
                  <span>Tiếp nhận & Đề xuất</span>
                </div>
                {proposals.filter(p => p.status === 'Chờ duyệt').length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none shrink-0 ${
                    activeTab === 'proposals' ? 'bg-white text-brand-primary' : 'bg-amber-500 text-white'
                  }`}>
                    {proposals.filter(p => p.status === 'Chờ duyệt').length}
                  </span>
                )}
              </button>

              {/* Approval Requests Tab (Admin/Guest workflow) */}
              <button
                onClick={() => {
                  setActiveTab('requests');
                  fetchPendingRequestsCount();
                }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer w-full text-left shrink-0 md:shrink ${
                  activeTab === 'requests'
                    ? 'bg-brand-primary text-white shadow-xs font-medium'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  <span>Duyệt yêu cầu ({currentUser.role === 'admin' ? 'Admin' : 'Khách'})</span>
                </div>
                {pendingChangeRequestsCount > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none shrink-0 ${
                    activeTab === 'requests' ? 'bg-white text-brand-primary' : 'bg-amber-500 text-white animate-pulse'
                  }`}>
                    {pendingChangeRequestsCount}
                  </span>
                )}
              </button>

              {/* Spacer for desktop */}
              <div className="hidden md:block flex-1 border-t border-slate-200/50 my-2" />

              {/* Create Document Quick Button */}
              <button
                onClick={() => {
                  setDocumentToEdit(null);
                  setShowCreateForm(true);
                }}
                className="hidden md:flex items-center justify-center space-x-2 px-4 py-3 border border-dashed border-slate-300 hover:border-brand-primary hover:bg-white text-slate-600 hover:text-brand-primary transition-all text-xs font-bold rounded-xl cursor-pointer bg-slate-50"
              >
                <PlusCircle className="h-4 w-4 text-brand-primary" />
                <span>Đăng tải tài liệu mới</span>
              </button>
            </aside>

            {/* Right Side Content Panel */}
            <main className="flex-1 min-w-0" id="app_main_content">
              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
                  <span className="text-xs font-medium text-slate-500">Đang tải đồng bộ dữ liệu hệ thống...</span>
                </div>
              ) : (
                <>
                  {/* TAB 1: DASHBOARD OVERVIEW */}
                  {activeTab === 'dashboard' && stats && (
                    <div className="animate-fade-in">
                      <DashboardOverview
                        stats={stats}
                        onNavigateToCategory={handleNavigateToCategory}
                      />
                    </div>
                  )}

                  {/* TAB 2: EXPLORER / SEARCH FILE TREE SPLIT VIEW */}
                  {activeTab === 'explorer' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start h-full" id="split_explorer_layout">
                      {/* Left Column (1/4): Hierarchical File Tree */}
                      <div className="lg:col-span-1 h-[calc(100vh-12rem)] md:sticky md:top-24">
                        <FolderTree
                          folders={folders}
                          selectedFolderId={selectedFolderId}
                          onSelectFolder={setSelectedFolderId}
                          onCreateFolder={handleCreateFolder}
                          onDeleteFolder={handleDeleteFolder}
                          documentCounts={getDocumentCounts()}
                        />
                      </div>

                      {/* Right Column (3/4): Search Controls and Grid */}
                      <div className="lg:col-span-3 space-y-4">
                        <DocumentSearch
                          searchResults={searchResults}
                          onSearch={handleSearch}
                          onSelectDocument={setSelectedDocument}
                          selectedFolderId={selectedFolderId}
                          folders={folders}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 3: INSPECTOR ROSTER SHEET */}
                  {activeTab === 'inspectors' && (
                    <div className="animate-fade-in">
                      <div className="text-left mb-4">
                        <h2 className="text-lg font-bold text-slate-900 font-sans flex items-center">
                          <Users className="h-5 w-5 text-brand-primary mr-2" />
                          Danh sách lực lượng thanh tra
                        </h2>
                      </div>
                      <InspectorRoster
                        inspectors={inspectors}
                        onSaveInspector={handleSaveInspector}
                        onDeleteInspector={handleDeleteInspector}
                      />
                    </div>
                  )}

                  {/* TAB 4: PROPOSALS MANAGER */}
                  {activeTab === 'proposals' && (
                    <div className="animate-fade-in">
                      <ProposalsManager
                        proposals={proposals}
                        folders={folders}
                        onApproveProposal={handleApproveProposal}
                        onRejectProposal={handleRejectProposal}
                        onSubmitNewProposal={handleSubmitNewProposal}
                      />
                    </div>
                  )}

                  {/* TAB 5: CHANGE REQUESTS MANAGER */}
                  {activeTab === 'requests' && (
                    <div className="animate-fade-in">
                      <RequestsManager
                        currentUser={currentUser}
                        onRequestProcessed={() => {
                          fetchPendingRequestsCount();
                          fetchData();
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </>
      )}

      {/* Slide-over right panel for Document Detail View */}
      {selectedDocument && (
        <DocumentDetail
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onDelete={async (id) => {
            await handleDeleteDocument(id);
            setSelectedDocument(null);
          }}
          onEdit={(doc) => {
            setDocumentToEdit(doc);
            setShowCreateForm(true);
          }}
          onUpdateDocument={handleUpdateDocumentDirect}
        />
      )}

      {/* Modal Dialog for Create/Edit Document Form */}
      {(showCreateForm || documentToEdit) && (
        <DocumentForm
          documentToEdit={documentToEdit}
          folders={folders}
          onSave={handleSaveDocument}
          onCancel={() => {
            setDocumentToEdit(null);
            setShowCreateForm(false);
          }}
        />
      )}

      {/* Login / Switch Account Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem('nhnn_user_session', JSON.stringify(user));
          fetchPendingRequestsCount();
        }}
        currentUser={currentUser}
      />
    </div>
  );
}
