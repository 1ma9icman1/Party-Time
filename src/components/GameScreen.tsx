import React, { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../socket";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics, useBox, useSphere, useCylinder } from "@react-three/cannon";
import { Environment, PerspectiveCamera, Grid } from "@react-three/drei";
import { LogOut } from "lucide-react";
import * as THREE from "three";

const PIN_POSITIONS: [number, number, number][] = [
    [0, 1, -45],
    [-0.8, 1, -46.5], [0.8, 1, -46.5],
    [-1.6, 1, -48], [0, 1, -48], [1.6, 1, -48],
    [-2.4, 1, -49.5], [-0.8, 1, -49.5], [0.8, 1, -49.5], [2.4, 1, -49.5]
];

const Pin = ({ position, onFallen, id }: { position: [number, number, number], onFallen: (id: number) => void, id: number }) => {
    const [ref, api] = useCylinder(() => ({
        mass: 1,
        position,
        args: [0.3, 0.45, 2], // top radius, bottom radius, height
        material: { friction: 0.1, restitution: 0.5 }
    }));
    const rot = useRef([0,0,0]);
    const pos = useRef([0,0,0]);
    const fallen = useRef(false);

    useEffect(() => {
        const unsubRot = api.rotation.subscribe(r => rot.current = r);
        const unsubPos = api.position.subscribe(p => pos.current = p);
        return () => { unsubRot(); unsubPos(); };
    }, [api]);

    useFrame(() => {
        if (!fallen.current) {
            const isFallen = Math.abs(rot.current[0]) > 0.8 || Math.abs(rot.current[2]) > 0.8 || pos.current[1] < -0.5;
            if (isFallen) {
                fallen.current = true;
                onFallen(id);
            }
        }
    });

    return (
        <mesh ref={ref as any} castShadow>
            <cylinderGeometry args={[0.3, 0.45, 2, 16]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.1} roughness={0.4} />
            <mesh position={[0, 0.4, 0]}>
                <cylinderGeometry args={[0.31, 0.31, 0.15, 16]} />
                <meshStandardMaterial color="#ef4444" />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.34, 0.34, 0.15, 16]} />
                <meshStandardMaterial color="#ef4444" />
            </mesh>
        </mesh>
    );
};

const Ball = ({ roomId, onThrow }: { roomId: string, onThrow: () => void }) => {
    const [ref, api] = useSphere(() => ({
        mass: 15,
        position: [0, 1, 10],
        args: [0.8],
        material: { friction: 0.1, restitution: 0.4 }
    }));

    const isThrown = useRef(false);

    useEffect(() => {
        let currentAim = 0;

        const handleAim = (data: { aim: number }) => {
            if (!isThrown.current) {
                currentAim = data.aim;
                api.position.set(currentAim * 4, 1, 10);
                api.velocity.set(0,0,0);
                api.angularVelocity.set(0,0,0);
            }
        };
        
        const handleThrow = (data: { power: number, spin: number }) => {
            if (!isThrown.current) {
                isThrown.current = true;
                // Add velocity to move towards pins (-Z axis)
                api.applyImpulse([data.spin * 20, 0, -data.power * 400], [0,0,0]);
                onThrow();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isThrown.current) return;
            if (e.key === "ArrowLeft") {
                currentAim = Math.max(-1, currentAim - 0.1);
                handleAim({ aim: currentAim });
            }
            if (e.key === "ArrowRight") {
                currentAim = Math.min(1, currentAim + 0.1);
                handleAim({ aim: currentAim });
            }
            if (e.key === " ") {
                handleThrow({ power: 2.5, spin: 0 }); // Default test throw
            }
        };
        
        socket.on("bowlAim", handleAim);
        socket.on("bowlThrow", handleThrow);
        window.addEventListener("keydown", handleKeyDown);
        
        return () => {
            socket.off("bowlAim", handleAim);
            socket.off("bowlThrow", handleThrow);
            window.removeEventListener("keydown", handleKeyDown);
        }
    }, [api, onThrow]);

    return (
        <mesh ref={ref as any} castShadow>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshStandardMaterial color="#06b6d4" emissive="#0284c7" emissiveIntensity={0.5} metalness={0.8} roughness={0.2} />
        </mesh>
    );
};

const Lane = () => {
    useBox(() => ({ type: "Static", position: [0, -0.25, -20], args: [10, 0.5, 100], material: { friction: 0.1, restitution: 0.2 } }));
    useBox(() => ({ type: "Static", position: [-6, -0.5, -20], args: [2, 0.5, 100] }));
    useBox(() => ({ type: "Static", position: [6, -0.5, -20], args: [2, 0.5, 100] }));
    useBox(() => ({ type: "Static", position: [0, 2, -55], args: [14, 4, 2] }));

    return (
        <group>
            <mesh position={[0, -0.01, -20]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                <planeGeometry args={[10, 100]} />
                <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.2} />
            </mesh>
            <Grid 
              position={[0, 0.01, -20]} 
              args={[10, 100]} 
              cellSize={1} 
              cellThickness={1} 
              cellColor="#0ea5e9" 
              sectionSize={5} 
              sectionThickness={1.5} 
              sectionColor="#38bdf8" 
              fadeDistance={100}
            />
            <mesh position={[-6, -0.25, -20]}>
                <boxGeometry args={[2, 0.5, 100]} />
                <meshStandardMaterial color="#020617" />
            </mesh>
            <mesh position={[6, -0.25, -20]}>
                <boxGeometry args={[2, 0.5, 100]} />
                <meshStandardMaterial color="#020617" />
            </mesh>
        </group>
    );
};

