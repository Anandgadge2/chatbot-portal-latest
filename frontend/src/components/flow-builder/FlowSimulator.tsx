"use client";

import { useState, useRef, useEffect } from "react";
import { FlowNode, FlowEdge } from "@/types/flowTypes";
import { Button } from "@/components/ui/button";
import {
  X,
  Send,
  Phone,
  Video,
  MoreVertical,
  ArrowLeft,
  Check,
  CheckCheck,
  Paperclip,
  Smile,
  Mic,
} from "lucide-react";

interface FlowSimulatorProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  flowName: string;
  onClose: () => void;
}

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
  buttons?: { text: string; id: string; isList?: boolean }[];
  listConfig?: {
    buttonText: string;
    sections: any[];
  };
  isTyping?: boolean;
}

const WHATSAPP_GREETINGS = [
  "hi",
  "hello",
  "hola",
  "namaste",
  "start",
  "menu",
  "hey",
  "restart",
  "help",
  "ନମସ୍କାର",
  "ନମସ୍କାର ସାର",
  "ନମସ୍କାର୍",
  "ଶୁଭ ସକାଳ",
  "नमस्ते",
  "शुभ प्रभात",
  "begin",
];

export default function FlowSimulator({
  nodes,
  edges,
  flowName,
  onClose,
}: FlowSimulatorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "or" | "mr">("en");
  const [activeList, setActiveList] = useState<{
    nodeId: string;
    buttonText: string;
    sections: any[];
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Helper to get localized text
  const getLocalText = (nodeData: any, field: string) => {
    const translationsField = `${field}Translations`;
    if (nodeData[translationsField] && nodeData[translationsField][language]) {
      return nodeData[translationsField][language];
    }
    return nodeData[field] || "";
  };

  // Start simulation
  const startSimulation = async () => {
    setIsSimulating(false);
    setMessages([]);
    setCurrentNodeId(null);

    // Initial system message
    addMessage("bot", `👋 Welcome! Type "hi" or "menu" to begin.`);
  };

  // Effect to automatically restart on first mount
  useEffect(() => {
    startSimulation();
  }, []);

  const executeNode = async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setCurrentNodeId(nodeId);
    setIsSimulating(true);

    // Show typing indicator
    const typingId = `typing-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: typingId,
        type: "bot",
        content: "",
        timestamp: new Date(),
        isTyping: true,
      },
    ]);

    // Simulate realistic typing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Remove typing indicator
    setMessages((prev) => prev.filter((m) => m.id !== typingId));

    // Process node based on type
    switch (node.type) {
      case "start":
        await continueToNextNode(nodeId);
        break;

      case "textMessage":
        const textMsg = getLocalText(node.data, "messageText") || "Hello!";
        addMessage("bot", textMsg);
        setIsSimulating(false);
        await continueToNextNode(nodeId);
        break;

      case "buttonMessage":
        const btnData = node.data as any;
        const buttonMsg =
          getLocalText(btnData, "messageText") || "Please select an option:";
        const buttons = (btnData.buttons || []).map(
          (btn: any, idx: number) => ({
            text:
              (btn.titleTranslations && btn.titleTranslations[language]) ||
              btn.text ||
              btn.title,
            id: btn.id || `button-${idx}`,
          }),
        );
        addMessage("bot", buttonMsg, buttons);
        setIsSimulating(false);
        break;

      case "listMessage":
        const listData = node.data as any;
        const listText =
          getLocalText(listData, "messageText") ||
          "Please select from the list:";
        const buttonText = getLocalText(listData, "buttonText") || "View Menu";

        let sections = (node.data as any).sections || [];

        addMessage(
          "bot",
          listText,
          [{ text: buttonText, id: `list-open-${node.id}`, isList: true }],
          { buttonText, sections },
        );
        setIsSimulating(false);
        break;

      case "userInput":
        const inputPrompt =
          getLocalText(node.data, "messageText") ||
          "Please enter your response:";
        addMessage("bot", inputPrompt);
        setIsSimulating(false);
        break;

      case "delay":
        const duration = (node.data as any).duration || 2;
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));
        await continueToNextNode(nodeId);
        break;

      case "end":
        const endMsg =
          getLocalText(node.data, "endMessage") ||
          "✅ Conversation ended. Thank you!";
        addMessage("bot", endMsg);
        setIsSimulating(false);
        setCurrentNodeId(null);
        break;

      default:
        addMessage("bot", `${node.data.label || node.type} node reached`);
        setIsSimulating(false);
        await continueToNextNode(nodeId);
    }
  };

  const continueToNextNode = async (sourceId: string, handleId?: string) => {
    let nextEdge;
    if (handleId) {
      nextEdge = edges.find(
        (e) => e.source === sourceId && e.sourceHandle === handleId,
      );
    } else {
      nextEdge = edges.find((e) => e.source === sourceId);
    }

    if (nextEdge) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await executeNode(nextEdge.target);
    } else {
      setIsSimulating(false);
    }
  };

  const addMessage = (
    type: "bot" | "user",
    content: string,
    buttons?: { text: string; id: string; isList?: boolean }[],
    listConfig?: { buttonText: string; sections: any[] },
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        type,
        content,
        timestamp: new Date(),
        buttons,
        listConfig,
      },
    ]);
  };

  const handleButtonClick = async (buttonText: string, buttonId: string) => {
    if (buttonId.startsWith("list-open-")) {
      const listMsg = messages.find((m) =>
        m.buttons?.some((b) => b.id === buttonId),
      );
      if (listMsg?.listConfig) {
        setActiveList({
          nodeId: buttonId.replace("list-open-", ""),
          buttonText: listMsg.listConfig.buttonText,
          sections: listMsg.listConfig.sections,
        });
      }
      return;
    }

    addMessage("user", buttonText);

    if (buttonId.startsWith("list-row-")) {
      const [_l, _r, secIdx, rowIdx] = buttonId.split("-");
      await continueToNextNode(currentNodeId!, `row-${secIdx}-${rowIdx}`);
    } else {
      const currentNode = nodes.find((n) => n.id === currentNodeId);
      if (currentNode?.type === "buttonMessage") {
        const btnIdx = (currentNode.data as any).buttons?.findIndex(
          (b: any) => b.id === buttonId,
        );
        await continueToNextNode(currentNodeId!, `button-${btnIdx}`);
      } else {
        await continueToNextNode(currentNodeId!);
      }
    }
  };

  const handleSendMessage = async () => {
    const input = userInput.trim();
    if (!input) return;

    addMessage("user", input);
    setUserInput("");

    const normalizedInput = input.toLowerCase();
    const isGreeting = WHATSAPP_GREETINGS.includes(normalizedInput);

    if (!currentNodeId || isGreeting) {
      const startNode = nodes.find((n) => n.type === "start");
      if (startNode) {
        const triggers =
          (startNode.data as any).trigger
            ?.split(",")
            .map((t: string) => t.trim().toLowerCase()) || [];
        if (triggers.includes(normalizedInput) || isGreeting) {
          await executeNode(startNode.id);
          return;
        }
      }
    }

    if (currentNodeId) {
      const node = nodes.find((n) => n.id === currentNodeId);
      if (node?.type === "userInput") {
        await continueToNextNode(currentNodeId);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-0 sm:p-4">
      <style jsx>{`
        .clip-path-right-tail {
          clip-path: polygon(0 0, 0 100%, 100% 0);
        }
        .clip-path-left-tail {
          clip-path: polygon(100% 0, 100% 100%, 0 0);
        }
      `}</style>

      <div className="bg-[#E5DDD5] w-full sm:w-[400px] h-full sm:h-[85vh] sm:max-h-[820px] flex flex-col shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] relative overflow-hidden sm:rounded-[40px] border-[10px] border-[#1a1a1a] transition-all duration-500 scale-100 origin-center">
        {/* Phone Notch */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-[#1a1a1a] rounded-b-2xl z-50"></div>

        {/* WhatsApp Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
          }}
        />

        {/* Header */}
        <div className="bg-[#075E54] text-white pt-8 pb-3 px-3 flex items-center gap-2 z-10 shadow-md sm:pt-10">
          <button
            onClick={onClose}
            className="hover:bg-white/10 rounded-full p-1 -ml-1"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="relative">
            <div className="w-9 h-9 bg-[#dfe5e7] rounded-full flex items-center justify-center text-gray-500 font-bold overflow-hidden border border-white/20">
              <span className="text-base">Jh</span>
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25D366] rounded-full border-2 border-[#075E54]"></div>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="font-semibold truncate leading-tight tracking-wide">
              {flowName}
            </div>
            <div className="text-[11px] text-white/80 flex items-center gap-1.5 mt-0.5">
              <span className="capitalize">
                {isSimulating ? "typing..." : "online"}
              </span>
              <span>•</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent text-[11px] border-none focus:ring-0 text-white cursor-pointer p-0 font-medium"
              >
                <option value="en" className="text-black">
                  English
                </option>
                <option value="hi" className="text-black">
                  हिंदी (Hindi)
                </option>
                <option value="or" className="text-black">
                  ଓଡ଼ିଆ (Odia)
                </option>
                <option value="mr" className="text-black">
                  मराठी (Marathi)
                </option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 px-1">
            <Video className="w-5 h-5 cursor-pointer hover:text-white/80 transition-transform" />
            <Phone className="w-5 h-5 cursor-pointer hover:text-white/80 transition-transform" />
            <MoreVertical className="w-5 h-5 cursor-pointer hover:text-white/80 transition-transform" />
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-3 z-0 relative scroll-smooth bg-transparent"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[85%] relative rounded-lg px-3 py-1.5 shadow-sm mb-1 ${
                  msg.type === "user"
                    ? "bg-[#E1FFC7] rounded-tr-none"
                    : "bg-white rounded-tl-none"
                }`}
              >
                {/* Tail */}
                <div
                  className={`absolute top-0 w-3 h-3 ${
                    msg.type === "user"
                      ? "-right-1.5 bg-[#E1FFC7] clip-path-right-tail"
                      : "-left-1.5 bg-white clip-path-left-tail"
                  }`}
                ></div>

                {msg.isTyping ? (
                  <div className="flex gap-1.5 p-1.5 items-center">
                    <div
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "200ms" }}
                    ></div>
                    <div
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "400ms" }}
                    ></div>
                  </div>
                ) : (
                  <>
                    <div className="text-[14.5px] text-[#111b21] whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>

                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="mt-2.5 flex flex-col gap-1 border-t border-gray-100/80 -mx-1 -mb-1 pt-1">
                        {msg.buttons.map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => handleButtonClick(btn.text, btn.id)}
                            className={`w-full text-center py-2.5 px-3 rounded-md text-[13.5px] font-semibold transition-all hover:bg-gray-50/50 active:bg-gray-100 ${
                              btn.isList
                                ? "text-[#008069] flex items-center justify-center gap-2 uppercase tracking-wide text-xs"
                                : "text-[#0695FF]"
                            }`}
                          >
                            {btn.isList && (
                              <MoreVertical className="w-4 h-4 rotate-90" />
                            )}
                            {btn.text}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[10px] text-gray-400">
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {msg.type === "user" && (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="bg-[#F0F2F5] p-2 flex gap-2 items-center z-11 border-t border-gray-200">
          <div className="flex items-center gap-1.5 px-1">
            <Smile className="w-6 h-6 text-[#8696a0] cursor-pointer" />
            <Paperclip className="w-6 h-6 text-[#8696a0] cursor-pointer -rotate-45" />
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendMessage();
              }}
              placeholder="Type a message..."
              className="w-full px-4 py-2.5 rounded-lg border-none bg-white text-[15px] focus:outline-none focus:ring-0 shadow-sm"
            />
          </div>
          <div className="flex items-center justify-center w-11 h-11">
            {userInput.trim() ? (
              <button
                onClick={handleSendMessage}
                className="bg-[#00a884] text-white p-2.5 rounded-full shadow-sm hover:bg-[#008f72] active:scale-90 transition-all"
              >
                <Send className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <div className="bg-[#00a884] text-white p-2.5 rounded-full shadow-sm">
                <Mic className="w-5 h-5 fill-current" />
              </div>
            )}
          </div>
        </div>

        {/* List Popup */}
        {activeList && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40 animate-in fade-in duration-300">
            <div className="relative bg-white text-[#111b21] w-full rounded-t-2xl shadow-2xl flex flex-col max-h-[80%] animate-in slide-in-from-bottom duration-300">
              <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveList(null)}
                    className="p-1 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                  <span className="text-lg font-semibold">
                    {activeList.buttonText}
                  </span>
                </div>
              </div>

              <div className="overflow-y-auto pt-2 pb-6">
                {activeList.sections.map((section, secIdx) => (
                  <div key={secIdx} className="mb-4">
                    {section.title && (
                      <div className="px-5 py-2 text-[#008069] text-[13px] font-semibold uppercase tracking-widest bg-gray-50/50">
                        {section.title}
                      </div>
                    )}
                    <div>
                      {section.rows?.map((row: any, rowIdx: number) => (
                        <button
                          key={row.id || `${secIdx}-${rowIdx}`}
                          onClick={() => {
                            handleButtonClick(
                              row.title,
                              `list-row-${secIdx}-${rowIdx}`,
                            );
                            setActiveList(null);
                          }}
                          className="w-full px-5 py-3.5 flex flex-col items-start hover:bg-gray-50 active:bg-gray-100 border-b border-gray-50 last:border-0"
                        >
                          <div className="text-[16px] text-[#111b21] font-medium leading-tight">
                            {row.title}
                          </div>
                          {row.description && (
                            <div className="text-[13px] text-gray-500 mt-1 truncate w-full">
                              {row.description}
                            </div>
                          )}
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
    </div>
  );
}
