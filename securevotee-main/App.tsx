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
  X 
} from 'lucide-react';
import { Echo } from './components/Echo';

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

  // ... (keep all your existing logic: handleUserSetup, useEffect, handlers, etc.)
  // I'll only show the updated render parts below for brevity

  const handleUserSetup = async (firebaseUser: FirebaseUser) => {
    // ... (unchanged)
  };

  // ... all other handlers remain the same

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-black/80 border border-white/20 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
          <AlertTriangle size={48} className="text-white/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-3">Configuration Error</h1>
          <p className="text-white/70 text-sm">Please check environment variables.</p>
        </div>
      </div>
    );
  }

  // === INTRO PHASE 0 - Fully Responsive ===
  if (introPhase === 0 && !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black px-6 py-12">
        <div className="w-full max-w-md text-center space-y-10">

          {/* Logo */}
          <div className="flex justify-center">
            <div className="p-5 bg-white/10 rounded-3xl shadow-2xl">
              <Vote size={56} className="text-white" />
            </div>
          </div>

          {/* Title - Responsive */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight">
              Campus Vote 3.0
            </h1>
            <p className="text-white/60 text-sm sm:text-base uppercase tracking-wider font-medium">
              Catholic University of Malawi
            </p>
          </div>

          {/* Feature Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-xl">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center justify-center gap-3">
              <Zap size={28} className="text-yellow-400" />
              Next-Level Experience
            </h3>
            <p className="text-white/70 text-base leading-relaxed">
              Secure, fast, and beautifully redesigned. Built with military-grade encryption and real-time transparency.
            </p>
          </div>

          {/* Continue Button - Full width, rounded */}
          <button 
            onClick={() => setIntroPhase(1)}
            className="w-full bg-white text-black font-bold py-5 px-8 rounded-full text-lg shadow-2xl hover:shadow-white/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="flex items-center justify-center gap-3">
              Continue <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </div>
    );
  }

  // === ECHO AI MODAL - Mobile Friendly ===
  if (introPhase === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-6">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <div className="bg-black/80 border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8 relative">

            <button 
              onClick={() => setIntroPhase(2)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X size={28} />
            </button>

            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl mx-auto mb-8 shadow-2xl flex items-center justify-center">
              <Sparkles size={36} className="text-white" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white text-center mb-4">Meet Echo AI</h2>
            <div className="h-1 w-20 bg-white/30 mx-auto mb-8 rounded-full"></div>

            <p className="text-white/70 text-center text-base leading-relaxed mb-8">
              Powered by <span className="font-bold text-white">Google Gemini</span>, Echo promotes respectful and informed campus discussions.
            </p>

            <div className="mb-10">
              <Echo />
            </div>

            <button 
              onClick={() => setIntroPhase(2)}
              className="w-full bg-white text-black font-bold py-5 rounded-full text-lg shadow-xl hover:shadow-white/30 transition"
            >
              Continue to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === MAIN LOGIN SCREEN - Modern & Mobile-First ===
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-black/70 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 sm:p-10">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-3xl mb-6">
              <Vote size={36} className="text-white sm:size-10" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
              Campus Vote 3.0
            </h1>
            <p className="text-white/60 mt-2 text-sm">Catholic University of Malawi</p>
          </div>

          {isVotingClosed ? (
            <div className="text-center space-y-8">
              <div className="bg-white/5 border border-white/10 p-10 rounded-3xl">
                <Calendar size={64} className="text-white/40 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white mb-4">Voting Has Ended</h2>
                <p className="text-white/70">
                  The election closed on <strong>December 12, 2028</strong>.
                </p>
              </div>

              {/* Admin form if visible */}
              {showAdminForm && (
                <div className="space-y-4">
                  <input placeholder="Username" className="w-full px-5 py-4 bg-white/5 border border-white/20 rounded-2xl text-white" />
                  <input type="password" placeholder="Password" className="w-full px-5 py-4 bg-white/5 border border-white/20 rounded-2xl text-white" />
                  <button className="w-full bg-white text-black font-bold py-5 rounded-full">
                    Admin Login
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* MODERN ROUNDED GOOGLE BUTTON */}
              <button
                onClick={handleGoogleVoterLogin}
                disabled={isLoading}
                className="w-full group relative bg-white/5 hover:bg-white/10 border border-white/30 hover:border-white/50 px-8 py-6 rounded-full font-medium text-white flex items-center justify-center gap-4 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-white/20 disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin size-6" />
                ) : (
                  <>
                    <GoogleLogo />
                    <span className="text-base sm:text-lg font-semibold">Continue with Google</span>
                  </>
                )}
              </button>

              <p className="text-center text-white/50 text-xs sm:text-sm mt-6">
                Only @cunima.ac.mw accounts allowed
              </p>

              {/* Admin form */}
              {showAdminForm && (
                <div className="mt-10 pt-8 border-t border-white/10 space-y-5">
                  <input 
                    type="text" 
                    value={adminUser} 
                    onChange={(e) => setAdminUser(e.target.value)} 
                    placeholder="Admin Username"
                    className="w-full px-6 py-4 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:border-white/60 outline-none"
                  />
                  <input 
                    type="password" 
                    value={adminPass} 
                    onChange={(e) => setAdminPass(e.target.value)} 
                    placeholder="Admin Password"
                    className="w-full px-6 py-4 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:border-white/60 outline-none"
                  />
                  <button 
                    onClick={handleAdminLogin}
                    className="w-full bg-white hover:bg-white/90 text-black font-bold py-5 rounded-full transition"
                  >
                    Admin Login
                  </button>
                </div>
              )}
            </>
          )}

          {loginError && (
            <div className="mt-8 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-center">
              {loginError}
            </div>
          )}

          {/* Hidden Admin Trigger */}
          <button
            onClick={() => setAdminClickCount(prev => prev + 1)}
            className="absolute top-6 right-6 text-white/20 hover:text-white/50 transition"
          >
            <CheckCircle size={28} />
          </button>
        </div>
      </div>

      <Echo />
    </div>
  );
};

export default App;