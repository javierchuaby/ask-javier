import fs from "fs";
import path from "path";
import { env } from "@/lib/env";

/**
 * Retrieves the system prompt for Javier.
 * Priority:
 * 1. Local markdown file: prompts/system-prompt.md (used in local development)
 * 2. Environment variable: JAVIER_SYSTEM_PROMPT (used on Vercel deployment)
 */
export function getSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), "prompts", "system-prompt.md");
    if (fs.existsSync(promptPath)) {
      const content = fs.readFileSync(promptPath, "utf-8").trim();
      if (content) {
        return content;
      }
    }
  } catch {
    // Ignore filesystem read error in edge/sandboxed environments and fallback to env
  }

  return env.JAVIER_SYSTEM_PROMPT || "";
}
