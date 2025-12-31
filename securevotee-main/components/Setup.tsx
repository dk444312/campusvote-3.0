import React, { useState } from 'react';
import { initSupabase } from '../services/supabase';
import { Database, Key, ShieldCheck } from 'lucide-react';

interface SetupProps {
  onComplete: () => void;
}

export const Setup: React.FC<SetupProps> = ({ onComplete }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleConnect = () => {
    if (!url || !key) {
      setError('Both URL and Key are required.');
      return;
    }
    if (initSupabase(url, key)) {
      onComplete();
    } else {
      setError('Failed to connect. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Connect to Database</h1>
          <p className="text-gray-500 text-center mt-2">
            Enter your Supabase credentials to initialize the SecureVote system.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Database size={16} /> Supabase URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Key size={16} /> API Key (Anon/Public)
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="your-anon-key"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-md"
          >
            Connect & Continue
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          Check the <code>database.sql</code> file for table setup instructions.
        </div>
      </div>
    </div>
  );
};
