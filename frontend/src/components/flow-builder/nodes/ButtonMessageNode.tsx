'use client';

import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { MousePointerClick, Plus, X, AlertCircle } from 'lucide-react';
import { BaseNodeWrapper, NodeField } from './BaseNodeWrapper';
import { ButtonMessageNodeData } from '@/types/flowTypes';

export default memo(function ButtonMessageNode({ data, selected, id }: NodeProps) {
  const nodeData = data as ButtonMessageNodeData;
  const messageText = nodeData.messageText || '';
  const buttons = nodeData.buttons || [];
  const preview = `${messageText.substring(0, 40)}${messageText.length > 40 ? '...' : ''} (${buttons.length} buttons)`;

  // Count button types for WhatsApp limits
  const quickReplyCount = buttons.filter(b => b.type === 'quick_reply').length;
  const ctaCount = buttons.filter(b => b.type === 'call' || b.type === 'url').length;

  // Check if we can add more buttons
  const canAddButton = buttons.length < 5;
  const canAddQuickReply = quickReplyCount < 3;
  const canAddCTA = ctaCount < 2;

  const addButton = () => {
    // Check WhatsApp limits
    if (buttons.length >= 5) {
      window.dispatchEvent(
        new CustomEvent('show:toast', {
          detail: { 
            type: 'error', 
            message: '❌ Cannot add button\n📍 Location: Button Message node\n⚠️ Error: Maximum 5 buttons allowed\n💡 Solution: Remove a button before adding new one' 
          },
        })
      );
      return;
    }

    const newButton = {
      id: `btn_${Date.now()}`,
      text: 'New Button',
      type: 'quick_reply' as const,
    };
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { buttons: [...buttons, newButton] } },
      })
    );
  };

  const removeButton = (index: number) => {
    const newButtons = buttons.filter((_, i) => i !== index);
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { buttons: newButtons } },
      })
    );
  };

  const updateButton = (index: number, field: string, value: any) => {
    const newButtons = [...buttons];
    const oldType = newButtons[index].type;
    const newType = value;

    // Check WhatsApp limits when changing button type
    if (field === 'type' && oldType !== newType) {
      if (newType === 'quick_reply') {
        const currentQuickReply = buttons.filter(b => b.type === 'quick_reply').length;
        if (currentQuickReply >= 3) {
          window.dispatchEvent(
            new CustomEvent('show:toast', {
              detail: { 
                type: 'error', 
                message: `❌ Cannot change to Quick Reply\n📍 Location: Button ${index + 1} in Button Message node\n⚠️ Error: Maximum 3 Quick Reply buttons allowed (currently ${currentQuickReply})\n💡 Solution: Change another button to Call/URL first, or keep current type` 
              },
            })
          );
          return;
        }
      } else if (newType === 'call' || newType === 'url') {
        const currentCTA = buttons.filter(b => b.type === 'call' || b.type === 'url').length;
        if (currentCTA >= 2) {
          window.dispatchEvent(
            new CustomEvent('show:toast', {
              detail: { 
                type: 'error', 
                message: `❌ Cannot change to ${newType === 'call' ? 'Call' : 'URL'}\n📍 Location: Button ${index + 1} in Button Message node\n⚠️ Error: Maximum 2 CTA buttons allowed (currently ${currentCTA})\n💡 Solution: Change another button to Quick Reply first, or keep current type` 
              },
            })
          );
          return;
        }
      }
    }

    newButtons[index] = { ...newButtons[index], [field]: value };
    window.dispatchEvent(
      new CustomEvent('node:update', {
        detail: { nodeId: id, data: { buttons: newButtons } },
      })
    );
  };

  // Get available button types for a specific button
  const getAvailableTypes = (currentType: string) => {
    const types = [
      { value: 'quick_reply', label: 'Quick Reply', available: true },
      { value: 'call', label: 'Call', available: true },
      { value: 'url', label: 'URL', available: true },
    ];

    // If changing from current type would exceed limits, disable that option
    types.forEach(type => {
      if (type.value === currentType) {
        type.available = true; // Current type is always available
      } else if (type.value === 'quick_reply') {
        type.available = quickReplyCount < 3;
      } else if (type.value === 'call' || type.value === 'url') {
        type.available = ctaCount < 2;
      }
    });

    return types;
  };

  return (
    <BaseNodeWrapper
      data={nodeData}
      selected={selected}
      icon={<MousePointerClick className="w-4 h-4" />}
      color="blue"
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
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          placeholder="Enter message text..."
        />
      </NodeField>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">
            Buttons
            <span className="ml-2 text-xs text-gray-500">
              (QR: {quickReplyCount}/3, CTA: {ctaCount}/2)
            </span>
          </label>
          <button
            onClick={addButton}
            disabled={!canAddButton}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canAddButton ? 'Maximum 5 buttons reached' : 'Add new button'}
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {/* Limits Warning */}
        {(buttons.length >= 5 || quickReplyCount >= 3 || ctaCount >= 2) && (
          <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <AlertCircle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-yellow-800">
              <strong>WhatsApp Limits:</strong>
              {buttons.length >= 5 && <div>• Max 5 buttons reached</div>}
              {quickReplyCount >= 3 && <div>• Max 3 Quick Reply buttons reached</div>}
              {ctaCount >= 2 && <div>• Max 2 CTA buttons reached</div>}
            </div>
          </div>
        )}

        {buttons.map((button, index) => {
          const availableTypes = getAvailableTypes(button.type);
          
          return (
            <div key={button.id} className="relative p-2 bg-gray-50 rounded border border-gray-200 space-y-1.5">
              {/* Connection Handle for each button */}
              <Handle
                type="source"
                position={Position.Right}
                id={`button-${index}`}
                style={{
                  top: '50%',
                  right: -8,
                  width: 12,
                  height: 12,
                  background: '#3b82f6',
                  border: '2px solid white',
                }}
              />
              
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Button {index + 1}</span>
                <button
                  onClick={() => removeButton(index)}
                  className="p-0.5 hover:bg-red-100 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-red-600" />
                </button>
              </div>
              <input
                type="text"
                value={button.text}
                onChange={(e) => updateButton(index, 'text', e.target.value)}
                placeholder="Button text"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={button.type}
                onChange={(e) => updateButton(index, 'type', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {availableTypes.map(type => (
                  <option 
                    key={type.value} 
                    value={type.value}
                    disabled={!type.available}
                  >
                    {type.label} {!type.available ? '(Limit reached)' : ''}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </BaseNodeWrapper>
  );
});
