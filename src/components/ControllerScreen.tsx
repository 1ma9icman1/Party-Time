import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { LogOut, Zap, Target } from "lucide-react";

interface ControllerScreenProps {
  roomId: string;
  onLeave: () => void;
}

export default function ControllerScreen({ roomId, onLeave }: ControllerScreenProps) {
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const touchAreaRef = useRef<HTMLDivElement>(null);
  
  // Controller State
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [currentOffset, setCurrentOffset] = useState<{x: number, y: number}>({x: 0, y: 0});

  useEffect(() => {
    socket.connect();
    
    socket.on("joinedRoom", () => {
      setJoined(true);
      setError("");
    });

    socket.on("roomError", (msg) => {
      setError(msg);
    });
    
    // Listen for turn updates
    socket.on("turnUpdate", (activePlayerId) => {
      setIsMyTurn(socket.id === activePlayerId);
      if (socket.id === activePlayerId) {
        if (navigator.vibrate) navigator.vibrate(200);
      }
    });

    return () => {
      socket.off("joinedRoom");
      socket.off("roomError");
      socket.off("turnUpdate");
    };
  }, []);

  const handleJoin = () => {
    if (playerName.trim()) {
      socket.emit("joinRoom", roomId, playerName);
    }
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    // if (!isMyTurn) return; // Uncomment in full logic
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setCurrentOffset({ x: 0, y: 0 });
    if (navigator.vibrate) navigator.vibrate(50);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStart) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.x;
    const dy = touch.clientY - dragStart.y;
    
    // Limit drag distance
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = 150;
    
    let fx = dx;
    let fy = dy;
    
    if (dist > maxDist) {
      fx = (dx / dist) * maxDist;
      fy = (dy / dist) * maxDist;
    }
    
    setCurrentOffset({ x: fx, y: fy });
    
    // Send to host for realtime aiming
    socket.emit("slingDrag", roomId, { dx: fx, dy: fy });
  };
  
  const handleTouchEnd = () => {
    if (!dragStart) return;
    
    socket.emit("slingRelease", roomId, { dx: currentOffset.x, dy: currentOffset.y });
    setDragStart(null);
    setCurrentOffset({ x: 0, y: 0 });
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };
  
  const handleAbility = () => {
    socket.emit("triggerAbility", roomId);
    if (navigator.vibrate) navigator.vibrate(100);
  };

  if (!joined) {
    return (
      <div className="w-full h-full bg-[#0a001a] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-slate-900 border-2 border-pink-500/50 rounded-2xl p-8 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
          <h2 className="text-3xl font-black text-pink-400 mb-6 text-center uppercase tracking-widest">JOIN ROOM</h2>
          <div className="text-xl text-center text-slate-300 font-mono tracking-[0.3em] mb-6">ID: {roomId}</div>
          
          <input 
            type="text" 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="YOUR NAME" 
            maxLength={12}
            className="w-full bg-black/50 border border-pink-500/50 text-pink-400 text-center text-xl tracking-[0.2em] p-4 rounded-xl focus:outline-none focus:border-pink-400 mb-6 placeholder:text-pink-900"
          />
          
          {error && <p className="text-red-400 text-center mb-4">{error}</p>}
          
          <button 
            onClick={handleJoin}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white font-black text-xl py-4 rounded-xl uppercase tracking-widest shadow-[0_0_15px_rgba(236,72,153,0.5)]"
          >
            CONNECT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#050014] flex flex-col text-white select-none touch-none overflow-hidden pb-safe">
      <div className="flex items-center justify-between p-4 bg-slate-900/80 border-b border-cyan-500/30">
        <button onClick={onLeave} className="text-slate-400 p-2">
          <LogOut size={24} />
        </button>
        <div className="text-cyan-400 font-black tracking-widest uppercase text-xl">
          {playerName}
        </div>
        <div className={`px-4 py-1 rounded-full text-sm font-bold tracking-widest ${isMyTurn ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-slate-800 text-slate-500'}`}>
          {isMyTurn ? 'YOUR TURN' : 'WAITING'}
        </div>
      </div>
      
      {/* Aiming Area */}
      <div 
        ref={touchAreaRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 relative flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#12002f] to-[#050014]"
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(to right, #e81cff 1px, transparent 1px), linear-gradient(to bottom, #e81cff 1px, transparent 1px)',
            backgroundSize: '20px 20px',
        }} />
        
        <div className="text-center pointer-events-none">
          <Target size={64} className="mx-auto mb-4 text-slate-700" />
          <p className="text-slate-500 uppercase tracking-widest font-bold text-xl">
            {isMyTurn ? 'DRAG TO AIM' : 'PLEASE WAIT'}
          </p>
        </div>
        
        {/* Virtual Thumbstick Feedback */}
        {dragStart && (
          <div 
            className="absolute w-24 h-24 rounded-full border-2 border-cyan-500/50 flex items-center justify-center pointer-events-none"
            style={{ left: dragStart.x - 48, top: dragStart.y - 48 }}
          >
            <div 
              className="w-12 h-12 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
              style={{ transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)` }}
            />
          </div>
        )}
      </div>
      
      {/* Ability Button */}
      <div className="p-6 bg-slate-900 border-t border-purple-500/30 flex justify-center">
        <button 
          onClick={handleAbility}
          className="w-full max-w-sm h-24 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center gap-4 border-2 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.5)] active:scale-95 transition-transform"
        >
          <Zap size={32} className="text-white" />
          <span className="text-2xl font-black uppercase tracking-widest text-white">ABILITY</span>
        </button>
      </div>
    </div>
  );
}
