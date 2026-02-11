// Flow Validation Utilities
// Validates flow structure and WhatsApp API compliance

import { Flow, FlowNode, FlowEdge, ValidationResult, ValidationError } from '@/types/flowTypes';

// WhatsApp API Limits
const WHATSAPP_LIMITS = {
  BUTTONS: {
    MAX_BUTTONS_PER_MESSAGE: 3,
    BUTTON_TITLE_MAX_LENGTH: 20,
  },
  LIST: {
    MAX_SECTIONS_PER_LIST: 10,
    MAX_ROWS_PER_SECTION: 10,
    SECTION_TITLE_MAX_LENGTH: 24,
    ROW_TITLE_MAX_LENGTH: 24,
    ROW_DESCRIPTION_MAX_LENGTH: 72,
  },
  MESSAGE: {
    MAX_LENGTH: 4096,
  },
};

/**
 * Validate entire flow
 */
export function validateFlow(flow: Flow): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check if flow has nodes
  if (!flow.nodes || flow.nodes.length === 0) {
    errors.push({
      type: 'error',
      message: 'Flow must have at least one node',
    });
    return { isValid: false, errors, warnings };
  }

  // Check for start node
  const hasStartNode = flow.nodes.some((n) => n.type === 'start');
  if (!hasStartNode) {
    warnings.push({
      type: 'warning',
      message: 'Flow should have a start node. First node will be used as start.',
    });
  }

  // Validate each node
  flow.nodes.forEach((node) => {
    const nodeErrors = validateNode(node, flow.edges);
    errors.push(...nodeErrors.filter((e) => e.type === 'error'));
    warnings.push(...nodeErrors.filter((e) => e.type === 'warning'));
  });

  // Check for disconnected nodes
  const disconnectedNodes = findDisconnectedNodes(flow.nodes, flow.edges);
  disconnectedNodes.forEach((nodeId) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    warnings.push({
      nodeId,
      type: 'warning',
      message: `Node "${node?.data.label || nodeId}" is not connected to any other node`,
    });
  });

  // Check for circular dependencies
  const cycles = detectCycles(flow.nodes, flow.edges);
  if (cycles.length > 0) {
    warnings.push({
      type: 'warning',
      message: `Loop detected: ${cycles.join(' → ')}. Chatbot flows can contain loops (e.g., returning to a menu), but ensure they aren't infinite.`,
    });
  }

  // Check for unreachable nodes
  const unreachableNodes = findUnreachableNodes(flow.nodes, flow.edges);
  unreachableNodes.forEach((nodeId) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    warnings.push({
      nodeId,
      type: 'warning',
      message: `Node "${node?.data.label || nodeId}" is unreachable from start node`,
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate individual node
 */
export function validateNode(node: FlowNode, edges: FlowEdge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate based on node type
  switch (node.type) {
    case 'textMessage':
      validateTextMessageNode(node, errors);
      break;
    case 'buttonMessage':
      validateButtonMessageNode(node, errors);
      break;
    case 'listMessage':
      validateListMessageNode(node, errors);
      break;
    case 'userInput':
      validateUserInputNode(node, errors);
      break;
    case 'condition':
      validateConditionNode(node, edges, errors);
      break;
    case 'apiCall':
      validateApiCallNode(node, errors);
      break;
    case 'mediaMessage':
      validateMediaMessageNode(node, errors);
      break;
    case 'assignDepartment':
      validateAssignDepartmentNode(node, errors);
      break;
    case 'delay':
      validateDelayNode(node, errors);
      break;
  }

  return errors;
}

function validateTextMessageNode(node: FlowNode, errors: ValidationError[]): void {
  const data = node.data as any;
  
  if (!data.messageText || data.messageText.trim() === '') {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Message text is required',
      field: 'messageText',
    });
  }

  if (data.messageText && data.messageText.length > WHATSAPP_LIMITS.MESSAGE.MAX_LENGTH) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: `Message exceeds ${WHATSAPP_LIMITS.MESSAGE.MAX_LENGTH} characters`,
      field: 'messageText',
    });
  }
}

