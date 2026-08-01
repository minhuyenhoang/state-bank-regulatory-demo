/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DashboardStats } from '../types';
import { FileText, ClipboardCheck, AlertCircle, ShieldAlert, Users, TrendingUp, HelpCircle } from 'lucide-react';

interface DashboardOverviewProps {
  stats: DashboardStats;
  onNavigateToCategory: (category: string) => void;
}

export default function DashboardOverview({ stats, onNavigateToCategory }: DashboardOverviewProps) {
  // Simple animations or statistics display
  const cards = [
    {
      title: 'Văn bản QPPL',
      count: stats.totalQPPL,
      subtitle: `${stats.activeQPPL} văn bản còn hiệu lực`,
      icon: FileText,
      color: 'bg-white text-slate-800 border-slate-200 hover:border-blue-500 border-l-4 border-l-blue-600',
      category: 'QPPL',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-100'
    },
    {
      title: 'Quyết định thanh tra',
      count: stats.totalQuyetDinhThanhTra,
      subtitle: 'Số Đoàn thanh tra đang tiến hành',
      icon: ShieldAlert,
      color: 'bg-white text-slate-800 border-slate-200 hover:border-amber-500 border-l-4 border-l-amber-500',
      category: 'QuyetDinhThanhTra',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-100'
    },
    {
      title: 'Kết luận thanh tra',
      count: stats.totalKetLuanThanhTra,
      subtitle: 'Kết luận đã ban hành',
      icon: ClipboardCheck,
      color: 'bg-white text-slate-800 border-slate-200 hover:border-emerald-500 border-l-4 border-l-emerald-600',
      category: 'KetLuanThanhTra',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    },
    {
      title: 'Văn bản, công văn chỉ đạo của NHNN',
      count: stats.totalChiDaoNHNN,
      subtitle: 'Công văn & Chỉ thị điều hành',
      icon: AlertCircle,
      color: 'bg-white text-slate-800 border-slate-200 hover:border-purple-500 border-l-4 border-l-purple-600',
      category: 'ChiDaoNHNN',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-100'
    }
  ];

  // Calculate highest count for SVG chart scaling
  const maxCount = Math.max(...stats.conclusionsByYear.map(c => c.count), 1);
  const chartHeight = 160;
  const barWidth = 36;
  const chartGap = 40;

  return (
    <div className="space-y-6" id="dashboard_overview_container">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-900 p-6 rounded-lg text-white border border-slate-800" id="db_banner">
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="inline-flex items-center px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold rounded-sm uppercase tracking-wider font-mono">
            Hệ thống nội bộ NHNN
          </span>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight font-sans">
            Cơ sở dữ liệu Pháp lý & Thanh tra Giám sát Ngân hàng
          </h1>
          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            Tra cứu văn bản quy phạm pháp luật, kết luận thanh tra chuyên ngành, chỉ đạo của Thống đốc tích hợp trí tuệ nhân tạo (Gemini AI) tự động đúc rút rủi ro & yêu cầu tuân thủ.
          </p>
        </div>
        {/* Subtle decorative background vector - clean geometric grid pattern */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi_grid">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <button
              key={i}
              onClick={() => onNavigateToCategory(card.category)}
              className={`flex items-start justify-between p-5 rounded-md border text-left transition-all duration-200 cursor-pointer hover:shadow-xs ${card.color}`}
              id={`kpi_card_${card.category}`}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">{card.title}</span>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">{card.count}</div>
                <span className="text-[11px] font-medium text-slate-500 block pt-1">{card.subtitle}</span>
              </div>
              <div className={`p-2.5 rounded-md ${card.badgeColor} border`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Analytics Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="analytics_section">
        {/* Conclusions by Year (Bar Chart) */}
        <div className="bg-white p-5 rounded-md border border-slate-200 flex flex-col justify-between lg:col-span-2" id="conclusions_chart_card">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-950 font-sans text-sm md:text-base">
                  Số lượng Kết luận Thanh tra đã ban hành theo năm
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Thống kê giám sát chuyên ngành chính thức</p>
              </div>
              <div className="flex items-center text-[10px] text-emerald-700 font-bold uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-sm border border-emerald-100 font-mono">
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                Duy trì ổn định
              </div>
            </div>

            {/* SVG Interactive Chart */}
            <div className="h-48 flex items-end justify-center pt-4 border-b border-slate-100 bg-slate-50/40 rounded-sm" id="svg_chart_canvas">
              {stats.conclusionsByYear.map((item, idx) => {
                const percent = item.count / maxCount;
                const barHeight = Math.max(percent * chartHeight, 15);
                return (
                  <div key={idx} className="flex flex-col items-center mx-5 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 bg-slate-950 text-white text-[10px] px-2 py-1 rounded-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-mono border border-slate-800">
                      {item.count} kết luận
                    </div>
                    {/* Bar */}
                    <div
                      style={{ height: `${barHeight}px`, width: `${barWidth}px` }}
                      className="bg-brand-primary rounded-t-xs hover:bg-brand-secondary transition-all duration-200 cursor-pointer"
                    />
                    {/* X-Axis Label */}
                    <span className="text-[11px] font-bold text-slate-400 mt-2 font-mono">
                      {item.year}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="text-[10px] text-slate-400 pt-3 text-center italic font-mono">
            * Dữ liệu được liên kết tự động từ các Phòng Tổng hợp & Cục Thanh tra Giám sát Ngân hàng địa phương.
          </div>
        </div>

        {/* Directory Status / Roster Summary Card */}
        <div className="bg-white p-5 rounded-md border border-slate-200 flex flex-col justify-between" id="inspector_summary_card">
          <div>
            <h3 className="font-bold text-slate-950 font-sans text-sm md:text-base mb-1 flex items-center">
              <Users className="h-4.5 w-4.5 text-amber-600 mr-2" />
              Lực lượng Thanh tra Giám sát
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 font-medium">Cán bộ đầu mối và đoàn thanh tra tại chỗ</p>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-sm border border-slate-200/60">
                <div className="text-xs font-semibold text-slate-700">Tổng số cán bộ nghiệp vụ</div>
                <div className="text-xl font-extrabold text-slate-950 font-mono">{stats.totalInspectors}</div>
              </div>

              {/* Status breakdown */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-[11px] text-slate-500 font-mono font-medium">
                  <span>Trực chiến / Sẵn sàng:</span>
                  <span className="font-bold text-emerald-600">60%</span>
                </div>
                <div className="w-full bg-slate-100 h-1 rounded-sm overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-sm" style={{ width: '60%' }} />
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 pt-1 font-mono font-medium">
                  <span>Đang đi công tác thực địa:</span>
                  <span className="font-bold text-blue-600">30%</span>
                </div>
                <div className="w-full bg-slate-100 h-1 rounded-sm overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-sm" style={{ width: '30%' }} />
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 pt-1 font-mono font-medium">
                  <span>Đang nghỉ phép / Đào tạo:</span>
                  <span className="font-bold text-amber-600">10%</span>
                </div>
                <div className="w-full bg-slate-100 h-1 rounded-sm overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-sm" style={{ width: '10%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-start space-x-2 text-[11px] text-slate-500 bg-amber-50/40 p-2.5 rounded-sm border border-amber-100/40">
              <HelpCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                <strong>Lưu ý nghiệp vụ:</strong> Việc bổ sung, phân công cán bộ vào các đoàn thanh tra được đồng bộ trực tiếp với danh bạ nhân sự phòng ban.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
