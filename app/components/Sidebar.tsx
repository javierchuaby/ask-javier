"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChildDress,
  faArrowRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { Chat } from "@/app/types/chat";
import { ChatList } from "./ChatList";

import { isValentinePeriod } from "@/app/utils/dateUtils";

interface ChatGroup {
  label: string;
  chats: Chat[];
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onNewChat: () => void;
  onShowLogoutModal: () => void;
  // ChatList props
  chats: Chat[];
  currentChatId: string | null;
  loadingChats: boolean;
  searchQuery: string;
  onSwitchChat: (chatId: string) => void;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  groupChatsByDate: (chats: Chat[]) => ChatGroup[];
}

export function Sidebar({
  isOpen,
  onToggle,
  onClose,
  onNewChat,
  onShowLogoutModal,
  chats,
  currentChatId,
  loadingChats,
  searchQuery,
  onSwitchChat,
  onDeleteChat,
  groupChatsByDate,
}: SidebarProps) {
  const isValentine = isValentinePeriod();

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black z-40 md:hidden transition-[var(--transition-opacity)]"
          style={{ opacity: "var(--opacity-backdrop)" }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] text-[var(--sidebar-text)] transition-all duration-300 ease-in-out flex flex-col z-50
          fixed md:relative h-full
          ${isOpen ? "w-65 translate-x-0" : "w-16 -translate-x-full md:translate-x-0"}
        `}
        role="complementary"
        aria-label="Chat navigation"
      >
        {/* Collapsed Sidebar - shown when sidebar is closed */}
        {!isOpen && (
          <div className="flex flex-col items-center py-3 gap-2 h-full">
            <button
              onClick={onToggle}
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
              onClick={onNewChat}
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
              onClick={onShowLogoutModal}
              className="sidebar-button mt-auto"
              style={{ padding: "0.75rem 0.75rem", marginBottom: "0rem" }}
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
        {isOpen && (
          <div className="flex flex-col h-full w-64">
            {/* Profile and Toggle Button */}
            <div className="p-[var(--spacing-sidebar-padding)] flex items-center justify-between">
              {/* Profile Section */}
              <div className="flex items-start gap-2 mt-1">
                {/* Profile Icon */}
                <div
                  className="flex-shrink-0"
                  style={{ marginTop: "0.5rem", marginLeft: "0.2rem" }}
                >
                  <FontAwesomeIcon
                    icon={faChildDress}
                    className={
                      isValentine
                        ? "text-[#DA6A68]"
                        : "text-[#FBBF24] dark:text-[#fed11d]"
                    }
                    style={{
                      width: "30px",
                      height: "30px",
                    }}
                  />
                </div>
                {/* Name and Username */}
                <div className="flex flex-col mt-1">
                  <span
                    className={`text-sm font-medium text-[var(--sidebar-text)] ${isValentine ? "font-[family-name:var(--font-itim)]" : ""}`}
                  >
                    Aiden Lei Lopez
                  </span>
                  <span
                    className={`text-xs text-[var(--chat-text-muted)] ${isValentine ? "font-[family-name:var(--font-itim)]" : ""}`}
                  >
                    @axd_lei
                  </span>
                </div>
              </div>
              {/* Toggle Buttons */}
              <div className="flex items-center gap-2">
                {/* Toggle button for desktop and mobile */}
                <button
                  onClick={onToggle}
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
                  onClick={onClose}
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
                onClick={onNewChat}
                className="bubble-button"
                style={{
                  paddingTop: "0.6rem",
                  paddingBottom: "0.6rem",
                  paddingLeft: "1rem",
                  paddingRight: "1rem",
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
                <span
                  className={
                    isValentine ? "font-[family-name:var(--font-itim)]" : ""
                  }
                >
                  New Chat
                </span>
              </button>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              <ChatList
                chats={chats}
                currentChatId={currentChatId}
                loadingChats={loadingChats}
                searchQuery={searchQuery}
                onSwitchChat={onSwitchChat}
                onDeleteChat={onDeleteChat}
                groupChatsByDate={groupChatsByDate}
              />
            </div>

            {/* Logout Button */}
            <div className="px-2 pb-3 pt-4">
              <button
                onClick={onShowLogoutModal}
                className="sidebar-button w-full flex items-center gap-3"
                style={{ padding: "0.75rem 0.75rem", marginBottom: "0rem" }}
                aria-label="Log out"
              >
                <FontAwesomeIcon
                  icon={faArrowRightFromBracket}
                  className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
                />
                <span
                  className={`text-base text-[var(--sidebar-text)] ${isValentine ? "font-[family-name:var(--font-itim)]" : ""}`}
                >
                  Log out
                </span>
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
