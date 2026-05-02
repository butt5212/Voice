import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface TTSOptions {
  text: string;
  voice: VoiceName;
  style?: string;
}

export const generateTTS = async (options: TTSOptions) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const { text, voice, style } = options;
  const prompt = style ? `Say in a ${style} style: ${text}` : text;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('No audio generated');

    return `data:audio/wav;base64,${base64Audio}`;
  } catch (error) {
    console.error('Gemini TTS Error:', error);
    throw error;
  }
};

export const suggestVoiceTone = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following text and suggest the best voice tone (e.g., professional, scary, cheerful, child-like, deep). Also suggest a prebuilt voice from this list: Puck (energetic), Charon (calm), Kore (sweet), Fenrir (strong), Zephyr (airy). Return as JSON: { "tone": "...", "suggestedVoice": "...", "reason": "..." }`,
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Tone Suggestion Error:', error);
    return null;
  }
};

export const correctGrammar = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Correct the punctuation and grammar of the following transcribed speech. Keep it natural but professional: "${text}"`,
    });
    return response.text || text;
  } catch (error) {
    console.error('Grammar Correction Error:', error);
    return text;
  }
};
