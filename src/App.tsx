import { useEffect, useState } from "react";
import MainMenu from "./components/MainMenu";
import HostScreen from "./components/HostScreen";
import ControllerScreen from "./components/ControllerScreen";

export default function App() {
  const [view, setView] = useState<'menu' | 'host' | 'controller' | 'solo'>('menu');
  const [roomId, setRoomId] = useState<string>('');

  useEffect(() => {
    // Check URL parameters for easy joining via QR
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
      setView('controller');
    }
  }, []);

  return (
    <div className="w-full h-screen bg-slate-950 text-white font-sans overflow-hidden">
      {view === 'menu' && (
        <MainMenu 
          onHost={() => setView('host')}
          onJoin={(code) => { setRoomId(code); setView('controller'); }}
          onSolo={() => setView('solo')}
        />
      )}
      {view === 'host' && (
        <HostScreen onBack={() => setView('menu')} />
      )}
      {view === 'controller' && (
        <ControllerScreen roomId={roomId} onLeave={() => setView('menu')} />
      )}
      {view === 'solo' && (
        <HostScreen isSolo={true} onBack={() => setView('menu')} />
      )}
    </div>
  );
}
