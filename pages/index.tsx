import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import React, { useEffect, useState } from 'react';
// Import the icons we need
import { FaWhatsapp, FaTelegramPlane } from 'react-icons/fa';

// --- TYPE DEFINITIONS (No changes) ---
type Profile = { user_type: string; coins_remaining: number; }
type Prediction = { prediction: string; probability?: string; reasoning?: string; }
type Predictions = { fullTimeWinner: Prediction; halfTimeWinner: Prediction; overUnderGoals: Prediction; correctScoreSuggestion: Prediction; bothTeamsToScore: Prediction; doubleChance: Prediction; handicapResult: Prediction; keyInsights: Prediction; }

// --- UI COMPONENT FOR A SINGLE PREDICTION ---
const PredictionCard = ({ title, data }: { title: string, data: Prediction }) => (
  <div className="prediction-card">
    <h4>{title}</h4>
    <p><strong>Prediction:</strong> {data.prediction}</p>
    {data.probability && <p><strong>Probability:</strong> {data.probability}</p>}
    {data.reasoning && <p><strong>Reasoning:</strong> {data.reasoning}</p>}
  </div>
);

// --- MAIN APP COMPONENT ---
const Home = () => {
  const session = useSession();
  const supabase = useSupabaseClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [accessCode, setAccessCode] = useState('');
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [predictions, setPredictions] = useState<Predictions | null>(null);
  const [predictionError, setPredictionError] = useState('');

  useEffect(() => {
    if (session) {
      const fetchProfile = async () => {
        setLoadingProfile(true);
        const { data } = await supabase.from('profiles').select('user_type, coins_remaining').eq('id', session.user.id).single();
        if (data) setProfile(data);
        setLoadingProfile(false);
      };
      fetchProfile();
    }
  }, [session, supabase]);

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpgrading(true);
    setUpgradeMessage('');
    const res = await fetch('/api/upgrade-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode }),
    });
    const data = await res.json();
    if (!res.ok) setUpgradeMessage(`Error: ${data.error}`);
    else {
      setUpgradeMessage(data.message);
      setProfile(data.profile);
    }
    setUpgrading(false);
    setAccessCode('');
  };

  const handlePrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPrediction(true);
    setPredictionError('');
    setPredictions(null);
    try {
        const res = await fetch('/api/predict', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamA, teamB }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Prediction failed.');
        setPredictions(data);
        const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', session!.user.id).single();
        setProfile(updatedProfile);
    } catch (err: any) {
        setPredictionError(err.message);
    } finally {
        setLoadingPrediction(false);
    }
  };

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://7817528c-38fb-4859-92b9-2e40a11799cb-00-37h8a75ucjznk.kirk.replit.dev/' } });
  }

  // Login page uses new styles
  if (!session) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', marginTop: '50px' }}>
            <h1>Deep Statistics Score</h1>
            <p>Sign in to get your AI-powered soccer predictions.</p>
            <button onClick={signInWithGoogle} className="primary-button" style={{ width: '100%' }}>Sign in with Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="app-header">
        <h2>Deep Statistics Score</h2>
        {loadingProfile ? <p>Loading...</p> : profile ? (
          <div className="user-info"><span>Type: <strong>{profile.user_type}</strong> | </span><span>Coins: <strong>{profile.coins_remaining}</strong></span></div>
        ) : <p>No profile.</p>}
        <button onClick={() => supabase.auth.signOut()} className="sign-out-button">Sign Out</button>
      </header>

      <main>
        <div className="card">
            <h3>Get New Prediction</h3>
            <form onSubmit={handlePrediction} className="prediction-form">
                <input type="text" placeholder="Home Team (e.g., Chelsea)" value={teamA} onChange={(e) => setTeamA(e.target.value)} required/>
                <span>vs</span>
                <input type="text" placeholder="Away Team (e.g., Arsenal)" value={teamB} onChange={(e) => setTeamB(e.target.value)} required/>
                <button type="submit" className="primary-button" disabled={loadingPrediction || profile?.coins_remaining === 0}>
                    {loadingPrediction ? 'Analyzing...' : `Predict (1 Coin)`}
                </button>
            </form>
            {profile?.coins_remaining === 0 && <p className="error-message">You are out of coins for today. Come back tomorrow!</p>}
        </div>

        {loadingPrediction && <p className="loading-message">Gathering stats and running AI analysis... This may take a moment.</p>}
        {predictionError && <p className="error-message" style={{textAlign: 'center'}}>{predictionError}</p>}
        {predictions && (
            <div className="card">
                <h3>AI Predictions for {teamA} vs {teamB}</h3>
                <PredictionCard title="Full-Time Winner" data={predictions.fullTimeWinner} />
                <PredictionCard title="Both Teams To Score" data={predictions.bothTeamsToScore} />
                <PredictionCard title="Over/Under Goals" data={predictions.overUnderGoals} />
                <PredictionCard title="Correct Score Suggestion" data={predictions.correctScoreSuggestion} />
                <PredictionCard title="Double Chance" data={predictions.doubleChance} />
                <PredictionCard title="Half-Time Winner" data={predictions.halfTimeWinner} />
                <PredictionCard title="Handicap Result" data={predictions.handicapResult} />
                <PredictionCard title="Key Insights" data={predictions.keyInsights} />
            </div>
        )}

        <div className="card">
          <h3>Upgrade Account</h3>
          <p>Enter a PIN or Password to upgrade your access level.</p>
          <form onSubmit={handleUpgrade} style={{display: 'flex', gap: '10px'}}>
            <input type="password" placeholder="Enter PIN or Password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required/>
            <button type="submit" className="secondary-button" disabled={upgrading}>{upgrading ? 'Upgrading...' : 'Upgrade'}</button>
          </form>
          {upgradeMessage && <p className={upgradeMessage.startsWith('Error') ? 'error-message' : 'success-message'}>{upgradeMessage}</p>}
        </div>
      </main>

      <footer className="app-footer">
          <p>Follow us for more!</p>
          <div className="social-links">
              <a href="https://whatsapp.com/channel/0029Vb6BRVY1HsppurRcdB0t" target="_blank" rel="noopener noreferrer" title="WhatsApp"><FaWhatsapp /></a>
              <a href="https://t.me/sportspredictionapps" target="_blank" rel="noopener noreferrer" title="Telegram"><FaTelegramPlane /></a>
          </div>
      </footer>
    </div>
  );
};

export default Home;