export enum PersonalityType {
  ANALYTICAL = 'Analytical & Data-Driven',
  CREATIVE = 'Creative & Expressive',
  ZEN = 'Zen & Minimalist',
  HIGH_ENERGY = 'High Energy & Action-Oriented',
  EMPATHETIC = 'Empathetic & Community-Focused',
  AUTHORITATIVE = 'Authoritative & Leader',
  WHIMSICAL = 'Whimsical & Playful'
}

export interface UserProfile {
  name: string;
  bio: string; // Raw input
  personality: PersonalityType;
  interests: string[];
  tone: string;
  pace: number; // 1-5
  moodBoardUrl?: string;
}

export interface DesignSystem {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  borderRadius: string;
  spacing: 'compact' | 'comfortable' | 'spacious';
}

export interface ProductConcept {
  conceptName: string;
  coreFunction: string;
  aestheticDescription: string;
  uniqueSellingPoint: string;
  imageUrl?: string; // Generated asset
}

export interface GeneratedContent {
  headline: string;
  subheadline: string;
  ctaText: string;
  features: { title: string; description: string; icon: string }[];
  productConcepts: ProductConcept[];
  heroImagePrompt?: string; // The prompt used/suggested for the hero
  heroImageUrl?: string; // Generated asset
}

export interface VerificationResult {
  score: number; // 0-100
  aligned: boolean;
  critique: string;
  suggestions: string;
  // Vibe Engineering specifics
  toneMismatch?: boolean;
  visualOverload?: boolean;
  paceFriction?: boolean;
}

export interface ExperienceData {
  design: DesignSystem;
  content: GeneratedContent;
  verification?: VerificationResult;
}

export interface Blueprint {
  strategy: string;
  visualMetaphor: string;
  copyAngle: string;
}

export type AgentStage = 'IDLE' | 'CALIBRATING' | 'PLANNING' | 'DRAFTING' | 'GENERATING_ASSETS' | 'VERIFYING' | 'REFINING' | 'COMPLETE' | 'DRIFT_DETECTED';

export interface LogEntry {
  stage: AgentStage;
  message: string;
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'persona';
  text: string;
}

// Long-Horizon Memory Types
export type InteractionType = 'REMIX' | 'CHAT' | 'VISUAL_EDIT' | 'COPY_EDIT' | 'REJECT';

export interface MemoryEvent {
  id: string;
  timestamp: number;
  type: InteractionType;
  detail: string; // "Changed to Dark Mode", "Asked for punchier copy"
  contextSummary: string;
}

export interface PreferenceDrift {
  hasDrifted: boolean;
  newProfile?: Partial<UserProfile>;
  reasoning: string;
  detectedPattern: string;
}
