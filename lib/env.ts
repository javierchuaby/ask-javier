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
  AFFECTION_MIRRORING_INSTRUCTION: z.string().optional().default(""),
});

export const env = envSchema.parse(process.env);
