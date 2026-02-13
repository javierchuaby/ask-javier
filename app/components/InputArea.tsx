"use client";

import { RefObject } from "react";

import { Heart } from "lucide-react";
import { isValentinePeriod } from "@/app/utils/dateUtils";

interface InputAreaProps {
  input: string;
  isLoading: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

export function InputArea({
  input,
  isLoading,
  textareaRef,
  onInputChange,
  onSubmit,
}: InputAreaProps) {
  const isValentine = isValentinePeriod();
  const showHeart = isValentine && input.trim().length > 0;

  return (
    <div
      className={`bg-[var(--bg-primary)] px-[var(--spacing-input-area-padding-x)] pb-[var(--spacing-input-area-padding-y-bottom)] pt-[var(--spacing-input-area-padding-y-top)] ${isValentine ? "font-[family-name:var(--font-itim)]" : ""}`}
    >
      <div className="max-w-[var(--max-width-chat)] mx-auto">
        {/* Floating Bubble Container */}
        <div
          className={`input-bubble ${isValentine ? "border-[var(--valentine-user-bubble)]" : ""}`}
        >
          {/* Input Field - Changed to textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={"Ask anything"}
            rows={1}
            style={{
              resize: "none",
              overflow: "hidden",
              minHeight: "24px",
              maxHeight: "240px", // 10 lines * 24px
            }}
          />

          {/* Send Button */}
          <button
            onClick={onSubmit}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className={`${showHeart || isValentine ? "text-white" : ""} ${isValentine ? "!bg-[var(--valentine-accent)] hover:!bg-[#b93c3c] !opacity-100" : ""}`}
          >
            {showHeart ? (
              <Heart
                className={`h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)] transition-colors duration-300 ${isLoading ? "animate-pulse" : "animate-heartbeat"}`}
                fill="currentColor"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[var(--spacing-button-icon)] w-[var(--spacing-button-icon)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
