'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { FlowNode, FlowEdge, Flow, NodeType } from '@/types/flowTypes';
import { generateNodeId, generateEdgeId } from '@/lib/flowTransform';
import { validateFlow } from '@/lib/flowValidation';
import NodeSidebar from '../flow-builder/NodeSidebar';
import FlowToolbar from '../flow-builder/FlowToolbar';
import NodeConfigPanel from '../flow-builder/NodeConfigPanel';
import { toast } from 'react-hot-toast';

// Import custom node components
import TextMessageNode from '../flow-builder/nodes/TextMessageNode';
import ButtonMessageNode from '../flow-builder/nodes/ButtonMessageNode';
import ListMessageNode from '../flow-builder/nodes/ListMessageNode';
import UserInputNode from '../flow-builder/nodes/UserInputNode';
import ConditionNode from '../flow-builder/nodes/ConditionNode';
import ApiCallNode from '../flow-builder/nodes/ApiCallNode';
import MediaMessageNode from '../flow-builder/nodes/MediaMessageNode';
import AssignDepartmentNode from '../flow-builder/nodes/AssignDepartmentNode';
import DelayNode from '../flow-builder/nodes/DelayNode';
import EndNode from '../flow-builder/nodes/EndNode';
import StartNode from '../flow-builder/nodes/StartNode';

// Define custom node types for React Flow
const nodeTypes = {
  textMessage: TextMessageNode,
  buttonMessage: ButtonMessageNode,
  listMessage: ListMessageNode,
  userInput: UserInputNode,
  condition: ConditionNode,
  apiCall: ApiCallNode,
  mediaMessage: MediaMessageNode,
  assignDepartment: AssignDepartmentNode,
  delay: DelayNode,
  end: EndNode,
  start: StartNode,
};

interface FlowCanvasProps {
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  onSave?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  showToolbarSave?: boolean;
  onToolbarSave?: (nodes: FlowNode[], edges: FlowEdge[], name: string) => void;
  flowName?: string;
  showToolbarName?: boolean;
}

