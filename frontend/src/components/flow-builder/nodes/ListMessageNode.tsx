'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { List, Plus, X } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { ListMessageNodeData } from '@/types/flowTypes';

export default memo(function ListMessageNode({ data, selected, id }: NodeProps) {
  const nodeData = data as ListMessageNodeData;
  const messageText = nodeData.messageText || '';
  const buttonText = nodeData.buttonText || 'Select';
  const sections = nodeData.sections || [];
  const isDynamic = nodeData.isDynamic || false;
  const dynamicSource = nodeData.dynamicSource || 'custom';

  const preview = isDynamic 
    ? `🔄 Dynamic List (${dynamicSource})`
    : `${sections.length} section(s), ${sections.reduce((acc, s) => acc + (s.rows?.length || 0), 0)} rows`;

  const addSection = () => {
    const newSection = {
      title: 'New Section',
      rows: [
        { id: `row_${Date.now()}`, title: 'Option 1', description: '' }
      ],
    };
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { sections: [...sections, newSection] } },
      })
    );
  };

  const removeSection = (index: number) => {
    const newSections = sections.filter((_, i) => i !== index);
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { sections: newSections } },
      })
    );
  };

  const updateSection = (sectionIndex: number, field: string, value: any) => {
    const newSections = [...sections];
    newSections[sectionIndex] = { ...newSections[sectionIndex], [field]: value };
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { sections: newSections } },
      })
    );
  };

  const addRow = (sectionIndex: number) => {
    const newSections = [...sections];
    const newRow = {
      id: `row_${Date.now()}`,
      title: 'New Option',
      description: '',
    };
    newSections[sectionIndex].rows = [...(newSections[sectionIndex].rows || []), newRow];
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { sections: newSections } },
      })
    );
  };

  const removeRow = (sectionIndex: number, rowIndex: number) => {
    const newSections = [...sections];
    newSections[sectionIndex].rows = newSections[sectionIndex].rows.filter((_, i) => i !== rowIndex);
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { sections: newSections } },
      })
    );
  };

  const updateRow = (sectionIndex: number, rowIndex: number, field: string, value: any) => {
    const newSections = [...sections];
    newSections[sectionIndex].rows[rowIndex] = {
      ...newSections[sectionIndex].rows[rowIndex],
      [field]: value,
    };
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { sections: newSections } },
      })
    );
  };

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<List className="w-4 h-4" />}
      color="indigo"
      preview={preview}
      nodeId={id}
      onDelete={() => {
        window.dispatchEvent(new CustomEvent('node:delete', { detail: { nodeId: id } }));
      }}
      onDuplicate={() => {
        window.dispatchEvent(new CustomEvent('node:duplicate', { detail: { nodeId: id } }));
      }}
      onCopy={() => {
        window.dispatchEvent(new CustomEvent('node:copy', { detail: { nodeId: id } }));
      }}
    >
      <NodeField label="Message Text">
        <textarea
          value={messageText}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { messageText: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          rows={2}
          placeholder="List message text..."
        />
      </NodeField>

      <NodeField label="Button Text">
        <input
          type="text"
          value={buttonText}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { buttonText: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g., View Options"
        />
      </NodeField>

      {/* Dynamic List Toggle */}
      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
        <input
          type="checkbox"
          checked={isDynamic}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { isDynamic: e.target.checked } },
              })
            );
          }}
          className="w-3 h-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <label className="text-xs font-medium text-blue-700">🔄 Load from Database</label>
      </div>

      {isDynamic ? (
        <NodeField label="Data Source">
          <select
            value={dynamicSource}
            onChange={(e) => {
              window.dispatchEvent(
                new CustomEvent('node:update', {
                  detail: { nodeId: id, data: { dynamicSource: e.target.value } },
                })
              );
            }}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="departments">Departments</option>
            <option value="custom">Custom API</option>
          </select>
        </NodeField>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">Sections</label>
            <button
              onClick={addSection}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Section
            </button>
          </div>

          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="p-2 bg-gray-50 rounded border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Section {sectionIndex + 1}</span>
                <button
                  onClick={() => removeSection(sectionIndex)}
                  className="p-0.5 hover:bg-red-100 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-red-600" />
                </button>
              </div>

              <input
                type="text"
                value={section.title}
                onChange={(e) => updateSection(sectionIndex, 'title', e.target.value)}
                placeholder="Section title"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Rows</span>
                  <button
                    onClick={() => addRow(sectionIndex)}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    + Add Row
                  </button>
                </div>

                {section.rows?.map((row, rowIndex) => (
                  <div key={row.id} className="p-1.5 bg-white rounded border border-gray-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Row {rowIndex + 1}</span>
                      <button
                        onClick={() => removeRow(sectionIndex, rowIndex)}
                        className="p-0.5 hover:bg-red-50 rounded"
                      >
                        <X className="w-2.5 h-2.5 text-red-500" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateRow(sectionIndex, rowIndex, 'title', e.target.value)}
                      placeholder="Row title"
                      className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <input
                      type="text"
                      value={row.description || ''}
                      onChange={(e) => updateRow(sectionIndex, rowIndex, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseNodeWrapper>
  );
});
