
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { SYSTEM_PROMPT } from './constants';

export const queryGemini = async (prompt: string): Promise<{ text: string; sources?: { title: string; uri: string }[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "未能生成内容，请稍后再试。";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || '参考来源',
      uri: chunk.web?.uri || ''
    })).filter((s: any) => s.uri) || [];

    return { text, sources };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateStructuralImage = async (prompt: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `A professional 3D technical engineering diagram showing the structural mechanics and physical principles of: "${prompt}". Minimalist blueprint style. White background. ABSOLUTELY NO TEXT, NO CHARACTERS, NO LABELS, NO CHINESE OR ENGLISH WORDS. Use only arrows, dashed lines, and geometric structural shapes to show force distribution.` },
        ],
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
};
