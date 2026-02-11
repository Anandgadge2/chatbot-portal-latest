'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Clock } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { DelayNodeData } from '@/types/flowTypes';

export default memo(function DelayNode({ data, selected, id }: NodeProps) {
  const nodeData = data as DelayNodeData;
  const duration = nodeData.duration || 5;
  const unit = nodeData.unit || 'seconds';
  const delayType = nodeData.delayType || 'fixed';
  const preview = delayType === 'fixed' 
    ? `Wait ${duration} ${unit}`
    : `Random ${nodeData.randomRange?.min}-${nodeData.randomRange?.max} ${unit}`;

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<Clock className="w-4 h-4" />}
      color="yellow"
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
      <NodeField label="Delay Type">
        <select
          value={delayType}
          onChange={(e) => {
            window.dispatchEvent(
              new CustomEvent('node:update', {
                detail: { nodeId: id, data: { delayType: e.target.value } },
              })
            );
          }}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
        >
          <option value="fixed">Fixed</option>
          <option value="random">Random</option>
        </select>
      </NodeField>

      {delayType === 'fixed' ? (
        <div className="grid grid-cols-2 gap-2">
          <NodeField label="Duration">
            <input
              type="number"
              value={duration}
              onChange={(e) => {
                window.dispatchEvent(
                  new CustomEvent('node:update', {
                    detail: { nodeId: id, data: { duration: parseInt(e.target.value) || 0 } },
                  })
                );
              }}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
              min="1"
            />
          </NodeField>

          <NodeField label="Unit">
            <select
              value={unit}
              onChange={(e) => {
                window.dispatchEvent(
                  new CustomEvent('node:update', {
                    detail: { nodeId: id, data: { unit: e.target.value } },
                  })
                );
              }}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </NodeField>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NodeField label="Min">
              <input
                type="number"
                value={nodeData.randomRange?.min || 1}
                onChange={(e) => {
                  window.dispatchEvent(
                    new CustomEvent('node:update', {
                      detail: {
                        nodeId: id,
                        data: {
                          randomRange: {
                            ...nodeData.randomRange,
                            min: parseInt(e.target.value) || 0,
                          },
                        },
                      },
                    })
                  );
                }}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                min="1"
              />
            </NodeField>

            <NodeField label="Max">
              <input
                type="number"
                value={nodeData.randomRange?.max || 10}
                onChange={(e) => {
                  window.dispatchEvent(
                    new CustomEvent('node:update', {
                      detail: {
                        nodeId: id,
                        data: {
                          randomRange: {
                            ...nodeData.randomRange,
                            max: parseInt(e.target.value) || 0,
                          },
                        },
                      },
                    })
                  );
                }}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                min="1"
              />
            </NodeField>
          </div>

          <NodeField label="Unit">
            <select
              value={unit}
              onChange={(e) => {
                window.dispatchEvent(
                  new CustomEvent('node:update', {
                    detail: { nodeId: id, data: { unit: e.target.value } },
                  })
                );
              }}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </NodeField>
        </>
      )}
    </BaseNodeWrapper>
  );
});
