/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DocumentCategory = 'QPPL' | 'QuyetDinhThanhTra' | 'KetLuanThanhTra' | 'ChiDaoNHNN';

export interface Document {
  id: string;
  category: DocumentCategory;
  title: string;
  docNumber: string; // Số văn bản
  issueDate: string; // Ngày ban hành (YYYY-MM-DD)
  effectiveDate?: string; // Ngày hiệu lực (YYYY-MM-DD)
  agency: string; // Cơ quan ban hành
  specialization?: string; // Lĩnh vực chuyên môn
  status?: 'Còn hiệu lực' | 'Hết hiệu lực'; // For QPPL
  inspectionTarget?: string; // Đối tượng thanh tra
  inspectionYear?: number; // Năm thanh tra
  inspectionContent?: string; // Nội dung thanh tra
  keyContent?: string; // Nội dung cơ bản (Kết luận)
  summaryInstructions?: string; // Tóm tắt nội dung chỉ đạo (Chỉ đạo)
  fullText: string; // Bản sao văn bản / Nội dung đầy đủ
  sourceLink?: string; // Đường dẫn nguồn
  tags: string[]; // Nhãn / từ khóa
  folderId: string; // Thư mục lưu trữ
  aiSummary?: {
    implications: string; // Tác động & Hệ quả
    complianceRequirements: string; // Yêu cầu tuân thủ cho Banker
    keyTakeaways: string[]; // Tóm tắt ngắn gọn
  };
  createdAt: string;
}

export interface SearchResult {
  document: Document;
  score: number;
  matchSnippet: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // Cấu trúc thư mục phân cấp
  path: string[] | null;
}

export interface Inspector {
  id: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  phone?: string;
  status: 'Sẵn sàng' | 'Đang công tác' | 'Nghỉ phép';
}

export interface Proposal {
  id: string;
  title: string;
  category: DocumentCategory;
  docNumber: string;
  issueDate: string;
  agency: string;
  fullText: string;
  proposedBy: string; // Email của cán bộ gửi đề xuất
  createdAt: string;
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
}

export interface DashboardStats {
  totalQPPL: number;
  activeQPPL: number;
  totalQuyetDinhThanhTra: number;
  totalKetLuanThanhTra: number;
  totalChiDaoNHNN: number;
  totalInspectors: number;
  conclusionsByYear: { year: number; count: number }[];
  categoryDistribution: { name: string; value: number }[];
}

export type UserRole = 'admin' | 'guest';

export interface UserSession {
  role: UserRole;
  name: string;
}

export type ChangeRequestType = 
  | 'CREATE_DOCUMENT' 
  | 'EDIT_DOCUMENT' 
  | 'DELETE_DOCUMENT' 
  | 'CREATE_FOLDER' 
  | 'DELETE_FOLDER';

export interface ChangeRequest {
  id: string;
  requestType: ChangeRequestType;
  targetId?: string;
  targetName?: string;
  payload?: any;
  requestedBy: string;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  processedAt?: string;
  rejectedReason?: string;
}
