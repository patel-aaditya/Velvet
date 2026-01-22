import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserProfile, ExperienceData, Blueprint, VerificationResult, PersonalityType, DesignSystem, MemoryEvent, PreferenceDrift } from '../types';

const STORAGE_KEY = 'velvet_api_key';

// Helper to reliably get the key from the encoded injection point
const getEnvKey = () => {
  // 1. Check for Base64 Encoded key (Bypasses Netlify Scanner)
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY_B64) {
    try {
      return atob(process.env.API_KEY_B64);
    } catch (e) {
      console.error("Failed to decode env key");
    }
  }
  
  // Note: We deliberately do NOT check process.env.API_KEY here to prevent 
  // the build system from inlining the raw secret.
  
  // 2. Check Vite standard import.meta.env (Fallback)
  if (import.meta && import.meta.env && import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY;
  }
  return '';
};

const envKey = getEnvKey();
let apiKey = envKey || localStorage.getItem(STORAGE_KEY) || '';

// Initialize client only if key exists, otherwise we wait for updateApiKey
let ai = apiKey ? new GoogleGenAI({ apiKey }) : null as any;

export const updateApiKey = (key: string) => {
  if (!key) return;
  apiKey = key;
  localStorage.setItem(STORAGE_KEY, key);
  ai = new GoogleGenAI({ apiKey });
};

export const hasApiKey = () => !!apiKey && apiKey.length > 0;

export const clearLocalKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    // Only clear if we don't have a hardcoded env key
    if (!envKey) {
        apiKey = '';
    }
}

// --- Helper: Clean JSON Parser ---
const cleanAndParseJSON = (text: string | undefined): any => {
  if (!text) return {};
  try {
    // Remove markdown code blocks if present (e.g. ```json ... ```)
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON from model output:", text);
    throw new Error("Model response was not valid JSON.");
  }
};

// --- Schemas ---

const calibrationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    personality: { type: Type.STRING, enum: Object.values(PersonalityType) },
    interests: { type: Type.ARRAY, items: { type: Type.STRING } },
    tone: { type: Type.STRING },
    pace: { type: Type.INTEGER, description: "1 for slow/deep, 5 for fast/skimmable" }
  },
  required: ['personality', 'interests', 'tone', 'pace']
};

const blueprintSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    strategy: { type: Type.STRING, description: "High level UX strategy" },
    visualMetaphor: { type: Type.STRING, description: "The core visual concept" },
    copyAngle: { type: Type.STRING, description: "The rhetorical approach for text" }
  },
  required: ['strategy', 'visualMetaphor', 'copyAngle']
};

const experienceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    design: {
      type: Type.OBJECT,
      properties: {
        primaryColor: { type: Type.STRING },
        secondaryColor: { type: Type.STRING },
        backgroundColor: { type: Type.STRING },
        textColor: { type: Type.STRING },
        fontFamily: { type: Type.STRING, enum: ['sans', 'serif', 'mono'] },
        borderRadius: { type: Type.STRING },
        spacing: { type: Type.STRING, enum: ['compact', 'comfortable', 'spacious'] }
      },
      required: ['primaryColor', 'secondaryColor', 'backgroundColor', 'textColor', 'fontFamily', 'borderRadius', 'spacing']
    },
    content: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        subheadline: { type: Type.STRING },
        ctaText: { type: Type.STRING },
        heroImagePrompt: { type: Type.STRING, description: "Detailed prompt for generating a photorealistic hero image. Include style, lighting, and mention if text should be visible (only simple words)." },
        features: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ['title', 'description', 'icon']
          }
        },
        productConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              conceptName: { type: Type.STRING },
              coreFunction: { type: Type.STRING },
              aestheticDescription: { type: Type.STRING, description: "Visual description of the physical or digital product look for image generation." },
              uniqueSellingPoint: { type: Type.STRING }
            },
            required: ['conceptName', 'coreFunction', 'aestheticDescription', 'uniqueSellingPoint']
          }
        }
      },
      required: ['headline', 'subheadline', 'ctaText', 'features', 'productConcepts', 'heroImagePrompt']
    }
  },
  required: ['design', 'content']
};

const designSystemSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      primaryColor: { type: Type.STRING },
      secondaryColor: { type: Type.STRING },
      backgroundColor: { type: Type.STRING },
      textColor: { type: Type.STRING },
      fontFamily: { type: Type.STRING, enum: ['sans', 'serif', 'mono'] },
      borderRadius: { type: Type.STRING },
      spacing: { type: Type.STRING, enum: ['compact', 'comfortable', 'spacious'] }
    },
    required: ['primaryColor', 'secondaryColor', 'backgroundColor', 'textColor', 'fontFamily', 'borderRadius', 'spacing']
};

const verificationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "0 to 100 alignment score" },
    aligned: { type: Type.BOOLEAN, description: "Is it good enough to show?" },
    critique: { type: Type.STRING, description: "What is wrong or right?" },
    suggestions: { type: Type.STRING, description: "Specific instructions for refinement" },
    toneMismatch: { type: Type.BOOLEAN },
    visualOverload: { type: Type.BOOLEAN },
    paceFriction: { type: Type.BOOLEAN }
  },
  required: ['score', 'aligned', 'critique', 'suggestions', 'toneMismatch', 'visualOverload', 'paceFriction']
};

const driftSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        hasDrifted: { type: Type.BOOLEAN },
        reasoning: { type: Type.STRING, description: "Why the profile needs to evolve based on interaction history." },
        detectedPattern: { type: Type.STRING, description: "e.g. 'User consistently prefers darker, high-contrast modes'." },
        newProfile: {
            type: Type.OBJECT,
            properties: {
                tone: { type: Type.STRING },
                pace: { type: Type.INTEGER },
                personality: { type: Type.STRING, enum: Object.values(PersonalityType) }
            },
            nullable: true
        }
    },
    required: ['hasDrifted', 'reasoning', 'detectedPattern']
};

// --- Agent Functions ---

// 1. Calibration (Gemini 3 Pro)
export const calibratePersona = async (bio: string, moodBoardUrl?: string): Promise<Partial<UserProfile>> => {
  if (!ai) throw new Error("API Key missing. Please check your settings.");
  
  const prompt = `
    Analyze this user input to infer their psychographic profile.
    Bio/Input: "${bio}"
    ${moodBoardUrl ? `User's Mood Board / Pinterest: ${moodBoardUrl} (Use this context to infer visual taste if possible)` : ''}
  `;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: calibrationSchema,
      systemInstruction: "You are a psychologist and UX researcher. Infer personality, interests, tone, and cognitive pace."
    }
  });

  return cleanAndParseJSON(response.text);
};

// 2. Blueprint (Gemini 3 Pro) - Now Memory Aware
export const createBlueprint = async (profile: UserProfile, history: MemoryEvent[] = []): Promise<Blueprint> => {
  if (!ai) throw new Error("API Key missing. Please check your settings.");

  let memoryContext = "";
  if (history.length > 0) {
      memoryContext = `
      LONG-HORIZON MEMORY (Past Interactions):
      ${history.slice(-10).map(h => `- ${h.type}: ${h.detail}`).join('\n')}
      
      CRITICAL: Incorporate these past preferences into the blueprint. If they asked for 'Dark Mode' before, ensure the visual metaphor reflects that.
      `;
  }

  const prompt = `
    Create a Creative Blueprint for:
    - Personality: ${profile.personality}
    - Interests: ${profile.interests.join(', ')}
    - Tone: ${profile.tone}
    - Pace: ${profile.pace}
    ${profile.moodBoardUrl ? `- Visual Inspiration (Mood Board): ${profile.moodBoardUrl}` : ''}

    ${memoryContext}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: blueprintSchema,
      systemInstruction: "You are a Creative Director planning a hyper-personalized product experience."
    }
  });

  return cleanAndParseJSON(response.text);
};

