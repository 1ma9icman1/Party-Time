import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { socket } from "../socket";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics, useBox, useSphere, useCylinder } from "@react-three/cannon";
import { PerspectiveCamera, Grid, useTexture, Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { LogOut, Music } from "lucide-react";
import * as THREE from "three";
import { playSound } from "../utils/audio";

const PIN_POSITIONS: [number, number, number][] = [
    [0, 1, -45],
    [-0.8, 1, -46.5], [0.8, 1, -46.5],
    [-1.6, 1, -48], [0, 1, -48], [1.6, 1, -48],
    [-2.4, 1, -49.5], [-0.8, 1, -49.5], [0.8, 1, -49.5], [2.4, 1, -49.5]
];

const Pin = ({ position, onFallen, id }: { position: [number, number, number], onFallen: (id: number) => void, id: number }) => {
    const [ref, api] = useCylinder(() => ({
        mass: 1.5,
        position,
        args: [0.3, 0.45, 2], // physics approximation
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
                playSound('hit');
                onFallen(id);
            }
        }
    });

    const pinPoints = useMemo(() => {
        const pts = [];
        pts.push(new THREE.Vector2(0, 0));
        pts.push(new THREE.Vector2(0.25, 0));
        pts.push(new THREE.Vector2(0.35, 0.2));
        pts.push(new THREE.Vector2(0.45, 0.6));
        pts.push(new THREE.Vector2(0.4, 0.9));
        pts.push(new THREE.Vector2(0.2, 1.3));
        pts.push(new THREE.Vector2(0.15, 1.5)); // neck
        pts.push(new THREE.Vector2(0.22, 1.75)); // head
        pts.push(new THREE.Vector2(0.15, 1.95));
        pts.push(new THREE.Vector2(0, 2.0));
        return pts;
    }, []);

    return (
        <mesh ref={ref as any} castShadow>
            <latheGeometry args={[pinPoints, 32]} />
            <meshPhysicalMaterial 
                color="#000000" 
                emissive="#22d3ee"
                emissiveIntensity={1.5}
                roughness={0.1}
                clearcoat={1}
                wireframe={true}
            />
            {/* Upper Pink Stripe */}
            <mesh position={[0, 1.55, 0]}>
                <torusGeometry args={[0.16, 0.02, 16, 32]} />
                <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={3} />
            </mesh>
            {/* Lower Pink Stripe */}
            <mesh position={[0, 1.35, 0]}>
                <torusGeometry args={[0.2, 0.02, 16, 32]} />
                <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={3} />
            </mesh>
        </mesh>
    );
};

const Ball = ({ roomId, onThrow }: { roomId: string, onThrow: () => void }) => {
    const [ref, api] = useSphere(() => ({
        mass: 20,
        position: [0, 1, 10],
        args: [0.8],
        material: { friction: 0.1, restitution: 0.4 }
    }));

    const isThrown = useRef(false);
    const [aimPos, setAimPos] = useState(0);

    useEffect(() => {
        let currentAim = 0;

        const handleAim = (data: { aim: number }) => {
            if (!isThrown.current) {
                currentAim = data.aim;
                setAimPos(currentAim * 4);
                api.position.set(currentAim * 4, 1, 10);
                api.velocity.set(0,0,0);
                api.angularVelocity.set(0,0,0);
            }
        };
        
        const handleThrow = (data: { power: number, spin: number }) => {
            if (!isThrown.current) {
                isThrown.current = true;
                playSound('throw');
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
                handleThrow({ power: 2.5, spin: 0 });
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
        <group>
            {/* The Bowling Ball */}
            <mesh ref={ref as any} castShadow receiveShadow>
                <sphereGeometry args={[0.8, 32, 32]} />
                <meshStandardMaterial color="#06b6d4" emissive="#0284c7" emissiveIntensity={0.5} metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Aim Pointer (Wii style line on the ground) */}
            {!isThrown.current && (
                <mesh position={[aimPos, 0.05, -5]} rotation={[-Math.PI/2, 0, 0]}>
                    <planeGeometry args={[0.2, 28]} />
                    <meshBasicMaterial color="#06b6d4" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
                </mesh>
            )}
        </group>
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
                <shadowMaterial opacity={0.4} color="#000000" />
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
            {/* Gutters */}
            <mesh position={[-6, -0.25, -20]} visible={false}>
                <boxGeometry args={[2, 0.5, 100]} />
                <meshBasicMaterial />
            </mesh>
            <mesh position={[6, -0.25, -20]} visible={false}>
                <boxGeometry args={[2, 0.5, 100]} />
                <meshBasicMaterial />
            </mesh>
        </group>
    );
};

interface GameScreenProps {
  roomId: string;
  isSolo: boolean;
  players?: {id: string, name: string}[];
  onExit: () => void;
}

export default function GameScreen({ roomId, isSolo, players: initialPlayers, onExit }: GameScreenProps) {
  const [players, setPlayers] = useState<{id: string, name: string, score: number}[]>(() => {
     if (isSolo) return [{ id: "solo", name: "Player 1", score: 0 }];
     return initialPlayers ? initialPlayers.map(p => ({ ...p, score: 0 })) : [];
  });
  const [turnIndex, setTurnIndex] = useState(0);
  const [frame, setFrame] = useState(1);
  const [message, setMessage] = useState(players.length > 0 ? `${players[0].name.toUpperCase()} UP!` : "PLAYER 1 UP!");
  
  const [resetCounter, setResetCounter] = useState(0);
  const fallenPinsRef = useRef<Set<number>>(new Set());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(true);

  useEffect(() => {
    if (!isSolo && players.length > 0) {
      socket.emit("turnUpdate", roomId, players[0]?.id);
    }
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
      
      {/* 80s MP3 Audio */}
      {isPlayingMusic && (
          <audio 
            src="https://archive.org/download/80s-party-mix-80s-classic-hits-80s-greatest-hits-80s-mix_202408/80s%20Party%20Mix%2080s%20Classic%20Hits%2080s%20Greatest%20Hits%2080s%20Mix.mp3" 
            autoPlay 
            loop 
          />
      )}
      
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

        {/* Right: Controls */}
        <div className="flex items-start gap-4 pointer-events-auto">
            <button onClick={() => setIsPlayingMusic(!isPlayingMusic)} className={`px-4 py-3 border rounded-lg uppercase tracking-widest text-sm font-bold shadow-lg transition-all ${isPlayingMusic ? 'bg-pink-900 border-pink-500 text-pink-400 hover:bg-pink-800' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
              <Music size={20} className="inline mr-2" /> {isPlayingMusic ? 'Mute 80s' : 'Play 80s'}
            </button>
            <button onClick={onExit} className="px-6 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white uppercase tracking-widest text-sm font-bold shadow-lg transition-all">
              <LogOut size={20} className="inline mr-2" /> End Game
            </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
         <Canvas shadows>
            {/* Post-Processing for Glowing Neon */}
            <EffectComposer>
               <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} intensity={1.5} />
            </EffectComposer>
         
            {/* Camera */}
            <PerspectiveCamera makeDefault position={[0, 5, 18]} rotation={[-0.15, 0, 0]} fov={45} />
            <Environment preset="night" />
            <ambientLight intensity={0.2} />
            
            {/* Neon Lights */}
            <pointLight position={[0, 5, 5]} intensity={2} color="#06b6d4" castShadow />
            <pointLight position={[0, 8, -40]} intensity={4} color="#ec4899" distance={50} />
            <pointLight position={[0, 2, -48]} intensity={3} color="#22d3ee" distance={15} />
            
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