function validateButtonMessageNode(node: FlowNode, errors: ValidationError[]): void {
  const data = node.data as any;

  if (!data.messageText || data.messageText.trim() === '') {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Message text is required',
      field: 'messageText',
    });
  }

  if (!data.buttons || data.buttons.length === 0) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'At least one button is required',
      field: 'buttons',
    });
    return;
  }

  if (data.buttons.length > WHATSAPP_LIMITS.BUTTONS.MAX_BUTTONS_PER_MESSAGE) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: `WhatsApp allows maximum ${WHATSAPP_LIMITS.BUTTONS.MAX_BUTTONS_PER_MESSAGE} buttons per message. You have ${data.buttons.length}. Please split into multiple steps.`,
      field: 'buttons',
    });
  }

  data.buttons.forEach((btn: any, index: number) => {
    if (!btn.text || btn.text.trim() === '') {
      errors.push({
        nodeId: node.id,
        type: 'error',
        message: `Button ${index + 1} text is required`,
        field: `buttons[${index}].text`,
      });
    }

    if (btn.text && btn.text.length > WHATSAPP_LIMITS.BUTTONS.BUTTON_TITLE_MAX_LENGTH) {
      errors.push({
        nodeId: node.id,
        type: 'error',
        message: `Button "${btn.text.substring(0, 15)}..." exceeds ${WHATSAPP_LIMITS.BUTTONS.BUTTON_TITLE_MAX_LENGTH} characters. Please shorten to max ${WHATSAPP_LIMITS.BUTTONS.BUTTON_TITLE_MAX_LENGTH} characters.`,
        field: `buttons[${index}].text`,
      });
    }
  });
}

function validateListMessageNode(node: FlowNode, errors: ValidationError[]): void {
  const data = node.data as any;

  if (!data.messageText || data.messageText.trim() === '') {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Message text is required',
      field: 'messageText',
    });
  }

  if (!data.buttonText || data.buttonText.trim() === '') {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Button text is required',
      field: 'buttonText',
    });
  }

  if (!data.isDynamic) {
    if (!data.sections || data.sections.length === 0) {
      errors.push({
        nodeId: node.id,
        type: 'error',
        message: 'At least one section is required',
        field: 'sections',
      });
      return;
    }

    if (data.sections.length > WHATSAPP_LIMITS.LIST.MAX_SECTIONS_PER_LIST) {
      errors.push({
        nodeId: node.id,
        type: 'error',
        message: `WhatsApp allows maximum ${WHATSAPP_LIMITS.LIST.MAX_SECTIONS_PER_LIST} sections per list`,
        field: 'sections',
      });
    }

    data.sections.forEach((section: any, sectionIndex: number) => {
      if (!section.title || section.title.trim() === '') {
        errors.push({
          nodeId: node.id,
          type: 'error',
          message: `Section ${sectionIndex + 1} title is required`,
          field: `sections[${sectionIndex}].title`,
        });
      }

      if (section.title && section.title.length > WHATSAPP_LIMITS.LIST.SECTION_TITLE_MAX_LENGTH) {
        errors.push({
          nodeId: node.id,
          type: 'error',
          message: `Section title exceeds ${WHATSAPP_LIMITS.LIST.SECTION_TITLE_MAX_LENGTH} characters`,
          field: `sections[${sectionIndex}].title`,
        });
      }

      if (!section.rows || section.rows.length === 0) {
        errors.push({
          nodeId: node.id,
          type: 'error',
          message: `Section ${sectionIndex + 1} must have at least one row`,
          field: `sections[${sectionIndex}].rows`,
        });
      }

      if (section.rows && section.rows.length > WHATSAPP_LIMITS.LIST.MAX_ROWS_PER_SECTION) {
        errors.push({
          nodeId: node.id,
          type: 'error',
          message: `Section ${sectionIndex + 1} exceeds ${WHATSAPP_LIMITS.LIST.MAX_ROWS_PER_SECTION} rows. WhatsApp allows maximum ${WHATSAPP_LIMITS.LIST.MAX_ROWS_PER_SECTION} rows per section.`,
          field: `sections[${sectionIndex}].rows`,
        });
      }

      section.rows?.forEach((row: any, rowIndex: number) => {
        if (!row.title || row.title.trim() === '') {
          errors.push({
            nodeId: node.id,
            type: 'error',
            message: `Row ${rowIndex + 1} in section ${sectionIndex + 1} title is required`,
            field: `sections[${sectionIndex}].rows[${rowIndex}].title`,
          });
        }

        if (row.title && row.title.length > WHATSAPP_LIMITS.LIST.ROW_TITLE_MAX_LENGTH) {
          errors.push({
            nodeId: node.id,
            type: 'error',
            message: `Row title exceeds ${WHATSAPP_LIMITS.LIST.ROW_TITLE_MAX_LENGTH} characters`,
            field: `sections[${sectionIndex}].rows[${rowIndex}].title`,
          });
        }

        if (row.description && row.description.length > WHATSAPP_LIMITS.LIST.ROW_DESCRIPTION_MAX_LENGTH) {
          errors.push({
            nodeId: node.id,
            type: 'error',
            message: `Row description exceeds ${WHATSAPP_LIMITS.LIST.ROW_DESCRIPTION_MAX_LENGTH} characters`,
            field: `sections[${sectionIndex}].rows[${rowIndex}].description`,
          });
        }
      });
    });
  }
}

