import { useEffect, useState, useCallback } from "react";
import { socket } from "../socket";
import { LogOut, Zap, Crosshair, Gamepad2 } from "lucide-react";

interface ControllerScreenProps {
  roomId: string;
  onLeave: () => void;
}

export default function ControllerScreen({ roomId, onLeave }: ControllerScreenProps) {
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  
  // Controller State
  const [isMyTurn, setIsMyTurn] = useState(false);
  
  // Wii Pointer State
  const [pointerModeActive, setPointerModeActive] = useState(false);
  const [calibration, setCalibration] = useState<{ alpha: number, beta: number, gamma: number } | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [currentOffset, setCurrentOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

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
      } else {
        // Reset state if turn ends
        setIsGrabbing(false);
        setCalibration(null);
      }
    });

    return () => {
      socket.off("joinedRoom");
      socket.off("roomError");
      socket.off("turnUpdate");
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!isMyTurn || !isGrabbing) return;
    
    setCalibration((cal) => {
      if (!cal && event.alpha !== null && event.beta !== null && event.gamma !== null) {
        // Initial calibration point when grab button is first pressed
        return { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
      }
      
      if (cal && event.alpha !== null && event.beta !== null && event.gamma !== null) {
        // Calculate relative rotation (yaw and pitch)
        let dAlpha = event.alpha - cal.alpha;
        let dBeta = event.beta - cal.beta;
        
        // Handle 360 wrap-around for alpha (yaw)
        if (dAlpha > 180) dAlpha -= 360;
        if (dAlpha < -180) dAlpha += 360;
        
        // Map rotation to slingshot pull distance (adjust sensitivity here)
        // Usually you hold the phone flat or slightly tilted up. 
        // Alpha (yaw) = Left/Right (X axis)
        // Beta (pitch) = Up/Down (Y axis)
        const sensitivity = 3.5; 
        
        const dx = dAlpha * sensitivity;
        const dy = dBeta * sensitivity;
        
        // Limit max pull distance
        const dist = Math.sqrt(dx*dx + dy*dy);
        const maxDist = 150;
        
        let fx = dx;
        let fy = dy;
        
        if (dist > maxDist) {
          fx = (dx / dist) * maxDist;
          fy = (dy / dist) * maxDist;
        }
        
        setCurrentOffset({ x: fx, y: fy });
        socket.emit("slingDrag", roomId, { dx: fx, dy: fy });
      }
      
      return cal;
    });
  }, [isMyTurn, isGrabbing, roomId]);

  useEffect(() => {
    if (pointerModeActive) {
      window.addEventListener("deviceorientation", handleOrientation);
    } else {
      window.removeEventListener("deviceorientation", handleOrientation);
    }
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [pointerModeActive, handleOrientation]);

  const handleJoin = () => {
    if (playerName.trim()) {
      socket.emit("joinRoom", roomId, playerName);
    }
  };

  const enablePointerMode = () => {
    // Request permission for iOS 13+ devices
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            setPointerModeActive(true);
          } else {
            alert("Permission required for Wii pointer mode.");
          }
        })
        .catch(console.error);
    } else {
      // Non iOS 13+ devices
      setPointerModeActive(true);
    }
  };

  const handleGrabStart = () => {
    if (!isMyTurn || !pointerModeActive) return;
    setIsGrabbing(true);
    setCalibration(null); // Reset calibration on new grab
    setCurrentOffset({ x: 0, y: 0 });
    if (navigator.vibrate) navigator.vibrate(50);
  };
  
  const handleGrabEnd = () => {
    if (!isMyTurn || !pointerModeActive || !isGrabbing) return;
    setIsGrabbing(false);
    
    socket.emit("slingRelease", roomId, { dx: currentOffset.x, dy: currentOffset.y });
    setCurrentOffset({ x: 0, y: 0 });
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };
  
  const handleAbility = () => {
    if (!isMyTurn) return;
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
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#12002f] to-[#050014] p-6">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(to right, #e81cff 1px, transparent 1px), linear-gradient(to bottom, #e81cff 1px, transparent 1px)',
            backgroundSize: '20px 20px',
        }} />
        
        {!pointerModeActive ? (
          <div className="z-10 flex flex-col items-center gap-6">
            <Gamepad2 size={80} className="text-cyan-400" />
            <p className="text-center text-slate-300 max-w-[250px] uppercase tracking-widest font-bold">
              Enable Wii Remote mode to aim with your phone's tilt!
            </p>
            <button 
              onClick={enablePointerMode}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest px-8 py-4 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)]"
            >
              Activate Motion
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center z-10 relative">
            <div className="text-center pointer-events-none mb-12">
              <Crosshair size={64} className={`mx-auto mb-4 ${isGrabbing ? 'text-pink-500' : 'text-slate-600'} transition-colors duration-200`} />
              <p className="text-slate-400 uppercase tracking-widest font-bold text-sm">
                {isMyTurn 
                  ? (isGrabbing ? 'AIMING... RELEASE TO SHOOT!' : 'HOLD BUTTON AND TILT TO AIM') 
                  : 'PLEASE WAIT FOR YOUR TURN'}
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
              className={`w-40 h-40 rounded-full flex items-center justify-center text-5xl font-black transition-all ${
                !isMyTurn 
                  ? 'bg-slate-800 text-slate-600 border-4 border-slate-700'
                  : isGrabbing 
                    ? 'bg-pink-500 text-white border-4 border-pink-300 scale-95 shadow-[0_0_30px_rgba(236,72,153,0.8)]'
                    : 'bg-slate-800 text-pink-500 border-4 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.4)]'
              }`}
            >
              A
            </button>

            {/* Virtual Thumbstick Feedback */}
            {isGrabbing && (
              <div 
                className="absolute w-24 h-24 rounded-full border-2 border-cyan-500/50 flex items-center justify-center pointer-events-none"
                style={{ top: '20%' }}
              >
                <div 
                  className="w-8 h-8 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                  style={{ transform: `translate(${currentOffset.x * 0.3}px, ${currentOffset.y * 0.3}px)` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Ability Button */}
      <div className="p-6 bg-slate-900 border-t border-purple-500/30 flex justify-center z-10">
        <button 
          onClick={handleAbility}
          disabled={!isMyTurn}
          className="w-full max-w-sm h-24 bg-gradient-to-r from-purple-600 to-blue-600 disabled:from-slate-800 disabled:to-slate-800 rounded-2xl flex items-center justify-center gap-4 border-2 border-purple-400 disabled:border-slate-700 shadow-[0_0_20px_rgba(168,85,247,0.5)] disabled:shadow-none active:scale-95 transition-transform"
        >
          <Zap size={32} className={isMyTurn ? "text-white" : "text-slate-500"} />
          <span className={`text-2xl font-black uppercase tracking-widest ${isMyTurn ? "text-white" : "text-slate-500"}`}>
            ABILITY
          </span>
        </button>
      </div>
    </div>
  );
}
