"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { NodeType, NodePaletteItem } from "@/types/flowTypes";
import {
  MessageSquare,
  MousePointerClick,
  List,
  Image as ImageIcon,
  FileText,
  Type,
  GitBranch,
  Globe,
  Users,
  Clock,
  MapPin,
  HelpCircle,
  Tag,
  Workflow,
  UserPlus,
  BarChart3,
  ChevronRight,
  Play,
  StopCircle,
  ShoppingCart,
  Package,
  Boxes,
  FormInput,
} from "lucide-react";
import { Input } from "@/components/ui/input";

// Reorganized node palette with Message types and Actions
const messageTypeNodes: NodePaletteItem[] = [
  {
    type: "textMessage",
    label: "Text Buttons",
    description: "Send text with button options",
    icon: <MousePointerClick className="w-4 h-4" />,
    category: "message",
    defaultData: {},
  },
  {
    type: "mediaMessage",
    label: "Media Buttons",
    description: "Send media with buttons",
    icon: <ImageIcon className="w-4 h-4" />,
    category: "message",
    defaultData: {},
  },
  {
    type: "listMessage",
    label: "List",
    description: "WhatsApp list message",
    icon: <List className="w-4 h-4" />,
    category: "message",
    defaultData: {},
  },
  {
    type: "userInput",
    label: "Whatsapp Forms",
    description: "Collect user information",
    icon: <FormInput className="w-4 h-4" />,
    category: "message",
    defaultData: {},
  },
  {
    type: "buttonMessage",
    label: "Button Messages",
    description: "Send buttons with options",
    icon: <ShoppingCart className="w-4 h-4" />,
    category: "message",
    defaultData: {},
  },
  {
    type: "templateMessage",
    label: "Single Product",
    description: "Single product message",
    icon: <Package className="w-4 h-4" />,
    category: "message",
    defaultData: {},
  },
  {
    type: "dynamicResponse",
    label: "Multi Product",
    description: "Multiple products",
    icon: <Boxes className="w-4 h-4" />,
    category: "message",
    defaultData: {},
  },
  {
    type: "start",
    label: "Template",
    description: "Message template",
    icon: <FileText className="w-4 h-4" />,
    category: "message",
    defaultData: {},
  },
];

const actionNodes: NodePaletteItem[] = [
  {
    type: "start",
    label: "Start (Trigger)",
    description: "Flow entry point",
    icon: <Play className="w-4 h-4" />,
    category: "control",
    defaultData: {},
  },
  {
    type: "assignDepartment",
    label: "Request Intervention",
    description: "Request human assistance",
    icon: <UserPlus className="w-4 h-4" />,
    category: "logic",
    defaultData: {},
  },
  {
    type: "apiCall",
    label: "Meta Conversions Api",
    description: "Track conversions",
    icon: <BarChart3 className="w-4 h-4" />,
    category: "integration",
    defaultData: {},
  },
  {
    type: "condition",
    label: "Condition",
    description: "Conditional branching",
    icon: <GitBranch className="w-4 h-4" />,
    category: "logic",
    defaultData: {},
  },
  {
    type: "delay",
    label: "Connect Flow",
    description: "Link to another flow",
    icon: <Workflow className="w-4 h-4" />,
    category: "control",
    defaultData: {},
  },
  {
    type: "userInput",
    label: "Ask Address",
    description: "Request address input",
    icon: <MapPin className="w-4 h-4" />,
    category: "logic",
    defaultData: {},
  },
  {
    type: "userInput",
    label: "Ask Location",
    description: "Request location",
    icon: <MapPin className="w-4 h-4" />,
    category: "logic",
    defaultData: {},
  },
  {
    type: "userInput",
    label: "Ask Question",
    description: "Ask user a question",
    icon: <HelpCircle className="w-4 h-4" />,
    category: "logic",
    defaultData: {},
  },
  {
    type: "mediaMessage",
    label: "Ask Media",
    description: "Request media upload",
    icon: <ImageIcon className="w-4 h-4" />,
    category: "logic",
    defaultData: {},
  },
  {
    type: "userInput",
    label: "Ask Attribute",
    description: "Request specific attribute",
    icon: <Type className="w-4 h-4" />,
    category: "logic",
    defaultData: {},
  },
  {
    type: "end",
    label: "Add Tag",
    description: "Tag conversation",
    icon: <Tag className="w-4 h-4" />,
    category: "control",
    defaultData: {},
  },
  {
    type: "apiCall",
    label: "API Request 4/5",
    description: "External API call",
    icon: <Globe className="w-4 h-4" />,
    category: "integration",
    defaultData: {},
  },
];

function DraggableNode({ item }: { item: NodePaletteItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.type,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    // Dispatch custom event to add node to canvas on click
    window.dispatchEvent(
      new CustomEvent('node:add-from-sidebar', {
        detail: { nodeType: item.type },
      })
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-md cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-all group active:scale-95"
    >
      <div className="p-1.5 bg-teal-100 rounded text-teal-600 group-hover:bg-teal-200">
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-800">{item.label}</div>
      </div>
    </div>
  );
}

export default function NodeSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    messageTypes: true,
    actions: true,
  });

  const toggleSection = (section: "messageTypes" | "actions") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const filteredMessageTypes = messageTypeNodes.filter((node) =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredActions = actionNodes.filter((node) =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          {!isCollapsed && (
            <h2 className="text-base font-semibold text-gray-900">
              Message types
            </h2>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors ml-auto"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronRight
              className={`w-4 h-4 text-gray-600 transition-transform ${
                isCollapsed ? '' : 'rotate-180'
              }`}
            />
          </button>
        </div>

        {/* Search */}
        {!isCollapsed && (
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm"
          />
        )}
      </div>

      {/* Node List - Expanded */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
        {/* Message Types Section */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection("messageTypes")}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">
              Message types
            </span>
            <ChevronRight
              className={`w-4 h-4 text-gray-500 transition-transform ${
                expandedSections.messageTypes ? "rotate-90" : ""
              }`}
            />
          </button>
          {expandedSections.messageTypes && (
            <div className="px-3 py-2 space-y-2">
              {filteredMessageTypes.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-4">
                  No nodes found
                </div>
              ) : (
                filteredMessageTypes.map((item) => (
                  <DraggableNode key={item.type + item.label} item={item} />
                ))
              )}
            </div>
          )}
        </div>

        {/* Actions Section */}
        <div>
          <button
            onClick={() => toggleSection("actions")}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">Actions</span>
            <ChevronRight
              className={`w-4 h-4 text-gray-500 transition-transform ${
                expandedSections.actions ? "rotate-90" : ""
              }`}
            />
          </button>
          {expandedSections.actions && (
            <div className="px-3 py-2 space-y-2">
              {filteredActions.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-4">
                  No nodes found
                </div>
              ) : (
                filteredActions.map((item) => (
                  <DraggableNode key={item.type + item.label} item={item} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
      )}
      
      {/* Node List - Collapsed (Icon only) */}
      {isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {[...messageTypeNodes.slice(0, 4), ...actionNodes.slice(0, 4)].map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('node:add-from-sidebar', {
                    detail: { nodeType: item.type },
                  })
                );
              }}
              className="w-full p-2.5 bg-teal-50 hover:bg-teal-100 rounded transition-colors flex items-center justify-center group"
              title={item.label}
            >
              <div className="text-teal-600 group-hover:scale-110 transition-transform">{item.icon}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
