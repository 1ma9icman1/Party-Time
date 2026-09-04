import React from 'react';

const BowlingPinIcon = () => (
  <svg width="24" height="44" viewBox="0 0 24 44" fill="transparent" stroke="#22d3ee" strokeWidth="2" className="inline-block transform -translate-y-2">
    <path d="M12 2 C8 2 8 8 10 12 C11 14 11 16 10 18 C7 24 6 30 6 36 C6 41 9 42 12 42 C15 42 18 41 18 36 C18 30 17 24 14 18 C13 16 13 14 14 12 C16 8 16 2 12 2 Z" />
    <path d="M8.5 24 Q 12 26 15.5 24" stroke="#ec4899" strokeWidth="2" />
    <path d="M7.5 28 Q 12 30 16.5 28" stroke="#ec4899" strokeWidth="2" />
  </svg>
);

export function CircularText() {
  const phrase = ["P", "PIN", "N", "\u00A0", "P", "A", "R", "T", "Y", "\u00A0", "✦", "\u00A0"];
  const repetitions = 5;
  const totalChars = phrase.length * repetitions;
  const radius = 220;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">
      {Array.from({ length: repetitions }).map((_, i) =>
        phrase.map((char, j) => {
          const index = i * phrase.length + j;
          // Offset by -90 deg so we start at the top, though since it spins it doesn't matter much.
          const angle = (index / totalChars) * 360;
          return (
            <div
              key={index}
              className="absolute flex items-center justify-center text-[44px] font-black"
              style={{
                transform: `rotate(${angle}deg) translateY(-${radius}px)`,
                transformOrigin: "center center",
                color: "transparent",
                WebkitTextStroke: char === "PIN" ? "0px" : "2px #22d3ee",
                width: "30px", // fixed width helps ensure even spacing
                textAlign: "center",
              }}
            >
              {char === "PIN" ? <BowlingPinIcon /> : char}
            </div>
          );
        })
      )}
    </div>
  );
}