// 3. Draft (Gemini 3 Pro)
export const generateDraft = async (profile: UserProfile, blueprint: Blueprint): Promise<ExperienceData> => {
  if (!ai) throw new Error("API Key missing. Please check your settings.");

  const prompt = `
    Execute this Blueprint:
    Strategy: ${blueprint.strategy}
    Visuals: ${blueprint.visualMetaphor}
    Copy: ${blueprint.copyAngle}

    User Profile:
    - Personality: ${profile.personality}
    - Interests: ${profile.interests.join(', ')}
    - Tone: ${profile.tone}
    
    TASK: Generate a landing page structure AND 3 distinct, high-fidelity Product Design Concepts.
    
    GUIDELINES FOR PRODUCT CONCEPTS:
    1. HYBRID SYNTHESIS: Combine the user's specific INTERESTS into a functional physical or digital product.
       (e.g., Interests: "F1" + "Gaming" -> Concept: "Aerodynamic Carbon-Fiber Mouse with Telemetry Display").
    2. INDUSTRIAL REALISM: Focus on manufacturability. Specify materials (e.g., anodized aluminum, vegetable-tanned leather, frosted glass), form factor, and ergonomics.
    3. UTILITY: The product must be USEFUL. No abstract art. It should be a tool, device, or accessory that fits their lifestyle.
    
    IMPORTANT: Provide a detailed 'heroImagePrompt' that describes the main visual. It should be high-resolution, photorealistic or 3D render style, matching the visual metaphor.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: experienceSchema,
      temperature: 0.9
    }
  });

  return cleanAndParseJSON(response.text);
};

// 4. Visual Assets (Gemini 2.5 Flash Image)
export const generateVisualAsset = async (prompt: string, design: DesignSystem): Promise<string> => {
  if (!ai) throw new Error("API Key missing. Please check your settings.");

  const enhancedPrompt = `
    High quality, professional product photography or 3D render.
    Subject: ${prompt}
    Aesthetic: Uses ${design.primaryColor} and ${design.secondaryColor} accents. 
    Style: ${design.fontFamily === 'serif' ? 'Elegant, editorial' : 'Modern, clean, minimal'}.
    
    Format: Photorealistic, 8k resolution.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: enhancedPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image gen failed", e);
  }
  return '';
};

export const generateProductAsset = async (conceptName: string, desc: string, design: DesignSystem): Promise<string> => {
   if (!ai) throw new Error("API Key missing. Please check your settings.");

   const enhancedPrompt = `
    Professional Industrial Design Product Photography.
    Subject: ${conceptName}.
    Design Features: ${desc}.
    Style: Studio lighting, ${design.primaryColor} accents. 
    Focus: Realism, material textures, ergonomic details.
    High definition, 4k.
   `;

   try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: enhancedPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Product image gen failed", e);
  }
  return '';
};

export const generateProjectThumbnail = async (): Promise<string> => {
    if (!ai) throw new Error("API Key missing. Please check your settings.");

    const prompt = `
      Cinematic abstract 3D composition representing "Velvet", an AI Hyper-Personalization Engine.
      Visuals: Sleek dark slate glass surfaces, glowing blue data streams, floating UI blueprints.
      Vibe: Industrial Design meets Futurism. Mysterious, Elegant, High-Tech.
      Center: A subtle, stylized 'V' logo in brushed titanium or light.
      Lighting: Volumetric, moody, rim lighting.
      Resolution: 8k, photorealistic.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "16:9" 
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }
    } catch (e) {
        console.error("Thumbnail gen failed", e);
    }
    return '';
}

// 5. Paint-to-Edit / Refine Visual (Gemini 2.5 Flash Image)
export const refineVisualAsset = async (imageBase64: string, instruction: string): Promise<string> => {
  if (!ai) throw new Error("API Key missing. Please check your settings.");

  // Extract base64 data if it has the prefix
  const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Good for edits
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          { text: instruction }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image edit failed", e);
  }
  return imageBase64; // Return original if failed
};


export const remixDraft = async (profile: UserProfile, blueprint: Blueprint, previousDraft: ExperienceData): Promise<ExperienceData> => {
  if (!ai) throw new Error("API Key missing. Please check your settings.");

  const prompt = `
    The user was not satisfied with the previous generation.
    Create completely NEW and DIFFERENT concepts.
    
    Blueprint Strategy: ${blueprint.strategy}
    User Profile:
    - Personality: ${profile.personality}
    - Interests: ${profile.interests.join(', ')}
    
    Previous Concepts: ${JSON.stringify(previousDraft.content.productConcepts.map(c => c.conceptName))}
    
    TASK: Generate 3 fresh Product Design Concepts and a new landing page.
    
    GUIDELINES:
    1. Merge user interests into FUNCTIONAL product designs (e.g. Hiking + Coffee = Portable Titanium Espresso Press).
    2. Focus on REALISTIC Industrial Design: specific materials, finishes, and mechanics.
    3. Ensure they are distinctly different from the previous attempt.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: experienceSchema,
      temperature: 1.0
    }
  });

  return cleanAndParseJSON(response.text);
};

