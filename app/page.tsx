"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

// We define what a 'Message' looks like
interface ChatMessage {
  role: "aiden" | "javier";
  content: string;
}

interface Chat {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export default function Home() {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to group chats by date
  const groupChatsByDate = (chats: Chat[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const groups: { label: string; chats: Chat[] }[] = [
      { label: "Today", chats: [] },
      { label: "Yesterday", chats: [] },
      { label: "Previous 7 days", chats: [] },
      { label: "Older", chats: [] },
    ];

    chats.forEach((chat) => {
      const updatedAt = new Date(chat.updatedAt);
      
      if (updatedAt >= today) {
        groups[0].chats.push(chat);
      } else if (updatedAt >= yesterday) {
        groups[1].chats.push(chat);
      } else if (updatedAt >= sevenDaysAgo) {
        groups[2].chats.push(chat);
      } else {
        groups[3].chats.push(chat);
      }
    });

    // Filter out empty groups
    return groups.filter((group) => group.chats.length > 0);
  };

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const loadChats = async () => {
    try {
      const response = await fetch("/api/chats");
      if (response.ok) {
        const data = await response.json();
        setChats(data);
        // If no current chat and chats exist, load the most recent one
        if (!currentChatId && data.length > 0) {
          setCurrentChatId(data[0]._id);
          loadChatMessages(data[0]._id);
        }
      }
    } catch (error) {
      console.error("Failed to load chats:", error);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`);
      if (response.ok) {
        const data = await response.json();
        const formattedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error("Failed to load chat messages:", error);
    }
  };

  const createNewChat = () => {
    // Clear the view without creating a chat
    // Chat will be created automatically when first message is sent
    setCurrentChatId(null);
    setMessages([]);
  };

  const switchChat = async (chatId: string) => {
    if (chatId === currentChatId) return;
    setCurrentChatId(chatId);
    await loadChatMessages(chatId);
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setChats((prev) => prev.filter((chat) => chat._id !== chatId));
        if (currentChatId === chatId) {
          // If deleted chat was active, switch to another or create new
          const remainingChats = chats.filter((chat) => chat._id !== chatId);
          if (remainingChats.length > 0) {
            setCurrentChatId(remainingChats[0]._id);
            loadChatMessages(remainingChats[0]._id);
          } else {
            setCurrentChatId(null);
            setMessages([]);
          }
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const saveMessage = async (chatId: string, role: "aiden" | "javier", content: string) => {
    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      });
    } catch (error) {
      console.error("Failed to save message:", error);
    }
  };

  const handleAskJavier = async () => {
    if (!input.trim() || isLoading) return;

    // Ensure we have a chat
    let chatId = currentChatId;
    if (!chatId) {
      // Create new chat if none exists
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (response.ok) {
        const newChat = await response.json();
        chatId = newChat._id;
        setCurrentChatId(chatId);
        setChats((prev) => [newChat, ...prev]);
      } else {
        console.error("Failed to create chat");
        return;
      }
    }

    const userMsg: ChatMessage = { role: "aiden", content: input };
    const updatedMessages = [...messages, userMsg];
    
      // Save user message to database
      if (chatId) {
        await saveMessage(chatId, "aiden", input);
      }
    
    // Create streaming message immediately
    const streamingMsg: ChatMessage = { role: "javier", content: "" };
    
    // Add both user message and empty streaming message
    setMessages([...updatedMessages, streamingMsg]);
    setInput("");
    setIsLoading(true);

    const streamingIndex = updatedMessages.length;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, chatId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk and append to accumulated text
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Update the streaming message content
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages[streamingIndex]) {
            newMessages[streamingIndex] = {
              ...newMessages[streamingIndex],
              content: accumulatedText,
            };
          }
          return newMessages;
        });
      }

      // Save bot message after streaming completes
      if (accumulatedText && chatId) {
        await saveMessage(chatId, "javier", accumulatedText);
        // Reload chats to update message count
        loadChats();
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
      // Update the streaming message with error message
      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages[streamingIndex]) {
          newMessages[streamingIndex] = {
            ...newMessages[streamingIndex],
            content: "I can't handle that yet—ask the real Javier.",
          };
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-stone-50 font-serif">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-stone-200 text-stone-900 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-64" : "w-0"
        } overflow-hidden flex flex-col`}
      >
        <div className={`flex flex-col h-full ${isSidebarOpen ? "w-64" : "w-0"}`}>
          {/* Sidebar Header */}
          <div className="p-3 border-b border-stone-200">
            <button
              onClick={createNewChat}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-100 transition-colors text-sm font-medium border border-stone-300 text-stone-800"
            >
              <span>+</span>
              <span>New Chat</span>
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <div className="p-4 text-stone-500 text-sm">Loading chats...</div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="mb-4 text-stone-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <p className="text-stone-600 font-medium mb-1">No chats yet</p>
                <p className="text-stone-400 text-sm mb-4">Start a conversation with Javier</p>
                <button
                  onClick={createNewChat}
                  className="px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-stone-800 transition-colors"
                >
                  Create New Chat
                </button>
              </div>
            ) : (
              <div className="p-2">
                {groupChatsByDate(chats).map((group) => (
                  <div key={group.label} className="mb-4">
                    <div className="px-3 py-2 text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {group.label}
                    </div>
                    {group.chats.map((chat) => (
                      <div
                        key={chat._id}
                        onClick={() => switchChat(chat._id)}
                        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-1 ${
                          currentChatId === chat._id
                            ? "bg-stone-100"
                            : "hover:bg-stone-50"
                        }`}
                      >
                        <span className="flex-1 text-sm truncate text-stone-800">
                          {chat.title}
                        </span>
                        <button
                          onClick={(e) => deleteChat(chat._id, e)}
                          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-600 transition-all p-1 rounded hover:bg-stone-200"
                          aria-label="Delete chat"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with Toggle */}
        <div className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-stone-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <header>
            <h1 className="text-xl font-bold text-stone-900">Ask Javier</h1>
            <p className="text-xs text-stone-600 italic">For Aiden Lei Lopez</p>
          </header>
        </div>

        {/* Chat Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {/* Chat History Area */}
            <div className="space-y-6 mb-8 min-h-[300px]">
              {messages.length === 0 && !isLoading && (
                <div className="text-center text-stone-400 py-12">
                  <p>Start a conversation with Javier...</p>
                </div>
              )}
              {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === "aiden" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] p-4 rounded-lg shadow-sm ${
                msg.role === "aiden" 
                ? "bg-stone-800 text-stone-100 rounded-br-none" 
                : "bg-stone-50 border border-stone-200 text-stone-800 rounded-bl-none italic"
              }`}>
                <span className="block text-xs uppercase tracking-widest mb-1 opacity-50">
                  {msg.role === "aiden" ? "AIDEN" : "JAVIER"}
                </span>
                {msg.role === "javier" ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="ml-2">{children}</li>,
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-stone-100 text-stone-800 px-1 py-0.5 rounded text-sm" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="bg-stone-100 border border-stone-300 rounded p-3 overflow-x-auto mb-2">
                          {children}
                        </pre>
                      ),
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-stone-300 pl-4 italic my-2">{children}</blockquote>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
                </div>
              ))}
              {isLoading && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
                <p className="text-stone-400 animate-pulse">Javier is typing...</p>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white p-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-2 rounded-xl shadow-lg border border-stone-200 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskJavier()}
                placeholder="Type here..."
                className="flex-1 p-3 focus:outline-none text-stone-800"
              />
              <button
                onClick={handleAskJavier}
                disabled={isLoading}
                className="bg-stone-900 text-white px-6 py-2 rounded-lg hover:bg-stone-700 transition-colors disabled:bg-stone-300"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
