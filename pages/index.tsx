import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import React, { useEffect, useState } from 'react';
import { FaWhatsapp, FaTelegramPlane } from 'react-icons/fa';
// --- NEW: Import the Head component ---
import Head from 'next/head';

// --- TYPE DEFINITIONS (No changes) ---
type Profile = { user_type: string; coins_remaining: number; }
type Prediction = { prediction: string; probability?: string; reasoning?: string; }
type Predictions = { fullTimeWinner: Prediction; halfTimeWinner: Prediction; overUnderGoals: Prediction; correctScoreSuggestion: Prediction; bothTeamsToScore: Prediction; doubleChance: Prediction; handicapResult: Prediction; keyInsights: Prediction; }

// --- UI COMPONENT FOR A SINGLE PREDICTION (No changes) ---
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
  // All the state and functions remain the same
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

  useEffect(() => { /* ... no changes here ... */ if(session){const fetchProfile=async()=>{setLoadingProfile(!0);const{data:a}=await supabase.from("profiles").select("user_type, coins_remaining").eq("id",session.user.id).single();a&&setProfile(a),setLoadingProfile(!1)};fetchProfile()}},[session,supabase]);
  const handleUpgrade = async (e: React.FormEvent) => { /* ... no changes here ... */ e.preventDefault(),setUpgrading(!0),setUpgradeMessage("");const a=await fetch("/api/upgrade-account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessCode})}),t=await a.json();a.ok?(setUpgradeMessage(t.message),setProfile(t.profile)):setUpgradeMessage(`Error: ${t.error}`),setUpgrading(!1),setAccessCode("")};
  const handlePrediction = async (e: React.FormEvent) => { /* ... no changes here ... */ e.preventDefault(),setLoadingPrediction(!0),setPredictionError(""),setPredictions(null);try{const a=await fetch("/api/predict",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamA,teamB})}),t=await a.json();if(!a.ok)throw new Error(t.error||"Prediction failed.");setPredictions(t);const{data:o}=await supabase.from("profiles").select("*").eq("id",session.user.id).single();setProfile(o)}catch(a:any){setPredictionError(a.message)}finally{setLoadingPrediction(!1)}};
  async function signInWithGoogle(){await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:"https://deep-statistics-score.vercel.app/"}})};

  // Login page uses new styles (no changes)
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
      {/* --- NEW: The Head component for mobile responsiveness --- */}
      <Head>
        <title>Deep Statistics Score</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <header className="app-header">
        {/* ... rest of the code is the same ... */}
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
                <input type="text" placeholder="Home Team" value={teamA} onChange={(e) => setTeamA(e.target.value)} required/>
                <span>vs</span>
                <input type="text" placeholder="Away Team" value={teamB} onChange={(e) => setTeamB(e.target.value)} required/>
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
          <form onSubmit={handleUpgrade} className="upgrade-form" style={{display: 'flex', gap: '10px'}}>
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