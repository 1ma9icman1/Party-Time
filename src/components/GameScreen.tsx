import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { socket } from "../socket";
import { Player } from "../types";
import { generateLevel } from "../game/levels";
import { db, auth } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Crown } from "lucide-react";

interface GameScreenProps {
  roomId: string;
  players: Player[];
  isSolo?: boolean;
  onExit: () => void;
}

export default function GameScreen({ roomId, players, isSolo, onExit }: GameScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const birdRef = useRef<Matter.Body | null>(null);
  const slingConstraintRef = useRef<Matter.Constraint | null>(null);
  const pigsLeftRef = useRef<number>(0);
  const birdLaunchedRef = useRef<boolean>(false);
  const levelCompleteRef = useRef<boolean>(false);
  
  const [level, setLevel] = useState(1);
  const [turnIndex, setTurnIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [levelComplete, setLevelComplete] = useState(false);
  
  const turnIndexRef = useRef(turnIndex);
  useEffect(() => { turnIndexRef.current = turnIndex; }, [turnIndex]);
  
  const SLING_ORIGIN = { x: 200, y: 400 };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // 1. Setup Matter.js Engine (ONCE)
    const engine = Matter.Engine.create();
    engineRef.current = engine;
    
    const render = Matter.Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: 1200,
        height: 600,
        background: 'transparent',
        wireframes: false,
        hasBounds: true
      }
    });
    renderRef.current = render;

    Matter.Render.run(render);
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    // Collision detection for pigs scoring
    Matter.Events.on(engine, 'collisionStart', (event) => {
      if (!birdLaunchedRef.current) return; // Prevent instant death on level load

      event.pairs.forEach(pair => {
        const a = pair.bodyA;
        const b = pair.bodyB;
        if (a.label === 'pig' || b.label === 'pig') {
          // Calculate relative collision speed
          const speedA = a.speed || 0;
          const speedB = b.speed || 0;
          if (speedA > 2 || speedB > 2) {
             const pig = a.label === 'pig' ? a : b;
             if (!pig.plugin.popped) {
                 pig.plugin.popped = true;
                 Matter.World.remove(engine.world, pig);
                 pigsLeftRef.current -= 1;
                 setScore(s => s + 500);
                 
                 if (pigsLeftRef.current <= 0 && !levelCompleteRef.current) {
                     levelCompleteRef.current = true;
                     handleLevelComplete();
                 }
             }
          }
        }
      });
    });

    // Socket Event Listeners (Attach once)
    const onSlingDrag = (data: { playerId: string, dx: number, dy: number }) => {
      if (players[turnIndexRef.current]?.id !== data.playerId && !isSolo) return;
      if (birdRef.current && slingConstraintRef.current) {
        const limit = 120; // Max drag distance
        let dx = data.dx;
        let dy = data.dy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > limit) {
          dx = (dx / dist) * limit;
          dy = (dy / dist) * limit;
        }
        Matter.Body.setPosition(birdRef.current, { 
          x: SLING_ORIGIN.x - dx, 
          y: SLING_ORIGIN.y - dy 
        });
      }
    };

    const onSlingRelease = (data: { playerId: string, dx: number, dy: number }) => {
      if (players[turnIndexRef.current]?.id !== data.playerId && !isSolo) return;
      if (birdRef.current && slingConstraintRef.current) {
        Matter.World.remove(engine.world, slingConstraintRef.current);
        slingConstraintRef.current = null;
        birdLaunchedRef.current = true;
        
        const forceMultiplier = 0.04;
        Matter.Body.applyForce(birdRef.current, birdRef.current.position, {
          x: data.dx * forceMultiplier,
          y: data.dy * forceMultiplier
        });
        
        // Wait for physics to settle, then next turn if level not complete
        setTimeout(() => {
          if (!levelCompleteRef.current && engineRef.current) {
             setTurnIndex(prev => {
                const next = (prev + 1) % players.length;
                if (!isSolo) socket.emit("turnUpdate", roomId, players[next]?.id);
                return next;
             });
             spawnBird(engineRef.current);
          }
        }, 7000);
      }
    };

    socket.on("slingDrag", onSlingDrag);
    socket.on("slingRelease", onSlingRelease);

    // Load Initial Level
    buildLevel(level, engine);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      render.canvas.remove();
      socket.off("slingDrag", onSlingDrag);
      socket.off("slingRelease", onSlingRelease);
    };
  }, []); // Run ONCE on mount

  // Watch for level changes and rebuild
  useEffect(() => {
    if (engineRef.current && level > 1) {
       buildLevel(level, engineRef.current);
    }
  }, [level]);

  const spawnBird = (engine: Matter.Engine) => {
    birdLaunchedRef.current = false;

    // Clean up old bird if it exists
    if (birdRef.current) {
      Matter.World.remove(engine.world, birdRef.current);
    }
    if (slingConstraintRef.current) {
      Matter.World.remove(engine.world, slingConstraintRef.current);
    }

    const bird = Matter.Bodies.circle(SLING_ORIGIN.x, SLING_ORIGIN.y, 16, {
      label: 'bird',
      restitution: 0.5,
      density: 0.005,
      friction: 0.5,
      render: { fillStyle: '#ff0055', strokeStyle: '#ff99cc', lineWidth: 3 }
    });
    birdRef.current = bird;
    Matter.World.add(engine.world, bird);

    const constraint = Matter.Constraint.create({
      pointA: SLING_ORIGIN,
      bodyB: bird,
      stiffness: 0.04,
      damping: 0.1,
      render: { strokeStyle: '#06b6d4', lineWidth: 3 }
    });
    slingConstraintRef.current = constraint;
    Matter.World.add(engine.world, constraint);
  };

  const buildLevel = (levelIdx: number, engine: Matter.Engine) => {
    Matter.World.clear(engine.world, false);
    levelCompleteRef.current = false;
    birdLaunchedRef.current = false;
    
    // Add Ground
    const ground = Matter.Bodies.rectangle(600, 580, 1200, 40, { 
      isStatic: true,
      friction: 1,
      render: { fillStyle: '#0a001a', strokeStyle: '#e81cff', lineWidth: 4 }
    });
    Matter.World.add(engine.world, ground);

    // Load definitions
    const def = generateLevel(levelIdx);
    pigsLeftRef.current = def.pigs.length;
    
    // Create Blocks (Neon Theme)
    def.blocks.forEach(b => {
      const colors = {
        glass: { fill: 'rgba(6,182,212,0.1)', stroke: '#06b6d4' },
        wood: { fill: 'rgba(236,72,153,0.1)', stroke: '#ec4899' },
        stone: { fill: 'rgba(168,85,247,0.1)', stroke: '#a855f7' }
      };
      const block = Matter.Bodies.rectangle(b.x, b.y, b.w, b.h, {
        label: 'block',
        friction: 0.8,
        restitution: 0.1,
        density: b.type === 'stone' ? 0.005 : b.type === 'wood' ? 0.002 : 0.001,
        render: { fillStyle: colors[b.type].fill, strokeStyle: colors[b.type].stroke, lineWidth: 2 }
      });
      Matter.World.add(engine.world, block);
    });

    // Create Pigs
    def.pigs.forEach(p => {
      const pig = Matter.Bodies.circle(p.x, p.y, p.radius || 15, {
        label: 'pig',
        density: 0.002,
        restitution: 0.4,
        friction: 0.8,
        render: { fillStyle: 'rgba(34,197,94,0.2)', strokeStyle: '#22c55e', lineWidth: 3 }
      });
      pig.plugin = { popped: false };
      Matter.World.add(engine.world, pig);
    });

    // Add Sling Base
    const slingBase = Matter.Bodies.rectangle(SLING_ORIGIN.x, SLING_ORIGIN.y + 70, 20, 140, {
      isStatic: true,
      collisionFilter: { mask: 0 },
      render: { fillStyle: '#1a103c', strokeStyle: '#06b6d4', lineWidth: 2 }
    });
    Matter.World.add(engine.world, slingBase);

    // Spawn first bird
    spawnBird(engine);
    
    // Reset turns for new level
    setTurnIndex(0);
    if (!isSolo) socket.emit("turnUpdate", roomId, players[0]?.id);
  };
  
  const handleLevelComplete = async () => {
      setLevelComplete(true);
      
      if (auth.currentUser) {
          try {
              await setDoc(doc(db, "users", auth.currentUser.uid), {
                  userId: auth.currentUser.uid,
                  maxLevelUnlocked: level + 1,
                  stars: { [level]: 3 },
                  updatedAt: serverTimestamp()
              }, { merge: true });
          } catch (e) {
              console.error("Failed to save progress", e);
          }
      }
  };
  
  const handleNextLevel = () => {
      setLevelComplete(false);
      setLevel(l => l + 1); // Triggers useEffect to rebuild level
  };

  return (
    <div className="w-full h-full bg-[#050014] flex flex-col items-center justify-center relative overflow-hidden" ref={containerRef}>
      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none" 
           style={{
             backgroundImage: 'linear-gradient(to right, #e81cff15 1px, transparent 1px), linear-gradient(to bottom, #e81cff15 1px, transparent 1px)',
             backgroundSize: '50px 50px',
             transform: 'perspective(600px) rotateX(60deg) translateY(-50px) translateZ(-200px)',
             height: '200%'
           }} 
      />

      {/* Top HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex gap-4">
          {players.map((p, i) => (
            <div key={p.id} className={`p-4 rounded-xl border-2 transition-all backdrop-blur-md ${i === turnIndex ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.8)] scale-110' : 'bg-slate-900/40 border-slate-700 opacity-70'}`}>
              <div className="flex items-center gap-2">
                 <span className="text-xs uppercase tracking-widest text-slate-300">{p.name}</span>
                 {i === 0 && !isSolo && <Crown size={12} className="text-yellow-400" />}
              </div>
              <div className="text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                 {isSolo ? score : (i === turnIndex ? score : p.score || 0)}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          <div className="text-5xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.8)] uppercase">
            SECTOR {level}
          </div>
          <button onClick={onExit} className="px-6 py-2 bg-slate-900/80 border border-pink-500/50 rounded-lg text-pink-400 hover:bg-pink-900/50 hover:text-white uppercase tracking-widest text-sm font-bold shadow-[0_0_10px_rgba(236,72,153,0.3)] transition-all">
            Abandon Mission
          </button>
        </div>
      </div>

      {/* Game Canvas container with CSS drop-shadow to create massive Neon Glow */}
      <div className="w-[1200px] h-[600px] relative z-0 border border-cyan-500/30 rounded-2xl overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#12002f] to-[#050014] shadow-[0_0_30px_rgba(6,182,212,0.2)]">
        <canvas ref={canvasRef} className="w-full h-full drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
      </div>
      
      {/* Bottom HUD (Bird Selection mockup) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-10 pointer-events-none">
        {[1, 2, 3].map((b) => (
          <div key={b} className={`w-16 h-20 rounded-xl border-2 ${b === 1 ? 'border-pink-500 bg-pink-950/60 shadow-[0_0_20px_rgba(236,72,153,0.6)]' : 'border-slate-700 bg-slate-900/50'} flex items-center justify-center relative backdrop-blur-md`}>
            <div className={`w-10 h-10 rounded-full ${b === 1 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : b === 2 ? 'bg-yellow-400 opacity-50' : 'bg-black opacity-50'} border-2 ${b === 1 ? 'border-white' : 'border-transparent'}`}></div>
          </div>
        ))}
      </div>

      {/* Level Complete Modal */}
      <AnimatePresence>
        {levelComplete && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
          >
            <div className="bg-[#0a001a] border-4 border-cyan-400 rounded-3xl p-12 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(6,182,212,0.6)]">
               <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 tracking-widest uppercase drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">
                 SECTOR CLEARED
               </h2>
               
               <div className="flex gap-6 my-6">
                  {[1,2,3].map(s => (
                    <motion.div 
                      key={s} 
                      initial={{ rotate: -180, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: s * 0.2, type: 'spring' }}
                      className="text-7xl text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,1)]"
                    >
                      ★
                    </motion.div>
                  ))}
               </div>

               <div className="text-4xl font-black text-white mb-8 tracking-widest flex items-center gap-4">
                 SCORE: <span className="text-pink-400">{score}</span>
               </div>

               <button 
                 onClick={handleNextLevel}
                 className="px-16 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 rounded-xl font-black text-3xl uppercase tracking-widest text-white shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all transform hover:scale-105 active:scale-95"
               >
                 NEXT SECTOR
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
