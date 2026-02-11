'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { TextMessageNodeData } from '@/types/flowTypes';

export default memo(function TextMessageNode({ data, selected, id }: NodeProps) {
  const nodeData = data as TextMessageNodeData;
  const messageText = nodeData.messageText || '';
  const preview = messageText.length > 80 ? messageText.substring(0, 80) + '...' : messageText;

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<MessageSquare className="w-4 h-4" />}
      color="purple"
      preview={preview}
      nodeId={id}
      onDelete={() => {
        // Dispatch custom event for deletion
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
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          rows={4}
          placeholder="Enter your message..."
        />
      </NodeField>

      <NodeField label="Language">
        <select
          value={nodeData.language || 'en'}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { language: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="or">Oriya</option>
          <option value="mr">Marathi</option>
        </select>
      </NodeField>
    </BaseNodeWrapper>
  );
});
