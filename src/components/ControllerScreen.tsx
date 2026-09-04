import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "../socket";
import { LogOut, Zap, Gamepad2, Navigation } from "lucide-react";

interface ControllerScreenProps {
  roomId: string;
  onExit: () => void;
}

export default function ControllerScreen({ roomId, onExit }: ControllerScreenProps) {
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  
  // Controller State
  const [isMyTurn, setIsMyTurn] = useState(false);
  
  // Wii Pointer/Swing State
  const [motionActive, setMotionActive] = useState(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const maxAccRef = useRef<number>(0);

  useEffect(() => {
    socket.connect();
    
    socket.on("joinedRoom", (room) => {
      setJoined(true);
      setError("");
    });
    
    socket.on("roomError", (msg) => setError(msg));
    
    socket.on("turnUpdate", (roomIdUpdate, activePlayerId) => {
      if (roomIdUpdate === roomId) {
        setIsMyTurn(socket.id === activePlayerId);
        if (socket.id === activePlayerId) {
          if (navigator.vibrate) navigator.vibrate(200);
        } else {
          setIsGrabbing(false);
        }
      }
    });

    return () => {
      socket.off("joinedRoom");
      socket.off("roomError");
      socket.off("turnUpdate");
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [roomId]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!isMyTurn || isGrabbing) return; // Only aim when NOT swinging
    
    // Use gamma (tilt left/right) for aiming
    let gamma = event.gamma || 0;
    // Cap tilt between -45 and 45 degrees
    if (gamma > 45) gamma = 45;
    if (gamma < -45) gamma = -45;
    
    // Normalize to -1 to 1
    const aim = gamma / 45;
    socket.emit("bowlAim", roomId, { aim });
  }, [isMyTurn, isGrabbing, roomId]);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isMyTurn || !isGrabbing) return;
    
    // Accumulate swing power
    const acc = event.acceleration || event.accelerationIncludingGravity;
    if (acc) {
      const force = Math.abs(acc.y || 0) + Math.abs(acc.z || 0) + Math.abs(acc.x || 0);
      if (force > maxAccRef.current) {
        maxAccRef.current = force;
      }
    }
  }, [isMyTurn, isGrabbing]);

  useEffect(() => {
    if (motionActive) {
      window.addEventListener("deviceorientation", handleOrientation);
      window.addEventListener("devicemotion", handleMotion);
    } else {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
    }
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
    }
  }, [motionActive, handleOrientation, handleMotion]);

  const handleJoin = () => {
    if (playerName.trim()) {
      socket.emit("joinRoom", roomId, playerName);
    }
  };

  const enableMotionMode = () => {
    const requestMotion = (typeof (DeviceMotionEvent as any).requestPermission === 'function')
      ? (DeviceMotionEvent as any).requestPermission()
      : Promise.resolve('granted');

    const requestOrientation = (typeof (DeviceOrientationEvent as any).requestPermission === 'function')
      ? (DeviceOrientationEvent as any).requestPermission()
      : Promise.resolve('granted');

    Promise.all([requestMotion, requestOrientation])
      .then(states => {
        if (states.every(s => s === 'granted' || typeof s === 'undefined')) {
          setMotionActive(true);
        } else {
          alert("Sensor permission required for Bowling!");
        }
      })
      .catch((err) => {
        console.error(err);
        setMotionActive(true);
      });
  };

  const handleGrabStart = () => {
    if (!isMyTurn || !motionActive) return;
    setIsGrabbing(true);
    maxAccRef.current = 0; // Reset swing tracker
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleGrabEnd = () => {
    if (!isMyTurn || !motionActive || !isGrabbing) return;
    setIsGrabbing(false);
    
    // Calculate final power
    let power = maxAccRef.current / 15; 
    if (power < 0.5) power = 0.5; // Minimum throw
    if (power > 3.0) power = 3.0; // Max throw limit

    socket.emit("bowlThrow", roomId, { power, spin: 0 });
    
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const handleAbility = () => {
    if (!isMyTurn) return;
    socket.emit("triggerAbility", roomId);
    if (navigator.vibrate) navigator.vibrate(100);
  };

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black text-white p-6">
        <Gamepad2 size={64} className="mb-6 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
        <h1 className="text-3xl font-black uppercase tracking-widest mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          Neon Bowling
        </h1>
        
        <div className="w-full max-w-sm bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm shadow-xl">
          <input 
            type="text" 
            placeholder="Enter your name..."
            className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl px-4 py-3 text-lg font-bold mb-4 focus:outline-none focus:border-cyan-400 transition-colors"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={12}
          />
          {error && <p className="text-red-400 text-sm font-bold mb-4">{error}</p>}
          <button 
            onClick={handleJoin}
            disabled={!playerName.trim()}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-900 font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all"
          >
            Join Lane
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-cyan-500/30 flex justify-between items-center z-10 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-black text-lg border-2 border-white shadow-[0_0_10px_rgba(6,182,212,0.8)]">
             {playerName.charAt(0).toUpperCase()}
           </div>
           <div>
             <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Bowler</div>
             <div className="font-black uppercase">{playerName}</div>
           </div>
        </div>
        
        <button onClick={onExit} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
          <LogOut size={20} />
        </button>
      </div>
      
      {/* Aiming / Throw Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/40 to-black p-6">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'bottom'
        }} />
        
        {!motionActive ? (
          <div className="z-10 flex flex-col items-center gap-6">
            <Gamepad2 size={80} className="text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
            <p className="text-center text-slate-300 max-w-[250px] uppercase tracking-widest font-bold">
              Enable Wii Remote mode to bowl with your phone!
            </p>
            <button 
              onClick={enableMotionMode}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest px-8 py-4 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)]"
            >
              Activate Motion
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center z-10 relative">
            <div className="text-center pointer-events-none mb-12">
              <Navigation size={64} className={`mx-auto mb-4 ${isGrabbing ? 'text-blue-500' : 'text-slate-600'} transition-colors duration-200 ${isGrabbing ? '' : 'animate-pulse'}`} />
              <p className="text-cyan-400 uppercase tracking-widest font-bold text-sm bg-black/50 px-4 py-2 rounded-full border border-cyan-500/30">
                {isMyTurn 
                  ? (isGrabbing ? 'SWING AND RELEASE!' : 'TILT LEFT/RIGHT TO AIM') 
                  : 'WAITING FOR YOUR TURN'}
              </p>
            </div>

            {/* Wii Main Button */}
            <button
              onTouchStart={handleGrabStart}
              onMouseDown={handleGrabStart}
              onTouchEnd={handleGrabEnd}
              onMouseUp={handleGrabEnd}
              onMouseLeave={handleGrabEnd}
              disabled={!isMyTurn}
              className={`w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all ${
                !isMyTurn 
                  ? 'bg-slate-800 text-slate-600 border-4 border-slate-700'
                  : isGrabbing 
                    ? 'bg-cyan-500 text-slate-900 border-4 border-cyan-200 scale-95 shadow-[0_0_40px_rgba(6,182,212,0.8)]'
                    : 'bg-slate-900 text-cyan-400 border-4 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
              }`}
            >
              <span className="text-7xl font-black block leading-none">B</span>
              <span className="text-xs font-bold uppercase tracking-widest mt-2 opacity-80">
                {isGrabbing ? 'SWINGING' : 'HOLD TO SWING'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Ability Button (Spin/Special) */}
      <div className="p-6 bg-slate-900 border-t border-cyan-500/30 flex justify-center z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <button 
          onClick={handleAbility}
          disabled={!isMyTurn}
          className="w-full max-w-sm h-20 bg-gradient-to-r from-blue-600 to-cyan-600 disabled:from-slate-800 disabled:to-slate-800 rounded-2xl flex items-center justify-center gap-4 border-2 border-cyan-400 disabled:border-slate-700 shadow-[0_0_20px_rgba(6,182,212,0.5)] disabled:shadow-none active:scale-95 transition-transform"
        >
          <Zap size={28} className={isMyTurn ? "text-white" : "text-slate-500"} />
          <span className={`text-xl font-black uppercase tracking-widest ${isMyTurn ? "text-white" : "text-slate-500"}`}>
            SPECIAL
          </span>
        </button>
      </div>
    </div>
  );
}
