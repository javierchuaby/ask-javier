export interface ChatMessage {
  role: "aiden" | "javier";
  content: string;
}

export interface Chat {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
