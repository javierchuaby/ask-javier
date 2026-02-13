"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { useChatCache } from "@/app/hooks/useChatCache";
import { authenticatedFetch } from "@/app/utils/api";
import { ChatMessage, Chat } from "@/app/types/chat";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { MessageList } from "@/app/components/MessageList";
import { InputArea } from "@/app/components/InputArea";
import { LogoutModal } from "@/app/components/LogoutModal";
import { isValentinePeriod } from "@/app/utils/dateUtils";

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

  const isValentine = isValentinePeriod();

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
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // Approximate line height in pixels
      const maxHeight = lineHeight * 10; // 10 lines max

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

  const updateChatInList = (
    chatId: string,
    updates?: Partial<Chat> & { messageCountIncrement?: number },
  ) => {
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
        const formattedMessages: ChatMessage[] = data.messages.map(
          (msg: { role: "aiden" | "javier"; content: string }) => ({
            role: msg.role,
            content: msg.content,
          }),
        );
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

  const handleAskJavier = async () => {
    if (!input.trim() || isLoading) return;

    // Add length validation on frontend
    const MAX_INPUT_LENGTH = 100000; // Match backend limit
    if (input.length > MAX_INPUT_LENGTH) {
      alert(
        `Message too long. Maximum length is ${MAX_INPUT_LENGTH} characters.`,
      );
      return;
    }

    // Ensure we have a chat
    let chatId = currentChatId;
    let isFirstMessage = false;
    if (!chatId) {
      // Create new chat if none exists
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
        // Error is already handled by authenticatedFetch (redirects on 401)
        return;
      }
    } else {
      // Check if this is the first message in an existing chat
      const currentChat = chats.find((chat) => chat._id === chatId);
      isFirstMessage = currentChat ? currentChat.messageCount === 0 : false;
    }

    const userMsg: ChatMessage = { role: "aiden", content: input };
    const updatedMessages = [...messages, userMsg];

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

      // Invalidate cache to refresh chat list and message count
      if (chatId) {
        chatCache.invalidate(chatId);
        updateChatInList(chatId, { messageCountIncrement: 2 });
      }

      // If this is the first message, fetch updated chat title after AI generation
      if (chatId && isFirstMessage) {
        // Wait a bit for the title to be generated, then fetch updated chat
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
                  // Re-sort by updatedAt descending
                  return newChats.sort((a, b) => {
                    const dateA = new Date(a.updatedAt).getTime();
                    const dateB = new Date(b.updatedAt).getTime();
                    return dateB - dateA;
                  });
                }
                return prevChats;
              });
            }
          } catch (error) {
            console.error("Failed to fetch updated chat title:", error);
          }
        }, 2000); // Wait 2 seconds for AI title generation
      }

      if (accumulatedText.trim().length === 0) {
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
          messages={messages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
        />

        <InputArea
          input={input}
          isLoading={isLoading}
          textareaRef={textareaRef}
          onInputChange={setInput}
          onSubmit={handleAskJavier}
        />
      </main>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => signOut()}
      />

      {/* Valentine's Decorations (Hidden on mobile) */}
      {isValentine && mounted && <></>}
    </div>
  );
}
