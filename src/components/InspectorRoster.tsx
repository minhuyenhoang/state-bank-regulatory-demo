/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Inspector } from '../types';
import { Search, UserPlus, Phone, Mail, Building, Award, Shield, Trash2, Edit3, X, Save } from 'lucide-react';

interface InspectorRosterProps {
  inspectors: Inspector[];
  onSaveInspector: (ins: Inspector) => void;
  onDeleteInspector: (id: string) => void;
}

export default function InspectorRoster({
  inspectors,
  onSaveInspector,
  onDeleteInspector,
}: InspectorRosterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form fields
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Thành viên Đoàn');
  const [department, setDepartment] = useState('Thanh tra Ngân hàng Nhà nước Khu vực');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'Sẵn sàng' | 'Đang công tác' | 'Nghỉ phép'>('Sẵn sàng');

  const handleEditClick = (ins: Inspector) => {
    setId(ins.id);
    setName(ins.name);
    setRole(ins.role);
    setDepartment(ins.department);
    setEmail(ins.email || '');
    setPhone(ins.phone || '');
    setStatus(ins.status);
    setShowAddForm(true);
  };

  const handleResetForm = () => {
    setId('');
    setName('');
    setRole('Thành viên Đoàn');
    setDepartment('Thanh tra Ngân hàng Nhà nước Khu vực');
    setEmail('');
    setPhone('');
    setStatus('Sẵn sàng');
    setShowAddForm(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên cán bộ.');
      return;
    }

    onSaveInspector({
      ...(id ? { id } : {}),
      name: name.trim(),
      role,
      department,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      status,
    } as Inspector);

    handleResetForm();
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'Sẵn sàng':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Đang công tác':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Nghỉ phép':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const filteredInspectors = inspectors.filter(ins => 
    ins.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ins.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ins.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="inspector_roster_section">
      
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-md border border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm cán bộ thanh tra theo tên, vụ cục hoặc chức danh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs md:text-sm text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:bg-white font-sans"
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold px-4 py-2.5 rounded-sm flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          <span>Thêm cán bộ mới</span>
        </button>
      </div>

      {/* Grid of Inspectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="inspectors_grid_container">
        {filteredInspectors.length === 0 ? (
          <div className="col-span-1 md:col-span-2 xl:col-span-3 text-center py-12 bg-slate-50 rounded-md border border-slate-200">
            <p className="text-xs text-slate-400 font-medium font-sans">Không tìm thấy cán bộ nào phù hợp với bộ lọc tìm kiếm.</p>
          </div>
        ) : (
          filteredInspectors.map(ins => (
            <div
              key={ins.id}
              className="bg-white p-5 rounded-md border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between group relative text-left"
              id={`inspector_card_${ins.id}`}
            >
              {/* Quick Actions (Hover visible) */}
              <div className="absolute right-3 top-3 hidden group-hover:flex items-center space-x-1">
                <button
                  onClick={() => handleEditClick(ins)}
                  className="p-1 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-brand-primary cursor-pointer"
                  title="Sửa thông tin"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Bạn chắc chắn muốn xóa cán bộ ${ins.name}?`)) {
                      onDeleteInspector(ins.id);
                    }
                  }}
                  className="p-1 rounded-sm hover:bg-red-50 text-slate-500 hover:text-red-600 cursor-pointer"
                  title="Xóa cán bộ"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Main Info */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  {/* Avatar style placeholder */}
                  <div className="h-10 w-10 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center text-brand-primary font-extrabold text-sm font-mono">
                    {ins.name.split(' ').pop()?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs md:text-sm leading-tight flex items-center font-sans uppercase">
                      {ins.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">MÃ SỐ: {ins.id}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Award className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-bold text-slate-700 font-sans">{ins.role}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate font-medium">{ins.department}</span>
                  </div>
                  {ins.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono text-slate-500 font-medium">{ins.phone}</span>
                    </div>
                  )}
                  {ins.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono truncate text-slate-500 font-medium">{ins.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Trạng thái nghiệp vụ</span>
                <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider border ${statusBadge(ins.status)}`}>
                  {ins.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Overlay Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-850 text-xs md:text-sm uppercase tracking-wider font-sans">
                {id ? 'Cập nhật cán bộ' : 'Thêm cán bộ thanh tra mới'}
              </h3>
              <button onClick={handleResetForm} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              {/* Name */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Họ và tên cán bộ</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn Hùng"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                  required
                />
              </div>

              {/* Role */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Chức vụ</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                >
                  <option value="Trưởng đoàn Thanh tra">Trưởng đoàn Thanh tra</option>
                  <option value="Phó trưởng đoàn">Phó trưởng đoàn</option>
                  <option value="Thành viên Đoàn">Thành viên Đoàn</option>
                  <option value="Thành viên giám sát">Thành viên giám sát</option>
                  <option value="Chuyên viên hỗ trợ">Chuyên viên hỗ trợ</option>
                </select>
              </div>

              {/* Department */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Đơn vị trực thuộc</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                >
                  <option value="Thanh tra Ngân hàng Nhà nước Khu vực">Thanh tra Ngân hàng Nhà nước Khu vực</option>
                  <option value="Phòng Quản lý, giám sát">Phòng Quản lý, giám sát</option>
                  <option value="Phòng Tiền tệ kho quỹ">Phòng Tiền tệ kho quỹ</option>
                  <option value="Phòng Kế toán - Thanh toán">Phòng Kế toán - Thanh toán</option>
                  <option value="Phòng Hành chính - Nhân sự">Phòng Hành chính - Nhân sự</option>
                  <option value="Phòng Tổng hợp">Phòng Tổng hợp</option>
                </select>
              </div>

              {/* Contact phone/email */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Số điện thoại</label>
                  <input
                    type="tel"
                    placeholder="09..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Email</label>
                  <input
                    type="email"
                    placeholder="...@sbv.gov.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-sm p-2.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-brand-primary font-mono"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Trạng thái công tác</label>
                <div className="flex space-x-4 pt-1">
                  <label className="inline-flex items-center text-xs text-slate-700">
                    <input
                      type="radio"
                      checked={status === 'Sẵn sàng'}
                      onChange={() => setStatus('Sẵn sàng')}
                      className="mr-2 text-brand-primary focus:ring-brand-primary cursor-pointer"
                    />
                    Sẵn sàng
                  </label>
                  <label className="inline-flex items-center text-xs text-slate-700">
                    <input
                      type="radio"
                      checked={status === 'Đang công tác'}
                      onChange={() => setStatus('Đang công tác')}
                      className="mr-2 text-brand-primary focus:ring-brand-primary cursor-pointer"
                    />
                    Đang công tác
                  </label>
                  <label className="inline-flex items-center text-xs text-slate-700">
                    <input
                      type="radio"
                      checked={status === 'Nghỉ phép'}
                      onChange={() => setStatus('Nghỉ phép')}
                      className="mr-2 text-brand-primary focus:ring-brand-primary cursor-pointer"
                    />
                    Nghỉ phép
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 px-4 py-2 rounded-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold px-5 py-2.5 rounded-sm flex items-center cursor-pointer shadow-xs"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
