'use client';

import { useState } from 'react';
import { FlowNode, FlowEdge } from '@/types/flowTypes';
import { Button } from '@/components/ui/button';
import { X, Send, Phone, Video, MoreVertical, ArrowLeft } from 'lucide-react';

interface FlowSimulatorProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  flowName: string;
  onClose: () => void;
}

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  buttons?: { text: string; id: string; isList?: boolean }[];
  listConfig?: {
    buttonText: string;
    sections: any[];
  };
  isTyping?: boolean;
}

export default function FlowSimulator({ nodes, edges, flowName, onClose }: FlowSimulatorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [activeList, setActiveList] = useState<{
    nodeId: string;
    buttonText: string;
    sections: any[];
  } | null>(null);

  // Start simulation
  const startSimulation = async () => {
    setIsSimulating(true);
    setMessages([]);
    
    // Find start node
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) {
      addMessage('bot', '❌ No start node found in flow');
      setIsSimulating(false);
      return;
    }

    // Execute flow from start
    await executeNode(startNode.id);
  };

  const executeNode = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setCurrentNodeId(nodeId);

    // Show typing indicator
    const typingId = `typing-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: typingId,
      type: 'bot',
      content: '',
      timestamp: new Date(),
      isTyping: true,
    }]);

    // Simulate typing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Remove typing indicator
    setMessages(prev => prev.filter(m => m.id !== typingId));

    // Process node based on type
    switch (node.type) {
      case 'start':
        addMessage('bot', `👋 Welcome! Type "${(node.data as any).trigger}" to begin`);
        break;

      case 'textMessage':
        const textMsg = (node.data as any).messageText || 'Hello!';
        addMessage('bot', textMsg);
        // Auto-continue to next node
        await continueToNextNode(nodeId);
        break;

      case 'buttonMessage':
        const buttons = (node.data as any).buttons || [];
        const buttonMsg = (node.data as any).messageText || 'Please select an option:';
        addMessage('bot', buttonMsg, buttons.map((btn: any, idx: number) => ({
          text: btn.text,
          id: `button-${idx}`,
        })));
        break;


      case 'listMessage':
        const isDynamic = (node.data as any).isDynamic;
        const dynamicSource = (node.data as any).dynamicSource;
        const listText = (node.data as any).messageText || 'Please select from the list:';
        const buttonText = (node.data as any).buttonText || 'View Menu';
        
        let sections = (node.data as any).sections || [];

        if (isDynamic && dynamicSource === 'departments') {
          try {
            const response = await fetch('/api/departments');
            if (response.ok) {
              const departments = await response.json();
              sections = [{
                title: 'Departments',
                rows: departments.map((dept: any) => ({
                  id: dept._id,
                  title: dept.name,
                  description: dept.description
                }))
              }];
            }
          } catch (error) {
            console.error('Error fetching departments:', error);
          }
        }
        
        // Add single "View Menu" button message
        addMessage('bot', listText, [
          { text: buttonText, id: `list-open-${node.id}`, isList: true }
        ], { buttonText, sections });
        break;

      case 'userInput':
        const inputPrompt = (node.data as any).messageText || 'Please enter your response:';
        addMessage('bot', inputPrompt);
        // Wait for user input
        break;

      case 'delay':
        const duration = (node.data as any).duration || 5;
        addMessage('bot', `⏱️ Waiting ${duration} seconds...`);
        await new Promise(resolve => setTimeout(resolve, duration * 1000));
        await continueToNextNode(nodeId);
        break;

      case 'end':
        addMessage('bot', '✅ Conversation ended. Thank you!');
        setIsSimulating(false);
        break;

      default:
        addMessage('bot', `[${node.type}] node executed`);
        await continueToNextNode(nodeId);
    }
  };

  const continueToNextNode = async (currentNodeId: string) => {
    // Find next node
    const nextEdge = edges.find(e => e.source === currentNodeId);
    if (nextEdge) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await executeNode(nextEdge.target);
    } else {
      setIsSimulating(false);
    }
  };

  const addMessage = (
    type: 'bot' | 'user', 
    content: string, 
    buttons?: { text: string; id: string; isList?: boolean }[],
    listConfig?: { buttonText: string; sections: any[] }
  ) => {
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      type,
      content,
      timestamp: new Date(),
      buttons,
      listConfig
    }]);
  };

  const handleButtonClick = async (buttonText: string, buttonId: string) => {
    if (buttonId.startsWith('list-open-')) {
      // Find the message that has the list config
      const listMsg = messages.find(m => m.buttons?.some(b => b.id === buttonId));
      if (listMsg?.listConfig) {
        setActiveList({
          nodeId: buttonId.replace('list-open-', ''),
          buttonText: listMsg.listConfig.buttonText,
          sections: listMsg.listConfig.sections
        });
      }
      return;
    }

    // Add user's button click as message
    addMessage('user', buttonText);

    // Find the edge for this button or list selection
    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (currentNode?.type === 'buttonMessage') {
      const buttonIndex = parseInt(buttonId.split('-')[1]);
      const edge = edges.find(e => e.source === currentNodeId && e.sourceHandle === `button-${buttonIndex}`);
      
      if (edge) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await executeNode(edge.target);
      } else {
        await continueToNextNode(currentNodeId!);
      }
    } else if (currentNode?.type === 'listMessage') {
      const parts = buttonId.split('-');
      const secIdx = parts[1];
      const rowIdx = parts[2];
      const handleId = `row-${secIdx}-${rowIdx}`;
      
      const edge = edges.find(e => e.source === currentNodeId && e.sourceHandle === handleId);
      
      if (edge) {
        setIsSimulating(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        await executeNode(edge.target);
      } else {
        await continueToNextNode(currentNodeId!);
      }
    } else {
      await continueToNextNode(currentNodeId!);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    addMessage('user', userInput);
    const input = userInput;
    setUserInput('');

    // Check if this is the start trigger
    const startNode = nodes.find(n => n.type === 'start');
    if (startNode && input.toLowerCase() === (startNode.data as any).trigger?.toLowerCase()) {
      await continueToNextNode(startNode.id);
      return;
    }

    // Handle user input node
    if (currentNodeId) {
      const currentNode = nodes.find(n => n.id === currentNodeId);
      if (currentNode?.type === 'userInput') {
        await continueToNextNode(currentNodeId);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md h-[600px] flex flex-col shadow-2xl">
        {/* WhatsApp-style Header */}
        <div className="bg-[#075E54] text-white p-3 flex items-center gap-3 rounded-t-lg">
          <button onClick={onClose} className="hover:bg-white/10 rounded-full p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-semibold">
            {flowName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{flowName}</div>
            <div className="text-xs text-gray-200">
              {isSimulating ? 'typing...' : 'Flow Simulator'}
            </div>
          </div>
          <Phone className="w-5 h-5" />
          <Video className="w-5 h-5" />
          <MoreVertical className="w-5 h-5" />
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#ECE5DD] space-y-2">
          {messages.length === 0 && !isSimulating && (
            <div className="text-center text-gray-500 mt-8">
              <p className="mb-4">🚀 Ready to test your flow!</p>
              <Button onClick={startSimulation} className="bg-[#25D366] hover:bg-[#20BA5A]">
                Start Simulation
              </Button>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg p-2 shadow ${
                  msg.type === 'user'
                    ? 'bg-[#DCF8C6]'
                    : 'bg-white'
                }`}
              >
                {msg.isTyping ? (
                  <div className="flex gap-1 p-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* Buttons / List Trigger */}
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="mt-2 space-y-2 pt-2 border-t border-gray-100">
                        {msg.buttons.map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => handleButtonClick(btn.text, btn.id)}
                            className={`w-full text-center py-2 px-4 rounded text-sm transition-colors ${
                              btn.isList 
                                ? 'text-[#128C7E] font-bold flex items-center justify-center gap-2 hover:bg-gray-50'
                                : 'text-blue-600 font-medium hover:bg-blue-50'
                            }`}
                          >
                            {btn.isList && <MoreVertical className="w-4 h-4 rotate-90" />}
                            {btn.text}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <div className="text-[10px] text-gray-500 mt-1 text-right">
                      {msg.timestamp.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="bg-[#F0F0F0] p-2 flex gap-2 items-center rounded-b-lg">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-[#25D366]"
            disabled={!isSimulating && messages.length > 0}
          />
          <button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || (!isSimulating && messages.length > 0)}
            className="bg-[#25D366] text-white p-2 rounded-full hover:bg-[#20BA5A] disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Reset Button */}
        {messages.length > 0 && !isSimulating && (
          <div className="p-2 bg-gray-100 border-t">
            <Button
              onClick={startSimulation}
              className="w-full bg-[#075E54] hover:bg-[#064E47]"
              size="sm"
            >
              🔄 Restart Simulation
            </Button>
          </div>
        )}
      </div>

      {/* WhatsApp List Popup */}
      {activeList && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setActiveList(null)} />
          <div className="relative bg-[#1f2c34] text-[#e9edef] w-full max-w-md mx-auto rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Popup Header */}
            <div className="p-4 flex items-center gap-4 border-b border-[#2a3942]">
              <button 
                onClick={() => setActiveList(null)}
                className="hover:bg-[#2a3942] rounded-full p-1"
              >
                <X className="w-5 h-5 text-[#8696a0]" />
              </button>
              <h3 className="text-lg font-medium">{activeList.buttonText}</h3>
            </div>

            {/* List Content */}
            <div className="overflow-y-auto flex-1 pb-8">
              {activeList.sections.map((section, secIdx) => (
                <div key={secIdx} className="mt-4">
                  {section.title && (
                    <div className="px-5 py-2 text-[#8696a0] text-sm font-semibold uppercase tracking-wider">
                      {section.title}
                    </div>
                  )}
                  <div className="space-y-1">
                    {section.rows?.map((row: any, rowIdx: number) => (
                      <button
                        key={row.id || `${secIdx}-${rowIdx}`}
                        onClick={() => {
                          handleButtonClick(row.title, `list-${secIdx}-${rowIdx}`);
                          setActiveList(null);
                        }}
                        className="w-full px-5 py-3 flex items-start gap-4 hover:bg-[#2a3942] text-left transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-medium text-[#e9edef] group-active:text-white leading-tight">
                            {row.title}
                          </div>
                          {row.description && (
                            <div className="text-sm text-[#8696a0] mt-0.5 leading-snug truncate">
                              {row.description}
                            </div>
                          )}
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 border-[#8696a0] flex-shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-transparent group-active:bg-[#00a884]" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
