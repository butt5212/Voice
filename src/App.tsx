import { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Volume2, 
  History, 
  Settings, 
  Play, 
  Pause, 
  Download, 
  Share2, 
  Trash2, 
  Sparkles, 
  Ghost, 
  CloudRain, 
  Wind, 
  Trees, 
  Film,
  User as UserIcon,
  LogOut,
  Languages,
  Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { auth, signInWithGoogle, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { generateTTS, VoiceName, suggestVoiceTone, correctGrammar } from './services/geminiService';
import { saveGeneration, useGenerations, deleteGeneration } from './services/firebaseService';
import { cn } from './lib/utils';

// --- Types ---
interface Generation {
  id: string;
  text: string;
  audioUrl: string;
  voice: string;
  ambientSound?: string;
  createdAt: any;
}

const VOICES: { id: VoiceName; label: string; icon: any; desc: string }[] = [
  { id: 'Fenrir', label: 'Deep (Male)', icon: Volume2, desc: 'Strong & authoritative' },
  { id: 'Kore', label: 'Sweet (Female)', icon: Volume2, desc: 'Soft & friendly' },
  { id: 'Puck', label: 'Child', icon: Volume2, desc: 'Energetic & young' },
  { id: 'Charon', label: 'Horror', icon: Ghost, desc: 'Calm & eerie' },
  { id: 'Zephyr', label: 'Airy', icon: Wind, desc: 'Soft & ethereal' },
];

const AMBIENT_SOUNDS = [
  { id: 'none', label: 'None', icon: Volume2 },
  { id: 'horror', label: 'Scary Ambience', icon: Ghost },
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'wind', label: 'Wind', icon: Wind },
  { id: 'forest', label: 'Forest', icon: Trees },
  { id: 'cinematic', label: 'Cinematic', icon: Film },
];

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'ur', label: 'Urdu' },
  { id: 'hi', label: 'Hindi' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [text, setText] = useState('');
  const [activeVoice, setActiveVoice] = useState<VoiceName>('Fenrir');
  const [activeAmbient, setActiveAmbient] = useState('none');
  const [activeLang, setActiveLang] = useState('en');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = useGenerations((items) => {
        setGenerations(items);
      });
      return () => unsubscribe();
    } else {
      setGenerations([]);
    }
  }, [user]);

  // --- Actions ---
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in popup was closed');
      } else {
        toast.error('Failed to sign in');
        console.error(error);
      }
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Please enter some text');
      return;
    }
    
    if (!user) {
      toast.error('Please sign in to generate voice');
      return;
    }

    setIsGenerating(true);
    try {
      const audioData = await generateTTS({
        text,
        voice: activeVoice,
        style: activeAmbient !== 'none' ? activeAmbient : undefined
      });
      
      setCurrentAudio(audioData);
      
      await saveGeneration({
        text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        audioUrl: audioData,
        voice: activeVoice,
        ambientSound: activeAmbient,
      });

      toast.success('Voice generated successfully!');
    } catch (error) {
      toast.error('Failed to generate voice');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAISuggest = async () => {
    if (!text) return;
    const toastId = toast.loading('AI analyzing text...');
    try {
      const suggestion = await suggestVoiceTone(text);
      if (suggestion && suggestion.suggestedVoice) {
        const voice = VOICES.find(v => v.id === (suggestion.suggestedVoice as VoiceName)) || VOICES[0];
        setActiveVoice(voice.id);
        toast.success(`AI suggests: ${suggestion.tone} tone with ${voice.label} voice`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (error) {
      toast.dismiss(toastId);
    }
  };

  const handleSTT = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = activeLang === 'ur' ? 'ur-PK' : activeLang === 'hi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      toast('Listening...', { icon: '🎙️' });
    };

    recognition.onresult = async (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setText(transcript);
    };

    recognition.onend = async () => {
      setIsRecording(false);
      if (text) {
        const corrected = await correctGrammar(text);
        setText(corrected);
      }
    };

    recognition.onerror = () => setIsRecording(false);
    
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handleAutoStyle = () => {
    const randomVoice = VOICES[Math.floor(Math.random() * VOICES.length)].id;
    const randomAmbient = AMBIENT_SOUNDS[Math.floor(Math.random() * AMBIENT_SOUNDS.length)].id;
    setActiveVoice(randomVoice as VoiceName);
    setActiveAmbient(randomAmbient);
    toast('Auto Style Applied!', { icon: '🎲' });
  };

  const downloadAudio = (url: string, filename: string = 'voicegen-ai.wav') => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareAudio = async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'VoiceGen AI Audio',
          text: 'Check out this AI-generated voice!',
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };

  // --- UI ---
  return (
    <div className="min-h-screen bg-[#0a0502] text-[#e0d8d0] font-sans selection:bg-orange-500/30 overflow-x-hidden">
      <Toaster position="top-center" />
      
      {/* Immersive Background */}
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[10%] left-[20%] w-[40rem] h-[40rem] bg-orange-900/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[10%] w-[30rem] h-[30rem] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto min-h-screen flex flex-col pt-6 pb-24 px-4">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Volume2 className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">VoiceGen<span className="text-orange-500 italic">AI</span></h1>
          </div>
          
          {user ? (
            <button 
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition-colors"
            >
              <img src={user.photoURL || ''} alt="User" className="w-5 h-5 rounded-full" />
              <LogOut size={14} />
            </button>
          ) : (
            <button 
              onClick={handleSignIn}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-600 text-white font-medium text-sm hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20"
            >
              <UserIcon size={16} />
              Sign In
            </button>
          )}
        </header>

        {/* Tabs */}
        <div className="flex bg-white/5 p-1 rounded-2xl mb-8 border border-white/10 backdrop-blur-sm">
          <button 
            onClick={() => setActiveTab('create')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'create' ? "bg-white/10 text-orange-500 shadow-sm" : "text-white/40 hover:text-white"
            )}
          >
            <Sparkles size={16} /> Create
          </button>
          <button 
            onClick={() => setActiveTab('library')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'library' ? "bg-white/10 text-orange-500 shadow-sm" : "text-white/40 hover:text-white"
            )}
          >
            <History size={16} /> Library
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'create' ? (
              <motion.div 
                key="create"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Text Input Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/40">Enter Script</label>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handleAISuggest}
                        className="text-[10px] uppercase font-bold text-orange-500 border border-orange-500/30 px-2 py-1 rounded-md hover:bg-orange-500/10 transition-colors flex items-center gap-1"
                      >
                        <Wand2 size={10} /> AI Analyze
                      </button>
                      <button 
                        onClick={handleAutoStyle}
                        className="text-[10px] uppercase font-bold text-blue-400 border border-blue-400/30 px-2 py-1 rounded-md hover:bg-blue-400/10 transition-colors flex items-center gap-1"
                      >
                        <Sparkles size={10} /> Auto Style
                      </button>
                      <select 
                        value={activeLang}
                        onChange={(e) => setActiveLang(e.target.value)}
                        className="bg-transparent text-xs text-white/60 focus:outline-none cursor-pointer"
                      >
                        {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <textarea 
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste your story or type here..."
                      className="w-full h-48 bg-white/5 border border-white/10 rounded-3xl p-6 text-lg focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/5 transition-all resize-none backdrop-blur-sm"
                    />
                    <button 
                      onClick={handleSTT}
                      className={cn(
                        "absolute bottom-4 right-4 p-4 rounded-2xl shadow-xl transition-all duration-300",
                        isRecording 
                          ? "bg-red-500 text-white animate-pulse scale-110" 
                          : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white"
                      )}
                    >
                      <Mic />
                    </button>
                  </div>
                </div>

                {/* Voice Selection */}
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 px-2">Choose Voice</label>
                  <div className="grid grid-cols-2 gap-3">
                    {VOICES.map((v) => (
                      <button 
                        key={v.id}
                        onClick={() => setActiveVoice(v.id)}
                        className={cn(
                          "relative p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden",
                          activeVoice === v.id 
                            ? "bg-orange-600/10 border-orange-500 shadow-lg shadow-orange-500/5" 
                            : "bg-white/5 border-white/5 hover:border-white/20"
                        )}
                      >
                       <div className="relative z-10">
                          <div className={cn(
                            "w-8 h-8 rounded-lg mb-3 flex items-center justify-center",
                            activeVoice === v.id ? "bg-orange-500 text-white" : "bg-white/10 text-white/60"
                          )}>
                            <v.icon size={16} />
                          </div>
                          <p className={cn("text-sm font-semibold", activeVoice === v.id ? "text-white" : "text-white/80")}>{v.label}</p>
                          <p className="text-[10px] text-white/40 line-clamp-1">{v.desc}</p>
                       </div>
                       {activeVoice === v.id && (
                         <motion.div 
                          layoutId="activeVoice"
                          className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" 
                         />
                       )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ambient Selection */}
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 px-2">Ambient Background</label>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                    {AMBIENT_SOUNDS.map((s) => (
                      <button 
                        key={s.id}
                        onClick={() => setActiveAmbient(s.id)}
                        className={cn(
                          "flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border transition-all duration-300",
                          activeAmbient === s.id 
                            ? "bg-orange-600/10 border-orange-500 text-orange-500" 
                            : "bg-white/5 border-white/5 text-white/40 hover:text-white"
                        )}
                      >
                        <s.icon size={18} />
                        <span className="text-[10px] font-bold uppercase">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={cn(
                    "w-full py-5 rounded-3xl font-bold text-lg tracking-wide transition-all duration-500 flex items-center justify-center gap-3 relative overflow-hidden group shadow-2xl shadow-orange-500/20",
                    isGenerating ? "bg-white/5 text-white/20" : "bg-orange-600 text-white hover:bg-orange-500 active:scale-95"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Designing Voice...
                    </>
                  ) : (
                    <>
                      <Volume2 fill="white" />
                      Generate High Quality Voice
                    </>
                  )}
                </button>

                {/* Audio Player */}
                <AnimatePresence>
                  {currentAudio && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                            <Volume2 size={20} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Generated Output</p>
                            <p className="text-[10px] text-white/40">{activeVoice} • {activeAmbient}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => downloadAudio(currentAudio)}
                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                          >
                            <Download size={18} />
                          </button>
                          <button 
                            onClick={() => shareAudio(currentAudio)}
                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                          >
                            <Share2 size={18} />
                          </button>
                        </div>
                      </div>
                      
                      <audio 
                        ref={audioRef}
                        src={currentAudio} 
                        controls 
                        className="w-full h-10 invert brightness-150 grayscale"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div 
                key="library"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {generations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-white/20">
                    <History size={48} className="mb-4 opacity-50" />
                    <p className="font-medium text-lg">No saved audios yet</p>
                    <p className="text-sm">Start generating to build your collection</p>
                  </div>
                ) : (
                  generations.map((gen) => (
                    <div 
                      key={gen.id}
                      className="group bg-white/5 border border-white/10 rounded-3xl p-4 hover:bg-white/[0.08] transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => {
                              setCurrentAudio(gen.audioUrl);
                              setActiveTab('create');
                              setTimeout(() => audioRef.current?.play(), 100);
                            }}
                            className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all group-hover:scale-105"
                          >
                            <Play fill="currentColor" size={24} className="ml-1" />
                          </button>
                          <div>
                            <p className="text-sm font-medium text-white line-clamp-1">{gen.text}</p>
                            <p className="text-[10px] text-white/40 mt-1">
                              {gen.voice} • {new Date(gen.createdAt.seconds * 1000).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteGeneration(gen.id)}
                          className="p-2 text-white/20 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => downloadAudio(gen.audioUrl)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10"
                        >
                          <Download size={12} /> Save
                        </button>
                        <button 
                          onClick={() => shareAudio(gen.audioUrl)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10"
                        >
                          <Share2 size={12} /> Share
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Floating Nav (Mobile Style) */}
        {!user && (
          <div className="fixed bottom-6 left-4 right-4 p-4 rounded-3xl bg-orange-600/90 backdrop-blur-xl border border-white/10 flex items-center justify-between shadow-2xl">
            <p className="text-sm font-bold text-white">Save your creations</p>
            <button 
              onClick={handleSignIn}
              className="px-6 py-2 rounded-xl bg-white text-orange-600 font-bold text-sm"
            >
              Get Started
            </button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
