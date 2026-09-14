import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { getSystemPrompt } from "./prompt";
import { env } from "@/lib/env";

vi.mock("fs");

describe("lib/prompt", () => {
  const originalPromptEnv = env.JAVIER_SYSTEM_PROMPT;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore env
    env.JAVIER_SYSTEM_PROMPT = originalPromptEnv;
  });

  it("reads from prompts/system-prompt.md if the file exists on disk", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("### MOCK PROMPT FROM FILE");

    const result = getSystemPrompt();
    expect(result).toBe("### MOCK PROMPT FROM FILE");
  });

  it("falls back to env.JAVIER_SYSTEM_PROMPT if the file does not exist", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    env.JAVIER_SYSTEM_PROMPT = "### FALLBACK ENV PROMPT";

    const result = getSystemPrompt();
    expect(result).toBe("### FALLBACK ENV PROMPT");
  });

  it("falls back to env.JAVIER_SYSTEM_PROMPT if the file is empty", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("   ");
    env.JAVIER_SYSTEM_PROMPT = "### FALLBACK FOR EMPTY FILE";

    const result = getSystemPrompt();
    expect(result).toBe("### FALLBACK FOR EMPTY FILE");
  });

  it("falls back to env.JAVIER_SYSTEM_PROMPT if fs throws an exception", () => {
    vi.spyOn(fs, "existsSync").mockImplementation(() => {
      throw new Error("Disk permission denied");
    });
    env.JAVIER_SYSTEM_PROMPT = "### SAFE FALLBACK ON ERROR";

    const result = getSystemPrompt();
    expect(result).toBe("### SAFE FALLBACK ON ERROR");
  });
});
