'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { ApiCallNodeData } from '@/types/flowTypes';

export default memo(function ApiCallNode({ data, selected, id }: NodeProps) {
  const nodeData = data as ApiCallNodeData;
  const method = nodeData.method || 'GET';
  const endpoint = nodeData.endpoint || '';
  const saveResponseTo = nodeData.saveResponseTo || '';
  const preview = `${method} ${endpoint || '/api/...'}`;

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<Globe className="w-4 h-4" />}
      color="cyan"
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
      <NodeField label="HTTP Method">
        <select
          value={method}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { method: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
      </NodeField>

      <NodeField label="Endpoint URL">
        <input
          type="text"
          value={endpoint}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { endpoint: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="/api/endpoint"
        />
      </NodeField>

      <NodeField label="Save Response To">
        <input
          type="text"
          value={saveResponseTo}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { saveResponseTo: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="e.g., apiResponse"
        />
      </NodeField>

      <NodeField label="Request Headers (JSON)">
        <textarea
          value={JSON.stringify(nodeData.headers || {}, null, 2)}
          onChange={(e) => {
            try {
              const headers = JSON.parse(e.target.value);
              window.dispatchEvent(
                new CustomEvent('node:update', {
                  detail: { nodeId: id, data: { headers } },
                })
              );
            } catch (err) {
              // Invalid JSON, ignore
            }
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-mono"
          rows={3}
          placeholder='{"Content-Type": "application/json"}'
        />
      </NodeField>

      {(method === 'POST' || method === 'PUT') && (
        <NodeField label="Request Body (JSON)">
          <textarea
            value={JSON.stringify(nodeData.body || {}, null, 2)}
            onChange={(e) => {
              try {
                const body = JSON.parse(e.target.value);
                window.dispatchEvent(
                  new CustomEvent('node:update', {
                    detail: { nodeId: id, data: { body } },
                  })
                );
              } catch (err) {
                // Invalid JSON, ignore
              }
            }}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-mono"
            rows={4}
            placeholder='{"key": "value"}'
          />
        </NodeField>
      )}
    </BaseNodeWrapper>
  );
});
