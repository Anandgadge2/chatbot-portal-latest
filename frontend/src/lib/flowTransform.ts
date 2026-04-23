import { 
  FlowNode, 
  FlowEdge, 
  Flow,
  BackendFlow, 
  BackendFlowStep, 
  FlowMetadata,
  NodeType,
  FlowNodeData
} from "@/types/flowTypes";

/**
 * Generates a unique node ID based on type and random entropy
 */
export function generateNodeId(type: string): string {
  const prefix = type === 'start' ? 'start' : type.substring(0, 3);
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generates a unique edge ID based on source and target IDs
 */
export function generateEdgeId(source: string, target: string): string {
  return `e_${source}_${target}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Transforms frontend React Flow structure to Backend flow format (steps-based)
 */
export function transformToBackendFormat(flow: {
  metadata: FlowMetadata;
  nodes: FlowNode[];
  edges: FlowEdge[];
}): Partial<BackendFlow> {
  const { metadata, nodes, edges } = flow;

  const steps: BackendFlowStep[] = nodes.map((node) => {
    const data = node.data as any;
    const nodeType = node.type as NodeType;

    // Base step structure
    const step: BackendFlowStep = {
      stepId: node.id,
      stepName: data.label || node.id,
      stepType: mapNodeTypeToStepType(nodeType),
      position: {
        x: node.position.x,
        y: node.position.y,
      },
    };

    // Map specific node data to backend config
    switch (nodeType) {
      case 'textMessage':
        step.messageText = data.messageText;
        step.messageTextTranslations = data.messageTextTranslations;
        break;

      case 'buttonMessage':
        step.messageText = data.messageText;
        step.messageTextTranslations = data.messageTextTranslations;
        step.buttons = (data.buttons || []).map((btn: any) => ({
          id: btn.id,
          title: btn.text,
          titleTranslations: btn.titleTranslations,
          nextStepId: findNextStepId(node.id, edges, btn.id),
          action: 'next'
        }));
        break;

      case 'listMessage':
        step.messageText = data.messageText;
        step.messageTextTranslations = data.messageTextTranslations;
        step.listConfig = {
          buttonText: data.buttonText,
          buttonTextTranslations: data.buttonTextTranslations,
          listSource: data.isDynamic ? 'departments' : 'manual',
          sections: (data.sections || []).map((section: any) => ({
            title: section.title,
            titleTranslations: section.titleTranslations,
            rows: (section.rows || []).map((row: any) => ({
              id: row.id,
              title: row.title,
              titleTranslations: row.titleTranslations,
              description: row.description,
              descriptionTranslations: row.descriptionTranslations,
              nextStepId: findNextStepId(node.id, edges, row.id)
            }))
          }))
        };
        break;

      case 'userInput':
        step.messageText = data.messageText;
        step.messageTextTranslations = data.messageTextTranslations;
        step.inputConfig = {
          inputType: data.inputType,
          saveToField: data.saveToField,
          validation: data.validation,
          placeholder: data.placeholder,
          nextStepId: findNextStepId(node.id, edges)
        };
        break;

      case 'mediaMessage':
        step.mediaConfig = {
          mediaType: data.mediaType,
          mediaUrl: data.mediaUrl,
          optional: false,
          saveToField: '', // Optional for media nodes
          nextStepId: findNextStepId(node.id, edges)
        };
        break;

      case 'condition':
        step.conditionConfig = {
          field: data.field,
          operator: data.operator,
          value: data.value,
          trueStepId: findNextStepId(node.id, edges, 'true') ?? "",
          falseStepId: findNextStepId(node.id, edges, 'false') ?? ""
        };
        break;

      case 'apiCall':
        step.apiConfig = {
          method: data.method || 'GET',
          endpoint: data.endpoint,
          headers: data.headers,
          body: data.body,
          saveResponseTo: data.saveResponseTo,
          nextStepId: findNextStepId(node.id, edges)
        };
        break;

      case 'delay':
        step.delayConfig = {
          duration: data.duration,
          unit: data.unit,
          nextStepId: findNextStepId(node.id, edges)
        };
        break;

      case 'assignDepartment':
        step.assignDepartmentConfig = {
          departmentId: data.departmentId,
          isDynamic: data.isDynamic,
          conditionField: data.conditionField,
          nextStepId: findNextStepId(node.id, edges)
        };
        break;

      case 'end':
        step.messageText = data.endMessage;
        step.messageTextTranslations = data.endMessageTranslations;
        // end steps don't have nextStepId
        break;

      case 'start':
        // Start node specifically just points to next
        step.nextStepId = findNextStepId(node.id, edges);
        break;
    }

    // Generic nextStepId if not already set by specific configs
    if (!step.nextStepId && nodeType !== 'end' && nodeType !== 'condition' && nodeType !== 'buttonMessage' && nodeType !== 'listMessage') {
      step.nextStepId = findNextStepId(node.id, edges);
    }

    // Build expectedResponses for engine
    step.expectedResponses = buildExpectedResponses(node, edges);

    return step;
  });

  // Determine flow type and triggers
  const startNode = nodes.find(n => n.type === 'start');
  const triggers = startNode ? [{
    triggerType: (startNode.data as any).triggerType || 'keyword',
    triggerValue: (startNode.data as any).trigger || 'hi',
    startStepId: findNextStepId(startNode.id, edges) || startNode.id
  }] : [];

  return {
    companyId: metadata.companyId,
    flowName: metadata.name,
    name: metadata.name,
    flowDescription: metadata.description,
    description: metadata.description,
    flowType: 'custom', // Default
    isActive: metadata.isActive,
    version: metadata.version,
    startStepId: startNode?.id || nodes[0]?.id || 'start',
    steps,
    triggers: triggers as any,
    nodes, // Store original nodes for frontend reconstruction
    edges, // Store original edges for frontend reconstruction
    supportedLanguages: ['en', 'hi', 'or'],
    defaultLanguage: 'en',
    settings: {
      sessionTimeout: 3600,
      enableTypingIndicator: true,
      enableReadReceipts: true,
      maxRetries: 3,
      errorFallbackMessage: "I'm sorry, I encountered an error. Please try again."
    },
    isPreTransformed: true
  };
}

/**
 * Transforms Backend flow format back to frontend React Flow structure
 */
export function transformFromBackendFormat(backendFlow: BackendFlow): Flow {
  const metadata: FlowMetadata = {
    name: backendFlow.flowName || backendFlow.name || 'Imported Flow',
    companyId: backendFlow.companyId,
    version: backendFlow.version || 1,
    isActive: backendFlow.isActive,
    description: backendFlow.flowDescription || backendFlow.description
  };

  // If original nodes and edges are stored, use them
  if (backendFlow.nodes && backendFlow.edges && backendFlow.nodes.length > 0) {
    return {
      metadata,
      nodes: backendFlow.nodes as FlowNode[],
      edges: backendFlow.edges as FlowEdge[]
    };
  }

  // Otherwise, reconstruct from steps (more complex, requires layouting)
  // For now, return empty if no visual data is found
  return {
    metadata,
    nodes: [],
    edges: []
  };
}

// Helper: Map Node Type to Step Type
function mapNodeTypeToStepType(type: NodeType): BackendFlowStep['stepType'] {
  switch (type) {
    case 'start': return 'start';
    case 'textMessage': return 'message';
    case 'buttonMessage': return 'buttons';
    case 'listMessage': return 'list';
    case 'userInput': return 'input';
    case 'mediaMessage': return 'media';
    case 'condition': return 'condition';
    case 'apiCall': return 'api_call';
    case 'delay': return 'delay';
    case 'assignDepartment': return 'assign_department';
    case 'dynamicResponse': return 'dynamic_response';
    case 'end': return 'end';
    default: return 'message';
  }
}

// Helper: Find next step ID from edges
function findNextStepId(sourceId: string, edges: FlowEdge[], handleId?: string | null): string | undefined {
  const edge = edges.find(e => e.source === sourceId && (handleId ? e.sourceHandle === handleId : true));
  return edge?.target;
}

// Helper: Build expected responses based on node type
function buildExpectedResponses(node: FlowNode, edges: FlowEdge[]): BackendFlowStep['expectedResponses'] {
  const responses: BackendFlowStep['expectedResponses'] = [];
  const data = node.data as any;

  if (node.type === 'buttonMessage' && data.buttons) {
    data.buttons.forEach((btn: any) => {
      const target = findNextStepId(node.id, edges, btn.id);
      if (target) {
        responses.push({
          type: 'button_click',
          value: btn.id,
          nextStepId: target
        });
      }
    });
  } else if (node.type === 'listMessage' && data.sections) {
    data.sections.forEach((section: any) => {
      section.rows.forEach((row: any) => {
        const target = findNextStepId(node.id, edges, row.id);
        if (target) {
          responses.push({
            type: 'list_selection',
            value: row.id,
            nextStepId: target
          });
        }
      });
    });
  } else if (node.type === 'userInput') {
    const target = findNextStepId(node.id, edges);
    if (target) {
      responses.push({
        type: 'any',
        value: '*',
        nextStepId: target
      });
    }
  }

  return responses.length > 0 ? responses : undefined;
}
