"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChildDress, faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useChatCache } from "@/app/hooks/useChatCache";
import { authenticatedFetch } from "@/app/utils/api";

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
  const [searchQuery, _setSearchQuery] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const chatCache = useChatCache();

  // Ensure component is mounted before using theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter chats by search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase().trim();
    return chats.filter((chat) => chat.title.toLowerCase().includes(query));
  }, [chats, searchQuery]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // Approximate line height in pixels
      const maxHeight = lineHeight * 10; // 10 lines max
      
      if (scrollHeight <= maxHeight) {
        textareaRef.current.style.height = `${Math.max(scrollHeight, 24)}px`;
        textareaRef.current.style.overflowY = 'hidden';
      } else {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = 'auto';
      }
    }
  }, [input]);

  const loadChats = async () => {
    try {
      const response = await authenticatedFetch("/api/chats");
      if (response.ok) {
        const data = await response.json();
        setChats(data);
        // If no current chat and chats exist, load the most recent one
        if (!currentChatId && data.length > 0) {
          setCurrentChatId(data[0]._id);
          loadChatMessages(data[0]._id);
        }
      }
    } catch {
      // Error is already handled by authenticatedFetch (redirects on 401)
    } finally {
      setLoadingChats(false);
    }
  };

  const updateChatInList = (chatId: string, updates?: Partial<Chat> & { messageCountIncrement?: number }) => {
    setChats((prevChats) => {
      const chatIndex = prevChats.findIndex((chat) => chat._id === chatId);
      
      if (chatIndex === -1) {
        // Chat not found in list, return unchanged
        return prevChats;
      }

      // Create updated chat object
      const chat = prevChats[chatIndex];
      const messageCountIncrement = updates?.messageCountIncrement ?? 1;
      const updatedChat: Chat = {
        ...chat,
        messageCount: chat.messageCount + messageCountIncrement,
        updatedAt: updates?.updatedAt ?? new Date().toISOString(),
        ...(updates?.title && { title: updates.title }),
      };

      // Remove chat from current position and add to top
      const newChats = [...prevChats];
      newChats.splice(chatIndex, 1);
      
      // Insert at the beginning
      newChats.unshift(updatedChat);

      // Re-sort by updatedAt descending to ensure proper order
      return newChats.sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
    });
  };

  const rollbackChatUpdate = (chatId: string, previousMessageCount: number, previousUpdatedAt: string) => {
    setChats((prevChats) => {
      const chatIndex = prevChats.findIndex((chat) => chat._id === chatId);
      
      if (chatIndex === -1) {
        return prevChats;
      }

      const chat = prevChats[chatIndex];
      const rolledBackChat: Chat = {
        ...chat,
        messageCount: previousMessageCount,
        updatedAt: previousUpdatedAt,
      };

      // Remove chat from current position
      const newChats = [...prevChats];
      newChats.splice(chatIndex, 1);
      
      // Re-insert at original position (or re-sort to find correct position)
      newChats.push(rolledBackChat);
      
      // Re-sort by updatedAt descending
      return newChats.sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
    });
  };

  const loadChatMessages = async (chatId: string) => {
    // Check cache first
    const cachedMessages = chatCache.get(chatId);
    if (cachedMessages) {
      setMessages(cachedMessages);
      return;
    }

    // Cache miss - fetch from API
    try {
      const response = await authenticatedFetch(`/api/chats/${chatId}`);
      if (response.ok) {
        const data = await response.json();
        const formattedMessages: ChatMessage[] = data.messages.map((msg: { role: "aiden" | "javier"; content: string }) => ({
          role: msg.role,
          content: msg.content,
        }));
        setMessages(formattedMessages);
        // Store in cache
        chatCache.set(chatId, formattedMessages);
      }
    } catch {
      // Error is already handled by authenticatedFetch (redirects on 401)
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
    
    // Check cache for instant loading
    const cachedMessages = chatCache.get(chatId);
    if (cachedMessages) {
      setMessages(cachedMessages);
    } else {
      // Cache miss - load from API
      await loadChatMessages(chatId);
    }
    
    // Close sidebar on mobile after switching
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await authenticatedFetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        // Invalidate cache for deleted chat
        chatCache.invalidate(chatId);
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
    } catch {
      // Error is already handled by authenticatedFetch (redirects on 401)
    }
  };

  const saveMessage = async (chatId: string, role: "aiden" | "javier", content: string): Promise<boolean> => {
    try {
      const response = await authenticatedFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      });
      return response.ok;
    } catch {
      // Error is already handled by authenticatedFetch (redirects on 401)
      return false;
    }
  };

  const handleAskJavier = async () => {
    if (!input.trim() || isLoading) return;
    
    // Add length validation on frontend
    const MAX_INPUT_LENGTH = 100000; // Match backend limit
    if (input.length > MAX_INPUT_LENGTH) {
        alert(`Message too long. Maximum length is ${MAX_INPUT_LENGTH} characters.`);
        return;
    }

    // Ensure we have a chat
    let chatId = currentChatId;
    if (!chatId) {
      // Create new chat if none exists
      try {
        const response = await authenticatedFetch("/api/chats", {
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
          return;
        }
      } catch {
        // Error is already handled by authenticatedFetch (redirects on 401)
        return;
      }
    }

    const userMsg: ChatMessage = { role: "aiden", content: input };
    const updatedMessages = [...messages, userMsg];
    
      // Save user message to database
      if (chatId) {
        await saveMessage(chatId, "aiden", input);
        // Invalidate cache after saving user message
        chatCache.invalidate(chatId);
      }
    
    // Create streaming message immediately
    const streamingMsg: ChatMessage = { role: "javier", content: "" };
    
    // Add both user message and empty streaming message
    setMessages([...updatedMessages, streamingMsg]);
    setInput("");
    setIsLoading(true);

    const streamingIndex = updatedMessages.length;

    try {
      const response = await authenticatedFetch("/api/chat", {
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
      if (accumulatedText && accumulatedText.trim().length > 0 && chatId) {
        // Store previous state for rollback
        const chat = chats.find(c => c._id === chatId);
        const previousMessageCount = chat?.messageCount ?? 0;
        const previousUpdatedAt = chat?.updatedAt ?? new Date().toISOString();
        
        // Optimistically update first
        updateChatInList(chatId, { messageCountIncrement: 2 });
        
        // Try to save bot message
        const saveSuccess = await saveMessage(chatId, "javier", accumulatedText);
        
        if (!saveSuccess) {
          // Rollback the optimistic update
          rollbackChatUpdate(chatId, previousMessageCount, previousUpdatedAt);
        } else {
          // Invalidate cache only on success
          chatCache.invalidate(chatId);
        }
      } else if (accumulatedText.trim().length === 0) {
        // Handle empty response
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
      }
    } catch {
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

  // Handle escape key to close sidebar on mobile
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen && window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSidebarOpen]);

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black z-40 md:hidden transition-[var(--transition-opacity)]"
          style={{ opacity: 'var(--opacity-backdrop)' }}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] text-[var(--sidebar-text)] transition-all duration-300 ease-in-out flex flex-col z-50
          fixed md:relative h-full
          ${isSidebarOpen ? "w-65 translate-x-0" : "w-16 -translate-x-full md:translate-x-0"}
        `}
        role="complementary"
        aria-label="Chat navigation"
      >
        {/* Collapsed Sidebar - shown when sidebar is closed */}
        {!isSidebarOpen && (
          <div className="flex flex-col items-center py-3 gap-2 h-full">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="sidebar-button mt-1"
              aria-label="Open sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
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
            <button
              onClick={createNewChat}
              className="sidebar-button mt-2"
              aria-label="New chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="sidebar-button mt-auto"
              style={{ padding: '0.75rem 0.75rem', marginBottom: '0rem' }}
              aria-label="Log out"
            >
              <FontAwesomeIcon 
                icon={faArrowRightFromBracket} 
                className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
              />
            </button>
          </div>
        )}

        {/* Full Sidebar Content - shown when sidebar is open */}
        {isSidebarOpen && (
          <div className="flex flex-col h-full w-64">
            {/* Profile and Toggle Button */}
            <div className="p-[var(--spacing-sidebar-padding)] flex items-center justify-between">
              {/* Profile Section */}
              <div className="flex items-start gap-2 mt-1">
                {/* Profile Icon */}
                <div className="flex-shrink-0" style={{ marginTop: '0.5rem', marginLeft: '0.2rem' }}>
                  <FontAwesomeIcon 
                    icon={faChildDress} 
                    className="text-[#FBBF24] dark:text-[#fed11d]"
                    style={{ 
                      width: '30px',
                      height: '30px',
                    }}
                  />
                </div>
                {/* Name and Username */}
                <div className="flex flex-col mt-1">
                  <span className="text-sm font-medium text-[var(--sidebar-text)]">Aiden Lei Lopez</span>
                  <span className="text-xs text-[var(--chat-text-muted)]">@axd_lei</span>
                </div>
              </div>
              {/* Toggle Buttons */}
              <div className="flex items-center gap-2">
                {/* Toggle button for desktop and mobile */}
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="sidebar-button mt-1"
                  aria-label="Toggle sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                {/* Close button for mobile only */}
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="sidebar-button md:hidden"
                  aria-label="Close sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
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
            </div>

            {/* Navigation Menu */}
            <div className="px-2 pt-2 pb-2">
              <button
                onClick={createNewChat}
                className="bubble-button"
                style={{
                  paddingTop: '0.6rem',
                  paddingBottom: '0.6rem',
                  paddingLeft: '1rem',
                  paddingRight: '1rem',
                }}
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
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                <span>New Chat</span>
              </button>
            </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <div className="px-2 pb-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="px-3 py-2.5 mb-1 animate-pulse">
                    <div className="h-4 bg-[var(--stone-200)] rounded-[var(--radius-sm)] w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : filteredChats.length === 0 && !searchQuery ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="mb-6 text-[var(--stone-400)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-16 w-16"
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
                <p className="text-[var(--chat-text)] font-medium text-base mb-2">No chats yet</p>
                <p className="text-[var(--chat-text-muted)] text-sm">Begin chatting with Javier to get started</p>
              </div>
            ) : filteredChats.length === 0 && searchQuery ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <p className="text-[var(--chat-text-muted)] text-sm">No chats found</p>
              </div>
            ) : (
              <div className="px-2 pb-2">
                {groupChatsByDate(filteredChats).map((group) => (
                  <div key={group.label} className="mb-4">
                    {!searchQuery && (
                      <div className="px-3 py-2 text-xs font-medium text-[var(--chat-text-muted)] uppercase tracking-wider">
                        {group.label}
                      </div>
                    )}
                    {group.chats.map((chat) => (
                      <div
                        key={chat._id}
                        onClick={() => switchChat(chat._id)}
                        className={`chat-item group ${
                          currentChatId === chat._id ? "chat-item-active" : ""
                        }`}
                      >
                        <span>{chat.title}</span>
                        <button
                          onClick={(e) => deleteChat(chat._id, e)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--chat-text-muted)] hover:text-[var(--chat-text)] transition-[var(--transition-default)] p-1 rounded-[var(--radius-sm)] hover:bg-[var(--chat-delete-hover)]"
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
          
          {/* Logout Button */}
          <div className="px-2 pb-3 pt-4">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="sidebar-button w-full flex items-center gap-3"
              style={{ padding: '0.75rem 0.75rem', marginBottom: '0rem' }}
              aria-label="Log out"
            >
              <FontAwesomeIcon 
                icon={faArrowRightFromBracket} 
                className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
              />
              <span className="text-sm text-[var(--sidebar-text)]">Log out</span>
            </button>
          </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with Toggle */}
        <div className="topbar bg-[var(--bg-primary)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="sidebar-button md:hidden"
              aria-label="Open sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)] text-[var(--chat-text)]"
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
              <h1 className="text-xl font-bold text-[var(--chat-text)]">Ask Javier</h1>
              <p className="text-xs text-[var(--chat-text-muted)] italic">For Aiden Lei Lopez</p>
            </header>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="sidebar-button"
            aria-label="Toggle theme"
          >
            {(!mounted || theme === "dark") ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)] text-[var(--chat-text)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)] text-[var(--chat-text)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Chat Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col">
          <div className={`max-w-[800px] mx-auto w-full overflow-visible ${messages.length === 0 && !isLoading ? 'flex-1 flex flex-col justify-center' : ''}`}>
            {/* Chat History Area */}
            <div className={messages.length === 0 && !isLoading ? '' : 'space-y-6 mb-8 min-h-[300px]'}>
              {messages.length === 0 && !isLoading && (
                <div className="text-center text-[var(--chat-text-muted)] py-12">
                  <p>Start a conversation with Javier...</p>
                </div>
              )}
              {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === "aiden" ? "justify-end" : "justify-start"} ${msg.role === "javier" ? "w-full" : ""}`}
              style={{ 
                animation: `fadeIn 0.2s ease-out forwards`,
                opacity: 0
              }}
            >
              <div className={`message-bubble ${msg.role === "aiden" ? "max-w-[var(--message-max-width)]" : "w-[800px] !max-w-none"} ${
                msg.role === "aiden" 
                ? "bg-[var(--message-bubble-user-bg)] border border-[#f4f4f4] text-[var(--text-primary)]" 
                : "bg-[var(--message-bubble-assistant-bg)] border border-[var(--stone-300)] text-[var(--text-primary)]"              }`}
              >
                {msg.role === "javier" ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="markdown-paragraph">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="markdown-list markdown-list-unordered">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="markdown-list markdown-list-ordered">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="markdown-list-item">{children}</li>
                      ),
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="markdown-code-inline" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="markdown-code-block">
                          {children}
                        </pre>
                      ),
                      h1: ({ children }) => (
                        <h1 className="markdown-heading markdown-heading-1">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="markdown-heading markdown-heading-2">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="markdown-heading markdown-heading-3">{children}</h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="markdown-heading markdown-heading-4">{children}</h4>
                      ),
                      h5: ({ children }) => (
                        <h5 className="markdown-heading markdown-heading-5">{children}</h5>
                      ),
                      h6: ({ children }) => (
                        <h6 className="markdown-heading markdown-heading-6">{children}</h6>
                      ),
                      strong: ({ children }) => (
                        <strong className="markdown-strong">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="markdown-em">{children}</em>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="markdown-blockquote">{children}</blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a href={href} className="markdown-link" target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                      table: ({ children }) => (
                        <div className="markdown-table-wrapper">
                          <table className="markdown-table">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="markdown-table-head">{children}</thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody className="markdown-table-body">{children}</tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className="markdown-table-row">{children}</tr>
                      ),
                      th: ({ children }) => (
                        <th className="markdown-table-header">{children}</th>
                      ),
                      td: ({ children }) => (
                        <td className="markdown-table-cell">{children}</td>
                      ),
                      hr: () => (
                        <hr className="markdown-hr" />
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
                <p className="text-[var(--chat-text-muted)] animate-pulse">Javier is typing...</p>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-[var(--bg-primary)] px-[var(--spacing-input-area-padding-x)] pb-[var(--spacing-input-area-padding-y-bottom)] pt-[var(--spacing-input-area-padding-y-top)]">
          <div className="max-w-[var(--max-width-chat)] mx-auto">
            {/* Floating Bubble Container */}
            <div className="input-bubble">
              {/* Input Field - Changed to textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAskJavier();
                  }
                }}
                placeholder="Ask anything"
                rows={1}
                style={{
                  resize: 'none',
                  overflow: 'hidden',
                  minHeight: '24px',
                  maxHeight: '240px', // 10 lines * 24px
                }}
              />
              
              {/* Send Button */}
              <button
                onClick={handleAskJavier}
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="var(--input-button-color)"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black z-50 transition-[var(--transition-opacity)]"
            style={{ opacity: 'var(--opacity-backdrop)' }}
            onClick={() => setShowLogoutModal(false)}
            aria-hidden="true"
          />
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[500px] mx-4">
              <div
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-10 shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                  Log out
                </h2>
                <p className="text-[var(--text-secondary)] mb-6">
                  Are you sure you want to log out?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="px-4 py-2 rounded-[var(--radius-md)] text-[var(--text-primary)] hover:bg-[var(--button-hover)] transition-[var(--transition-colors)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--input-button-bg)] text-[var(--input-button-color)] hover:bg-[var(--input-button-hover)] transition-[var(--transition-colors)]"
                  >
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
