import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

// This is our new component that contains the logic.
// It will only be rendered *after* the Supabase provider is ready.
const AppContent = () => {
  const session = useSession();
  const supabase = useSupabaseClient();

  // If the user is NOT logged in, show the login UI
  if (!session) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h1>Deep Statistics Score</h1>
        <p>Sign in to get your AI-powered soccer predictions.</p>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          onlyThirdPartyProviders={true}
        />
      </div>
    )
  }

  // If the user IS logged in, show the main app
  return (
    <div style={{ padding: '20px' }}>
      <h2>Welcome! You are logged in.</h2>
      <p>The main application will be built here.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
    </div>
  )
}

// This is the main page export. It now only renders our AppContent component.
const Home = () => {
  return (
    <AppContent />
  )
}

export default Home;