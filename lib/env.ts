import { z } from "zod";

const envSchema = z.object({
  // Required – fail fast if missing
  GOOGLE_GENAI_API_KEY: z.string().min(1, "GOOGLE_GENAI_API_KEY is required"),
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .refine(
      (val) => val.startsWith("mongodb"),
      "MONGODB_URI must be a valid MongoDB connection string",
    ),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

  // Optional – with defaults
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),
  ALLOWED_EMAILS: z.string().optional().default(""),
  TITLE_GENERATOR_SYSTEM_PROMPT: z.string().optional().default(""),
  JAVIER_SYSTEM_PROMPT: z.string().optional().default(""),

  // Personalization Configs
  NEXT_PUBLIC_BOT_NAME: z.string().optional().default("Bot"),
  NEXT_PUBLIC_USER_NAME: z.string().optional().default("User"),
  NEXT_PUBLIC_USER_FULL_NAME: z.string().optional().default("User"),
  BOT_RELATIONSHIP: z.string().optional().default("friend"),
  TELEGRAM_TARGET_CHAT: z.string().optional().default(""),

  TELEGRAM_CLI_PATH: z
    .string()
    .optional()
    .default("~/.local/bin/telegram-download-chat"),

  // SoCLaaS RAG configuration
  SOCLAAS_BASE_URL: z
    .string()
    .optional()
    .default("https://soclaas-api.comp.nus.edu.sg/v1"),
  SOCLAAS_API_KEY: z.string().optional().default(""),
  SOCLAAS_MODEL: z.string().optional().default("llama3.1:8b"),
  SOCLAAS_EMBEDDING_MODEL: z.string().optional().default("bge-m3"),
});

export const env = envSchema.parse(process.env);
