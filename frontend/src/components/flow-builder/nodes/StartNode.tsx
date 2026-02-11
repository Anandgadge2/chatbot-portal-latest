'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Play } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { StartNodeData } from '@/types/flowTypes';

export default memo(function StartNode({ data, selected, id }: NodeProps) {
  const nodeData = data as StartNodeData;
  const trigger = nodeData.trigger || '';
  const triggerType = nodeData.triggerType || 'keyword';

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<Play className="w-4 h-4" />}
      color="green"
      preview={`Trigger: ${trigger}`}
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
      <NodeField label="Trigger Type">
        <select
          value={triggerType}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { triggerType: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="keyword">Keyword</option>
          <option value="button_click">Button Click</option>
          <option value="menu_selection">Menu Selection</option>
        </select>
      </NodeField>

      <NodeField label="Trigger Value">
        <input
          type="text"
          value={trigger}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { trigger: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="e.g., hi, hello, start"
        />
      </NodeField>
    </BaseNodeWrapper>
  );
});
