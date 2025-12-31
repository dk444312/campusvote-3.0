import React, { useState, useEffect } from 'react';
import { AuthState, Voter } from './types';
import { getSupabase } from './services/supabase';
import { auth, googleProvider } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AdminPanel } from './components/AdminPanel';
import { VoterPanel } from './components/VoterPanel';
import { 
  Shield, 
  User, 
  Lock, 
  AlertTriangle, 
  Vote, 
  Calendar, 
  CheckCircle, 
  Loader2, 
  Sparkles, 
  ArrowRight, 
  Zap,
  X 
} from 'lucide-react';
import { Echo } from './components/Echo';

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>(AuthState.LOGIN);
  const [currentUser, setCurrentUser] = useState<Voter | null>(null);
  const [configError, setConfigError] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [introPhase, setIntroPhase] = useState<0 | 1 | 2>(0); 

  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const votingDeadline = new Date('2028-12-12T16:15:00');
  const isVotingClosed = new Date() >= votingDeadline;

  const handleUserSetup = async (firebaseUser: FirebaseUser) => {
    try {
      if (!firebaseUser.email?.endsWith('@cunima.ac.mw')) {
        await signOut(auth);
        throw new Error('Only @cunima.ac.mw emails are allowed.');
      }

      const supabase = getSupabase();
      if (!supabase) throw new Error('System configuration error.');

      let { data: voterData, error } = await supabase
        .from('voters')
        .select('*')
        .eq('uid', firebaseUser.uid)
        .maybeSingle();

      if (error) throw error;

      if (!voterData) {
        if (isVotingClosed) {
          throw new Error('Voting has closed. New registrations are not allowed.');
        }

        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        let isUnique = false;

        while (!isUnique) {
          code = Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
          const { data: existing } = await supabase.from('voters').select('id').eq('code', code).maybeSingle();
          isUnique = !existing;
        }

        const { data: newVoter, error: insertError } = await supabase
          .from('voters')
          .insert({ code, uid: firebaseUser.uid, has_voted: false })
          .select('*')
          .single();

        if (insertError) throw insertError;
        voterData = newVoter;
      }

      setCurrentUser(voterData);
      setAuthState(AuthState.VOTER_DASHBOARD);

    } catch (err: any) {
      setLoginError(err.message || 'Verification failed.');
      await signOut(auth);
    } finally {
      setIsLoading(false);
    }
  };

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIntroPhase(2);
        handleUserSetup(user);
      } else {
        setAuthState(AuthState.LOGIN);
        setCurrentUser(null);
        setIsLoading(false);
      }
    });

    const sb = getSupabase();
    if (!sb) setConfigError(true);

    return () => unsubscribe();
  }, []);

  // Secret Admin Access (5 clicks)
  useEffect(() => {
    if (adminClickCount > 0 && adminClickCount < 5) {
      const timer = setTimeout(() => setAdminClickCount(0), 5000);
      return () => clearTimeout(timer);
    }
    if (adminClickCount >= 5) {
      setShowAdminForm(true);
      setAdminClickCount(0);
    }
  }, [adminClickCount]);

  // Voter Google Login
  const handleGoogleVoterLogin = async () => {
    if (isVotingClosed) {
      setLoginError('Voting period has ended.');
      return;
    }

    setIsLoading(true);
    setLoginError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await handleUserSetup(result.user);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
      setIsLoading(false);
    }
  };

  // Admin Login
  const handleAdminLogin = async () => {
    if (adminUser === 'admin' && adminPass === 'adminpass1') {
      setIsLoading(true);
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.from('admin_logs').insert({
            action_type: 'ADMIN_LOGIN',
            details: 'Successful admin login',
          });
        }
      } catch (logError) {
        console.error("Failed to log admin login:", logError);
      }

      setAuthState(AuthState.ADMIN_DASHBOARD);
      setShowAdminForm(false);
      setLoginError('');
      setIsLoading(false);
    } else {
      setLoginError('Invalid admin credentials.');
    }
  };

  // Shared logout
  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setAuthState(AuthState.LOGIN);
    setIntroPhase(2);
    setLoginError('');
  };

  const handleVoteComplete = () => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, has_voted: true });
    }
  };

  // --- RENDER (same as your original) ---

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-black p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-white/20">
          <AlertTriangle size={56} className="text-white/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-3">Configuration Error</h1>
          <p className="text-white/80">Please check Supabase environment variables.</p>
        </div>
      </div>
    );
  }

  if (introPhase === 0 && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="max-w-md w-full text-center text-white space-y-8 animate-fade-in-up">
          <div className="flex justify-center">
            <div className="bg-white/10 p-4 rounded-full shadow-lg shadow-white/10">
              <Vote size={48} className="text-white" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tight text-white">
              Campus Vote 3.0
            </h1>
            <p className="text-white/80 text-sm tracking-widest uppercase font-semibold">Catholic University of Malawi</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-2xl text-left shadow-xl">
            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <Zap size={20} /> Why this version is better
            </h3>
            <p className="text-white/80 leading-relaxed">
              We have completely re-engineered the voting experience to be faster, more secure, and smarter. 
              Version 3.0 introduces military-grade encryption for your votes, real-time analytics to ensure transparency, 
              and a streamlined interface that makes casting your ballot easier than ever before.
            </p>
          </div>

          <button 
            onClick={() => setIntroPhase(1)}
            className="group relative w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 overflow-hidden transition-all hover:bg-white/80 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            <span className="relative z-10 text-lg">Continue</span>
            <ArrowRight className="relative z-10 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    );
  }

  if (introPhase === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-black border border-white/20 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative">
            <button 
              onClick={() => setIntroPhase(2)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition"
            >
              <X size={24} />
            </button>
            
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-white/10">
              <Sparkles size={32} className="text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Introducing Echo AI</h2>
            <div className="h-1 w-12 bg-white/50 mx-auto mb-6 rounded-full"></div>

            <p className="text-white/80 leading-relaxed mb-8">
              Echo AI is a new feature powered by <span className="font-bold text-white">Google Gemini</span> to promote effective communication during the elections period.
              <Echo />
            </p>

            <button 
              onClick={() => setIntroPhase(2)}
              className="w-full bg-white hover:bg-white/80 text-black font-bold py-3 rounded-xl transition shadow-lg shadow-white/10"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authState === AuthState.ADMIN_DASHBOARD) {
    return <AdminPanel onLogout={logout} />;
  }

  if (authState === AuthState.VOTER_DASHBOARD && currentUser) {
    return (
      <VoterPanel
        voter={currentUser}
        onLogout={logout}
        onVoteComplete={handleVoteComplete}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 relative">
      <div className={`bg-black border border-white/20 p-10 rounded-3xl shadow-2xl max-w-md w-full transition-all duration-500 ${introPhase === 1 ? 'scale-95 opacity-50 blur-[2px]' : 'scale-100 opacity-100'}`}>

        <div className="text-center mb-10 relative">
          <Vote size={48} className="text-white/80 mx-auto mb-4" />
          <h1 className="text-4xl font-black text-white tracking-tight">Campus Vote 3.0</h1>
          <p className="text-white/80 font-semibold mt-2">Catholic University of Malawi</p>

          <CheckCircle 
            size={24} 
            className="absolute top-0 right-0 text-white/20 hover:text-white/50 cursor-pointer transition" 
            onClick={() => setAdminClickCount(prev => prev + 1)} 
          />
        </div>

        {isVotingClosed ? (
          <div className="text-center space-y-6">
            <div className="bg-black/50 p-8 rounded-3xl border border-white/20">
              <Calendar size={64} className="text-white/50 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-white mb-3">Voting Has Ended</h2>
              <p className="text-lg text-white/80">
                The election closed on <strong>December 12, 2028</strong>.
              </p>
              <p className="text-md text-white/60 mt-4">
                Results and candidate profiles are available in the voter portal.
              </p>
            </div>

            {showAdminForm && (
              <div className="mt-8 space-y-5">
                <input 
                  type="text" 
                  value={adminUser} 
                  onChange={(e) => setAdminUser(e.target.value)} 
                  className="w-full p-4 bg-black border border-white/20 rounded-xl focus:border-white outline-none text-white" 
                  placeholder="Admin Username" 
                />
                <input 
                  type="password" 
                  value={adminPass} 
                  onChange={(e) => setAdminPass(e.target.value)} 
                  className="w-full p-4 bg-black border border-white/20 rounded-xl focus:border-white outline-none text-white" 
                  placeholder="Admin Password" 
                />
                <button 
                  onClick={handleAdminLogin} 
                  disabled={isLoading}
                  className="w-full bg-white hover:bg-white/80 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <Shield size={20} />}
                  Admin Login
                </button>
              </div>
            )}

            {loginError && (
              <div className="mt-6 p-4 bg-white/10 text-white/80 rounded-xl text-center font-medium">
                {loginError}
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={handleGoogleVoterLogin}
              disabled={isLoading || introPhase === 1}
              className="w-full py-5 rounded-xl font-bold text-black text-lg bg-white hover:bg-white/80 disabled:bg-white/50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg transition transform hover:scale-105"
            >
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : <User size={24} />}
              {isLoading ? 'Signing In...' : 'Sign In with Google (@cunima.ac.mw)'}
            </button>

            {showAdminForm && (
              <div className="mt-8 space-y-5 border-t pt-6 border-white/20">
                <input 
                  type="text" 
                  value={adminUser} 
                  onChange={(e) => setAdminUser(e.target.value)} 
                  className="w-full p-4 bg-black border border-white/20 rounded-xl focus:border-white outline-none text-white" 
                  placeholder="Admin Username" 
                />
                <input 
                  type="password" 
                  value={adminPass} 
                  onChange={(e) => setAdminPass(e.target.value)} 
                  className="w-full p-4 bg-black border border-white/20 rounded-xl focus:border-white outline-none text-white" 
                  placeholder="Admin Password" 
                />
                <button 
                  onClick={handleAdminLogin} 
                  disabled={isLoading}
                  className="w-full bg-white hover:bg-white/80 text-black font-bold py-4 rounded-xl"
                >
                  Admin Login
                </button>
              </div>
            )}

            {loginError && (
              <div className="mt-6 p-4 bg-white/10 text-white/80 rounded-xl text-center">
                {loginError}
              </div>
            )}
          </>
        )}
      </div>
      <Echo />
    </div>
  );
};

export default App;