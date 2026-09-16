"use client";

import ReactMarkdown from "react-markdown";
import { ChatMessage } from "@/app/types/chat";
import { markdownComponents } from "./MarkdownComponents";

import { isValentinePeriod } from "@/app/utils/dateUtils";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isValentine = isValentinePeriod();

  const userBubbleClass = isValentine
    ? "bg-[var(--valentine-user-bubble)] text-[var(--text-primary)] font-[family-name:var(--font-itim)]"
    : "bg-[var(--message-bubble-user-bg)] border border-[#f4f4f4] text-[var(--text-primary)]";

  const aiBubbleClass = isValentine
    ? "bg-[var(--valentine-ai-bubble)] border-b-2 border-[var(--valentine-gold)] text-[var(--text-primary)] font-[family-name:var(--font-itim)]"
    : "bg-[var(--message-bubble-assistant-bg)] border border-[var(--stone-300)] text-[var(--text-primary)]";

  return (
    <div
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} ${message.role === "bot" ? "w-full" : ""}`}
      style={{
        animation: `fadeIn 0.2s ease-out forwards`,
        opacity: 0,
      }}
    >
      <div
        className={`message-bubble ${message.role === "user" ? "max-w-[var(--message-max-width)]" : "w-[800px] !max-w-none"} ${
          message.role === "user" ? userBubbleClass : aiBubbleClass
        }`}
      >
        {message.role === "bot" ? (
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        ) : (
          <span>{message.content}</span>
        )}
      </div>
    </div>
  );
}
