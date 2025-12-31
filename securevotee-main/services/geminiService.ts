import { GoogleGenerativeAI, Content } from "@google/generative-ai";

const getApiKey = (): string | undefined => {
  return (
    (import.meta as any).env?.VITE_GEMINI_API_KEY || 
    process.env.REACT_APP_GEMINI_API_KEY
  );
};

// List of models to try in order. 
// If 2.5 Flash fails (limit hit), it drops down to Lite, then 1.5.
const MODEL_PRIORITY = [
  "gemini-2.5-flash",       // Preferred (Fastest, but low limit)
  "gemini-2.5-flash-lite",  // Fallback 1 (Good balance, higher limit)
  "gemini-1.5-flash"        // Fallback 2 (Old reliable, high limit)
];

const SYSTEM_INSTRUCTION = 
  "You are Echo, the intelligent assistant for Campus vote 3.0 the school election platform. " +
  "Keep your responses helpful, clear, and strictly under 4 sentences. " +
  "If users have trouble accessing the app, remind them to log in using their valid school email. " +
  "For navigation, guide them to the Sidebar to access the Ballot, election Results, or Socials." +
  "Always maintain a caring , professional and supportive tone."+
  "The manifesto can be accessed under the socials section and voters can like their favourite manifesto."+
  "If you encounter any technical issues, advise users to reach out to the support team via the contact menu"+
  "only respond to questions related to the school election platform and avoid unrelated topics."+
  "you must not disclose any personal data or sensitive information."+
  "The black theme embraces that there is no room for racism and discrimination on the platform ";

export const generateEchoResponse = async (
  userMessage: string,
  history: { role: 'user' | 'model'; text: string }[]
): Promise<string> => {
  
  const apiKey = getApiKey();

  if (!apiKey) {
    console.error("CRITICAL: API Key is missing.");
    return "I am Echo. Please configure my API_KEY.";
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Map history once
  const formattedHistory: Content[] = history.map((h) => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }],
  }));

  // Remove initial model message to prevent crash
  if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
    formattedHistory.shift(); 
  }

  // Loop through models until one works
  for (const modelName of MODEL_PRIORITY) {
    try {
      // console.log(`Attempting to generate with ${modelName}...`); // Uncomment for debugging
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      const chat = model.startChat({ history: formattedHistory });
      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      
      return response.text();

    } catch (error: any) {
      // If it's a Rate Limit (429) or Service Unavailable (503), try the next model
      if (error.message.includes("429") || error.message.includes("503")) {
        console.warn(`Model ${modelName} failed (Limit Hit). Switching to backup...`);
        continue; // Try next model in the list
      }
      
      // If it's a different error (e.g., Invalid Key), stop immediately
      console.error("Echo AI Error:", error);
      return `I am experiencing interference. (${error.message})`;
    }
  }

  // If all models fail
  return "System overloaded. Please try again later.";
};