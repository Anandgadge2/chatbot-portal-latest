// Flow Transformation Utilities
// Converts between React Flow format and backend API format

import { FlowNode, FlowEdge, Flow, BackendFlow, BackendFlowStep, NodeType } from '@/types/flowTypes';

/**
 * Convert React Flow nodes and edges to backend flow format
 */
export function transformToBackendFormat(flow: Flow): BackendFlow {
  const { metadata, nodes, edges } = flow;

  // Transform nodes to backend steps
  const steps: BackendFlowStep[] = nodes.map((node) => transformNodeToStep(node, edges));

  // Find start node
  const startNode = nodes.find((n) => n.type === 'start');
  const startStepId = startNode ? startNode.id : (nodes.length > 0 ? nodes[0].id : 'start');

  // Extract triggers from start node or use default
  const triggers = startNode
    ? [
        {
          triggerType: (startNode.data as any).triggerType || 'keyword',
          triggerValue: (startNode.data as any).trigger || 'hi',
          startStepId: startNode.id,
        },
      ]
    : [
        {
          triggerType: 'keyword' as const,
          triggerValue: 'hi',
          startStepId,
        },
      ];

  return {
    companyId: metadata.companyId,
    flowName: metadata.name,
    name: metadata.name, // Support both formats for backend validation
    flowDescription: metadata.description,
    description: metadata.description, // Support both formats
    flowType: inferFlowType(metadata.name),
    isActive: metadata.isActive,
    version: metadata.version,
    isPreTransformed: true, // Signal backend to skip transformation
    startStepId,
    steps,
    triggers,
    supportedLanguages: ['en', 'hi', 'or'],
    defaultLanguage: 'en',
    settings: {
      sessionTimeout: 30,
      enableTypingIndicator: true,
      enableReadReceipts: true,
      maxRetries: 3,
      errorFallbackMessage: 'We encountered an error. Please try again.',
    },
    createdBy: metadata.createdBy,
    updatedBy: metadata.updatedBy,
  };
}

/**
 * Transform a single React Flow node to backend step format
 */
function transformNodeToStep(node: FlowNode, edges: FlowEdge[]): BackendFlowStep {
  const baseStep: BackendFlowStep = {
    stepId: node.id,
    stepType: mapNodeTypeToStepType(node.type),
    stepName: node.data.label,
    position: node.position,
  };

  // Find next step from outgoing edges
  const outgoingEdge = edges.find((e) => e.source === node.id);
  if (outgoingEdge) {
    baseStep.nextStepId = outgoingEdge.target;
  }

  // Add type-specific configuration
  switch (node.type) {
    case 'textMessage':
      return {
        ...baseStep,
        messageText: (node.data as any).messageText || '',
      };

    case 'buttonMessage':
      const buttonData = node.data as any;
      return {
        ...baseStep,
        stepType: 'buttons',
        messageText: buttonData.messageText || '',
        buttons: buttonData.buttons?.map((btn: any, index: number) => {
          // Find edge for this button
          const buttonEdge = edges.find(
            (e) => e.source === node.id && e.sourceHandle === `button-${index}`
          );
          return {
            id: btn.id,
            title: btn.text,
            description: '',
            nextStepId: buttonEdge?.target,
            action: 'next' as const,
          };
        }) || [],
      };

    case 'listMessage':
      const listData = node.data as any;
      return {
        ...baseStep,
        stepType: 'list',
        messageText: listData.messageText || '',
        listConfig: {
          listSource: listData.isDynamic ? 'departments' : 'manual',
          buttonText: listData.buttonText || 'Select',
          sections: listData.sections || [],
        },
      };

    case 'userInput':
      const inputData = node.data as any;
      return {
        ...baseStep,
        stepType: 'input',
        messageText: `Please provide your ${inputData.saveToField}:`,
        inputConfig: {
          inputType: inputData.inputType,
          validation: inputData.validation,
          placeholder: inputData.placeholder,
          saveToField: inputData.saveToField,
          nextStepId: baseStep.nextStepId,
        },
      };

    case 'condition':
      const conditionData = node.data as any;
      const trueEdge = edges.find(
        (e) => e.source === node.id && e.sourceHandle === 'true'
      );
      const falseEdge = edges.find(
        (e) => e.source === node.id && e.sourceHandle === 'false'
      );
      return {
        ...baseStep,
        stepType: 'condition',
        conditionConfig: {
          field: conditionData.field,
          operator: conditionData.operator,
          value: conditionData.value,
          trueStepId: trueEdge?.target || '',
          falseStepId: falseEdge?.target || '',
        },
      };

    case 'apiCall':
      const apiData = node.data as any;
      return {
        ...baseStep,
        stepType: 'api_call',
        apiConfig: {
          method: apiData.method,
          endpoint: apiData.endpoint,
          headers: apiData.headers,
          body: apiData.body,
          saveResponseTo: apiData.saveResponseTo,
          nextStepId: baseStep.nextStepId,
        },
      };

    case 'mediaMessage':
      const mediaData = node.data as any;
      return {
        ...baseStep,
        stepType: 'media',
        messageText: mediaData.caption || '',
        mediaConfig: {
          mediaType: mediaData.mediaType,
          mediaUrl: mediaData.mediaUrl,
          optional: false,
          nextStepId: baseStep.nextStepId,
        },
      };

    case 'delay':
      const delayData = node.data as any;
      return {
        ...baseStep,
        stepType: 'delay',
        delayConfig: {
          duration: delayData.duration,
          unit: delayData.unit,
        },
      };

    case 'assignDepartment':
      const deptData = node.data as any;
      return {
        ...baseStep,
        stepType: 'assign_department',
        assignDepartmentConfig: {
          departmentId: deptData.departmentId,
          isDynamic: deptData.isDynamic,
          conditionField: deptData.conditionField,
        },
      };

    case 'end':
      return {
        ...baseStep,
        stepType: 'message',
        messageText: (node.data as any).endMessage || 'Thank you!',
      };

    default:
      return baseStep;
  }
}

