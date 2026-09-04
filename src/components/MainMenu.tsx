import { useEffect, useState } from "react";
import { Users, Gamepad2, Settings, QrCode, LogIn, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { auth, loginWithGoogle } from "../firebase";
import { onAuthStateChanged, User } from "firebase/auth";

interface MainMenuProps {
  onHost: () => void;
  onJoin: (code: string) => void;
  onSolo: () => void;
}

export default function MainMenu({ onHost, onJoin, onSolo }: MainMenuProps) {
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#050014] to-[#12002f] overflow-hidden">
      {/* Background Neon Grid */}
      <div className="absolute inset-0 pointer-events-none z-0" 
           style={{
             backgroundImage: 'linear-gradient(to right, #e81cff22 1px, transparent 1px), linear-gradient(to bottom, #e81cff22 1px, transparent 1px)',
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)',
             height: '200%'
           }} 
      />
      <NeonParticles />

      {/* Top right auth corner */}
      <div className="absolute top-4 right-4 z-20">
        {user ? (
           <div className="flex items-center gap-4 bg-slate-900/80 p-3 rounded-full border border-cyan-500/50 backdrop-blur-md">
             <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="Avatar" className="w-10 h-10 rounded-full border border-cyan-400" />
             <div className="hidden md:flex flex-col text-sm pr-4">
               <span className="text-cyan-400 font-bold">{user.displayName || 'Player'}</span>
               <button onClick={() => auth.signOut()} className="text-pink-400 text-xs text-left hover:text-pink-300">Sign Out</button>
             </div>
           </div>
        ) : (
           <button 
             onClick={loginWithGoogle}
             className="flex items-center gap-2 bg-slate-900/80 px-6 py-3 rounded-full border border-pink-500/50 hover:bg-pink-900/50 hover:border-pink-400 text-pink-400 font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] backdrop-blur-md"
           >
             <LogIn size={18} />
             Sign In
           </button>
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="z-10 relative flex items-center justify-center w-[600px] h-[600px]"
      >
        {/* Rotating Circular Text SVG */}
        <motion.div 
          className="absolute inset-0 pointer-events-none drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]"
          animate={{ rotate: 360 }}
          transition={{ duration: 25, ease: "linear", repeat: Infinity }}
        >
          <svg width="600" height="600" viewBox="0 0 600 600">
            <defs>
              <path id="textCircle" d="M 300, 300 m -220, 0 a 220,220 0 1,1 440,0 a 220,220 0 1,1 -440,0" />
            </defs>
            <text className="text-[44px] font-black uppercase tracking-[0.25em]" fill="transparent" stroke="#22d3ee" strokeWidth="2">
              <textPath href="#textCircle" startOffset="0%">
                 PARTY TIME ✦ PARTY TIME ✦ PARTY TIME ✦ PARTY TIME ✦ 
              </textPath>
            </text>
          </svg>
        </motion.div>

        {/* Center Buttons Container */}
        <div className="flex flex-col gap-6 w-80 z-20">
          <MenuButton icon={<Gamepad2 size={24} />} text="Host Party" onClick={onHost} color="cyan" />
          
          {showJoin ? (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }}
              className="flex flex-col gap-2 p-4 border border-pink-500/50 rounded-xl bg-pink-950/80 backdrop-blur-md shadow-[0_0_20px_rgba(236,72,153,0.5)]"
            >
              <input 
                type="text" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE" 
                maxLength={4}
                className="w-full bg-black/50 border border-pink-500/50 text-pink-400 text-center text-2xl tracking-[0.5em] p-3 rounded-lg focus:outline-none focus:border-pink-400 focus:shadow-[0_0_15px_rgba(236,72,153,0.8)] placeholder:text-pink-900"
              />
              <button 
                onClick={() => joinCode.length >= 4 && onJoin(joinCode)}
                className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-2 rounded-lg transition-colors tracking-widest uppercase"
              >
                JOIN
              </button>
            </motion.div>
          ) : (
            <MenuButton icon={<QrCode size={24} />} text="Join Game" onClick={() => setShowJoin(true)} color="pink" />
          )}

          <MenuButton icon={<Users size={24} />} text="Solo Mode" onClick={onSolo} color="purple" />
          <MenuButton icon={<Settings size={24} />} text="Settings" onClick={() => {}} color="blue" />
        </div>
      </motion.div>
    </div>
  );
}

function MenuButton({ icon, text, onClick, color }: { icon: React.ReactNode, text: string, onClick: () => void, color: 'cyan' | 'pink' | 'purple' | 'blue' }) {
  const colorStyles = {
    cyan: "border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.8)] hover:bg-cyan-950/50",
    pink: "border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)] hover:shadow-[0_0_25px_rgba(236,72,153,0.8)] hover:bg-pink-950/50",
    purple: "border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.8)] hover:bg-purple-950/50",
    blue: "border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:shadow-[0_0_25px_rgba(59,130,246,0.8)] hover:bg-blue-950/50"
  };

  return (
    <motion.button 
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative overflow-hidden group flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 uppercase font-bold tracking-widest backdrop-blur-sm transition-all duration-300 ${colorStyles[color]}`}
    >
      {icon}
      {text}
    </motion.button>
  );
}

function NeonParticles() {
  const particles = Array.from({ length: 40 });
  const colors = ['bg-pink-500', 'bg-cyan-400', 'bg-purple-500', 'bg-yellow-400'];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((_, i) => {
        const size = Math.random() * 6 + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const duration = Math.random() * 15 + 10;
        const delay = Math.random() * 10;
        
        return (
          <motion.div
            key={i}
            className={`absolute rounded-full shadow-[0_0_10px_currentColor] ${color}`}
            style={{ width: size, height: size, left: `${left}%`, top: '110%' }}
            animate={{
              y: ['0vh', '-120vh'],
              x: [0, (Math.random() - 0.5) * 200],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        );
      })}
    </div>
  );
}