function validateUserInputNode(node: FlowNode, errors: ValidationError[]): void {
  const data = node.data as any;

  if (!data.saveToField || data.saveToField.trim() === '') {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Field name to save input is required',
      field: 'saveToField',
    });
  }

  if (!data.inputType) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Input type is required',
      field: 'inputType',
    });
  }
}

function validateConditionNode(node: FlowNode, edges: FlowEdge[], errors: ValidationError[]): void {
  const data = node.data as any;

  if (!data.field || data.field.trim() === '') {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Field to check is required',
      field: 'field',
    });
  }

  if (!data.operator) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Operator is required',
      field: 'operator',
    });
  }

  // Check if both true and false paths are connected
  const trueEdge = edges.find((e) => e.source === node.id && e.sourceHandle === 'true');
  const falseEdge = edges.find((e) => e.source === node.id && e.sourceHandle === 'false');

  if (!trueEdge) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'True path must be connected',
      field: 'trueConnection',
    });
  }

  if (!falseEdge) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'False path must be connected',
      field: 'falseConnection',
    });
  }
}

function validateApiCallNode(node: FlowNode, errors: ValidationError[]): void {
  const data = node.data as any;

  if (!data.endpoint || data.endpoint.trim() === '') {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'API endpoint is required',
      field: 'endpoint',
    });
  }

  if (!data.method) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'HTTP method is required',
      field: 'method',
    });
  }
}

function validateMediaMessageNode(node: FlowNode, errors: ValidationError[]): void {
  const data = node.data as any;

  if (!data.mediaType) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Media type is required',
      field: 'mediaType',
    });
  }

  if (!data.mediaUrl || data.mediaUrl.trim() === '') {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Media URL is required',
      field: 'mediaUrl',
    });
  }
}

function validateAssignDepartmentNode(node: FlowNode, errors: ValidationError[]): void {
  const data = node.data as any;

  if (!data.isDynamic && (!data.departmentId || data.departmentId.trim() === '')) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Department must be selected',
      field: 'departmentId',
    });
  }
}

function validateDelayNode(node: FlowNode, errors: ValidationError[]): void {
  const data = node.data as any;

  if (!data.duration || data.duration <= 0) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Delay duration must be greater than 0',
      field: 'duration',
    });
  }

  if (!data.unit) {
    errors.push({
      nodeId: node.id,
      type: 'error',
      message: 'Time unit is required',
      field: 'unit',
    });
  }
}

/**
 * Find disconnected nodes (nodes with no incoming or outgoing edges)
 */
function findDisconnectedNodes(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  return nodes
    .filter((node) => {
      const hasIncoming = edges.some((e) => e.target === node.id);
      const hasOutgoing = edges.some((e) => e.source === node.id);
      return !hasIncoming && !hasOutgoing && node.type !== 'start';
    })
    .map((node) => node.id);
}

/**
 * Detect circular dependencies using DFS
 */
function detectCycles(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.target)) {
        if (dfs(edge.target)) return true;
      } else if (recursionStack.has(edge.target)) {
        // Cycle detected
        const cycleStart = path.indexOf(edge.target);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return path;
      }
    }
  }

  return [];
}

/**
 * Find unreachable nodes from start node
 */
function findUnreachableNodes(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const startNode = nodes.find((n) => n.type === 'start') || nodes[0];
  if (!startNode) return [];

  const reachable = new Set<string>();
  const queue = [startNode.id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    reachable.add(current);

    const outgoingEdges = edges.filter((e) => e.source === current);
    outgoingEdges.forEach((edge) => {
      if (!reachable.has(edge.target)) {
        queue.push(edge.target);
      }
    });
  }

  return nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id);
}
