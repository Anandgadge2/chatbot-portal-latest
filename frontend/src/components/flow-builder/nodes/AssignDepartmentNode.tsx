'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Users } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { AssignDepartmentNodeData } from '@/types/flowTypes';

export default memo(function AssignDepartmentNode({ data, selected, id }: NodeProps) {
  const nodeData = data as AssignDepartmentNodeData;
  const departmentName = nodeData.departmentName || '';
  const preview = departmentName || 'Select Department';

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<Users className="w-4 h-4" />}
      color="orange"
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
      <NodeField label="Department Name">
        <input
          type="text"
          value={departmentName}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { departmentName: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="e.g., Support, Sales, Billing"
        />
      </NodeField>
    </BaseNodeWrapper>
  );
});