/**
 * Convert backend flow format to React Flow nodes and edges
 */
export function transformFromBackendFormat(backendFlow: BackendFlow): Flow {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Transform steps to nodes
  backendFlow.steps.forEach((step, index) => {
    const node = transformStepToNode(step, index);
    nodes.push(node);

    // Create edges from nextStepId
    if (step.nextStepId) {
      edges.push({
        id: `${step.stepId}-${step.nextStepId}`,
        source: step.stepId,
        target: step.nextStepId,
        type: 'smoothstep',
      });
    }

    // Create edges for buttons
    if (step.buttons) {
      step.buttons.forEach((btn, btnIndex) => {
        if (btn.nextStepId) {
          edges.push({
            id: `${step.stepId}-btn${btnIndex}-${btn.nextStepId}`,
            source: step.stepId,
            target: btn.nextStepId,
            sourceHandle: `button-${btnIndex}`,
            type: 'smoothstep',
            label: btn.title,
          });
        }
      });
    }

    // Create edges for conditions
    if (step.conditionConfig) {
      if (step.conditionConfig.trueStepId) {
        edges.push({
          id: `${step.stepId}-true-${step.conditionConfig.trueStepId}`,
          source: step.stepId,
          target: step.conditionConfig.trueStepId,
          sourceHandle: 'true',
          type: 'smoothstep',
          label: 'True',
          animated: true,
        });
      }
      if (step.conditionConfig.falseStepId) {
        edges.push({
          id: `${step.stepId}-false-${step.conditionConfig.falseStepId}`,
          source: step.stepId,
          target: step.conditionConfig.falseStepId,
          sourceHandle: 'false',
          type: 'smoothstep',
          label: 'False',
        });
      }
    }
  });

  return {
    metadata: {
      id: backendFlow._id,
      name: backendFlow.flowName,
      description: backendFlow.flowDescription,
      companyId: backendFlow.companyId,
      version: backendFlow.version,
      isActive: backendFlow.isActive,
      createdAt: backendFlow.createdAt,
      updatedAt: backendFlow.updatedAt,
      createdBy: backendFlow.createdBy,
      updatedBy: backendFlow.updatedBy,
    },
    nodes,
    edges,
  };
}

