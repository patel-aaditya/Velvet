import React, { useState } from 'react';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import { UserProfile } from './types';

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const handleProfileComplete = (newProfile: UserProfile) => {
    setProfile(newProfile);
  };

  const handleReset = () => {
    setProfile(null);
  };

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