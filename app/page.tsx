"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { useChat } from "ai/react";
import { useChatCache } from "@/app/hooks/useChatCache";
import { authenticatedFetch } from "@/app/utils/api";
import { ChatMessage, Chat } from "@/app/types/chat";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { MessageList } from "@/app/components/MessageList";
import { InputArea } from "@/app/components/InputArea";
import { LogoutModal } from "@/app/components/LogoutModal";
import { formatRetryTime, isValentinePeriod } from "@/app/utils/dateUtils";

export default function Home() {
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
  const [rateLimitRetryIn, setRateLimitRetryIn] = useState<number | null>(null);
  const chatCache = useChatCache();

  const isValentine = isValentinePeriod();

  // useChat integration
  const { messages, setMessages, input, setInput, append, isLoading } = useChat({
    api: "/api/chat",
    onError: (error) => {
      // Assuming 429 errors contain 'retryAfter' in the message or handle gracefully
      if (error.message.includes("429") || error.message.includes("rate limit")) {
        setRateLimitRetryIn(60); // Default to 60s if not parsed
      }
    },
    onFinish: () => {
      if (currentChatId) {
        chatCache.invalidate(currentChatId);
        updateChatInList(currentChatId, { messageCountIncrement: 2 });
      }
    },
  });

  // Countdown for rate limit banner
  useEffect(() => {
    if (rateLimitRetryIn === null || rateLimitRetryIn <= 0) return;
    const id = setInterval(() => {
      setRateLimitRetryIn((prev) =>
        prev === null || prev <= 0 ? prev : prev - 1,
      );
    }, 1000);
    return () => clearInterval(id);
  }, [rateLimitRetryIn]);

  // Ensure component is mounted before using theme
  useEffect(() => {
    setMounted(true);
    if (isValentine && theme === "dark") {
      setTheme("light");
    }
  }, [isValentine, theme, setTheme]);

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
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; 
      const maxHeight = lineHeight * 10; 

      if (scrollHeight <= maxHeight) {
        textareaRef.current.style.height = `${Math.max(scrollHeight, 24)}px`;
        textareaRef.current.style.overflowY = "hidden";
      } else {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = "auto";
      }
    }
  }, [input]);

  const loadChats = async () => {
    try {
      const response = await authenticatedFetch("/api/chats");
      if (response.ok) {
        const data = await response.json();
        setChats(data);
        if (!currentChatId && data.length > 0) {
          setCurrentChatId(data[0]._id);
          loadChatMessages(data[0]._id);
        }
      }
    } catch {
      // Error is already handled by authenticatedFetch
    } finally {
      setLoadingChats(false);
    }
  };

  const updateChatInList = (
    chatId: string,
    updates?: Partial<Chat> & { messageCountIncrement?: number },
  ) => {
    setChats((prevChats) => {
      const chatIndex = prevChats.findIndex((chat) => chat._id === chatId);
      if (chatIndex === -1) return prevChats;

      const chat = prevChats[chatIndex];
      const messageCountIncrement = updates?.messageCountIncrement ?? 1;
      const updatedChat: Chat = {
        ...chat,
        messageCount: chat.messageCount + messageCountIncrement,
        updatedAt: updates?.updatedAt ?? new Date().toISOString(),
        ...(updates?.title && { title: updates.title }),
      };

      const newChats = [...prevChats];
      newChats.splice(chatIndex, 1);
      newChats.unshift(updatedChat);

      return newChats.sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    });
  };

  const loadChatMessages = async (chatId: string) => {
    const cachedMessages = chatCache.get(chatId);
    if (cachedMessages) {
      setMessages(
        cachedMessages.map((msg, idx) => ({
          id: `msg-${idx}`,
          role: msg.role === "bot" ? "assistant" : "user",
          content: msg.content,
        }))
      );
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/chats/${chatId}`);
      if (response.ok) {
        const data = await response.json();
        const formattedMessages: ChatMessage[] = data.messages.map(
          (msg: { role: "user" | "bot"; content: string }) => ({
            role: msg.role,
            content: msg.content,
          }),
        );
        chatCache.set(chatId, formattedMessages);
        setMessages(
          formattedMessages.map((msg, idx) => ({
            id: `msg-${idx}`,
            role: msg.role === "bot" ? "assistant" : "user",
            content: msg.content,
          }))
        );
      }
    } catch {
      // Handled
    }
  };

  const createNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
  };

  const switchChat = async (chatId: string) => {
    if (chatId === currentChatId) return;
    setCurrentChatId(chatId);
    
    // Clear current messages while loading
    setMessages([]);

    const cachedMessages = chatCache.get(chatId);
    if (cachedMessages) {
      setMessages(
        cachedMessages.map((msg, idx) => ({
          id: `msg-${idx}`,
          role: msg.role === "bot" ? "assistant" : "user",
          content: msg.content,
        }))
      );
    } else {
      await loadChatMessages(chatId);
    }

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
        chatCache.invalidate(chatId);
        setChats((prev) => prev.filter((chat) => chat._id !== chatId));
        if (currentChatId === chatId) {
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
      // Handled
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const MAX_INPUT_LENGTH = 100000;
    if (input.length > MAX_INPUT_LENGTH) {
      alert(`Message too long. Maximum length is ${MAX_INPUT_LENGTH} characters.`);
      return;
    }

    let chatId = currentChatId;
    let isFirstMessage = false;

    if (!chatId) {
      isFirstMessage = true;
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
        return;
      }
    } else {
      const currentChat = chats.find((chat) => chat._id === chatId);
      isFirstMessage = currentChat ? currentChat.messageCount === 0 : false;
    }

    const userInput = input;
    setInput("");

    // Use AI SDK append to start streaming. Pass chatId dynamically so the
    // backend always receives the correct chatId, even for newly-created chats.
    append({
      role: 'user',
      content: userInput,
    }, {
      body: { chatId },
    });
    
    if (chatId && isFirstMessage) {
      setTimeout(async () => {
        try {
          const response = await authenticatedFetch(`/api/chats/${chatId}`);
          if (response.ok) {
            const updatedChat = await response.json();
            setChats((prevChats) => {
              const chatIndex = prevChats.findIndex(
                (chat) => chat._id === chatId,
              );
              if (chatIndex !== -1) {
                const newChats = [...prevChats];
                newChats[chatIndex] = {
                  _id: updatedChat._id,
                  title: updatedChat.title,
                  createdAt: updatedChat.createdAt,
                  updatedAt: updatedChat.updatedAt,
                  messageCount: updatedChat.messageCount || 0,
                };
                return newChats.sort((a, b) => {
                  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                });
              }
              return prevChats;
            });
          }
        } catch (error) {
          console.error("Failed to fetch updated chat title:", error);
        }
      }, 3000); 
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen && window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSidebarOpen]);

  // Map ai-sdk messages to the format expected by MessageList component
  const mappedMessages: ChatMessage[] = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'bot',
    content: m.content || ''
  }));

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={createNewChat}
        onShowLogoutModal={() => setShowLogoutModal(true)}
        chats={filteredChats}
        currentChatId={currentChatId}
        loadingChats={loadingChats}
        searchQuery={searchQuery}
        onSwitchChat={switchChat}
        onDeleteChat={deleteChat}
        groupChatsByDate={groupChatsByDate}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          theme={theme}
          mounted={mounted}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <MessageList
          messages={mappedMessages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
        />

        <InputArea
          input={input}
          isLoading={isLoading}
          textareaRef={textareaRef}
          onInputChange={setInput}
          onSubmit={handleSendMessage}
          rateLimitRetryIn={rateLimitRetryIn}
          onRetry={() => setRateLimitRetryIn(null)}
        />
      </main>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => signOut()}
      />
    </div>
  );
}