/**
 * Transform backend step to React Flow node
 */
function transformStepToNode(step: BackendFlowStep, index: number): FlowNode {
  const nodeType = mapStepTypeToNodeType(step.stepType);
  
  // Use saved position or auto-layout
  const position = step.position || {
    x: 250,
    y: index * 150 + 50,
  };

  const baseNode: FlowNode = {
    id: step.stepId,
    type: nodeType,
    position,
    data: {
      label: step.stepName,
    },
  };

  // Add type-specific data
  switch (step.stepType) {
    case 'message':
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          messageText: step.messageText || '',
        },
      };

    case 'buttons':
      return {
        ...baseNode,
        type: 'buttonMessage',
        data: {
          ...baseNode.data,
          messageText: step.messageText || '',
          buttons: step.buttons?.map((btn) => ({
            id: btn.id,
            text: btn.title,
            type: 'quick_reply' as const,
          })) || [],
        },
      };

    case 'list':
      return {
        ...baseNode,
        type: 'listMessage',
        data: {
          ...baseNode.data,
          messageText: step.messageText || '',
          buttonText: step.listConfig?.buttonText || 'Select',
          sections: step.listConfig?.sections || [],
          isDynamic: step.listConfig?.listSource === 'departments',
        },
      };

    case 'input':
      return {
        ...baseNode,
        type: 'userInput',
        data: {
          ...baseNode.data,
          inputType: step.inputConfig?.inputType || 'text',
          saveToField: step.inputConfig?.saveToField || '',
          validation: step.inputConfig?.validation,
          placeholder: step.inputConfig?.placeholder,
        },
      };

    case 'condition':
      return {
        ...baseNode,
        type: 'condition',
        data: {
          ...baseNode.data,
          field: step.conditionConfig?.field || '',
          operator: step.conditionConfig?.operator || 'equals',
          value: step.conditionConfig?.value,
        },
      };

    case 'api_call':
      return {
        ...baseNode,
        type: 'apiCall',
        data: {
          ...baseNode.data,
          method: step.apiConfig?.method || 'GET',
          endpoint: step.apiConfig?.endpoint || '',
          headers: step.apiConfig?.headers,
          body: step.apiConfig?.body,
          saveResponseTo: step.apiConfig?.saveResponseTo,
        },
      };

    default:
      return baseNode;
  }
}

/**
 * Map React Flow node type to backend step type
 */
function mapNodeTypeToStepType(nodeType: NodeType): BackendFlowStep['stepType'] {
  const mapping: Record<NodeType, BackendFlowStep['stepType']> = {
    textMessage: 'message',
    templateMessage: 'message',
    buttonMessage: 'buttons',
    listMessage: 'list',
    mediaMessage: 'media',
    condition: 'condition',
    apiCall: 'api_call',
    assignDepartment: 'assign_department',
    userInput: 'input',
    delay: 'delay',
    end: 'message',
    dynamicResponse: 'message',
    start: 'message',
  };
  return mapping[nodeType] || 'message';
}

/**
 * Map backend step type to React Flow node type
 */
function mapStepTypeToNodeType(stepType: BackendFlowStep['stepType']): NodeType {
  const mapping: Record<BackendFlowStep['stepType'], NodeType> = {
    message: 'textMessage',
    buttons: 'buttonMessage',
    list: 'listMessage',
    input: 'userInput',
    media: 'mediaMessage',
    condition: 'condition',
    api_call: 'apiCall',
    delay: 'delay',
    assign_department: 'assignDepartment',
    dynamic_response: 'dynamicResponse',
  };
  return mapping[stepType] || 'textMessage';
}

/**
 * Infer flow type from flow name
 */
function inferFlowType(name: string): 'grievance' | 'appointment' | 'tracking' | 'custom' {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('grievance')) return 'grievance';
  if (nameLower.includes('appointment')) return 'appointment';
  if (nameLower.includes('track')) return 'tracking';
  return 'custom';
}

/**
 * Generate unique node ID
 */
export function generateNodeId(type: NodeType): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique edge ID
 */
export function generateEdgeId(source: string, target: string): string {
  return `${source}-${target}`;
}
