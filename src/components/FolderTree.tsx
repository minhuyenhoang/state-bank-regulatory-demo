import React, { useState } from "react";
import { Folder as FolderType } from "../types";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  FolderPlus,
  Files,
} from "lucide-react";

interface FolderTreeProps {
  folders: FolderType[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (
    name: string,
    parentId: string | null,
    path: string[] | null,
  ) => void;
  onDeleteFolder: (folderId: string) => void;
  documentCounts: { [folderId: string]: number };
}

// 🛠️ NEW: Helper to extract string from MongoDB { $oid: "..." } format or raw objects
export const getSafeIdStr = (idValue: any): string => {
  if (!idValue) return "";
  if (typeof idValue === "string") return idValue;
  if (typeof idValue === "object") {
    if (idValue.$oid) return idValue.$oid;
    if (idValue.toString) return idValue.toString();
  }
  return String(idValue);
};

export default function FolderTree({
  folders = [],
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  documentCounts,
}: FolderTreeProps) {
  // Expand top-level folders by default
  const [expandedFolders, setExpandedFolders] = useState<{
    [id: string]: boolean;
  }>(() => {
    const initialExpanded: { [id: string]: boolean } = {};
    folders
      .filter((f) => !getSafeIdStr(f.parentId)) // Roots have empty/null parentId
      .forEach((f) => {
        const idStr = getSafeIdStr(f.id) || getSafeIdStr((f as any)._id);
        if (idStr) initialExpanded[idStr] = true;
      });
    return initialExpanded;
  });

  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");

  const toggleExpand = (idStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [idStr]: !prev[idStr] }));
  };

  const handleSelectFolder = (idStr: string) => {
    setExpandedFolders((prev) => ({ ...prev, [idStr]: true }));
    onSelectFolder(idStr);
  };

  const handleCreateFolder = (
    parentIdStr: string | null,
    path: string[] | null,
  ) => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) return;

    const childPath = parentIdStr
      ? [...(path ?? []).map(getSafeIdStr), parentIdStr]
      : null;

    onCreateFolder(trimmedName, parentIdStr, childPath);

    if (parentIdStr) {
      setExpandedFolders((prev) => ({ ...prev, [parentIdStr]: true }));
    }

    setNewFolderName("");
    setShowAddForm(null);
  };

  const handleCancelCreate = () => {
    setNewFolderName("");
    setShowAddForm(null);
  };

  const handleDelete = (idStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteFolder(idStr);
  };

  // Render a folder node and its children recursively
  const renderFolderNode = (
    folder: FolderType,
    depth: number = 0,
  ): React.ReactElement => {
    // Safely extract the current folder ID (handles both `id` and `_id`)
    const folderIdStr =
      getSafeIdStr(folder.id) || getSafeIdStr((folder as any)._id);

    const path = folder.path;

    // Safely match children using the normalized strings
    const children = folders.filter((f) => {
      const parentIdStr = getSafeIdStr(f.parentId);
      const isDirectChild = parentIdStr !== "" && parentIdStr === folderIdStr;

      // Safely check if the folderId exists in the path
      const isInPath =
        f.path && f.path.some((p) => getSafeIdStr(p) === folderIdStr);

      return isDirectChild || isInPath;
    });

    const hasChildren = children.length > 0;
    const isExpanded = !!expandedFolders[folderIdStr];

    // Safely compare selected folder
    const safeSelectedFolderId = getSafeIdStr(selectedFolderId);
    const isSelected =
      safeSelectedFolderId === folderIdStr && folderIdStr !== "";

    // Look up count using normalized ID
    const docCount = documentCounts[folderIdStr] || 0;

    return (
      <div
        key={folderIdStr}
        className="space-y-1"
        id={`folder_node_${folderIdStr}`}
      >
        {/* Folder row */}
        <div
          onClick={() => handleSelectFolder(folderIdStr)}
          className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors duration-150 cursor-pointer select-none ${
            isSelected
              ? "bg-brand-primary text-white font-semibold"
              : "hover:bg-slate-100 text-slate-700"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-1">
            {/* Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={(e) => toggleExpand(folderIdStr, e)}
              className={`p-0.5 rounded-sm hover:bg-black/10 text-inherit transition-opacity ${
                !hasChildren ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
              disabled={!hasChildren}
              aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" />
              )}
            </button>

            {/* Folder Icon */}
            {isSelected ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}

            {/* Folder Name */}
            <span className="truncate text-xs">{folder.name}</span>

            {/* Doc count badge */}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium leading-none ${
                isSelected
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500 border border-slate-200/60"
              }`}
            >
              {docCount}
            </span>
          </div>

          {/* Actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 shrink-0 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddForm(folderIdStr);
                setNewFolderName("");
              }}
              title="Thêm thư mục con"
              className={`p-1 rounded-sm transition-colors ${
                isSelected
                  ? "hover:bg-white/20 text-white"
                  : "hover:bg-slate-200 text-slate-600"
              }`}
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDelete(folderIdStr, e)}
              title="Xóa thư mục"
              className={`p-1 rounded-sm transition-colors ${
                isSelected
                  ? "hover:bg-white/20 text-white"
                  : "hover:bg-red-100 text-red-600"
              }`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Inline form for subfolder creation */}
        {showAddForm === folderIdStr && (
          <div
            className="flex items-center space-x-1.5 py-1 pr-2"
            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
          >
            <input
              type="text"
              placeholder="Tên thư mục con..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder(folderIdStr, path);
                if (e.key === "Escape") handleCancelCreate();
              }}
            />
            <button
              type="button"
              onClick={() => handleCreateFolder(folderIdStr, path)}
              className="bg-brand-primary hover:opacity-90 text-white text-[10px] font-semibold px-2 py-1 rounded-sm cursor-pointer transition-opacity"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={handleCancelCreate}
              className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Child Rendering Block */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Identify root folders (where parentId is empty/null after safe extraction)
  const rootFolders = folders.filter((f) => !getSafeIdStr(f.parentId));
  // Parent counts already include their descendants, so summing every folder
  // would count nested documents more than once. Each document belongs to one
  // root subtree, making the sum of root totals the overall total.
  const totalDocCount = rootFolders.reduce((total, folder) => {
    const folderIdStr =
      getSafeIdStr(folder.id) || getSafeIdStr((folder as any)._id);
    return total + (documentCounts[folderIdStr] || 0);
  }, 0);

  return (
    <div
      className="bg-white rounded-md border border-slate-200 flex flex-col h-full overflow-hidden"
      id="folder_tree_sidebar"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-slate-800 text-xs md:text-sm flex items-center">
          <Files className="h-4 w-4 text-brand-primary mr-2" />
          Thư mục tài liệu
        </h3>
        <button
          type="button"
          onClick={() => {
            setShowAddForm("root");
            setNewFolderName("");
          }}
          title="Thêm thư mục gốc"
          className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-brand-primary transition-colors cursor-pointer"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer select-none ${
            selectedFolderId === null
              ? "bg-slate-100 text-brand-primary font-semibold"
              : "hover:bg-slate-50 text-slate-700"
          }`}
          id="btn_all_folders"
        >
          <div className="flex items-center space-x-2">
            <Files className="h-4 w-4 text-brand-primary" />
            <span>Tất cả văn bản</span>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium leading-none ${
              selectedFolderId === null
                ? "bg-brand-primary text-white"
                : "bg-slate-100 text-slate-600 border border-slate-200/60"
            }`}
          >
            {totalDocCount}
          </span>
        </button>

        <div className="border-t border-slate-100 my-1" />

        {/* Root form */}
        {showAddForm === "root" && (
          <div className="flex items-center space-x-1.5 p-1.5 bg-slate-50 rounded-md border border-slate-200 mb-2">
            <input
              type="text"
              placeholder="Tên thư mục gốc..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder(null, null);
                if (e.key === "Escape") handleCancelCreate();
              }}
            />
            <button
              type="button"
              onClick={() => handleCreateFolder(null, null)}
              className="bg-brand-primary hover:opacity-90 text-white text-[10px] font-semibold px-2 py-1 rounded-sm cursor-pointer transition-opacity"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={handleCancelCreate}
              className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Root Folders */}
        <div className="space-y-0.5">
          {rootFolders.map((folder) => renderFolderNode(folder))}
        </div>
      </div>
    </div>
  );
}
