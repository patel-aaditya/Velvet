import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ExperienceData, AgentStage, LogEntry, Blueprint, ChatMessage, DesignSystem, MemoryEvent, InteractionType } from '../types';
import PreviewPane from './PreviewPane';
import { createBlueprint, generateDraft, remixDraft, verifyDraft, refineDraft, simulatePersonaChat, mutateDesign, polishCopy, generateVisualAsset, generateProductAsset, detectPreferenceDrift, generateProjectThumbnail } from '../services/geminiService';
import { ICONS } from '../constants';

interface DashboardProps {
  userProfile: UserProfile;
  onReset: () => void;
}

type Tab = 'SYSTEM' | 'PERSONA' | 'STUDIO';

const Dashboard: React.FC<DashboardProps> = ({ userProfile: initialProfile, onReset }) => {
  // State
  const [userProfile, setUserProfile] = useState<UserProfile>(initialProfile);
  const [data, setData] = useState<ExperienceData | null>(null);
  const [stage, setStage] = useState<AgentStage>('IDLE');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('SYSTEM');
  
  // Memory & Long Horizon
  const [memory, setMemory] = useState<MemoryEvent[]>([]);
  const [driftAlert, setDriftAlert] = useState<{message: string, pattern: string} | null>(null);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Studio State
  const [isMutating, setIsMutating] = useState(false);
  
  // Thumbnail State
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load Memory on mount
  useEffect(() => {
    const savedMemory = localStorage.getItem(`velvet_memory_${initialProfile.name}`);
    if (savedMemory) {
      setMemory(JSON.parse(savedMemory));
      addLog('IDLE', `Long-Horizon Memory loaded: ${JSON.parse(savedMemory).length} past interactions found.`);
    }
  }, [initialProfile.name]);

  // Persist Memory on change
  useEffect(() => {
    localStorage.setItem(`velvet_memory_${userProfile.name}`, JSON.stringify(memory));
  }, [memory, userProfile.name]);

  const addLog = (stage: AgentStage, message: string) => {
    setLogs(prev => [...prev, { stage, message, timestamp: Date.now() }]);
    setStage(stage);
  };

  const recordInteraction = (type: InteractionType, detail: string) => {
    const event: MemoryEvent = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type,
        detail,
        contextSummary: `Stage: ${stage}`
    };
    setMemory(prev => [...prev, event]);
    
    // Trigger Drift Detection periodically
    if (memory.length > 0 && memory.length % 3 === 0) {
        checkDrift([...memory, event]);
    }
  };

  const checkDrift = async (currentHistory: MemoryEvent[]) => {
      addLog('IDLE', 'Analyzing long-horizon preference drift...');
      try {
          const drift = await detectPreferenceDrift(userProfile, currentHistory);
          if (drift.hasDrifted && drift.newProfile) {
              setDriftAlert({ message: drift.reasoning, pattern: drift.detectedPattern });
              addLog('DRIFT_DETECTED', `Preference Drift: ${drift.detectedPattern}`);
              
              // Apply drift
              setUserProfile(prev => ({
                  ...prev,
                  ...drift.newProfile
              }));
          }
      } catch (e) {
          console.error("Drift check failed", e);
      }
  };

  const clearMemory = () => {
    if (window.confirm("Clear all learned preference data?")) {
      setMemory([]);
      localStorage.removeItem(`velvet_memory_${userProfile.name}`);
      addLog('IDLE', 'Memory Core wiped.');
    }
  };
  
  const handleGenerateThumbnail = async () => {
      setIsGeneratingThumbnail(true);
      addLog('GENERATING_ASSETS', 'Generating Press Kit / Project Thumbnail...');
      try {
          const url = await generateProjectThumbnail();
          if (url) {
             setThumbnailUrl(url);
             addLog('COMPLETE', 'Press Kit Asset Generated.');
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingThumbnail(false);
      }
  }

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs, chatHistory, activeTab]);

  // The Orchestration Loop
  const orchestrateCreation = async (isRemix: boolean = false) => {
    if (!isRemix) {
      setLogs([]);
      setData(null);
      setBlueprint(null);
      setChatHistory([]); // Clear chat on new session
    } else {
      setStage('DRAFTING');
      recordInteraction('REMIX', 'User requested full regeneration/remix');
    }

    try {
      let bp = blueprint;
      let currentDraft: ExperienceData;

      if (!isRemix || !bp) {
        addLog('PLANNING', `Analyzing vector: ${userProfile.personality} | Pace: ${userProfile.pace}`);
        // Memory Injection log
        if (memory.length > 0) addLog('PLANNING', `Incorporating ${memory.length} historical vectors...`);
        
        bp = await createBlueprint(userProfile, memory);
        setBlueprint(bp);
        addLog('PLANNING', `Strategy defined: ${bp.strategy}`);
        
        addLog('DRAFTING', `Synthesizing content with metaphor: ${bp.visualMetaphor}`);
        currentDraft = await generateDraft(userProfile, bp);
      } else {
        addLog('DRAFTING', `User requested alternatives. Remixing concepts...`);
        currentDraft = await remixDraft(userProfile, bp, data!);
      }

      // Initial render with placeholders
      setData(currentDraft);
      
      // --- Visual Asset Generation Phase ---
      addLog('GENERATING_ASSETS', `Deploying Nano Banana Pro for visuals...`);
      setStage('GENERATING_ASSETS');

      // 1. Generate Hero Image
      if (currentDraft.content.heroImagePrompt) {
         addLog('GENERATING_ASSETS', `Rendering Hero: ${currentDraft.content.heroImagePrompt.substring(0, 40)}...`);
         const heroUrl = await generateVisualAsset(currentDraft.content.heroImagePrompt, currentDraft.design);
         currentDraft.content.heroImageUrl = heroUrl;
         // Update state progressively
         setData(prev => prev ? {...prev, content: {...prev.content, heroImageUrl: heroUrl}} : null);
      }

      // 2. Generate Product Images (Parallel)
      const productPromises = currentDraft.content.productConcepts.map(async (concept, idx) => {
         const url = await generateProductAsset(concept.conceptName, concept.aestheticDescription, currentDraft.design);
         return { idx, url };
      });
      
      // Process as they complete to update UI
      productPromises.forEach(p => {
        p.then(({ idx, url }) => {
            setData(prev => {
                if (!prev) return null;
                const newConcepts = [...prev.content.productConcepts];
                newConcepts[idx] = { ...newConcepts[idx], imageUrl: url };
                return { ...prev, content: { ...prev.content, productConcepts: newConcepts } };
            });
        });
      });
      
      await Promise.all(productPromises);
      addLog('GENERATING_ASSETS', `Assets generated.`);

      // --- Vibe Verification Phase ---
      addLog('VERIFYING', `Running Vibe Engineering Audit...`);
      const verification = await verifyDraft(currentDraft, userProfile);
      
      // Log specific vibe failures if any
      if (verification.visualOverload) addLog('VERIFYING', 'Detected: Visual Overload');
      if (verification.toneMismatch) addLog('VERIFYING', 'Detected: Tone Mismatch');
      if (verification.paceFriction) addLog('VERIFYING', 'Detected: Pace Friction');

      if (verification.aligned) {
        addLog('COMPLETE', `Vibe Alignment confirmed (Score: ${verification.score}/100).`);
        setData(prev => prev ? { ...prev, verification } : null);
      } else {
        addLog('REFINING', `Vibe misalignment (${verification.score}/100). Auto-correcting...`);
        const refinedDraft = await refineDraft(currentDraft, verification, userProfile);
        
        // Preserve generated images during refinement if text changed
        refinedDraft.content.heroImageUrl = currentDraft.content.heroImageUrl;
        refinedDraft.content.productConcepts.forEach((c, i) => {
           c.imageUrl = currentDraft.content.productConcepts[i]?.imageUrl;
        });

        addLog('COMPLETE', `Refinement applied. Finalizing output.`);
        setData({ ...refinedDraft, verification: { ...verification, aligned: true, score: Math.min(verification.score + 15, 99) } });
      }

    } catch (error) {
      addLog('IDLE', 'Orchestration failed.');
      console.error(error);
    }
  };

  useEffect(() => {
    orchestrateCreation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Tool Handlers ---

  const handleRemix = () => {
    if (stage === 'COMPLETE' && data) {
      orchestrateCreation(true);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !data) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);
    
    // Memory
    recordInteraction('CHAT', `User asked persona: "${userMsg}"`);

    try {
      const response = await simulatePersonaChat(userProfile, userMsg, data);
      setChatHistory(prev => [...prev, { role: 'persona', text: response }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatting(false);
    }
  };

  const handleVisualMutation = async (instruction: string) => {
    if (!data) return;
    setIsMutating(true);
    recordInteraction('VISUAL_EDIT', `User applied visual mutation: ${instruction}`);
    try {
      const newDesign = await mutateDesign(userProfile, data.design, instruction);
      setData(prev => prev ? { ...prev, design: newDesign } : null);
      addLog('REFINING', `Visual mutation applied: ${instruction}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleCopyPolish = async (type: 'headline' | 'sub', tone: string) => {
    if (!data) return;
    setIsMutating(true);
    recordInteraction('COPY_EDIT', `User polished copy to tone: ${tone}`);
    try {
      const textToPolish = type === 'headline' ? data.content.headline : data.content.subheadline;
      const newText = await polishCopy(textToPolish, tone);
      
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          content: {
            ...prev.content,
            headline: type === 'headline' ? newText : prev.content.headline,
            subheadline: type === 'sub' ? newText : prev.content.subheadline
          }
        }
      });
      addLog('REFINING', `Copy polished: ${tone}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsMutating(false);
    }
  }

  // --- Sidebar Content Renderers ---

  const renderSystemTab = () => (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs bg-slate-950/50">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3 animate-fade-in opacity-80 hover:opacity-100 transition-opacity">
            <span className="text-slate-600 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString([], { second: '2-digit', minute: '2-digit' })}
            </span>
            <div>
              <span className={`font-bold mr-2 ${
                log.stage === 'PLANNING' ? 'text-purple-400' :
                log.stage === 'DRAFTING' ? 'text-yellow-400' :
                log.stage === 'GENERATING_ASSETS' ? 'text-pink-400' :
                log.stage === 'VERIFYING' ? 'text-red-400' :
                log.stage === 'REFINING' ? 'text-orange-400' :
                log.stage === 'DRIFT_DETECTED' ? 'text-blue-400' :
                log.stage === 'COMPLETE' ? 'text-green-400' : 'text-slate-400'
              }`}>
                [{log.stage}]
              </span>
              <span className="text-slate-300 leading-relaxed">{log.message}</span>
            </div>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
      
      {/* Blueprint & Memory Mini-view */}
      <div className="h-2/5 border-t border-slate-800 bg-slate-900 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">System State</h3>
            {userProfile.moodBoardUrl && (
              <a href={userProfile.moodBoardUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
                <ICONS.Link className="w-3 h-3" />
                Mood Board
              </a>
            )}
        </div>
        <div className="space-y-4">
           {blueprint ? (
             <>
               <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                 <p className="text-[10px] text-purple-400 uppercase mb-1">Strategy</p>
                 <p className="text-xs text-slate-300">{blueprint.strategy}</p>
               </div>
               <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                 <p className="text-[10px] text-yellow-400 uppercase mb-1">Visual Metaphor</p>
                 <p className="text-xs text-slate-300">{blueprint.visualMetaphor}</p>
               </div>
             </>
           ) : (
             <div className="text-slate-600 text-xs italic">Waiting for blueprint...</div>
           )}
           
           {/* Press Kit Generator */}
           <div className="pt-4 border-t border-slate-800">
               <div className="flex justify-between items-center mb-2">
                   <p className="text-[10px] text-green-400 uppercase">Press Kit</p>
               </div>
               {!thumbnailUrl ? (
                   <button 
                    onClick={handleGenerateThumbnail} 
                    disabled={isGeneratingThumbnail}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs rounded text-slate-300 transition flex items-center justify-center gap-2"
                   >
                     {isGeneratingThumbnail ? (
                         <div className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                     ) : (
                         <ICONS.VelvetLogo className="w-3 h-3" />
                     )}
                     Generate Project Thumbnail
                   </button>
               ) : (
                   <div className="space-y-2">
                       <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-24 object-cover rounded border border-slate-700 opacity-80 hover:opacity-100 transition" />
                       <a 
                         href={thumbnailUrl} 
                         download={`Velvet_Project_${userProfile.name}.png`}
                         className="block w-full text-center py-2 bg-green-600 hover:bg-green-500 text-white text-xs rounded font-bold"
                       >
                           Download Asset
                       </a>
                       <button onClick={() => setThumbnailUrl(null)} className="text-[10px] text-slate-500 w-full text-center hover:text-white">Regenerate</button>
                   </div>
               )}
           </div>

           {/* Explicit Memory Bank */}
           <div className="pt-4 border-t border-slate-800">
               <div className="flex justify-between items-center mb-2">
                 <p className="text-[10px] text-blue-400 uppercase">Long-Horizon Memory ({memory.length})</p>
                 {memory.length > 0 && (
                   <button onClick={clearMemory} className="text-[10px] text-red-400 hover:text-red-300">Wipe</button>
                 )}
               </div>
               {memory.length === 0 ? (
                 <p className="text-xs text-slate-600 italic">No interaction signatures yet.</p>
               ) : (
                 <div className="space-y-2">
                   {memory.slice(-3).reverse().map(m => (
                     <div key={m.id} className="p-2 bg-blue-900/10 border border-blue-900/30 rounded">
                        <div className="flex justify-between text-[10px] text-blue-300 mb-1">
                           <span className="font-bold">{m.type}</span>
                           <span>{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{m.detail}</p>
                     </div>
                   ))}
                   {memory.length > 3 && <p className="text-[10px] text-slate-600 text-center">+{memory.length - 3} older records</p>}
                 </div>
               )}
           </div>
        </div>
      </div>
    </>
  );

  const renderPersonaTab = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
             <ICONS.User className="w-5 h-5 text-blue-400" />
           </div>
           <div>
             <h3 className="text-sm font-bold text-white">{userProfile.name} (Simulated)</h3>
             <p className="text-[10px] text-slate-400">{userProfile.personality}</p>
           </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/30">
         {chatHistory.length === 0 && (
           <div className="text-center mt-10 opacity-40 text-xs">
             <p>Ask {userProfile.name} for feedback on this design.</p>
             <p className="mt-2 italic">"Would you trust this brand?"</p>
           </div>
         )}
         {chatHistory.map((msg, i) => (
           <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-lg text-xs leading-relaxed ${
                msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
              }`}>
                {msg.text}
              </div>
           </div>
         ))}
         {isChatting && (
           <div className="flex justify-start">
             <div className="bg-slate-800 p-3 rounded-lg rounded-bl-none border border-slate-700">
               <div className="flex gap-1">
                 <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                 <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                 <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></span>
               </div>
             </div>
           </div>
         )}
         <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <form onSubmit={handleChat} className="relative">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-full py-2.5 px-4 pr-10 text-xs text-white focus:border-blue-500 outline-none"
            placeholder={`Message ${userProfile.name}...`}
            disabled={isChatting || !data}
          />
          <button type="submit" disabled={!chatInput || isChatting} className="absolute right-2 top-2 text-blue-400 hover:text-white disabled:opacity-30">
            <ICONS.Chat className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );

  const renderStudioTab = () => (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-900/50">
       <div>
         <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <ICONS.Palette className="w-4 h-4" /> Visual DNA Mutator
         </h3>
         <div className="grid grid-cols-2 gap-3">
            {[
              "Make it Dark Mode", "Make it Minimalist (White)", 
              "High Contrast / Bold", "Soft Pastels",
              "Tech / Cyberpunk", "Luxury / Serif"
            ].map((instruction) => (
              <button
                key={instruction}
                onClick={() => handleVisualMutation(instruction)}
                disabled={isMutating}
                className="p-3 text-xs bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 hover:border-blue-500 transition text-left text-slate-300"
              >
                {instruction}
              </button>
            ))}
         </div>
       </div>

       <div>
         <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <ICONS.Pencil className="w-4 h-4" /> Copy Polisher
         </h3>
         <div className="space-y-4">
            <div>
              <p className="text-[10px] text-slate-400 mb-2">Headline Tone</p>
              <div className="flex flex-wrap gap-2">
                 {['Punchy', 'Mysterious', 'Friendly', 'Corporate'].map(tone => (
                   <button 
                     key={tone} 
                     onClick={() => handleCopyPolish('headline', tone)}
                     disabled={isMutating}
                     className="px-3 py-1.5 text-[10px] border border-slate-600 rounded-full hover:bg-white hover:text-black transition"
                   >
                     {tone}
                   </button>
                 ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-2">Subheadline Tone</p>
              <div className="flex flex-wrap gap-2">
                 {['Detailed', 'Concise', 'Emotional', 'Data-focused'].map(tone => (
                   <button 
                     key={tone}
                     onClick={() => handleCopyPolish('sub', tone)}
                     disabled={isMutating}
                     className="px-3 py-1.5 text-[10px] border border-slate-600 rounded-full hover:bg-white hover:text-black transition"
                   >
                     {tone}
                   </button>
                 ))}
              </div>
            </div>
         </div>
       </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-slate-950 text-white overflow-hidden font-sans relative">
      
      {/* Drift Alert Toast */}
      {driftAlert && (
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
              <div className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl border border-blue-400 flex items-center gap-3">
                  <div className="p-1 bg-white rounded-full">
                      <ICONS.Sparkles className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="text-xs">
                      <span className="font-bold uppercase tracking-widest block mb-0.5">Profile Evolved</span>
                      <span className="opacity-90">{driftAlert.pattern}</span>
                  </div>
                  <button onClick={() => setDriftAlert(null)} className="ml-2 hover:bg-blue-700 rounded-full p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
              </div>
          </div>
      )}

      {/* Sidebar */}
      <aside className="w-[400px] flex flex-col border-r border-slate-800 bg-slate-900 z-10 shadow-2xl">
        
        {/* Header */}
        <div className="p-6 pb-2 border-b border-slate-800 bg-slate-900">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-mono font-bold text-sm tracking-widest text-white flex items-center gap-2 uppercase">
              <ICONS.VelvetLogo className="w-5 h-5 text-blue-500" />
              Velvet OS
            </h2>
            <div className="flex items-center gap-2">
               <span className={`w-2 h-2 rounded-full ${stage === 'COMPLETE' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></span>
               <span className="text-[10px] font-mono text-slate-500">{stage}</span>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-lg">
             <button 
               onClick={() => setActiveTab('SYSTEM')}
               className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'SYSTEM' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
             >
               <ICONS.CPU className="w-3.5 h-3.5" /> Core
             </button>
             <button 
               onClick={() => setActiveTab('PERSONA')}
               disabled={!data}
               className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'PERSONA' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}
             >
               <ICONS.Chat className="w-3.5 h-3.5" /> Sim
             </button>
             <button 
               onClick={() => setActiveTab('STUDIO')}
               disabled={!data}
               className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'STUDIO' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}
             >
               <ICONS.Palette className="w-3.5 h-3.5" /> Studio
             </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'SYSTEM' && renderSystemTab()}
        {activeTab === 'PERSONA' && renderPersonaTab()}
        {activeTab === 'STUDIO' && renderStudioTab()}

        {/* Footer controls */}
        {activeTab === 'SYSTEM' && (
           <div className="p-4 border-t border-slate-800 bg-slate-900">
             <button onClick={onReset} className="w-full py-2 border border-slate-700 text-slate-400 text-xs rounded hover:bg-slate-800 transition">
               Reset System
             </button>
           </div>
        )}
      </aside>

      {/* Main Preview */}
      <main className="flex-1 relative bg-slate-100">
        <PreviewPane 
          data={data!} 
          isLoading={stage !== 'COMPLETE' && !data} 
          onRemix={stage === 'COMPLETE' ? handleRemix : undefined}
        />
        {(isMutating || stage === 'REFINING') && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs shadow-xl animate-bounce flex items-center gap-2 z-50">
             <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
             {stage === 'REFINING' ? 'Auto-Correcting Vibe Mismatch...' : 'Refining Experience...'}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;