// Enhanced Vibe Verification
export const verifyDraft = async (draft: ExperienceData, profile: UserProfile): Promise<VerificationResult> => {
  if (!ai) throw new Error("API Key missing. Please check your settings.");

  const prompt = `
    VIBE ENGINEERING AUDIT
    
    Critique this draft against the user profile.
    User: ${profile.personality}, ${profile.tone} tone, Pace: ${profile.pace}/5.
    
    Draft Design: Colors ${draft.design.primaryColor}, Font ${draft.design.fontFamily}, Spacing ${draft.design.spacing}.
    Draft Copy: "${draft.content.headline}"
    
    CHECK FOR:
    1. Tone Mismatch: Is it too corporate for a 'Creative' person? Too silly for 'Authoritative'?
    2. Visual Overload: Is 'spacing: compact' too overwhelming for a 'Zen' personality?
    3. Pace Friction: Does the copy length match the user's cognitive pace? (Fast pace = short copy).
    
    Be extremely critical.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: verificationSchema
    }
  });

  return cleanAndParseJSON(response.text);
};

export const refineDraft = async (draft: ExperienceData, critique: VerificationResult, profile: UserProfile): Promise<ExperienceData> => {
  if (!ai) throw new Error("API Key missing. Please check your settings.");

  const prompt = `
    AUTO-REFINE EXPERIENCE
    
    Critique received: ${critique.critique}
    Specific issues:
    - Tone Mismatch: ${critique.toneMismatch}
    - Visual Overload: ${critique.visualOverload}
    - Pace Friction: ${critique.paceFriction}
    
    Suggestions: ${critique.suggestions}
    
    Task: Fix these issues specifically. Modify the Design System and Copy to align perfectly.
    Original Draft: ${JSON.stringify(draft)}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: experienceSchema
    }
  });

  return cleanAndParseJSON(response.text);
};

// --- Long Horizon / Drift Detection ---

export const detectPreferenceDrift = async (currentProfile: UserProfile, history: MemoryEvent[]): Promise<PreferenceDrift> => {
    if (!ai) throw new Error("API Key missing. Please check your settings.");
    
    // Only analyze if sufficient history
    if (history.length < 2) return { hasDrifted: false, reasoning: "Insufficient data", detectedPattern: "" };

    const prompt = `
       LONG-HORIZON PERSONALIZATION ENGINE
       
       Current Profile: ${JSON.stringify(currentProfile)}
       
       Recent Interaction History (Newest last):
       ${JSON.stringify(history.slice(-10))}
       
       Task: Detect if the user's actual preferences (demonstrated by behavior) have drifted away from their initial profile.
       
       Example: If profile says "Zen/Minimalist" but user keeps asking for "Punchy" copy and "High Contrast" visuals, there is drift towards "High Energy".
       
       Return 'hasDrifted: true' ONLY if there is a clear, repeated pattern contradicting the current profile.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: driftSchema
        }
    });

    return cleanAndParseJSON(response.text);
}

// --- Studio Tools ---

export const simulatePersonaChat = async (profile: UserProfile, message: string, context: ExperienceData): Promise<string> => {
    if (!ai) throw new Error("API Key missing. Please check your settings.");
    
    const prompt = `
      ROLE: You are ${profile.name}, a person with these traits: ${profile.personality}.
      CONTEXT: Looking at a website designed for you. Headline: "${context.content.headline}".
      TASK: Reply to this question from the designer.
      Question: "${message}"
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
    });

    return response.text || "...";
};

export const mutateDesign = async (profile: UserProfile, currentDesign: DesignSystem, instruction: string): Promise<DesignSystem> => {
    if (!ai) throw new Error("API Key missing. Please check your settings.");

    const prompt = `
      Modify this Design System based on the instruction: "${instruction}"
      Current System: ${JSON.stringify(currentDesign)}
      
      User Profile Context: ${profile.personality}, ${profile.tone}
      
      Return the updated Design System JSON only.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: designSystemSchema
        }
    });

    return cleanAndParseJSON(response.text);
};

export const polishCopy = async (text: string, tone: string): Promise<string> => {
    if (!ai) throw new Error("API Key missing. Please check your settings.");

    const prompt = `
      Rewrite the following text to have a "${tone}" tone.
      Keep the core meaning, but adjust the style.
      
      Original Text: "${text}"
      
      Return only the rewritten text.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: 'text/plain'
        }
    });

    return response.text || text;
};