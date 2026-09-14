#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const promptFile = path.join(rootDir, "prompts", "system-prompt.md");
const envFile = path.join(rootDir, ".env.local");

if (!fs.existsSync(promptFile)) {
  console.error(`❌ Error: Prompt file not found at ${promptFile}`);
  process.exit(1);
}

const rawPrompt = fs.readFileSync(promptFile, "utf-8").trim();

if (!rawPrompt) {
  console.error("❌ Error: Prompt file is empty.");
  process.exit(1);
}

console.log("📝 Read system prompt from prompts/system-prompt.md");
console.log(
  `   Length: ${rawPrompt.length} characters (~${rawPrompt.split(/\s+/).length} words)`,
);

// Format for .env.local: escape backslashes and double quotes, convert newlines to \n
const escapedForEnv = JSON.stringify(rawPrompt);

// Update .env.local if it exists
if (fs.existsSync(envFile)) {
  let envContent = fs.readFileSync(envFile, "utf-8");

  // Remove any leftover AFFECTION_MIRRORING_INSTRUCTION
  envContent = envContent.replace(/^AFFECTION_MIRRORING_INSTRUCTION=.*$/gm, "");

  // Check if JAVIER_SYSTEM_PROMPT already exists
  const promptRegex = /^JAVIER_SYSTEM_PROMPT=.*$/m;
  if (promptRegex.test(envContent)) {
    envContent = envContent.replace(
      promptRegex,
      `JAVIER_SYSTEM_PROMPT=${escapedForEnv}`,
    );
  } else {
    envContent += `\nJAVIER_SYSTEM_PROMPT=${escapedForEnv}\n`;
  }

  // Clean up any double blank lines
  envContent = envContent.replace(/\n{3,}/g, "\n\n");

  fs.writeFileSync(envFile, envContent, "utf-8");
  console.log(
    "✅ Updated JAVIER_SYSTEM_PROMPT in .env.local (valid escaped single-line)",
  );
} else {
  fs.writeFileSync(envFile, `JAVIER_SYSTEM_PROMPT=${escapedForEnv}\n`, "utf-8");
  console.log("✅ Created .env.local with JAVIER_SYSTEM_PROMPT");
}

// Copy raw prompt to macOS clipboard via pbcopy
try {
  execSync("pbcopy", { input: rawPrompt });
  console.log(
    "📋 Copied raw multiline prompt to macOS clipboard (ready to Cmd+V into Vercel Dashboard)",
  );
} catch {
  console.log(
    "ℹ️  Clipboard copy skipped (not on macOS or pbcopy unavailable)",
  );
}

console.log("\n🚀 System prompt is ready!");
console.log(
  "   - Local dev (`next dev`): Automatically loads prompts/system-prompt.md directly from disk.",
);
console.log(
  "   - Production (Vercel): Paste from your clipboard into Vercel Dashboard -> Settings -> Environment Variables (JAVIER_SYSTEM_PROMPT).",
);
