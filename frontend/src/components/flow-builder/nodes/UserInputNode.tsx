'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Type } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { UserInputNodeData } from '@/types/flowTypes';

export default memo(function UserInputNode({ data, selected, id }: NodeProps) {
  const nodeData = data as UserInputNodeData;
  const messageText = nodeData.messageText || '';
  const inputType = nodeData.inputType || 'text';
  const saveToField = nodeData.saveToField || '';
  const preview = messageText ? (messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText) : `Collect ${inputType} → ${saveToField}`;

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<Type className="w-4 h-4" />}
      color="green"
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
      <NodeField label="Question/Prompt">
        <textarea
          value={messageText}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { messageText: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          rows={3}
          placeholder="Ask the user something..."
        />
      </NodeField>
      <NodeField label="Input Type">
        <select
          value={inputType}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { inputType: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="date">Date</option>
          <option value="image">Image</option>
          <option value="document">Document</option>
          <option value="location">Location</option>
        </select>
      </NodeField>

      <NodeField label="Save To Field">
        <input
          type="text"
          value={saveToField}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { saveToField: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="e.g., userName"
        />
      </NodeField>

      <NodeField label="Placeholder">
        <input
          type="text"
          value={nodeData.placeholder || ''}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { placeholder: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Placeholder text..."
        />
      </NodeField>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={nodeData.validation?.required || false}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: {
                  nodeId: id,
                  data: {
                    validation: {
                      ...nodeData.validation,
                      required: e.target.checked,
                    },
                  },
                },
              })
            );
          }}
          className="w-3 h-3 text-green-600 border-gray-300 rounded focus:ring-green-500"
        />
        <label className="text-xs text-gray-700">Required</label>
      </div>
    </BaseNodeWrapper>
  );
});