interface GameScreenProps {
  roomId: string;
  isSolo: boolean;
  onExit: () => void;
}

export default function GameScreen({ roomId, isSolo, onExit }: GameScreenProps) {
  const [players, setPlayers] = useState<{id: string, name: string, score: number}[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [frame, setFrame] = useState(1);
  const [message, setMessage] = useState("PLAYER 1 UP!");
  
  const [resetCounter, setResetCounter] = useState(0);
  const fallenPinsRef = useRef<Set<number>>(new Set());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSolo) {
      socket.emit("getRoomState", roomId, (room: any) => {
        if (room && room.players) {
          setPlayers(room.players.map((p: any) => ({ ...p, score: 0 })));
          socket.emit("turnUpdate", roomId, room.players[0]?.id);
        }
      });
      
      socket.on("roomStateUpdate", (room) => {
        setPlayers(prev => {
          return room.players.map((rp: any) => {
            const existing = prev.find(p => p.id === rp.id);
            return existing ? existing : { ...rp, score: 0 };
          });
        });
      });
    } else {
      setPlayers([{ id: "solo", name: "Player 1", score: 0 }]);
    }

    return () => {
      socket.off("roomStateUpdate");
    };
  }, [roomId, isSolo]);

  const finishTurn = useCallback(() => {
     const count = fallenPinsRef.current.size;
     
     let pts = count * 10;
     let msg = `${count} PINS!`;
     if (count === 10) {
         pts = 300;
         msg = "STRIKE!";
     } else if (count === 0) {
         msg = "GUTTER!";
     }
     
     setMessage(msg);
     
     setPlayers(prev => {
        const next = [...prev];
        if (next[turnIndex]) {
            next[turnIndex].score += pts;
        }
        return next;
     });

     setTimeout(() => {
         setTurnIndex(prev => {
            const next = (prev + 1) % players.length;
            if (next === 0) setFrame(f => f + 1);
            
            setMessage(`${players[next]?.name}'S TURN!`);
            if (!isSolo) socket.emit("turnUpdate", roomId, players[next]?.id);
            return next;
         });
         
         fallenPinsRef.current.clear();
         setResetCounter(c => c + 1);
     }, 3000);
  }, [players, turnIndex, isSolo, roomId]);

  const handleThrow = useCallback(() => {
      setMessage("BALL AWAY!");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Wait 6 seconds for ball to roll and pins to fall
      timeoutRef.current = setTimeout(() => {
          finishTurn();
      }, 6000);
  }, [finishTurn]);

  useEffect(() => {
      return () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] bg-[#050014] overflow-hidden font-sans select-none relative">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-[#050014] to-black z-0 pointer-events-none" />
      
      {/* Top HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        
        {/* Left: Players */}
        <div className="flex gap-4">
          {players.map((p, i) => (
            <div key={p.id} className={`flex flex-col rounded-xl overflow-hidden border-2 transition-all ${i === turnIndex ? 'border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.9)] scale-110' : 'border-slate-800 opacity-60'} w-32 bg-slate-900/90 backdrop-blur-md`}>
              <div className={`text-xs text-center font-black uppercase tracking-wider py-1 ${i === 0 ? 'bg-cyan-600' : i === 1 ? 'bg-pink-600' : 'bg-purple-600'} text-white shadow-md`}>
                {p.name.substring(0, 10) || `Player ${i+1}`}
              </div>
              <div className="h-16 flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-950">
                <span className="text-4xl font-black text-white">{p.score}</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Center: Title & Banner */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-center text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
            <div className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              FRAME {frame}
            </div>
          </div>
          <div className="bg-gradient-to-r from-transparent via-cyan-900/80 to-transparent px-20 py-3 border-y border-cyan-400/50 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <span className="text-white font-black uppercase tracking-[0.25em] drop-shadow-[0_0_12px_rgba(6,182,212,1)] text-2xl animate-pulse">
              {message}
            </span>
          </div>
        </div>

        {/* Right: Exit */}
        <div className="flex items-start gap-4 pointer-events-auto">
            <button onClick={onExit} className="px-6 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white uppercase tracking-widest text-sm font-bold shadow-lg transition-all">
              <LogOut size={20} className="inline mr-2" /> End Game
            </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
         <Canvas shadows>
            {/* Camera looking slightly down and forward */}
            <PerspectiveCamera makeDefault position={[0, 5, 18]} rotation={[-0.15, 0, 0]} fov={45} />
            <Environment preset="city" />
            <ambientLight intensity={0.4} />
            {/* Neon Lights */}
            <pointLight position={[0, 5, 5]} intensity={2} color="#06b6d4" castShadow />
            <pointLight position={[0, 8, -40]} intensity={3} color="#ec4899" distance={50} />
            
            <Physics gravity={[0, -30, 0]} defaultContactMaterial={{ friction: 0.1, restitution: 0.4 }}>
               <Lane />
               <group key={resetCounter}>
                 <Ball roomId={roomId} onThrow={handleThrow} />
                 {PIN_POSITIONS.map((pos, i) => (
                    <Pin 
                       key={i}
                       id={i}
                       position={pos}
                       onFallen={(id) => fallenPinsRef.current.add(id)}
                    />
                 ))}
               </group>
            </Physics>
         </Canvas>
      </div>
      
    </div>
  );
}
