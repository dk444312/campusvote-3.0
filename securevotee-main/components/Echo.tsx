import React, { useState, useRef, useEffect } from 'react';
import { generateEchoResponse } from '../services/geminiService';
import { ChatMessage } from '../types';
import { X, Send, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const Echo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Systems online. I am Echo. How can I assist with the election process?" }
  ]);
  
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const responseText = await generateEchoResponse(userText, messages);
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: "Connection interrupted. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    // === FIXED TOP-RIGHT POSITIONING ===
    <div className="fixed top-4 right-4 md:top-6 md:right-6 z-[9999] font-sans pointer-events-none">
      <div className="pointer-events-auto">
        
        {/* --- CLOSED STATE: Floating Button --- */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group bg-black dark:bg-white text-white dark:text-black h-14 px-6 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-3 border border-gray-700 dark:border-gray-200"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="font-black text-lg tracking-widest font-mono group-hover:tracking-[0.2em] transition-all">
              ECHO
            </span>
          </button>
        )}

        {/* --- OPEN STATE: Chat Window (slides down from top-right) --- */}
        {isOpen && (
          <div className="
            w-full max-w-md 
            sm:w-[380px] 
            md:w-[420px] 
            h-[580px] sm:h-[600px] 
            flex flex-col 
            bg-white dark:bg-gray-900 
            border border-gray-200 dark:border-gray-800 
            rounded-2xl sm:rounded-3xl 
            shadow-2xl 
            overflow-hidden 
            animate-in fade-in slide-in-from-top-4 duration-300
          ">
            {/* Header */}
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="bg-black dark:bg-white text-white dark:text-black w-9 h-9 rounded-lg flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-black text-lg tracking-widest leading-none font-mono">ECHO</h3>
                  <p className="text-[10px] uppercase tracking-wider text-green-600 font-bold mt-0.5">System Online</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={22} />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef} 
              className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-black/40 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
            >
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex w-full animate-in fade-in-0 zoom-in-95 duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3.5 text-sm shadow-md break-words font-medium transition-all hover:shadow-lg ${
                        msg.role === 'user'
                          ? 'bg-black dark:bg-white text-white dark:text-black rounded-2xl rounded-br-sm'
                          : 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl rounded-bl-sm'
                      }`}
                    >
                      {msg.role === 'model' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown
                            components={{
                              strong: ({node, ...props}) => <strong className="font-bold text-black dark:text-white" {...props} />,
                              em: ({node, ...props}) => <em className="italic text-gray-800 dark:text-gray-200" {...props} />,
                              a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
                              code: ({node, ...props}) => <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-4" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-4" {...props} />,
                              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic" {...props} />,
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50 p-4 rounded-2xl rounded-bl-sm shadow-md flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type your query..."
                  className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white pl-5 pr-14 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:bg-white dark:focus:bg-black transition-all text-base font-medium placeholder:text-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="absolute right-3 p-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="text-center mt-3">
                <p className="text-[10px] text-gray-400">Powered by Gemini 3.0 Flash</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};