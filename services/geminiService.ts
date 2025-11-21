
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BoardState, Difficulty, Language, Move, Side } from "../types";
import { boardToFen } from "../utils/gameLogic";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const moveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    fromR: { type: Type.INTEGER, description: "Starting row index (0-9)" },
    fromC: { type: Type.INTEGER, description: "Starting column index (0-8)" },
    toR: { type: Type.INTEGER, description: "Destination row index (0-9)" },
    toC: { type: Type.INTEGER, description: "Destination column index (0-8)" },
    reasoning: { type: Type.STRING, description: "Strategic reasoning behind the move" }
  },
  required: ["fromR", "fromC", "toR", "toC", "reasoning"]
};

export const getAIMove = async (
  board: BoardState,
  currentTurn: Side,
  difficulty: Difficulty,
  lang: Language
): Promise<{ move: Move; reasoning: string } | null> => {
  const fen = boardToFen(board, currentTurn);
  
  // Configure thinking budget based on difficulty
  // Higher budget = deeper reasoning = stronger play
  let thinkingBudget = 0;
  switch(difficulty) {
    case Difficulty.BEGINNER: thinkingBudget = 0; break; // Fast, intuitive
    case Difficulty.INTERMEDIATE: thinkingBudget = 1024; break;
    case Difficulty.EXPERT: thinkingBudget = 2048; break;
    case Difficulty.MASTER: thinkingBudget = 4096; break;
    case Difficulty.GRANDMASTER: thinkingBudget = 8192; break; // Deep thought
  }

  const langPrompt = lang === Language.CN ? "请用中文解释你的策略。" : "Explain your strategy in English.";

  const prompt = `
    You are a Grandmaster Chinese Chess (Xiangqi) AI engine.
    
    Current Board State (FEN): ${fen}
    
    You are playing as BLACK (lowercase pieces in FEN).
    Red (uppercase) is at rows 7-9. Black is at rows 0-2.
    
    Task:
    1. Analyze the board for threats, tactical opportunities, and positional advantages.
    2. Select the ABSOLUTE BEST move for Black.
    3. Strictly adhere to Xiangqi rules (e.g., Flying General, Horse blocking, Elephant boundaries).
    4. Coordinates: Row 0 is top (Black), Row 9 is bottom (Red). Column 0 is left.
    
    ${langPrompt}
    Return ONLY the JSON object describing the move.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Using Flash for speed, with thinking enabled
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: moveSchema,
        thinkingConfig: { thinkingBudget: thinkingBudget }
      },
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    
    return {
      move: {
        from: { r: data.fromR, c: data.fromC },
        to: { r: data.toR, c: data.toC }
      },
      reasoning: data.reasoning || "AI Analysis complete."
    };

  } catch (error) {
    console.error("GenAI Error:", error);
    return null;
  }
};
