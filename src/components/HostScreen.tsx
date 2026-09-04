import { useEffect, useState } from "react";
import { socket } from "../socket";
import { QRCodeSVG } from "qrcode.react";
import { Player } from "../types";
import GameScreen from "./GameScreen";
import { ArrowLeft, Play, Crown, Users } from "lucide-react";
import { motion } from "motion/react";

interface HostScreenProps {
  isSolo?: boolean;
  onBack: () => void;
}

export default function HostScreen({ isSolo = false, onBack }: HostScreenProps) {
  const [roomId, setRoomId] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');

  useEffect(() => {
    if (isSolo) {
      setPlayers([{ id: 'solo', name: 'Player 1', score: 0 }]);
      setGameState('playing');
      return;
    }

    socket.connect();
    socket.emit("createRoom");

    socket.on("roomCreated", (id: string) => {
      setRoomId(id);
    });

    socket.on("playerJoined", (player: Player) => {
      setPlayers((prev) => [...prev, { ...player, score: 0 }]);
    });

    socket.on("playerLeft", (player: Player) => {
      setPlayers((prev) => prev.filter((p) => p.id !== player.id));
    });

    return () => {
      socket.off("roomCreated");
      socket.off("playerJoined");
      socket.off("playerLeft");
      // Don't disconnect socket fully, let App handle it or leave room
    };
  }, [isSolo]);

  const joinUrl = `${window.location.origin}?room=${roomId}`;

  if (gameState === 'playing') {
    return <GameScreen roomId={roomId} players={players} isSolo={isSolo} onExit={onBack} />;
  }

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col p-8 text-white">
      <button onClick={onBack} className="absolute top-8 left-8 text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
        <ArrowLeft /> BACK
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full gap-12">
        <div className="text-center">
          <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] uppercase tracking-widest mb-4">
            TOURNAMENT LOBBY
          </h2>
          <p className="text-xl text-slate-400 uppercase tracking-widest">Awaiting Contenders</p>
        </div>

        <div className="flex flex-col md:flex-row w-full gap-12 items-center justify-center">
          {/* QR Code Section */}
          <div className="flex flex-col items-center p-8 bg-[#0a001a] border-2 border-purple-500/50 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.3)]">
            <h3 className="text-2xl text-purple-400 font-bold mb-6 tracking-widest">SCAN TO JOIN</h3>
            <div className="p-4 bg-white rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <div className="mt-6 flex flex-col items-center">
              <span className="text-slate-400 mb-2 uppercase text-sm tracking-widest">OR ENTER CODE</span>
              <div className="text-5xl font-mono font-black text-cyan-400 tracking-[0.3em]">{roomId}</div>
            </div>
          </div>

          {/* Players List */}
          <div className="flex-1 w-full max-w-md flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl text-cyan-400 font-bold tracking-widest flex items-center gap-2">
                <Users /> PLAYERS ({players.length}/4)
              </h3>
            </div>
            
            <div className="flex flex-col gap-3 min-h-[300px]">
              {players.length === 0 ? (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl">
                  <p className="text-slate-500 uppercase tracking-widest">Waiting for players...</p>
                </div>
              ) : (
                players.map((p, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={p.id} 
                    className="flex items-center gap-4 p-4 bg-slate-900/80 border border-cyan-500/30 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xl font-black">
                      {i + 1}
                    </div>
                    <span className="text-2xl font-bold text-white tracking-wider">{p.name}</span>
                    {i === 0 && <Crown className="ml-auto text-yellow-400" size={24} />}
                  </motion.div>
                ))
              )}
            </div>

            <button 
              onClick={() => setGameState('playing')}
              disabled={players.length === 0}
              className="mt-4 w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-2xl uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all flex items-center justify-center gap-3"
            >
              <Play size={28} /> Start Match
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
