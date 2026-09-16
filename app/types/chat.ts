export interface ChatMessage {
  role: "user" | "bot";
  content: string;
}

export interface Chat {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
