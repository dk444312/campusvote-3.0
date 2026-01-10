import React, { useState, useEffect } from 'react';
import { AuthState, Voter } from './types';
import { getSupabase } from './services/supabase';
import { auth, googleProvider } from './services/firebase';
import { signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AdminPanel } from './components/AdminPanel';
import { VoterPanel } from './components/VoterPanel';
import {
  Shield,
  Vote,
  Calendar,
  CheckCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Zap,
  X,
  AlertTriangle
} from 'lucide-react';
import { Echo } from './components/Echo';
// Google Logo Component
const GoogleLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
    <path d="M22.501 12.293c0-.81-.073-1.62-.218-2.41H12v4.567h5.936a5.088 5.088 0 0 1-2.206 3.347v2.773h3.56c2.085-1.923 3.29-4.754 3.29-8.077Z" fill="#4285F4"/>
    <path d="M12 23c2.976 0 5.47-1.006 7.293-2.727l-3.56-2.773c-.99.663-2.257 1.055-3.733 1.055-2.874 0-5.303-1.94-6.172-4.548H1.156v2.863C2.969 20.427 6.758 23 12 23Z" fill="#34A853"/>
    <path d="M5.828 13.927C5.583 13.264 5.44 12.55 5.44 11.818c0-.732.143-1.446.388-2.109V6.846H1.156A11.993 11.993 0 0 0 0 12c0 1.93.464 3.75 1.156 5.154l4.672-3.227Z" fill="#FBBC05"/>
    <path d="M12 5.636c1.616 0 3.065.556 4.204 1.647l3.15-3.15C17.47 2.344 14.976 1 12 1 6.758 1 2.969 3.573 1.156 8.154l4.672 3.227C6.697 7.773 9.126 5.636 12 5.636Z" fill="#EA4335"/>
  </svg>
);
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
        await auth.signOut();
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
      await auth.signOut();
    } finally {
      setIsLoading(false);
    }
  };
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
  const logout = async () => {
    await auth.signOut();
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
  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full text-center border border-blue-100">
          <AlertTriangle size={56} className="text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-black mb-3">Configuration Error</h1>
          <p className="text-gray-700">Please check Supabase environment variables.</p>
        </div>
      </div>
    );
  }
  // Common wrapper to inject styles
  const FontWrapper = ({ children }: { children: React.ReactNode }) => (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap');
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>
      {children}
    </>
  );
  if (introPhase === 0 && !currentUser) {
    return (
      <FontWrapper>
        <div className="min-h-screen flex items-center justify-center bg-white px-4 sm:px-6 md:px-8">
          <div className="max-w-md md:max-w-4xl w-full text-center text-black space-y-10 md:space-y-12 py-12 md:flex md:flex-row md:items-center md:justify-between md:text-left md:space-x-12">
            <div className="md:w-1/2 space-y-6">
              <div className="flex justify-center md:justify-start">
                <div className="bg-blue-100 p-5 rounded-3xl shadow-2xl shadow-blue-100/50">
                  <Vote size={56} className="text-blue-600" />
                </div>
              </div>
              <div className="space-y-3">
                {/* Applied font-jakarta here */}
                <h1 className="font-jakarta text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-black leading-tight">
                  Campus Vote 3.0
                </h1>
                <p className="text-gray-500 text-sm tracking-widest uppercase font-semibold">Catholic University of Malawi</p>
              </div>
            </div>
            <div className="md:w-1/2 space-y-6">
              <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-8 rounded-3xl shadow-2xl">
                <h3 className="font-jakarta text-2xl md:text-3xl font-bold text-black mb-4 flex items-center justify-center md:justify-start gap-3">
                  <Zap size={28} className="text-blue-400" /> Next-Level Voting
                </h3>
                <p className="text-gray-700 leading-relaxed text-base">
                  Fully redesigned with military-grade security, instant verification, and a beautiful interface built for speed and trust.
                </p>
              </div>
              <button
                onClick={() => setIntroPhase(1)}
                className="group relative w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-bold py-5 rounded-full flex items-center justify-center gap-4 text-lg overflow-hidden transition-all hover:shadow-2xl hover:shadow-blue-200"
              >
                <span className="relative z-10 font-jakarta">Continue to Login</span>
                <ArrowRight className="relative z-10 transition-transform group-hover:translate-x-2" size={24} />
              </button>
            </div>
          </div>
        </div>
      </FontWrapper>
    );
  }
  if (introPhase === 1) {
    return (
      <FontWrapper>
        <div className="min-h-screen flex items-center justify-center bg-white px-4 sm:px-6 md:px-8">
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/90 backdrop-blur-xl p-4">
            <div className="bg-white border border-blue-100 p-10 rounded-3xl shadow-2xl max-w-md w-full text-center relative">
              <button
                onClick={() => setIntroPhase(2)}
                className="absolute top-5 right-5 text-gray-500 hover:text-black transition"
              >
                <X size={28} />
              </button>
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <Sparkles size={40} className="text-white" />
              </div>
              <h2 className="font-jakarta text-3xl font-extrabold text-black mb-3">Meet Echo AI</h2>
              <div className="h-1 w-20 bg-blue-200 mx-auto mb-8 rounded-full"></div>
              <p className="text-gray-700 leading-relaxed text-lg mb-10">
                Powered by <span className="font-bold text-blue-600">Google Gemini</span>, Echo helps foster respectful and informed discussions throughout the election.
              </p>
              <Echo />
              <button
                onClick={() => setIntroPhase(2)}
                className="mt-10 w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 text-white font-bold py-5 rounded-full text-lg transition shadow-xl"
              >
                <span className="font-jakarta">Continue to Sign In</span>
              </button>
            </div>
          </div>
        </div>
      </FontWrapper>
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
  // Main Login Screen
  return (
    <FontWrapper>
      <div className="min-h-screen flex items-center justify-center bg-white px-4 sm:px-6 md:px-8 py-12">
        <div className="w-full max-w-md md:max-w-lg">
          <div className="bg-gradient-to-b from-blue-50 to-white border border-blue-100 p-8 sm:p-10 md:p-12 rounded-3xl shadow-2xl">
            <div className="text-center mb-10 sm:mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-3xl mb-6 shadow-xl">
                <Vote size={40} className="text-blue-600" />
              </div>
             
              {/* Title with New Professional Font */}
              <h1 className="font-jakarta text-3xl sm:text-4xl md:text-5xl font-extrabold text-black tracking-tight leading-tight">
                Campus Vote 3.0
              </h1>
              <p className="text-gray-500 mt-3 text-sm font-medium">Catholic University of Malawi</p>
            </div>
            {isVotingClosed ? (
              <div className="text-center space-y-8">
                <div className="bg-blue-50 border border-blue-100 p-10 rounded-3xl">
                  <Calendar size={72} className="text-blue-200 mx-auto mb-6" />
                  <h2 className="font-jakarta text-3xl font-bold text-black mb-4">Voting Period Ended</h2>
                  <p className="text-gray-600 text-lg">
                    The election concluded on <span className="font-bold">December 12, 2028</span>.
                  </p>
                </div>
                {showAdminForm && (
                  <div className="space-y-5 mt-8">
                    <input
                      type="text"
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      placeholder="Admin Username"
                      className="w-full px-5 py-4 bg-blue-50 border border-blue-200 rounded-full text-black placeholder-gray-400 focus:border-blue-400 outline-none transition"
                    />
                    <input
                      type="password"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      placeholder="Admin Password"
                      className="w-full px-5 py-4 bg-blue-50 border border-blue-200 rounded-full text-black placeholder-gray-400 focus:border-blue-400 outline-none transition"
                    />
                    <button
                      onClick={handleAdminLogin}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 text-white font-bold py-5 rounded-full transition flex items-center justify-center gap-3"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Shield size={24} />}
                      Admin Access
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={handleGoogleVoterLogin}
                  disabled={isLoading}
                  className="w-full group relative bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 backdrop-blur-sm px-6 py-5 rounded-full font-medium text-black flex items-center justify-center gap-3 sm:gap-4 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>
                      <GoogleLogo />
                      <span className="text-base sm:text-lg font-jakarta">Continue with Google</span>
                    </>
                  )}
                </button>
                <p className="text-center text-gray-500 text-sm mt-6">
                  Only @cunima.ac.mw accounts are permitted
                </p>
                {showAdminForm && (
                  <div className="mt-10 pt-8 border-t border-blue-100 space-y-5">
                    <input
                      type="text"
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      placeholder="Admin Username"
                      className="w-full px-5 py-4 bg-blue-50 border border-blue-200 rounded-full text-black placeholder-gray-400 focus:border-blue-400 outline-none transition"
                    />
                    <input
                      type="password"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      placeholder="Admin Password"
                      className="w-full px-5 py-4 bg-blue-50 border border-blue-200 rounded-full text-black placeholder-gray-400 focus:border-blue-400 outline-none transition"
                    />
                    <button
                      onClick={handleAdminLogin}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 text-white font-bold py-5 rounded-full transition"
                    >
                      Admin Login
                    </button>
                  </div>
                )}
              </>
            )}
            {loginError && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200 text-red-700 rounded-3xl text-center font-medium">
                {loginError}
              </div>
            )}
            <button
              onClick={() => setAdminClickCount(prev => prev + 1)}
              className="absolute top-4 right-4 text-blue-200 hover:text-blue-400 transition"
            >
              <CheckCircle size={28} />
            </button>
          </div>
        </div>
        <Echo />
      </div>
    </FontWrapper>
  );
};
export default App;
