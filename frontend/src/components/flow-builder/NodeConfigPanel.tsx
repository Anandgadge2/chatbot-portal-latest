'use client';

import { FlowNode } from '@/types/flowTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '../ui/textarea';
import { X, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NodeConfigPanelProps {
  node: FlowNode;
  onUpdate: (data: any) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function NodeConfigPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: NodeConfigPanelProps) {
  const [localData, setLocalData] = useState(node.data);

  // Update local data when node changes
  useEffect(() => {
    setLocalData(node.data);
  }, [node]);

  const handleChange = (field: string, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdate(newData);
  };

  const renderConfigFields = () => {
    switch (node.type) {
      case 'textMessage':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={localData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder="Text Message"
              />
            </div>
            <div>
              <Label htmlFor="messageText">Message Text</Label>
              <Textarea
                id="messageText"
                value={(localData as any).messageText || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('messageText', e.target.value)}
                placeholder="Enter your message..."
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {'{'}variable{'}'} for dynamic content
              </p>
            </div>
          </div>
        );

      case 'buttonMessage':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={localData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="messageText">Message Text</Label>
              <Textarea
                id="messageText"
                value={(localData as any).messageText || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('messageText', e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Buttons (Max 3)</Label>
              {((localData as any).buttons || []).map((btn: any, index: number) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Input
                    value={btn.text}
                    onChange={(e) => {
                      const newButtons = [...(localData as any).buttons];
                      newButtons[index] = { ...btn, text: e.target.value };
                      handleChange('buttons', newButtons);
                    }}
                    placeholder={`Button ${index + 1} (max 20 chars)`}
                    maxLength={20}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newButtons = (localData as any).buttons.filter(
                        (_: any, i: number) => i !== index
                      );
                      handleChange('buttons', newButtons);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {((localData as any).buttons || []).length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    const newButtons = [
                      ...((localData as any).buttons || []),
                      { id: `btn${Date.now()}`, text: '', type: 'quick_reply' },
                    ];
                    handleChange('buttons', newButtons);
                  }}
                >
                  Add Button
                </Button>
              )}
            </div>
          </div>
        );

      case 'userInput':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={localData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="saveToField">Save To Field</Label>
              <Input
                id="saveToField"
                value={(localData as any).saveToField || ''}
                onChange={(e) => handleChange('saveToField', e.target.value)}
                placeholder="e.g., citizenName, email"
              />
            </div>
            <div>
              <Label htmlFor="inputType">Input Type</Label>
              <select
                id="inputType"
                value={(localData as any).inputType || 'text'}
                onChange={(e) => handleChange('inputType', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="date">Date</option>
                <option value="image">Image</option>
                <option value="document">Document</option>
              </select>
            </div>
            <div>
              <Label>
                <input
                  type="checkbox"
                  checked={(localData as any).validation?.required || false}
                  onChange={(e) =>
                    handleChange('validation', {
                      ...(localData as any).validation,
                      required: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                Required Field
              </Label>
            </div>
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={localData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="field">Field to Check</Label>
              <Input
                id="field"
                value={(localData as any).field || ''}
                onChange={(e) => handleChange('field', e.target.value)}
                placeholder="e.g., citizenName, category"
              />
            </div>
            <div>
              <Label htmlFor="operator">Operator</Label>
              <select
                id="operator"
                value={(localData as any).operator || 'equals'}
                onChange={(e) => handleChange('operator', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
                <option value="exists">Exists</option>
                <option value="not_exists">Not Exists</option>
              </select>
            </div>
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={(localData as any).value || ''}
                onChange={(e) => handleChange('value', e.target.value)}
                placeholder="Comparison value"
              />
            </div>
          </div>
        );

      case 'apiCall':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={localData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="method">HTTP Method</Label>
              <select
                id="method"
                value={(localData as any).method || 'GET'}
                onChange={(e) => handleChange('method', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input
                id="endpoint"
                value={(localData as any).endpoint || ''}
                onChange={(e) => handleChange('endpoint', e.target.value)}
                placeholder="/api/example"
              />
            </div>
            <div>
              <Label htmlFor="saveResponseTo">Save Response To</Label>
              <Input
                id="saveResponseTo"
                value={(localData as any).saveResponseTo || ''}
                onChange={(e) => handleChange('saveResponseTo', e.target.value)}
                placeholder="e.g., apiResponse"
              />
            </div>
          </div>
        );

      case 'delay':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={localData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                type="number"
                value={(localData as any).duration || 5}
                onChange={(e) => handleChange('duration', parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <select
                id="unit"
                value={(localData as any).unit || 'seconds'}
                onChange={(e) => handleChange('unit', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </div>
        );

      case 'end':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={localData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endMessage">End Message</Label>
              <Textarea
                id="endMessage"
                value={(localData as any).endMessage || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('endMessage', e.target.value)}
                placeholder="Thank you message..."
                rows={4}
              />
            </div>
            <div>
              <Label>
                <input
                  type="checkbox"
                  checked={(localData as any).clearSession || false}
                  onChange={(e) => handleChange('clearSession', e.target.checked)}
                  className="mr-2"
                />
                Clear Session Data
              </Label>
            </div>
          </div>
        );

      default:
        return (
          <div>
            <Label htmlFor="label">Node Label</Label>
            <Input
              id="label"
              value={localData.label || ''}
              onChange={(e) => handleChange('label', e.target.value)}
            />
          </div>
        );
    }
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-2xl z-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
        <div>
          <h3 className="font-semibold text-gray-900">Configure Node</h3>
          <p className="text-sm text-gray-500">{node.type}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Configuration Fields */}
      <div className="flex-1 overflow-y-auto p-4">{renderConfigFields()}</div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2 bg-gray-50">
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}