interface HistoryState {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export default function FlowCanvas({ 
  initialNodes = [], 
  initialEdges = [], 
  onSave,
  showToolbarSave = true,
  onToolbarSave,
  flowName,
  showToolbarName = true
}: FlowCanvasProps = {}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  // Undo/Redo state
  const [history, setHistory] = useState<HistoryState[]>([{ nodes: initialNodes, edges: initialEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Save to history whenever nodes or edges change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ nodes: nodes as FlowNode[], edges: edges as FlowEdge[] });
        // Keep max 50 history states
        if (newHistory.length > 50) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, historyIndex]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
      toast.success('Undo');
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
      toast.success('Redo');
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // Expose save method via window event
  useEffect(() => {
    const handleSaveRequest = () => {
      if (onSave) {
        onSave(nodes as FlowNode[], edges as FlowEdge[]);
      }
      // Also dispatch event with data for other listeners
      window.dispatchEvent(
        new CustomEvent('flow:data', {
          detail: { nodes, edges },
        })
      );
    };

    window.addEventListener('flow:save', handleSaveRequest);
    return () => window.removeEventListener('flow:save', handleSaveRequest);
  }, [nodes, edges, onSave]);

  // Listen for toast events from nodes
  useEffect(() => {
    const handleToast = (event: any) => {
      const { type, message } = event.detail;
      if (type === 'error') {
        toast.error(message);
      } else if (type === 'success') {
        toast.success(message);
      } else {
        toast(message);
      }
    };

    window.addEventListener('show:toast', handleToast);
    return () => window.removeEventListener('show:toast', handleToast);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      
      const newEdge: FlowEdge = {
        id: generateEdgeId(params.source, params.target),
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: 'smoothstep',
        animated: false,
      };
      setEdges((eds) => addEdge(params, eds));
      toast.success('Nodes connected successfully');
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as FlowNode);
  }, []);

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle drag end from sidebar
  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      console.log('Drag ended:', event);
      const { active, delta } = event;

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        console.log('Missing reactFlowWrapper or reactFlowInstance');
        return;
      }

      const nodeType = active.id as NodeType;
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      
      console.log('React Flow Bounds:', reactFlowBounds);
      console.log('Active:', active);
      console.log('Delta:', delta);
      
      // Get initial position and calculate final drop position
      let initialX = 0;
      let initialY = 0;
      
      // Get initial position from activatorEvent or active.rect
      if (event.activatorEvent && 'clientX' in event.activatorEvent && 'clientY' in event.activatorEvent) {
        initialX = event.activatorEvent.clientX as number;
        initialY = event.activatorEvent.clientY as number;
      } else if (active.rect?.current?.initial) {
        initialX = active.rect.current.initial.left;
        initialY = active.rect.current.initial.top;
      }
      
      // Calculate final drop position by adding delta
      const finalX = initialX + delta.x;
      const finalY = initialY + delta.y;
      
      console.log('Initial position:', initialX, initialY);
      console.log('Final drop position:', finalX, finalY);
      
      // Check if drop is within canvas bounds using FINAL position
      if (
        finalX < reactFlowBounds.left ||
        finalX > reactFlowBounds.right ||
        finalY < reactFlowBounds.top ||
        finalY > reactFlowBounds.bottom
      ) {
        console.log('Dropped outside canvas bounds');
        return; // Dropped outside canvas
      }
      
      // Convert final drop position to React Flow coordinates
      const position = reactFlowInstance.project({
        x: finalX - reactFlowBounds.left,
        y: finalY - reactFlowBounds.top,
      });

      console.log('Calculated position:', position);

      // Create new node
      const newNode: FlowNode = {
        id: generateNodeId(nodeType),
        type: nodeType,
        position,
        data: getDefaultNodeData(nodeType),
      };

      console.log('Creating node:', newNode);
      setNodes((nds) => nds.concat(newNode));
      toast.success(`${nodeType} node added`);
    },
    [reactFlowInstance, setNodes]
  );

  // Update node data
  const updateNodeData = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...data } };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Delete node
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNode(null);
      toast.success('Node deleted');
    },
    [setNodes, setEdges]
  );

  // Duplicate node
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const nodeToDuplicate = nodes.find((n) => n.id === nodeId) as FlowNode;
      if (!nodeToDuplicate) return;

      const newNode: FlowNode = {
        ...nodeToDuplicate,
        id: generateNodeId(nodeToDuplicate.type),
        type: nodeToDuplicate.type,
        position: {
          x: nodeToDuplicate.position.x + 50,
          y: nodeToDuplicate.position.y + 50,
        },
        data: { ...nodeToDuplicate.data },
      };

      setNodes((nds) => [...nds, newNode]);
      toast.success('Node duplicated');
    },
    [nodes, setNodes]
  );

  // Copy node to clipboard
  const copyNode = useCallback(
    (nodeId: string) => {
      const nodeToCopy = nodes.find((n) => n.id === nodeId);
      if (!nodeToCopy) return;

      localStorage.setItem('copiedNode', JSON.stringify(nodeToCopy));
      toast.success('Node copied to clipboard');
    },
    [nodes]
  );

  // Validate flow
  const handleValidate = useCallback(() => {
    const flow: Flow = {
      metadata: {
        name: 'Current Flow',
        companyId: '',
        version: 1,
        isActive: false,
      },
      nodes: nodes as FlowNode[],
      edges: edges as FlowEdge[],
    };

    const validation = validateFlow(flow);

    if (validation.isValid) {
      toast.success('Flow is valid! ✓');
    } else {
      toast.error(`Flow has ${validation.errors.length} error(s)`);
      validation.errors.forEach((error) => {
        toast.error(error.message, { duration: 5000 });
      });
    }

    if (validation.warnings.length > 0) {
      validation.warnings.forEach((warning) => {
        toast(warning.message, { icon: '⚠️', duration: 4000 });
      });
    }
  }, [nodes, edges]);

  // Event listeners for node actions
  useEffect(() => {
    const handleNodeUpdate = (event: any) => {
      const { nodeId, data } = event.detail;
      updateNodeData(nodeId, data);
    };

    const handleNodeDelete = (event: any) => {
      const { nodeId } = event.detail;
      deleteNode(nodeId);
    };

    const handleNodeDuplicate = (event: any) => {
      const { nodeId } = event.detail;
      duplicateNode(nodeId);
    };

    const handleNodeCopy = (event: any) => {
      const { nodeId } = event.detail;
      copyNode(nodeId);
    };

    const handleAddFromSidebar = (event: any) => {
      const { nodeType } = event.detail;
      
      if (!reactFlowInstance) return;

      // Get the center of the visible viewport
      const { x, y, zoom } = reactFlowInstance.getViewport();
      const canvasCenter = reactFlowInstance.project({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      // Create new node at center of viewport
      const newNode: FlowNode = {
        id: generateNodeId(nodeType),
        type: nodeType,
        position: canvasCenter,
        data: getDefaultNodeData(nodeType),
      };

      setNodes((nds) => nds.concat(newNode));
      toast.success(`${nodeType} node added to canvas`);
    };

    window.addEventListener('node:update', handleNodeUpdate);
    window.addEventListener('node:delete', handleNodeDelete);
    window.addEventListener('node:duplicate', handleNodeDuplicate);
    window.addEventListener('node:copy', handleNodeCopy);
    window.addEventListener('node:add-from-sidebar', handleAddFromSidebar);

    return () => {
      window.removeEventListener('node:update', handleNodeUpdate);
      window.removeEventListener('node:delete', handleNodeDelete);
      window.removeEventListener('node:duplicate', handleNodeDuplicate);
      window.removeEventListener('node:copy', handleNodeCopy);
      window.removeEventListener('node:add-from-sidebar', handleAddFromSidebar);
    };
  }, [updateNodeData, deleteNode, duplicateNode, copyNode, reactFlowInstance, setNodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Delete key - delete selected node
      if (event.key === 'Delete' && selectedNode) {
        deleteNode(selectedNode.id);
      }

      // Ctrl+Z - Undo
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('flowbuilder:undo'));
      }

      // Ctrl+Y or Ctrl+Shift+Z - Redo
      if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'z')) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('flowbuilder:redo'));
      }

      // Ctrl+S - Validate/Save
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        handleValidate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, deleteNode, handleValidate]);

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex h-screen bg-gray-50">
        {/* Left Sidebar - Node Palette */}
        <NodeSidebar />

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <FlowToolbar
            nodes={nodes as FlowNode[]}
            edges={edges as FlowEdge[]}
            onValidate={handleValidate}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            showSave={showToolbarSave}
            onSave={onToolbarSave}
            name={flowName}
            showName={showToolbarName}
          />

          {/* React Flow Canvas */}
          <div ref={reactFlowWrapper} className="flex-1 pb-4 relative" style={{ minHeight: 0 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Controls 
                position="bottom-left"
                showZoom={true}
                showFitView={true}
                showInteractive={true}
                style={{
                  left: '20px',
                  bottom: '20px',
                  zIndex: 10,
                }}
              />
              <MiniMap
                nodeColor={(node) => {
                  switch (node.type) {
                    case 'start':
                      return '#10b981';
                    case 'end':
                      return '#ef4444';
                    case 'condition':
                      return '#f59e0b';
                    case 'apiCall':
                      return '#3b82f6';
                    default:
                      return '#8b5cf6';
                  }
                }}
                className="bg-white border border-gray-200 rounded-lg"
              />
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              
              {/* Instructions Panel */}
              {nodes.length === 0 && (
                <Panel position="top-center" className="bg-white p-4 rounded-lg shadow-lg border border-purple-200">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      👋 Welcome to Flow Builder
                    </h3>
                    <p className="text-sm text-gray-600">
                      Drag nodes from the left sidebar to start building your chatbot flow
                    </p>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>
        </div>

      </div>
    </DndContext>
  );
}

// Helper function to get default data for each node type
function getDefaultNodeData(nodeType: NodeType): any {
  const defaults: Record<NodeType, any> = {
    start: {
      label: 'Start',
      trigger: 'hi',
      triggerType: 'keyword',
    },
    textMessage: {
      label: 'Text Message',
      messageText: 'Hello! How can I help you?',
    },
    buttonMessage: {
      label: 'Button Message',
      messageText: 'Please select an option:',
      buttons: [
        { id: 'btn1', text: 'Option 1', type: 'quick_reply' },
        { id: 'btn2', text: 'Option 2', type: 'quick_reply' },
      ],
    },
    listMessage: {
      label: 'List Message',
      messageText: 'Please select from the list:',
      buttonText: 'Select',
      sections: [
        {
          title: 'Options',
          rows: [
            { id: 'row1', title: 'Option 1', description: 'Description 1' },
            { id: 'row2', title: 'Option 2', description: 'Description 2' },
          ],
        },
      ],
      isDynamic: false,
    },
    userInput: {
      label: 'User Input',
      inputType: 'text',
      saveToField: 'userInput',
      validation: {
        required: true,
        minLength: 1,
        maxLength: 500,
      },
    },
    condition: {
      label: 'Condition',
      field: 'userInput',
      operator: 'equals',
      value: '',
    },
    apiCall: {
      label: 'API Call',
      method: 'GET',
      endpoint: '/api/example',
      headers: {},
      body: {},
    },
    mediaMessage: {
      label: 'Media Message',
      mediaType: 'image',
      mediaUrl: '',
      caption: '',
    },
    assignDepartment: {
      label: 'Assign Department',
      departmentId: '',
      isDynamic: false,
    },
    delay: {
      label: 'Delay',
      duration: 5,
      unit: 'seconds',
      delayType: 'fixed',
    },
    end: {
      label: 'End',
      endMessage: 'Thank you for using our service!',
      clearSession: true,
    },
    templateMessage: {
      label: 'Template Message',
      body: '',
    },
    dynamicResponse: {
      label: 'Dynamic Response',
      template: '',
      dataSource: '',
    },
  };

  return defaults[nodeType] || { label: nodeType };
}
