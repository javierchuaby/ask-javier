"use client";

import { Chat } from "@/app/types/chat";

interface ChatGroup {
  label: string;
  chats: Chat[];
}

interface ChatListProps {
  chats: Chat[];
  currentChatId: string | null;
  loadingChats: boolean;
  searchQuery: string;
  onSwitchChat: (chatId: string) => void;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  groupChatsByDate: (chats: Chat[]) => ChatGroup[];
}

export function ChatList({
  chats,
  currentChatId,
  loadingChats,
  searchQuery,
  onSwitchChat,
  onDeleteChat,
  groupChatsByDate,
}: ChatListProps) {
  if (loadingChats) {
    return (
      <div className="px-2 pb-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-3 py-2.5 mb-1 animate-pulse">
            <div className="h-4 bg-[var(--stone-200)] rounded-[var(--radius-sm)] w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (chats.length === 0 && !searchQuery) {
    return (
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
    );
  }

  if (chats.length === 0 && searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-[var(--chat-text-muted)] text-sm">No chats found</p>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      {groupChatsByDate(chats).map((group) => (
        <div key={group.label} className="mb-4">
          {!searchQuery && (
            <div className="px-3 py-2 text-xs font-medium text-[var(--chat-text-muted)] uppercase tracking-wider">
              {group.label}
            </div>
          )}
          {group.chats.map((chat) => (
            <div
              key={chat._id}
              onClick={() => onSwitchChat(chat._id)}
              className={`chat-item group ${
                currentChatId === chat._id ? "chat-item-active" : ""
              }`}
            >
              <span>{chat.title}</span>
              <button
                onClick={(e) => onDeleteChat(chat._id, e)}
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
  );
}
