/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Folder as FolderType } from '../types';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Plus, Trash2, FolderPlus, Files } from 'lucide-react';

interface FolderTreeProps {
  folders: FolderType[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onDeleteFolder: (folderId: string) => void;
  documentCounts: { [folderId: string]: number };
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  documentCounts,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<{ [id: string]: boolean }>({
    'f1': true,
    'f2': true,
    'f3': true,
  });
  const [showAddForm, setShowAddForm] = useState<string | null>(null); // 'root' or folderId parent
  const [newFolderName, setNewFolderName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateFolder = (parentId: string | null) => {
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim(), parentId);
    setNewFolderName('');
    setShowAddForm(null);
    setErrorMessage('');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteFolder(id);
  };

  // Render a folder node and its children recursively
  const renderFolderNode = (folder: FolderType, depth: number = 0) => {
    const children = folders.filter(f => f.parentId === folder.id);
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedFolders[folder.id];
    const isSelected = selectedFolderId === folder.id;
    const docCount = documentCounts[folder.id] || 0;

    return (
      <div key={folder.id} className="space-y-1" id={`folder_node_${folder.id}`}>
        {/* Folder row */}
        <div
          onClick={() => onSelectFolder(folder.id)}
          className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all duration-150 cursor-pointer ${
            isSelected
              ? 'bg-brand-primary text-white font-bold'
              : 'hover:bg-slate-50 text-slate-700'
          }`}
          style={{ paddingLeft: `${depth * 10 + 6}px` }}
        >
          <div className="flex items-center space-x-1.5 min-w-0">
            {/* Collapse indicator */}
            <button
              onClick={(e) => toggleExpand(folder.id, e)}
              className={`p-0.5 rounded-xs hover:bg-black/10 text-inherit ${!hasChildren ? 'opacity-0 cursor-default' : ''}`}
              disabled={!hasChildren}
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
            <span className="truncate">{folder.name}</span>

            {/* Doc count badge */}
            <span className={`text-[9px] px-1.5 py-0.25 rounded-xs font-mono font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200/40'}`}>
              {docCount}
            </span>
          </div>

          {/* Folder Actions hover effect */}
          <div className="hidden group-hover:flex items-center space-x-0.5 shrink-0 ml-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddForm(folder.id);
              }}
              title="Thêm thư mục con"
              className={`p-0.5 rounded-xs ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 text-slate-500'}`}
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => handleDelete(folder.id, e)}
              title="Xóa thư mục"
              className={`p-0.5 rounded-xs ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-red-50 text-red-500'}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Input box for creating subfolder */}
        {showAddForm === folder.id && (
          <div className="flex items-center space-x-1.5 py-1" style={{ paddingLeft: `${(depth + 1) * 10 + 12}px` }}>
            <input
              type="text"
              placeholder="Tên thư mục..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-brand-primary outline-hidden bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder(folder.id);
                if (e.key === 'Escape') setShowAddForm(null);
              }}
            />
            <button
              onClick={() => handleCreateFolder(folder.id)}
              className="bg-brand-primary text-white text-[10px] font-bold px-2 py-1 rounded-sm cursor-pointer"
            >
              Lưu
            </button>
            <button
              onClick={() => setShowAddForm(null)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Child Folders Render */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {children.map(child => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = folders.filter(f => f.parentId === null);

  return (
    <div className="bg-white rounded-md border border-slate-200 flex flex-col h-full overflow-hidden" id="folder_tree_sidebar">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-slate-900 text-xs md:text-sm flex items-center font-sans">
          <Files className="h-4 w-4 text-brand-primary mr-2" />
          Thư mục tài liệu
        </h3>
        <button
          onClick={() => setShowAddForm('root')}
          title="Thêm thư mục gốc"
          className="p-1 rounded-sm border border-slate-200 hover:bg-slate-100 text-brand-primary transition-colors cursor-pointer"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* List Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {/* All Documents Shortcut Button */}
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-sm text-xs text-left transition-colors cursor-pointer ${
            selectedFolderId === null
              ? 'bg-slate-100 text-brand-primary font-bold'
              : 'hover:bg-slate-50 text-slate-700'
          }`}
          id="btn_all_folders"
        >
          <div className="flex items-center space-x-2">
            <Files className="h-4 w-4 text-brand-primary" />
            <span className="font-sans">Tất cả văn bản</span>
          </div>
          <span className={`text-[9px] px-1.5 py-0.25 rounded-xs font-mono font-bold ${
            selectedFolderId === null ? 'bg-brand-primary text-white' : 'bg-slate-200 text-slate-600'
          }`}>
            {Object.values(documentCounts).reduce((a, b) => a + b, 0)}
          </span>
        </button>

        <div className="border-t border-slate-100 my-1.5" />

        {/* Root folders input box */}
        {showAddForm === 'root' && (
          <div className="flex items-center space-x-2 p-1.5 bg-slate-50 rounded-sm border border-slate-150">
            <input
              type="text"
              placeholder="Tên thư mục gốc..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-brand-primary outline-hidden bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder(null);
                if (e.key === 'Escape') setShowAddForm(null);
              }}
            />
            <button
              onClick={() => handleCreateFolder(null)}
              className="bg-brand-primary text-white text-[10px] font-bold px-2 py-1 rounded-sm"
            >
              Lưu
            </button>
            <button
              onClick={() => setShowAddForm(null)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Recurse list */}
        <div className="space-y-1">
          {rootFolders.map(folder => renderFolderNode(folder))}
        </div>
      </div>
    </div>
  );
}
