'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Image as ImageIcon } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { MediaMessageNodeData } from '@/types/flowTypes';

export default memo(function MediaMessageNode({ data, selected, id }: NodeProps) {
  const nodeData = data as MediaMessageNodeData;
  const mediaType = nodeData.mediaType || 'image';
  const mediaUrl = nodeData.mediaUrl || '';
  const caption = nodeData.caption || '';
  const preview = `${mediaType.toUpperCase()}: ${mediaUrl ? mediaUrl.substring(0, 30) + '...' : 'No URL'}`;

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<ImageIcon className="w-4 h-4" />}
      color="pink"
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
      <NodeField label="Media Type">
        <select
          value={mediaType}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { mediaType: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-500"
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="document">Document</option>
        </select>
      </NodeField>

      <NodeField label="Media URL">
        <input
          type="text"
          value={mediaUrl}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { mediaUrl: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-500"
          placeholder="https://example.com/media.jpg"
        />
      </NodeField>

      <NodeField label="Caption (Optional)">
        <textarea
          value={caption}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { caption: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
          rows={2}
          placeholder="Media caption..."
        />
      </NodeField>
    </BaseNodeWrapper>
  );
});
