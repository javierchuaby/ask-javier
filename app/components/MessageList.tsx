"use client";

import { RefObject } from "react";
import { ChatMessage } from "@/app/types/chat";
import { MessageBubble } from "./MessageBubble";

import { isValentinePeriod } from "@/app/utils/dateUtils";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function MessageList({ messages, isLoading, messagesEndRef }: MessageListProps) {
  const isValentine = isValentinePeriod();

  return (
    <div className={`flex-1 overflow-y-auto px-4 py-6 flex flex-col relative ${isValentine ? "font-[family-name:var(--font-itim)]" : ""}`}>
      <div
        className={`max-w-[800px] mx-auto w-full overflow-visible z-10 ${messages.length === 0 && !isLoading ? "flex-1 flex flex-col justify-center" : ""
          }`}
      >
        {/* Chat History Area */}
        <div className={messages.length === 0 && !isLoading ? "" : "space-y-6 mb-8 min-h-[300px]"}>
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-[var(--chat-text-muted)] py-12 flex flex-col items-center gap-4">
              {isValentine ? (
                <div className="text-4xl animate-bounce"><img src="/daisies.png" alt="Daisy" className="w-12 h-12 object-contain" /></div>
              ) : null}
              <p>Start a conversation with Javier...</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <MessageBubble key={index} message={msg} />
          ))}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
            <p className="text-[var(--chat-text-muted)] animate-pulse">Javier is typing...</p>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
