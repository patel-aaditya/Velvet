import React, { useState } from 'react';
import { ExperienceData } from '../types';
import { ICONS } from '../constants';
import { refineVisualAsset } from '../services/geminiService';

interface PreviewPaneProps {
  data: ExperienceData;
  isLoading: boolean;
  onRemix?: () => void;
}

const PreviewPane: React.FC<PreviewPaneProps> = ({ data, isLoading, onRemix }) => {
  // Local state for image editing
  const [editingImage, setEditingImage] = useState<{url: string, type: 'hero' | 'product', index?: number} | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  
  // Local state to store refined images so we don't need to update the main Orchestrator state for local visual tweaks
  const [localHeroImage, setLocalHeroImage] = useState<string | null>(null);
  const [localProductImages, setLocalProductImages] = useState<{[key: number]: string}>({});

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-white border-l border-slate-200 text-slate-400">
        <div className="w-16 h-16 relative">
             <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="mt-8 font-mono text-sm tracking-widest text-slate-500 animate-pulse">ORCHESTRATING EXPERIENCE...</p>
      </div>
    );
  }

  const { design, content, verification } = data;
  const currentHero = localHeroImage || content.heroImageUrl;

  // Dynamic Styles
  const containerStyle = {
    backgroundColor: design.backgroundColor,
    color: design.textColor,
    fontFamily: design.fontFamily === 'serif' ? '"Playfair Display", serif' : design.fontFamily === 'mono' ? '"Space Mono", monospace' : '"Inter", sans-serif',
  };

  const primaryBtnStyle = {
    backgroundColor: design.primaryColor,
    color: '#fff',
    borderRadius: design.borderRadius === 'rounded-full' ? '9999px' : design.borderRadius === 'rounded-none' ? '0px' : '8px',
  };

  const cardStyle = {
    backgroundColor: design.secondaryColor,
    borderRadius: design.borderRadius === 'rounded-full' ? '24px' : design.borderRadius === 'rounded-none' ? '0px' : '12px',
    borderColor: `${design.primaryColor}20`
  };

  const spacingClass = design.spacing === 'compact' ? 'gap-4 p-4' : design.spacing === 'spacious' ? 'gap-12 p-12' : 'gap-8 p-8';

  const handleRefineSubmit = async () => {
    if (!editingImage || !editPrompt) return;
    setIsRefining(true);
    try {
      const newUrl = await refineVisualAsset(editingImage.url, editPrompt);
      if (editingImage.type === 'hero') {
        setLocalHeroImage(newUrl);
      } else if (editingImage.type === 'product' && typeof editingImage.index === 'number') {
        setLocalProductImages(prev => ({...prev, [editingImage.index!]: newUrl}));
      }
      setEditingImage(null);
      setEditPrompt('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="h-full w-full relative">
      
      {/* Visual Refinement Modal */}
      {editingImage && (
        <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur flex items-center justify-center p-12">
           <div className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-lg w-full">
             <div className="p-4 border-b">
               <h3 className="text-sm font-bold text-slate-900">Paint-to-Edit / Refine Visual</h3>
             </div>
             <div className="p-4 bg-slate-100 flex justify-center">
                <img src={editingImage.url} className="max-h-64 rounded shadow" alt="Target" />
             </div>
             <div className="p-4">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Instruction</label>
                <input 
                  autoFocus
                  type="text" 
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Change the background to a sunset, make the product red..."
                  className="w-full border border-slate-300 rounded p-3 text-sm focus:border-blue-500 outline-none text-slate-900"
                />
                <div className="flex gap-2 mt-4 justify-end">
                   <button onClick={() => setEditingImage(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
                   <button 
                     onClick={handleRefineSubmit}
                     disabled={isRefining || !editPrompt}
                     className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
                   >
                     {isRefining ? 'Generating...' : 'Refine Visual'}
                   </button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Vibe Verification Overlay */}
      {verification && (
        <div className="absolute top-4 right-4 z-40 group">
          <div className={`backdrop-blur px-4 py-2 rounded-full shadow-xl flex items-center gap-3 cursor-help border transition-colors ${verification.aligned ? 'bg-slate-900/90 text-white border-slate-700 hover:border-blue-500' : 'bg-red-900/90 text-red-50 border-red-500'}`}>
            <div className={`w-2 h-2 rounded-full ${verification.score > 80 ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
            <span className="font-mono text-xs font-bold">VIBE SCORE: {verification.score}%</span>
          </div>
          <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 text-slate-300 p-4 rounded-xl shadow-2xl text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none transform translate-y-2 group-hover:translate-y-0">
             <p className="font-bold text-white mb-2 uppercase tracking-widest text-[10px]">Alignment Report</p>
             <p className="mb-2 italic">"{verification.critique}"</p>
             {verification.toneMismatch && <span className="inline-block px-2 py-1 bg-red-500/20 text-red-300 rounded mr-1 mb-1">Tone Mismatch</span>}
             {verification.visualOverload && <span className="inline-block px-2 py-1 bg-red-500/20 text-red-300 rounded mr-1 mb-1">Visual Overload</span>}
             {verification.paceFriction && <span className="inline-block px-2 py-1 bg-red-500/20 text-red-300 rounded mr-1 mb-1">Pace Friction</span>}
             <div className="h-px bg-slate-700 my-2"></div>
             <p className="text-blue-400">{verification.suggestions}</p>
          </div>
        </div>
      )}

      {/* Actual Experience Frame */}
      <div 
        className="h-full w-full overflow-y-auto transition-all duration-700 ease-in-out"
        style={containerStyle}
      >
        <nav className={`w-full flex justify-between items-center ${design.spacing === 'compact' ? 'p-4' : 'p-8'}`}>
          <div className="font-bold text-xl tracking-tighter flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-current opacity-20"></div>
            BRAND.AI
          </div>
          <div className="flex gap-4 text-sm opacity-70">
            <span>Product</span>
            <span>About</span>
            <span>Contact</span>
          </div>
        </nav>

        <header className={`flex flex-col items-center text-center max-w-5xl mx-auto ${spacingClass}`}>
          <div className="inline-block px-3 py-1 mb-4 text-[10px] tracking-widest uppercase border border-current rounded-full opacity-40">
            Personalized For You
          </div>
          <h1 className="text-4xl md:text-7xl font-bold leading-[1.1] mb-6" style={{ color: design.textColor }}>
            {content.headline}
          </h1>
          
          {/* Hero Image Section */}
          <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl my-8 relative group bg-black/5">
             {currentHero ? (
               <>
                 <img src={currentHero} alt="Hero" className="w-full h-full object-cover" />
                 <button 
                   onClick={() => setEditingImage({url: currentHero, type: 'hero'})}
                   className="absolute bottom-4 right-4 bg-white/90 text-black px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg flex items-center gap-2"
                 >
                   <ICONS.Pencil className="w-3 h-3" /> Edit Visual
                 </button>
               </>
             ) : (
               <div className="w-full h-full flex items-center justify-center bg-current opacity-10 animate-pulse">
                  <ICONS.Sparkles className="w-12 h-12 opacity-50" />
               </div>
             )}
          </div>

          <p className="text-lg md:text-2xl opacity-80 max-w-2xl mx-auto leading-relaxed">
            {content.subheadline}
          </p>
          <button 
            style={primaryBtnStyle}
            className="px-10 py-5 font-semibold shadow-lg hover:opacity-90 hover:scale-105 transition-all mt-8"
          >
            {content.ctaText}
          </button>
        </header>

        {/* Product Concepts Section */}
        {content.productConcepts && content.productConcepts.length > 0 && (
          <section className="py-20 max-w-7xl mx-auto px-6 border-t border-current border-opacity-10">
            <div className="flex justify-between items-end mb-12">
               <div>
                  <h2 className="text-2xl md:text-4xl font-bold mb-2">Tailored Product Concepts</h2>
                  <p className="opacity-60">Generated ideas based on your psychographic profile</p>
               </div>
               {onRemix && (
                 <button 
                  onClick={onRemix}
                  className="px-6 py-3 border border-current rounded-full text-sm font-bold hover:bg-current hover:text-white hover:bg-opacity-10 transition-all flex items-center gap-2"
                  style={{ borderColor: design.primaryColor, color: design.primaryColor }}
                 >
                   <ICONS.Refresh className="w-4 h-4" />
                   Generate New Ideas
                 </button>
               )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {content.productConcepts.map((concept, idx) => {
                const imgUrl = localProductImages[idx] || concept.imageUrl;
                return (
                  <div key={idx} style={cardStyle} className="p-8 flex flex-col h-full hover:shadow-xl transition-shadow relative overflow-hidden group">
                    <div className="w-full aspect-[4/3] rounded-lg bg-black/5 mb-6 overflow-hidden relative group/img">
                        {imgUrl ? (
                          <>
                            <img src={imgUrl} alt={concept.conceptName} className="w-full h-full object-cover" />
                            <button 
                               onClick={() => setEditingImage({url: imgUrl, type: 'product', index: idx})}
                               className="absolute bottom-2 right-2 bg-white/90 text-black px-2 py-1 rounded text-[10px] font-bold opacity-0 group-hover/img:opacity-100 transition-opacity shadow"
                            >
                               Edit
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center animate-pulse">
                             <div className="w-8 h-8 opacity-20 bg-current rounded-full"></div>
                          </div>
                        )}
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2">{concept.conceptName}</h3>
                    <div className="text-xs uppercase tracking-widest opacity-50 mb-4">{concept.coreFunction}</div>
                    <p className="mb-6 opacity-80 flex-grow leading-relaxed text-sm">{concept.aestheticDescription}</p>
                    <div className="mt-auto pt-6 border-t border-current border-opacity-10">
                      <span className="text-xs font-bold opacity-50 block mb-1">UNIQUE SELLING POINT</span>
                      <span className="text-sm font-medium">{concept.uniqueSellingPoint}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className={`grid grid-cols-1 md:grid-cols-3 max-w-7xl mx-auto ${spacingClass}`}>
          {content.features.map((feature, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col border border-current border-opacity-10 ${design.spacing === 'compact' ? 'p-6' : 'p-10'} hover:transform hover:-translate-y-2 transition-transform duration-500`}
              style={{ borderRadius: design.borderRadius === 'rounded-full' ? '16px' : '4px' }}
            >
              <div className="text-3xl mb-4 opacity-80" style={{ color: design.primaryColor }}>
                 <ICONS.Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3">{feature.title}</h3>
              <p className="opacity-70 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-20 border-t opacity-20 p-12 text-center text-sm">
          <p>Generated via Velvet Orchestration Engine v2.0</p>
        </footer>
      </div>
    </div>
  );
};

export default PreviewPane;