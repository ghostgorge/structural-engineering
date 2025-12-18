
import { SYSTEM_PROMPT } from './constants';

export const queryDeepSeek = async (prompt: string, apiKey: string): Promise<{ text: string }> => {
  if (!apiKey) {
    throw new Error("请先在设置中配置 DeepSeek API Key");
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "DeepSeek 请求失败");
    }

    const data = await response.json();
    return { text: data.choices[0].message.content };
  } catch (error) {
    console.error("DeepSeek API Error:", error);
    throw error;
  }
};
