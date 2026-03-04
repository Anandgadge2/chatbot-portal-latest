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
  // Support comma-separated triggers
  const triggerString = (startNode?.data as any)?.trigger || 'hi';
  const triggerValues = triggerString.split(',').map((t: string) => t.trim()).filter(Boolean);
  
  const triggers = triggerValues.length > 0 
    ? triggerValues.map((val: string) => ({
        triggerType: (startNode?.data as any)?.triggerType || 'keyword',
        triggerValue: val,
        startStepId: startNode?.id || startStepId,
      }))
    : [
        {
          triggerType: 'keyword' as const,
          triggerValue: 'hi',
          startStepId,
        },
      ];

  return {
    _id: metadata.id,
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
    nodes: nodes, // Pass original nodes for UI reconstruction
    edges: edges  // Pass original edges for UI reconstruction
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

  // Find next step from outgoing edges (general edge without specific handle)
  const outgoingEdge = edges.find((e) => e.source === node.id && !e.sourceHandle);
  if (outgoingEdge) {
    baseStep.nextStepId = outgoingEdge.target;
  }

  // Add type-specific configuration
  switch (node.type) {
    case 'textMessage':
      return {
        ...baseStep,
        messageText: (node.data as any).messageText || '',
        messageTextTranslations: (node.data as any).messageTextTranslations || {}
      };

    case 'buttonMessage':
      const buttonData = node.data as any;
      return {
        ...baseStep,
        stepType: 'buttons',
        messageText: buttonData.messageText || '',
        messageTextTranslations: buttonData.messageTextTranslations || {},
        buttons: buttonData.buttons?.map((btn: any, index: number) => {
          // Find edge for this button: try indexed handle first, then named handle (id)
          const buttonEdge = edges.find(
            (e) => e.source === node.id && (e.sourceHandle === `button-${index}` || e.sourceHandle === btn.id)
          );
          return {
            id: btn.id,
            title: btn.text || btn.title,
            titleTranslations: btn.titleTranslations || {},
            description: btn.description || '',
            nextStepId: buttonEdge?.target || btn.nextStepId || (node.data as any).nextStep,
            action: 'next' as const,
          };
        }) || [],
      };

    case 'listMessage':
      const listData = node.data as any;
      const sections = (listData.sections || []).map((section: any, sIdx: number) => ({
        ...section,
        titleTranslations: section.titleTranslations || {},
        rows: (section.rows || []).map((row: any, rIdx: number) => {
          // Find edge for this row: try indexed handle first (row-sIdx-rIdx), then named handle (row.id)
          const rowEdge = edges.find(
            (e) => e.source === node.id && (e.sourceHandle === `row-${sIdx}-${rIdx}` || e.sourceHandle === row.id)
          );
          return {
            ...row,
            titleTranslations: row.titleTranslations || {},
            descriptionTranslations: row.descriptionTranslations || {},
            nextStepId: rowEdge?.target || row.nextStepId
          };
        })
      }));

      return {
        ...baseStep,
        stepType: 'list',
        messageText: listData.messageText || '',
        messageTextTranslations: listData.messageTextTranslations || {},
        listConfig: {
          listSource: listData.isDynamic ? 'departments' : 'manual',
          buttonText: listData.buttonText || 'Select',
          buttonTextTranslations: listData.buttonTextTranslations || {},
          sections,
        },
      };

    case 'userInput':
      const inputData = node.data as any;
      // In userInput, the next step usually comes from the default outgoing edge
      const inputNextEdge = edges.find((e) => e.source === node.id);
      return {
        ...baseStep,
        stepType: 'input',
        messageText: inputData.messageText || `Please provide your ${inputData.saveToField}:`,
        messageTextTranslations: inputData.messageTextTranslations || {},
        inputConfig: {
          inputType: inputData.inputType,
          validation: inputData.validation,
          placeholder: inputData.placeholder,
          saveToField: inputData.saveToField,
          nextStepId: inputNextEdge?.target || baseStep.nextStepId,
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
      const apiNextEdge = edges.find((e) => e.source === node.id);
      return {
        ...baseStep,
        stepType: 'api_call',
        apiConfig: {
          method: apiData.method,
          endpoint: apiData.endpoint,
          headers: apiData.headers,
          body: apiData.body,
          saveResponseTo: apiData.saveResponseTo,
          nextStepId: apiNextEdge?.target || baseStep.nextStepId,
        },
      };

    case 'mediaMessage':
      const mediaData = node.data as any;
      const mediaNextEdge = edges.find((e) => e.source === node.id);
      return {
        ...baseStep,
        stepType: 'media',
        messageText: mediaData.caption || '',
        messageTextTranslations: mediaData.messageTextTranslations || {},
        mediaConfig: {
          mediaType: mediaData.mediaType,
          mediaUrl: mediaData.mediaUrl,
          optional: false,
          nextStepId: mediaNextEdge?.target || baseStep.nextStepId,
        },
      };

    case 'delay':
      const delayData = node.data as any;
      const delayNextEdge = edges.find((e) => e.source === node.id);
      return {
        ...baseStep,
        stepType: 'delay',
        delayConfig: {
          duration: delayData.duration,
          unit: delayData.unit,
        },
        nextStepId: delayNextEdge?.target || baseStep.nextStepId,
      };

    case 'assignDepartment':
      const deptData = node.data as any;
      const deptNextEdge = edges.find((e) => e.source === node.id);
      return {
        ...baseStep,
        stepType: 'assign_department',
        assignDepartmentConfig: {
          departmentId: deptData.departmentId,
          isDynamic: deptData.isDynamic,
          conditionField: deptData.conditionField,
        },
        nextStepId: deptNextEdge?.target || baseStep.nextStepId,
      };

    case 'end':
      return {
        ...baseStep,
        stepType: 'end',
        messageText: (node.data as any).endMessage || 'Thank you!',
        messageTextTranslations: (node.data as any).endMessageTranslations || {}
      };

    case 'dynamicResponse':
      const dynData = node.data as any;
      const dynNextEdge = edges.find((e) => e.source === node.id);
      return {
        ...baseStep,
        stepType: 'dynamic_response',
        messageText: dynData.template || '',
        nextStepId: dynNextEdge?.target || baseStep.nextStepId,
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

    // Create edges for inputConfig
    if (step.inputConfig?.nextStepId) {
      edges.push({
        id: `${step.stepId}-input-${step.inputConfig.nextStepId}`,
        source: step.stepId,
        target: step.inputConfig.nextStepId,
        type: 'smoothstep',
      });
    }

    // Create edges for apiConfig
    if (step.apiConfig?.nextStepId) {
      edges.push({
        id: `${step.stepId}-api-${step.apiConfig.nextStepId}`,
        source: step.stepId,
        target: step.apiConfig.nextStepId,
        type: 'smoothstep',
      });
    }

    // Create edges for mediaConfig
    if (step.mediaConfig?.nextStepId) {
      edges.push({
        id: `${step.stepId}-media-${step.mediaConfig.nextStepId}`,
        source: step.stepId,
        target: step.mediaConfig.nextStepId,
        type: 'smoothstep',
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
    // Create edges for list rows
    if (step.listConfig?.sections) {
      step.listConfig.sections.forEach((section, sectionIndex) => {
        section.rows?.forEach((row, rowIndex) => {
          if (row.nextStepId) {
            edges.push({
              id: `${step.stepId}-row-${sectionIndex}-${rowIndex}-${row.nextStepId}`,
              source: step.stepId,
              target: row.nextStepId,
              sourceHandle: `row-${sectionIndex}-${rowIndex}`,
              type: 'smoothstep',
              label: row.title,
            });
          }
        });
      });
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
      if (step.buttons && step.buttons.length > 0) {
        return {
          ...baseNode,
          type: 'buttonMessage',
          data: {
            ...baseNode.data,
            messageText: step.messageText || '',
            buttons: step.buttons.map((btn) => ({
              id: btn.id,
              text: btn.title,
              type: 'quick_reply' as const,
            })),
          },
        };
      }
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

    case 'media':
      return {
        ...baseNode,
        type: 'mediaMessage',
        data: {
          ...baseNode.data,
          mediaType: step.mediaConfig?.mediaType || 'image',
          mediaUrl: step.mediaConfig?.mediaUrl || '',
          caption: step.messageText || step.mediaConfig?.saveToField || '',
        },
      };

    case 'delay':
      return {
        ...baseNode,
        type: 'delay',
        data: {
          ...baseNode.data,
          duration: step.delayConfig?.duration || 5,
          unit: step.delayConfig?.unit || 'seconds',
        },
      };

    case 'assign_department':
      return {
        ...baseNode,
        type: 'assignDepartment',
        data: {
          ...baseNode.data,
          departmentId: step.assignDepartmentConfig?.departmentId || '',
          isDynamic: step.assignDepartmentConfig?.isDynamic || false,
          conditionField: step.assignDepartmentConfig?.conditionField || '',
        },
      };

    case 'end':
      return {
        ...baseNode,
        type: 'end',
        data: {
          ...baseNode.data,
          endMessage: step.messageText || '',
        },
      };

    case 'start':
      return {
        ...baseNode,
        type: 'start',
        data: {
          ...baseNode.data,
          // Start node usually gets trigger from backendFlow.triggers, 
          // but we can look for it if available or use defaults
          trigger: 'hi',
          triggerType: 'keyword',
        },
      };

    case 'dynamic_response':
      return {
        ...baseNode,
        type: 'dynamicResponse',
        data: {
          ...baseNode.data,
          template: step.messageText || '',
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
    start: 'start',
    end: 'end',
    dynamicResponse: 'dynamic_response',
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
    start: 'start',
    end: 'end',
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
