import React, { useState } from 'react';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import { UserProfile } from './types';
import { updateApiKey, hasApiKey } from './services/geminiService';
import { ICONS } from './constants';

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(hasApiKey());

  const handleProfileComplete = (newProfile: UserProfile) => {
    setProfile(newProfile);
  };

  const handleReset = () => {
    setProfile(null);
  };

  const handleSaveKey = () => {
    if (keyInput.trim().length > 10) {
      updateApiKey(keyInput.trim());
      setHasKey(true);
    }
  };

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-fade-in text-center">
           <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
             <ICONS.VelvetLogo className="w-6 h-6 text-red-500" />
           </div>
           <h2 className="text-xl font-bold mb-2">Access Key Required</h2>
           <p className="text-slate-400 text-sm mb-6">
             The Velvet Orchestration Engine requires a Gemini API key to operate. 
             This was not detected in the environment settings.
           </p>

           <input 
             type="password" 
             value={keyInput}
             onChange={(e) => setKeyInput(e.target.value)}
             placeholder="Paste your Gemini API Key here..."
             className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none text-sm font-mono mb-4"
           />

           <button 
             onClick={handleSaveKey}
             disabled={keyInput.length < 10}
             className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition disabled:opacity-50"
           >
             Initialize System
           </button>
           
           <p className="mt-6 text-[10px] text-slate-500">
             Your key is stored locally in your browser and never sent to our servers.
             <br />
             <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mt-2 inline-block">Get a key from Google AI Studio</a>
           </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {!profile ? (
        <Onboarding onComplete={handleProfileComplete} />
      ) : (
        <Dashboard userProfile={profile} onReset={handleReset} />
      )}
    </>
  );
};

export default App;