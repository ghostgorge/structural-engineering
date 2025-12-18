
export enum AIModelType {
  GEMINI = 'GEMINI',
  DEEPSEEK = 'DEEPSEEK'
}

export interface Config {
  modelType: AIModelType;
  deepseekApiKey: string;
}

export interface SearchResult {
  title: string;
  content: string;
  images?: string[];
  sources?: { title: string; uri: string }[];
}

export interface Category {
  id: string;
  title: string;
  icon: string;
  items: string[];
}
