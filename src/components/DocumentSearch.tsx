/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Document, DocumentCategory } from '../types';
import { SearchResult } from '../lib/searchEngine';
import { Search, Filter, Tag, Calendar, UserCheck, Eye, Sparkles, ChevronRight, Hash, AlertCircle } from 'lucide-react';

interface DocumentSearchProps {
  searchResults: SearchResult[];
  onSearch: (q: string, filters: any) => void;
  onSelectDocument: (doc: Document) => void;
  selectedFolderId: string | null;
  folders: any[];
}

export default function DocumentSearch({
  searchResults,
  onSearch,
  onSelectDocument,
  selectedFolderId,
  folders,
}: DocumentSearchProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [agency, setAgency] = useState<string>('');
  const [specialization, setSpecialization] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Predefined lists for quick dropdown filtering
  const categoriesList = [
    { value: 'QPPL', label: 'Văn bản QPPL' },
    { value: 'QuyetDinhThanhTra', label: 'Quyết định thanh tra' },
    { value: 'KetLuanThanhTra', label: 'Kết luận thanh tra' },
    { value: 'ChiDaoNHNN', label: 'Chỉ đạo của NHNN' },
  ];

  const agenciesList = [
    'Quốc hội',
    'Chính phủ',
    'Ngân hàng Nhà nước Chi nhánh Khu vực 9',
    'Ngân hàng Nhà nước',
    'Ban Thống đốc Ngân hàng Nhà nước',
    'Thanh tra Ngân hàng Nhà nước Khu vực 9',
    'Vụ Pháp chế NHNN',
    'Vụ Thanh toán NHNN'
  ];

  const specializationsList = [
    'Tín dụng & Quản lý rủi ro',
    'Phòng chống rửa tiền',
    'An toàn hệ thống',
    'Thanh toán & Công nghệ số',
    'Hoạt động ngoại hối & Vàng',
    'Chế độ kế toán & Kho quỹ'
  ];

  const handleSearchTrigger = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSearch(query, {
      category,
      status,
      agency,
      specialization,
      year: year ? parseInt(year) : null,
      folderId: selectedFolderId,
    });
  };

  const handleClearFilters = () => {
    setQuery('');
    setCategory('');
    setStatus('');
    setAgency('');
    setSpecialization('');
    setYear('');
    onSearch('', {
      category: '',
      status: '',
      agency: '',
      specialization: '',
      year: null,
      folderId: selectedFolderId,
    });
  };

  const categoryLabel = (cat: DocumentCategory) => {
    switch (cat) {
      case 'QPPL': return 'Văn bản QPPL';
      case 'QuyetDinhThanhTra': return 'Quyết định thanh tra';
      case 'KetLuanThanhTra': return 'Kết luận thanh tra';
      case 'ChiDaoNHNN': return 'Chỉ đạo điều hành';
      default: return cat;
    }
  };

  const categoryColor = (cat: DocumentCategory) => {
    switch (cat) {
      case 'QPPL': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'QuyetDinhThanhTra': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'KetLuanThanhTra': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ChiDaoNHNN': return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const categoryColorBorder = (cat: DocumentCategory) => {
    switch (cat) {
      case 'QPPL': return 'border-l-4 border-l-blue-600 hover:border-blue-700';
      case 'QuyetDinhThanhTra': return 'border-l-4 border-l-amber-500 hover:border-amber-600';
      case 'KetLuanThanhTra': return 'border-l-4 border-l-emerald-600 hover:border-emerald-700';
      case 'ChiDaoNHNN': return 'border-l-4 border-l-purple-600 hover:border-purple-700';
    }
  };

  return (
    <div className="space-y-4" id="document_search_section">
      {/* Search Input Card */}
      <div className="bg-white p-4 rounded-md border border-slate-200">
        <form onSubmit={handleSearchTrigger} className="space-y-3">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm (Ví dụ: nợ xấu, cơ cấu nợ, sở hữu chéo... hỗ trợ không dấu)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white transition-all font-sans"
              id="search_query_input"
            />
            <div className="absolute right-2 flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 transition-colors ${showAdvanced ? 'bg-slate-100 text-brand-primary' : ''}`}
                title="Bộ lọc nâng cao"
              >
                <Filter className="h-4 w-4" />
              </button>
              <button
                type="submit"
                className="bg-brand-primary hover:bg-brand-primary/95 text-white text-[11px] font-bold px-4 py-2 rounded-sm transition-colors cursor-pointer"
              >
                Tìm kiếm
              </button>
            </div>
          </div>

          {/* Collapsible Advanced Filters */}
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-100 animate-fade-in" id="advanced_filters_panel">
              {/* Category */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Phân loại</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white font-sans"
                >
                  <option value="">Tất cả phân loại</option>
                  {categoriesList.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Agency */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Cơ quan ban hành</label>
                <select
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white font-sans"
                >
                  <option value="">Tất cả cơ quan</option>
                  {agenciesList.map(age => (
                    <option key={age} value={age}>{age}</option>
                  ))}
                </select>
              </div>

              {/* Specialization */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Lĩnh vực chuyên môn</label>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white font-sans"
                >
                  <option value="">Tất cả lĩnh vực</option>
                  {specializationsList.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              {/* Status (For QPPL) */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Trạng thái hiệu lực</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white font-sans"
                >
                  <option value="">Tất cả hiệu lực</option>
                  <option value="Còn hiệu lực">Còn hiệu lực</option>
                  <option value="Hết hiệu lực">Hết hiệu lực</option>
                </select>
              </div>

              {/* Year */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Năm ban hành / thanh tra</label>
                <input
                  type="number"
                  placeholder="Ví dụ: 2024"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white font-mono"
                />
              </div>

              <div className="col-span-1 sm:col-span-2 md:col-span-5 flex justify-end space-x-2 pt-1 border-t border-slate-50">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-sm hover:bg-slate-100 transition-colors"
                >
                  Xóa bộ lọc
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchTrigger()}
                  className="bg-slate-900 text-white hover:bg-slate-950 text-xs font-semibold px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer"
                >
                  Áp dụng bộ lọc
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Results Meta Info */}
      <div className="flex items-center justify-between px-1" id="results_meta_info">
        <span className="text-xs text-slate-500 font-medium font-sans">
          Tìm thấy <strong className="text-slate-950 font-mono">{searchResults.length}</strong> kết quả 
          {selectedFolderId && (
            <span> trong thư mục <strong className="text-brand-primary font-mono">"{folders.find(f => f._id == selectedFolderId)?.name}"</strong></span>
          )}
        </span>

        {searchResults.some(r => r.score > 0) && (
          <span className="flex items-center text-[10px] text-brand-primary font-bold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-xs border border-blue-100 font-mono">
            <Sparkles className="h-3 w-3 mr-1" />
            Định hạng bằng BM25
          </span>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-3" id="search_results_list">
        {searchResults.length === 0 ? (
          <div className="bg-white text-center py-12 rounded-md border border-slate-200 p-6 space-y-2">
            <AlertCircle className="h-8 w-8 text-slate-400 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">Không tìm thấy tài liệu phù hợp</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Hãy thử thay đổi từ khóa tìm kiếm của bạn, sử dụng tiếng Việt có dấu/không dấu hoặc tắt bớt các điều kiện lọc nâng cao.
            </p>
          </div>
        ) : (
          searchResults.map((result, idx) => {
            const { document: doc, score, matchSnippet } = result;
            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc)}
                className={`bg-white p-4 rounded-md border border-slate-200 transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:shadow-xs ${categoryColorBorder(doc.category)}`}
                id={`search_result_card_${doc.id}`}
              >
                <div>
                  {/* Top line metadata */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-sm border font-bold tracking-wider uppercase font-sans ${categoryColor(doc.category)}`}>
                      {categoryLabel(doc.category)}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-sm border border-slate-200/50">
                      Số: {doc.docNumber}
                    </span>
                    {doc.specialization && (
                      <span className="text-[10px] font-sans font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-sm border border-indigo-100">
                        {doc.specialization}
                      </span>
                    )}
                    {doc.status && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider ${
                        doc.status === 'Còn hiệu lực' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {doc.status}
                      </span>
                    )}
                    {score > 0 && (
                      <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-sm font-mono font-bold ml-auto shrink-0">
                        BM25: {score}
                      </span>
                    )}
                  </div>

                  {/* Document Title */}
                  <h4 className="text-left font-bold text-slate-950 group-hover:text-brand-primary text-sm md:text-base transition-colors leading-snug mb-2 font-sans">
                    {doc.title}
                  </h4>

                  {/* Matched Snippet (Context highlight) */}
                  <p className="text-left text-xs text-slate-600 font-normal leading-relaxed line-clamp-3 mb-3 bg-slate-50/50 p-2.5 rounded-sm border border-slate-100">
                    <strong className="text-[9px] text-slate-400 block mb-1 font-mono uppercase tracking-wider font-bold">Trích dẫn đối chiếu</strong>
                    <span className="italic font-sans">"{matchSnippet}"</span>
                  </p>
                </div>

                {/* Tags and Metadata Footer */}
                <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 gap-2">
                  <div className="flex flex-wrap gap-1">
                    {doc.tags.slice(0, 3).map((tag, tIdx) => (
                      <span key={tIdx} className="flex items-center text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-sm border border-slate-200/40 font-medium">
                        <Tag className="h-2.5 w-2.5 mr-1 text-slate-400" />
                        {tag}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="text-[9px] text-slate-400 px-1.5 py-0.5 font-mono">
                        +{doc.tags.length - 3} tags
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
                      BH: {doc.issueDate}
                    </span>
                    {doc.effectiveDate && (
                      <span className="flex items-center">
                        <UserCheck className="h-3.5 w-3.5 mr-1 text-slate-400" />
                        HL: {doc.effectiveDate}
                      </span>
                    )}
                    <span className="flex items-center text-brand-primary font-bold uppercase tracking-wider text-[9px] group-hover:translate-x-1 transition-transform font-sans">
                      Chi tiết
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
