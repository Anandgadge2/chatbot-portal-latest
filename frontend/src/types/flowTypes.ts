// Flow Builder Type Definitions

import { Node, Edge } from 'reactflow';

// ============================================================================
// Node Types
// ============================================================================

export type NodeType =
  | 'textMessage'
  | 'templateMessage'
  | 'buttonMessage'
  | 'listMessage'
  | 'mediaMessage'
  | 'condition'
  | 'apiCall'
  | 'assignDepartment'
  | 'userInput'
  | 'delay'
  | 'end'
  | 'dynamicResponse'
  | 'start';

// ============================================================================
// Node Data Structures
// ============================================================================

export interface BaseNodeData {
  label: string;
  description?: string;
  isValid?: boolean;
  errors?: string[];
}

export interface TextMessageNodeData extends BaseNodeData {
  messageText: string;
  variables?: string[];
  language?: 'en' | 'hi' | 'or' | 'mr';
}

export interface TemplateMessageNodeData extends BaseNodeData {
  templateId?: string;
  templateName?: string;
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    content: string;
  };
  body: string;
  footer?: string;
  buttons?: Array<{
    type: 'quick_reply' | 'call' | 'url';
    text: string;
    value?: string;
  }>;
}

export interface ButtonMessageNodeData extends BaseNodeData {
  messageText: string;
  buttons: Array<{
    id: string;
    text: string;
    type: 'quick_reply' | 'call' | 'url';
    value?: string;
  }>;
}

export interface ListMessageNodeData extends BaseNodeData {
  messageText: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
  isDynamic?: boolean;
  dynamicSource?: 'departments' | 'custom';
}

export interface MediaMessageNodeData extends BaseNodeData {
  mediaType: 'image' | 'video' | 'audio' | 'document';
  mediaUrl: string;
  caption?: string;
}

export interface ConditionNodeData extends BaseNodeData {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value: any;
  trueLabel?: string;
  falseLabel?: string;
}

export interface ApiCallNodeData extends BaseNodeData {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  headers?: Record<string, string>;
  body?: Record<string, any>;
  saveResponseTo?: string;
  responseMapping?: Record<string, string>;
}

export interface AssignDepartmentNodeData extends BaseNodeData {
  departmentId?: string;
  departmentName?: string;
  isDynamic?: boolean;
  conditionField?: string;
}

export interface UserInputNodeData extends BaseNodeData {
  messageText: string;
  inputType: 'text' | 'number' | 'email' | 'phone' | 'date' | 'image' | 'document' | 'location';
  saveToField: string;
  validation?: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    errorMessage?: string;
  };
  placeholder?: string;
}

export interface DelayNodeData extends BaseNodeData {
  duration: number;
  unit: 'seconds' | 'minutes' | 'hours';
  delayType: 'fixed' | 'random';
  randomRange?: {
    min: number;
    max: number;
  };
}

export interface EndNodeData extends BaseNodeData {
  endMessage?: string;
  clearSession?: boolean;
}

export interface DynamicResponseNodeData extends BaseNodeData {
  template: string;
  dataSource: string;
  fallbackMessage?: string;
}

export interface StartNodeData extends BaseNodeData {
  trigger: string;
  triggerType: 'keyword' | 'button_click' | 'menu_selection';
}

// Union type for all node data
export type FlowNodeData =
  | TextMessageNodeData
  | TemplateMessageNodeData
  | ButtonMessageNodeData
  | ListMessageNodeData
  | MediaMessageNodeData
  | ConditionNodeData
  | ApiCallNodeData
  | AssignDepartmentNodeData
  | UserInputNodeData
  | DelayNodeData
  | EndNodeData
  | DynamicResponseNodeData
  | StartNodeData;

// ============================================================================
// Flow Types
// ============================================================================

export interface FlowNode extends Node {
  type: NodeType;
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  label?: string;
  animated?: boolean;
  style?: React.CSSProperties;
  markerEnd?: string;
}

export interface FlowMetadata {
  id?: string;
  name: string;
  description?: string;
  companyId: string;
  version: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface Flow {
  metadata: FlowMetadata;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  nodeId?: string;
  edgeId?: string;
  type: 'error' | 'warning';
  message: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// Backend API Types
// ============================================================================

export interface BackendFlowStep {
  stepId: string;
  stepType: 'message' | 'buttons' | 'list' | 'input' | 'media' | 'condition' | 'api_call' | 'delay' | 'assign_department' | 'dynamic_response';
  stepName: string;
  messageText?: string;
  buttons?: Array<{
    id: string;
    title: string;
    description?: string;
    nextStepId?: string;
    action?: 'next' | 'end' | 'restart' | 'goto';
  }>;
  listConfig?: {
    listSource?: 'manual' | 'departments';
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
        nextStepId?: string;
      }>;
    }>;
  };
  inputConfig?: {
    inputType: 'text' | 'number' | 'email' | 'phone' | 'date' | 'image' | 'document' | 'location';
    validation?: {
      required: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      errorMessage?: string;
    };
    placeholder?: string;
    saveToField: string;
    nextStepId?: string;
  };
  mediaConfig?: {
    mediaType: 'image' | 'document' | 'video';
    mediaUrl?: string;
    optional: boolean;
    saveToField?: string;
    nextStepId?: string;
  };
  conditionConfig?: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
    value: any;
    trueStepId: string;
    falseStepId: string;
  };
  apiConfig?: {
    method: 'GET' | 'POST' | 'PUT';
    endpoint: string;
    headers?: Record<string, string>;
    body?: Record<string, any>;
    saveResponseTo?: string;
    nextStepId?: string;
  };
  delayConfig?: {
    duration: number;
    unit: 'seconds' | 'minutes' | 'hours';
  };
  assignDepartmentConfig?: {
    departmentId?: string;
    isDynamic?: boolean;
    conditionField?: string;
  };
  expectedResponses?: Array<{
    type: 'text' | 'button_click' | 'list_selection' | 'any';
    value: string;
    nextStepId?: string;
  }>;
  nextStepId?: string;
  position?: {
    x: number;
    y: number;
  };
}

export interface BackendFlow {
  _id?: string;
  flowId?: string;
  companyId: string;
  flowName: string;
  name?: string; // For backend validation compatibility
  flowDescription?: string;
  description?: string; // For backend validation compatibility
  flowType: 'grievance' | 'appointment' | 'tracking' | 'custom';
  isActive: boolean;
  version: number;
  isPreTransformed?: boolean;
  startStepId: string;
  steps: BackendFlowStep[];
  triggers: Array<{
    triggerType: 'keyword' | 'button_click' | 'menu_selection' | 'webhook';
    triggerValue: string;
    startStepId: string;
  }>;
  supportedLanguages: string[];
  defaultLanguage: string;
  settings: {
    sessionTimeout: number;
    enableTypingIndicator: boolean;
    enableReadReceipts: boolean;
    maxRetries: number;
    errorFallbackMessage: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

// ============================================================================
// Node Palette Types
// ============================================================================

export interface NodePaletteItem {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'message' | 'logic' | 'integration' | 'control';
  defaultData: Partial<FlowNodeData>;
}

// ============================================================================
// Editor State Types
// ============================================================================

export interface EditorState {
  selectedNode: FlowNode | null;
  selectedEdge: FlowEdge | null;
  isDragging: boolean;
  isConnecting: boolean;
  clipboard: FlowNode | null;
  history: {
    past: Flow[];
    present: Flow;
    future: Flow[];
  };
}
