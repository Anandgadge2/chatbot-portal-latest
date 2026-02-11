'use client';

import { useState, useEffect, useCallback } from 'react';
import { FlowNode, FlowEdge, Flow } from '@/types/flowTypes';
import { transformToBackendFormat } from '@/lib/flowTransform';
import { validateFlow } from '@/lib/flowValidation';
import { Button } from '@/components/ui/button';
import {
  Save,
  FolderOpen,
  Play,
  Download,
  Upload,
  Undo,
  Redo,
  Settings,
  CheckCircle2,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import FlowSimulator from './FlowSimulator';

interface FlowToolbarProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onValidate: () => void;
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
  showSave?: boolean;
  onSave?: (nodes: FlowNode[], edges: FlowEdge[], name: string) => void;
  name?: string;
  showName?: boolean;
}

// History management
let history: { nodes: FlowNode[]; edges: FlowEdge[] }[] = [];
let historyIndex = -1;

export default function FlowToolbar({
  nodes,
  edges,
  onValidate,
  onNodesChange,
  onEdgesChange,
  showSave = true,
  onSave,
  name,
  showName = true,
}: FlowToolbarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [showSettings, setShowSettings] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  
  // Sync name from props
  useEffect(() => {
    if (name) setFlowName(name);
  }, [name]);
  
  // Settings state
  const [flowType, setFlowType] = useState('grievance');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [enableTypingIndicator, setEnableTypingIndicator] = useState(true);
  const [enableReadReceipts, setEnableReadReceipts] = useState(true);

  // Save current state to history
  const saveToHistory = () => {
    // Remove any future history if we're not at the end
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    
    // Add current state
    history.push({ nodes: [...nodes], edges: [...edges] });
    historyIndex = history.length - 1;
    
    // Limit history to 50 states
    if (history.length > 50) {
      history.shift();
      historyIndex--;
    }
  };

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      historyIndex--;
      const state = history[historyIndex];
      onNodesChange(state.nodes);
      onEdgesChange(state.edges);
      toast.success('Undo');
    } else {
      toast.error('Nothing to undo');
    }
  }, [onNodesChange, onEdgesChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      const state = history[historyIndex];
      onNodesChange(state.nodes);
      onEdgesChange(state.edges);
      toast.success('Redo');
    } else {
      toast.error('Nothing to redo');
    }
  }, [onNodesChange, onEdgesChange]);

  // Listen for keyboard shortcuts from FlowCanvas
  useEffect(() => {
    const handleUndoEvent = () => handleUndo();
    const handleRedoEvent = () => handleRedo();

    window.addEventListener('flowbuilder:undo', handleUndoEvent);
    window.addEventListener('flowbuilder:redo', handleRedoEvent);

    return () => {
      window.removeEventListener('flowbuilder:undo', handleUndoEvent);
      window.removeEventListener('flowbuilder:redo', handleRedoEvent);
    };
  }, [nodes, edges, handleUndo, handleRedo]);

  const handleLoad = async () => {
    try {
      setIsLoading(true);
      // Try to load from localStorage first as fallback
      const savedFlow = localStorage.getItem('flowbuilder_current_flow');
      
      if (savedFlow) {
        const flow: Flow = JSON.parse(savedFlow);
        saveToHistory(); // Save current state before loading
        onNodesChange(flow.nodes || []);
        onEdgesChange(flow.edges || []);
        setFlowName(flow.metadata?.name || 'Loaded Flow');
        toast.success('Flow loaded from local storage');
        return;
      }

      // Try backend API
      const response = await axios.get('/api/chatbot-flows');
      
      if (response.data.success && response.data.flows?.length > 0) {
        const flow = response.data.flows[0];
        saveToHistory();
        onNodesChange(flow.nodes || []);
        onEdgesChange(flow.edges || []);
        setFlowName(flow.metadata?.name || 'Loaded Flow');
        toast.success('Flow loaded successfully');
      } else {
        toast.error('No saved flows found');
      }
    } catch (error: any) {
      console.error('Load error:', error);
      toast.error('No saved flows available. Create and save a flow first.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = () => {
    // Validate first
    const flow: Flow = {
      metadata: {
        name: flowName,
        companyId: '',
        version: 1,
        isActive: false,
      },
      nodes,
      edges,
    };

    const validation = validateFlow(flow);

    if (!validation.isValid) {
      toast.error('Please fix validation errors before testing');
      onValidate();
      return;
    }

    // Show WhatsApp simulator
    setShowTestDialog(true);
  };

  const handleSave = async () => {
    // If a custom onSave handler is provided, use it
    if (onSave) {
      onSave(nodes, edges, flowName);
      return;
    }

    // Save to history before saving
    saveToHistory();

    // Validate first
    const flow: Flow = {
      metadata: {
        name: flowName,
        companyId: '', // Will be set from user context
        version: 1,
        isActive: false,
      },
      nodes,
      edges,
    };

    const validation = validateFlow(flow);

    if (!validation.isValid) {
      toast.error(`Cannot save: Flow has ${validation.errors.length} error(s)`);
      validation.errors.slice(0, 3).forEach((error) => {
        toast.error(error.message, { duration: 5000 });
      });
      return;
    }

    try {
      setIsSaving(true);

      // Save to localStorage as backup
      localStorage.setItem('flowbuilder_current_flow', JSON.stringify(flow));

      // Transform to backend format
      const backendFlow = transformToBackendFormat(flow);

      // Try to save to backend
      try {
        const response = await axios.post('/api/chatbot-flows', backendFlow);

        if (response.data.success) {
          toast.success('✅ Flow saved successfully!');
        } else {
          // Show success for local save only
          toast.success('✅ Flow saved locally');
        }
      } catch (apiError) {
        // If API fails, we still have localStorage backup
        // Just show success for local save without warning about server
        console.log('Backend API not available, flow saved locally');
        toast.success('✅ Flow saved locally');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error('Failed to save flow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const flow: Flow = {
      metadata: {
        name: flowName,
        companyId: '',
        version: 1,
        isActive: false,
      },
      nodes,
      edges,
    };

    const dataStr = JSON.stringify(flow, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${flowName.replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Flow exported successfully');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const rawData = JSON.parse(event.target?.result as string);
          
          // Basic normalization for different formats
          const nodes = (rawData.nodes || []).map((node: any) => {
            const data = { ...node.data };
            
            // Map legacy/external fields
            if (node.type === 'userInput' && node.data?.promptMessage) {
              data.messageText = node.data.promptMessage;
            }
            if (node.type === 'end' && node.data?.message) {
              data.endMessage = node.data.message;
            }
            if (node.type === 'textMessage' && node.data?.text) {
              data.messageText = node.data.text;
            }
            if (node.type === 'buttonMessage' && node.data?.text) {
              data.messageText = node.data.text;
            }

            return { ...node, data };
          });

          const edges = rawData.edges || [];
          
          // Handle missing metadata
          const name = rawData.metadata?.name || rawData.name || rawData.flowName || 'Imported Flow';
          
          saveToHistory();
          onNodesChange(nodes);
          onEdgesChange(edges);
          setFlowName(name);
          
          toast.success('Flow imported successfully');
        } catch (error) {
          console.error('Import error:', error);
          toast.error('Invalid flow file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left Section - Flow Name */}
          <div className="flex items-center gap-3">
            {showName && (
              <input
                type="text"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-2 py-1"
                placeholder="Flow Name"
              />
            )}
            <span className="text-sm text-gray-500">
              {nodes.length} node{nodes.length !== 1 ? 's' : ''}, {edges.length} connection
              {edges.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2">
            {/* Undo */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </Button>

            {/* Redo */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* Load */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoad}
              className="gap-2"
              disabled={isLoading}
              title="Load saved flow"
            >
              <FolderOpen className="w-4 h-4" />
              {isLoading ? 'Loading...' : 'Load'}
            </Button>

            {/* Test */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              className="gap-2"
              disabled={nodes.length === 0 || isTesting}
              title="Test flow"
            >
              <Play className="w-4 h-4" />
              {isTesting ? 'Testing...' : 'Test'}
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              title="Flow settings"
              className={showSettings ? 'bg-gray-100' : ''}
            >
              <Settings className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* Validate */}
            <Button
              variant="outline"
              size="sm"
              onClick={onValidate}
              className="gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Validate
            </Button>

            {/* Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2"
              disabled={nodes.length === 0}
              title="Export as JSON"
            >
              <Download className="w-4 h-4" />
            </Button>

            {/* Import */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              className="gap-2"
              title="Import from JSON"
            >
              <Upload className="w-4 h-4" />
            </Button>

            {/* Save */}
            {showSave && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || nodes.length === 0}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Flow Settings</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-gray-700 mb-1 font-medium">Flow Type</label>
                <select 
                  className="w-full border border-gray-300 rounded px-3 py-1.5"
                  value={flowType}
                  onChange={(e) => setFlowType(e.target.value)}
                >
                  <option value="grievance">Grievance</option>
                  <option value="appointment">Appointment</option>
                  <option value="tracking">Tracking</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1 font-medium">Default Language</label>
                <select 
                  className="w-full border border-gray-300 rounded px-3 py-1.5"
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="or">Odia</option>
                  <option value="mr">Marathi</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="rounded"
                    checked={enableTypingIndicator}
                    onChange={(e) => setEnableTypingIndicator(e.target.checked)}
                  />
                  <span>Enable typing indicator</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="rounded"
                    checked={enableReadReceipts}
                    onChange={(e) => setEnableReadReceipts(e.target.checked)}
                  />
                  <span>Enable read receipts</span>
                </label>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-600">
                  <strong>Current settings:</strong> {flowType} flow in {defaultLanguage === 'en' ? 'English' : defaultLanguage === 'hi' ? 'Hindi' : defaultLanguage === 'or' ? 'Odia' : 'Marathi'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Shortcuts:</span> Ctrl+S to validate • Ctrl+Z undo • Ctrl+Y redo • Delete to remove node
        </div>
      </div>

      {/* WhatsApp Flow Simulator */}
      {showTestDialog && (
        <FlowSimulator
          nodes={nodes}
          edges={edges}
          flowName={flowName}
          onClose={() => setShowTestDialog(false)}
        />
      )}
    </>
  );
}
