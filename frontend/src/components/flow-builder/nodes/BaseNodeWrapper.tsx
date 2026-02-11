import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface BaseNodeWrapperProps {
  data: any;
  selected: boolean;
  icon: React.ReactNode;
  color: string;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
  children?: React.ReactNode;
  preview?: string;
  nodeId?: string; // Add nodeId for updating label
}

export function BaseNodeWrapper({
  data,
  selected,
  icon,
  color,
  onDelete,
  onDuplicate,
  onCopy,
  children,
  preview,
  nodeId,
}: BaseNodeWrapperProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(data.label || 'Node');

  // Update labelValue when data.label changes
  React.useEffect(() => {
    setLabelValue(data.label || 'Node');
  }, [data.label]);

  const handleLabelSave = () => {
    if (nodeId && labelValue.trim()) {
      window.dispatchEvent(
        new CustomEvent('node:update', {
          detail: { nodeId, data: { label: labelValue.trim() } },
        })
      );
    }
    setIsEditingLabel(false);
  };

  const handleLabelCancel = () => {
    setLabelValue(data.label || 'Node');
    setIsEditingLabel(false);
  };

  const borderColor = selected ? `border-${color}-500` : `border-${color}-300`;
  const bgColor = `bg-${color}-50`;
  const iconBgColor = `bg-${color}-100`;
  const iconColor = `text-${color}-600`;

  return (
    <div
      className={`relative bg-white rounded-lg shadow-md border-2 ${borderColor} min-w-[280px] max-w-[350px] transition-all hover:shadow-lg`}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className={`w-3 h-3 !bg-${color}-500`}
      />

      {/* Header */}
      <div className={`px-3 py-2 ${bgColor} rounded-t-lg border-b border-${color}-200 flex items-center justify-between`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`p-1.5 ${iconBgColor} rounded ${iconColor} flex-shrink-0`}>
            {icon}
          </div>
          {isEditingLabel ? (
            <input
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLabelSave();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleLabelCancel();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="flex-1 px-2 py-0.5 text-sm font-semibold text-gray-900 bg-white border border-teal-400 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingLabel(true);
              }}
              className="flex-1 font-semibold text-sm text-gray-900 cursor-pointer hover:bg-white/50 px-2 py-0.5 rounded transition-colors truncate"
              title="Click to edit label"
            >
              {data.label}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {onDuplicate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="p-1 hover:bg-white rounded transition-colors"
              title="Duplicate node"
            >
              <Plus className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          {onCopy && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="p-1 hover:bg-white rounded transition-colors"
              title="Copy node"
            >
              <Copy className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Delete node"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          )}
          {children && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 hover:bg-white rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Preview/Content */}
      {preview && !isExpanded && (
        <div className="px-3 py-2">
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 font-mono line-clamp-2">
            {preview}
          </div>
        </div>
      )}

      {/* Expanded Configuration */}
      {isExpanded && children && (
        <div className="px-3 py-2 space-y-2 max-h-96 overflow-y-auto">
          {children}
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className={`w-3 h-3 !bg-${color}-500`}
      />
    </div>
  );
}

// Helper component for form fields in expanded view
export function NodeField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
