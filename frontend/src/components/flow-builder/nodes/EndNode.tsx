'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { StopCircle } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { EndNodeData } from '@/types/flowTypes';

export default memo(function EndNode({ data, selected, id }: NodeProps) {
  const nodeData = data as EndNodeData;
  const endMessage = nodeData.endMessage || '';

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<StopCircle className="w-4 h-4" />}
      color="red"
      preview={endMessage}
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
      <NodeField label="End Message">
        <textarea
          value={endMessage}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { endMessage: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          rows={3}
          placeholder="Thank you message..."
        />
      </NodeField>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={nodeData.clearSession || false}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { clearSession: e.target.checked } },
              })
            );
          }}
          className="w-3 h-3 text-red-600 border-gray-300 rounded focus:ring-red-500"
        />
        <label className="text-xs text-gray-700">Clear Session</label>
      </div>
    </BaseNodeWrapper>
  );
});
