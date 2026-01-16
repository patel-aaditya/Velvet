import React, { useState } from 'react';
import { UserProfile, PersonalityType } from '../types';
import { calibratePersona } from '../services/geminiService';
import { ICONS } from '../constants';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [bio, setBio] = useState('');
  const [name, setName] = useState('');
  const [moodBoardUrl, setMoodBoardUrl] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [inferredProfile, setInferredProfile] = useState<Partial<UserProfile> | null>(null);

  const handleCalibration = async () => {
    if (!bio.trim() || !name.trim()) return;
    setIsCalibrating(true);
    try {
      const data = await calibratePersona(bio, moodBoardUrl);
      setInferredProfile(data);
    } catch (e) {
      console.error(e);
      // Fallback
      setInferredProfile({
        personality: PersonalityType.CREATIVE,
        interests: ['General'],
        tone: 'Friendly',
        pace: 3
      });
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleConfirm = () => {
    if (inferredProfile && name) {
      onComplete({
        name,
        bio,
        personality: inferredProfile.personality!,
        interests: inferredProfile.interests || [],
        tone: inferredProfile.tone || 'Neutral',
        pace: inferredProfile.pace || 3,
        moodBoardUrl
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-xl w-full">
        
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-serif font-bold text-white mb-2 tracking-tight flex items-center justify-center gap-3">
             <ICONS.Sparkles className="w-8 h-8 text-blue-500" />
             Velvet
          </h1>
          <p className="text-slate-400 font-mono text-xs uppercase tracking-[0.2em]">Calibration Sequence</p>
        </div>

        {!inferredProfile ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-fade-in">
            <h2 className="text-xl font-medium mb-6">Initialize Persona Vector</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-2 uppercase">Subject Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-white focus:border-blue-500 outline-none transition"
                  placeholder="Your Name"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 mb-2 uppercase">Voice Sample / Bio</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full h-24 bg-slate-950 border border-slate-800 rounded-lg p-4 text-white focus:border-blue-500 outline-none transition resize-none leading-relaxed"
                  placeholder="Tell me who you are. How do you work? What energizes you?"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 mb-2 uppercase">Pinterest / Mood Board URL (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <ICONS.Link className="w-4 h-4" />
                  </div>
                  <input 
                    type="url" 
                    value={moodBoardUrl}
                    onChange={(e) => setMoodBoardUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500 outline-none transition text-sm"
                    placeholder="https://pinterest.com/..."
                  />
                </div>
              </div>

              <button 
                onClick={handleCalibration}
                disabled={isCalibrating || !bio || !name}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCalibrating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing Psychographics...
                  </>
                ) : (
                  "Calibrate System"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-medium">Inferred Profile</h2>
              <button onClick={() => setInferredProfile(null)} className="text-xs text-slate-500 hover:text-white underline">Recalibrate</button>
            </div>

            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-950 rounded-lg border border-slate-800/50">
                    <span className="block text-xs text-slate-500 mb-1 uppercase">Personality</span>
                    <span className="text-blue-400 font-medium">{inferredProfile.personality}</span>
                 </div>
                 <div className="p-4 bg-slate-950 rounded-lg border border-slate-800/50">
                    <span className="block text-xs text-slate-500 mb-1 uppercase">Cognitive Pace</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className={`w-1.5 h-4 rounded-sm ${i <= (inferredProfile.pace || 0) ? 'bg-blue-500' : 'bg-slate-800'}`} />
                        ))}
                      </div>
                      <span className="text-sm text-slate-300">
                        {inferredProfile.pace === 1 ? 'Deep' : inferredProfile.pace === 5 ? 'Rapid' : 'Balanced'}
                      </span>
                    </div>
                 </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800/50">
                 <span className="block text-xs text-slate-500 mb-2 uppercase">Detected Interests</span>
                 <div className="flex flex-wrap gap-2">
                   {inferredProfile.interests?.map(tag => (
                     <span key={tag} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded-md border border-slate-700">{tag}</span>
                   ))}
                 </div>
              </div>
              
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800/50">
                 <span className="block text-xs text-slate-500 mb-1 uppercase">Communication Tone</span>
                 <span className="text-slate-300 italic">"{inferredProfile.tone}"</span>
              </div>
            </div>

            <button 
              onClick={handleConfirm}
              className="w-full py-4 bg-white text-black hover:bg-slate-200 rounded-lg font-bold transition-all"
            >
              Initiate Creative Autopilot
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Onboarding;