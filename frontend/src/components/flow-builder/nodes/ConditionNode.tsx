'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { Handle, Position } from 'reactflow';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { ConditionNodeData } from '@/types/flowTypes';

export default memo(function ConditionNode({ data, selected, id }: NodeProps) {
  const nodeData = data as ConditionNodeData;
  const field = nodeData.field || '';
  const operator = nodeData.operator || 'equals';
  const value = nodeData.value || '';
  const preview = `If ${field} ${operator} ${value}`;

  return (
    <div className="relative">
      <BaseNodeWrapper
        data={nodeData}
        selected={selected}
        icon={<GitBranch className="w-4 h-4" />}
        color="amber"
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
        <NodeField label="Field">
          <input
            type="text"
            value={field}
            onChange={(e) => {
              window.dispatchEvent(
                new CustomEvent('node:update', {
                  detail: { nodeId: id, data: { field: e.target.value } },
                })
              );
            }}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="e.g., userInput"
          />
        </NodeField>

        <NodeField label="Operator">
          <select
            value={operator}
            onChange={(e) => {
              window.dispatchEvent(
                new CustomEvent('node:update', {
                  detail: { nodeId: id, data: { operator: e.target.value } },
                })
              );
            }}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="equals">Equals</option>
            <option value="contains">Contains</option>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
            <option value="exists">Exists</option>
            <option value="not_exists">Not Exists</option>
          </select>
        </NodeField>

        <NodeField label="Value">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              window.dispatchEvent(
                new CustomEvent('node:update', {
                  detail: { nodeId: id, data: { value: e.target.value } },
                })
              );
            }}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Comparison value"
          />
        </NodeField>

        <div className="grid grid-cols-2 gap-2">
          <NodeField label="True Label">
            <input
              type="text"
              value={nodeData.trueLabel || 'True'}
              onChange={(e) => {
                window.dispatchEvent(
                  new CustomEvent('node:update', {
                    detail: { nodeId: id, data: { trueLabel: e.target.value } },
                  })
                );
              }}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </NodeField>

          <NodeField label="False Label">
            <input
              type="text"
              value={nodeData.falseLabel || 'False'}
              onChange={(e) => {
                window.dispatchEvent(
                  new CustomEvent('node:update', {
                    detail: { nodeId: id, data: { falseLabel: e.target.value } },
                  })
                );
              }}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </NodeField>
        </div>
      </BaseNodeWrapper>

      {/* Custom handles for true/false branches */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '40%', background: '#10b981' }}
        className="w-3 h-3"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '60%', background: '#ef4444' }}
        className="w-3 h-3"
      />
    </div>
  );
});
