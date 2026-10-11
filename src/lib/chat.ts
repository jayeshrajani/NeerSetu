import { z } from "zod";

export const PAST_READINGS_QUESTION = "Which past readings at Khatlapura need a fresh check?";

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000),
  }).strict()).min(1).max(16),
  siteId: z.string().max(80).optional(),
}).strict().refine((request) => request.messages.at(-1)?.role === "user", "End with a user question.");

export type ChatRequest = z.infer<typeof chatRequestSchema>;

const blockSchema = z.object({
  text: z.string().trim().min(1).max(900),
  evidenceIds: z.array(z.string()).max(6),
  guideIds: z.array(z.string()).max(4),
}).strict();

export const chatAnswerSchema = z.object({
  language: z.enum(["en", "hinglish"]),
  answer: z.array(blockSchema).min(1).max(4),
  nextSteps: z.array(blockSchema).min(1).max(4),
  followUp: z.string().max(200),
}).strict();

export type ChatAnswer = z.infer<typeof chatAnswerSchema>;
export type ChatBlock = ChatAnswer["answer"][number];

export interface ChatSource {
  id: string;
  kind: "observation" | "guidance";
  label: string;
  href: string;
  detail: string;
  csvHref?: string;
  csvLine?: number;
}

export interface ChatResponse {
  mode: "ai" | "evidence";
  answer: ChatAnswer;
  sources: ChatSource[];
}

export function conversationText(answer: ChatAnswer): string {
  return [...answer.answer, ...answer.nextSteps].map((block) => block.text).join("\n") + (answer.followUp ? `\n${answer.followUp}` : "");
}