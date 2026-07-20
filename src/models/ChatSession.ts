export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type ChatSession = {
  _id?: any;
  sessionId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  createdAt: number;
};
