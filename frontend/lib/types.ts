export interface Animation {
  id: string;
  title: string;
  prompt: string;
  explanation: string;
  animation_code: string;
  created_at: string;
}

export interface GenerateResponse {
  title: string;
  explanation: string;
  animation_code: string;
}

export type AppView = "generate" | "library";
