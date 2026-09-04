export interface LevelDef {
  id: number;
  name: string;
  pigs: { x: number, y: number, radius?: number }[];
  blocks: { x: number, y: number, w: number, h: number, type: 'glass' | 'wood' | 'stone' }[];
}

export function generateLevel(levelIndex: number): LevelDef {
  const blocks: LevelDef['blocks'] = [];
  const pigs: LevelDef['pigs'] = [];
  
  const difficulty = Math.min(levelIndex / 50, 1);
  const startX = 600;
  const groundY = 500; // Adjusted for better physics settling

  // Helper to add a block
  const addBlock = (x: number, y: number, w: number, h: number, type: 'glass' | 'wood' | 'stone') => {
    blocks.push({ x, y, w, h, type });
  };

  // Helper to add a pig
  const addPig = (x: number, y: number, radius = 15) => {
    pigs.push({ x, y, radius });
  };

  // Helper to build a tower
  const buildTower = (x: number, floors: number, material: 'glass' | 'wood' | 'stone') => {
    for (let f = 0; f < floors; f++) {
      const y = groundY - (f * 70);
      addBlock(x - 35, y - 25, 20, 50, material);
      addBlock(x + 35, y - 25, 20, 50, material);
      addBlock(x, y - 60, 100, 20, material);
      if (f === floors - 1 || Math.random() < 0.3) addPig(x, y - 85);
    }
  };

  // Helper to build a pyramid
  const buildPyramid = (x: number, baseWidth: number, material: 'glass' | 'wood' | 'stone') => {
    for (let i = 0; i < baseWidth; i++) {
      for (let j = 0; j < baseWidth - i; j++) {
        const px = x + (j * 60) - ((baseWidth - i - 1) * 30);
        const py = groundY - (i * 60) - 30;
        addBlock(px, py, 50, 50, material);
        if (j % 2 === 0 && i > 0) addPig(px, py - 40, 12);
      }
    }
    addPig(x, groundY - (baseWidth * 60) - 20, 18);
  };

  // Deterministic layout selection based on level index (1-50)
  const pattern = levelIndex % 5;
  const scale = 1 + Math.floor(levelIndex / 10); // Increases every 10 levels
  
  const getMat = (l: number) => l < 15 ? 'glass' : l < 35 ? 'wood' : 'stone';
  const mat1 = getMat(levelIndex);
  const mat2 = getMat(levelIndex + 10);

  if (levelIndex === 1) {
    // Tutorial level
    addBlock(700, groundY - 25, 20, 50, 'glass');
    addBlock(760, groundY - 25, 20, 50, 'glass');
    addBlock(730, groundY - 60, 100, 20, 'glass');
    addPig(730, groundY - 85, 18);
  } else {
    // Procedural but deterministic layouts based on pattern
    switch (pattern) {
      case 0: // Twin Towers
        buildTower(startX, scale + 1, mat1);
        buildTower(startX + 200, scale + 1, mat2);
        addPig(startX + 100, groundY - 20, 20); // Pig between towers
        break;
      case 1: // Pyramid
        buildPyramid(startX + 100, scale + 2, mat1);
        break;
      case 2: // Fortress
        buildTower(startX - 50, scale, mat2);
        buildTower(startX + 150, scale, mat2);
        addBlock(startX + 50, groundY - (scale * 70) - 25, 220, 20, mat1); // Roof bridge
        addPig(startX + 50, groundY - 20, 25); // Boss pig inside
        addPig(startX + 50, groundY - (scale * 70) - 50, 15); // Roof pig
        break;
      case 3: // Scattered Pillars
        for (let i = 0; i < scale + 2; i++) {
          const px = startX - 50 + (i * 90);
          addBlock(px, groundY - 40, 20, 80, mat1);
          addPig(px, groundY - 95, 15);
        }
        break;
      case 4: // Bunker
        addBlock(startX + 100, groundY - 20, 200, 40, mat2); // Thick base
        addBlock(startX + 20, groundY - 70, 40, 60, mat2);
        addBlock(startX + 180, groundY - 70, 40, 60, mat2);
        addBlock(startX + 100, groundY - 110, 200, 20, mat2); // Thick roof
        addPig(startX + 100, groundY - 70, 20); // Protected pig
        buildTower(startX + 100, scale, mat1); // Tower on top of bunker
        break;
    }
  }

  // Ensure at least 1 pig exists if generator failed
  if (pigs.length === 0) {
    addPig(startX + 100, groundY - 20);
  }

  return {
    id: levelIndex,
    name: levelIndex === 1 ? 'TRAINING SECTOR' : `SECTOR ${levelIndex}`,
    pigs,
    blocks
  };
}
