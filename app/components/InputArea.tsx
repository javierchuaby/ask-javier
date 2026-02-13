"use client";

import { RefObject } from "react";

import { Heart } from "lucide-react";
import { formatRetryTime, isValentinePeriod } from "@/app/utils/dateUtils";

interface InputAreaProps {
  input: string;
  isLoading: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  rateLimitRetryIn: number | null;
  onRetry?: () => void;
}

export function InputArea({
  input,
  isLoading,
  textareaRef,
  onInputChange,
  onSubmit,
  rateLimitRetryIn,
  onRetry,
}: InputAreaProps) {
  const isValentine = isValentinePeriod();
  const showHeart = isValentine && input.trim().length > 0;

  return (
    <div
      className={`bg-[var(--bg-primary)] px-[var(--spacing-input-area-padding-x)] pb-[var(--spacing-input-area-padding-y-bottom)] pt-[var(--spacing-input-area-padding-y-top)] ${isValentine ? "font-[family-name:var(--font-itim)]" : ""}`}
    >
      <div className="max-w-[var(--max-width-chat)] mx-auto flex flex-col gap-2">
        {/* Rate limit banner */}
        {rateLimitRetryIn !== null && (
          <div className="rate-limit-banner flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/50">
            <span className="text-[var(--text-primary)]">
              {rateLimitRetryIn > 0
                ? `AI is busy. Try again in ${formatRetryTime(rateLimitRetryIn)}.`
                : "Ready to try again."}
            </span>
            {rateLimitRetryIn === 0 && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-amber-200 px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700"
              >
                Retry
              </button>
            )}
          </div>
        )}
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
            disabled={
              isLoading ||
              !input.trim() ||
              (rateLimitRetryIn !== null && rateLimitRetryIn > 0)
            }
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
