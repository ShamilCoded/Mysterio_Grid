'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Trophy, RefreshCw, Settings, Play, Image as ImageIcon, Check, Lock, AlertCircle, Upload, Undo2, Volume2, VolumeX, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLocalStorage } from 'usehooks-ts';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/audio';

// Types
type GridSize = 3 | 4 | 5 | 6;
type ThemeCategory = 'All' | 'Nature' | 'Urban' | 'Cozy' | 'Abstract' | 'Space' | 'Animals';

interface Theme {
  id: string;
  name: string;
  seed: string;
  category: ThemeCategory;
}

interface HighScore {
  moves: number;
  time: number; // in seconds
}

// Config
const THEMES: Theme[] = [
  { id: '1', name: 'Autumn Path', seed: 'autumnpath', category: 'Nature' },
  { id: '2', name: 'Tea Garden', seed: 'flowerteaparty', category: 'Cozy' },
  { id: '3', name: 'Coastal Town', seed: 'coastaltown', category: 'Urban' },
  { id: '4', name: 'Cozy Cabin', seed: 'cozycabin', category: 'Cozy' },
  { id: '5', name: 'Neon City', seed: 'neoncity', category: 'Urban' },
  { id: '6', name: 'Forest Magic', seed: 'forestmagic', category: 'Nature' },
  { id: '7', name: 'Desert Oasis', seed: 'desertoasis', category: 'Nature' },
  { id: '8', name: 'Cyberpunk', seed: 'cyberpunk', category: 'Urban' },
  { id: '9', name: 'Galaxy Colors', seed: 'galaxycolors12', category: 'Space' },
  { id: '10', name: 'Deep Nebula', seed: 'deepnebula3', category: 'Space' },
  { id: '11', name: 'Starry Night', seed: 'starrynight1', category: 'Space' },
  { id: '12', name: 'Abstract Art', seed: 'abstractart123', category: 'Abstract' },
  { id: '13', name: 'Fluid Colors', seed: 'fluidcolors12', category: 'Abstract' },
  { id: '14', name: 'Geometric Pattern', seed: 'geometricpattern4', category: 'Abstract' },
  { id: '15', name: 'Cute Dog', seed: 'cutedoggie2', category: 'Animals' },
  { id: '16', name: 'Wild Tiger', seed: 'wildtiger5', category: 'Animals' },
  { id: '17', name: 'Mountain Peak', seed: 'mountainpeak8', category: 'Nature' },
  { id: '18', name: 'Retro Sci-fi', seed: 'retroscifi1', category: 'Space' },
  { id: '19', name: 'Zen Garden', seed: 'zengarden1', category: 'Nature' },
  { id: '20', name: 'Rainy Cafe', seed: 'rainycafe3', category: 'Cozy' },
  { id: '21', name: 'Crystal Cave', seed: 'crystalcave9', category: 'Nature' },
  { id: '22', name: 'Modern Architecture', seed: 'modernarch1', category: 'Urban' },
];

const GRID_SIZES: GridSize[] = [3, 4, 5, 6];

// Helpers
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const isSolvable = (board: number[], gridSize: number) => {
  let inversions = 0;
  const puzzle = board.filter((n) => n !== gridSize * gridSize - 1); // remove empty

  for (let i = 0; i < puzzle.length - 1; i++) {
    for (let j = i + 1; j < puzzle.length; j++) {
      if (puzzle[i] > puzzle[j]) {
        inversions++;
      }
    }
  }

  if (gridSize % 2 !== 0) {
    return inversions % 2 === 0;
  } else {
    const emptyIndex = board.indexOf(gridSize * gridSize - 1);
    const emptyRowFromBottom = gridSize - Math.floor(emptyIndex / gridSize);
    if (emptyRowFromBottom % 2 === 0) {
      return inversions % 2 !== 0;
    } else {
      return inversions % 2 === 0;
    }
  }
};

const getBackgroundPos = (originalIndex: number, gridSize: number) => {
  const x = originalIndex % gridSize;
  const y = Math.floor(originalIndex / gridSize);
  const percentX = (x / (gridSize - 1)) * 100;
  const percentY = (y / (gridSize - 1)) * 100;
  
  // Need to handle when gridSize is 1 (impossible here, but good for math safety)
  return `${percentX}% ${percentY}%`;
};

export default function SlidingPuzzle() {
  const [gridSize, setGridSize] = useLocalStorage<GridSize>('sliding-puzzle-grid-size', 3);
  const [activeThemeId, setActiveThemeId] = useLocalStorage<string>('sliding-puzzle-theme', '1');
  const [customImageData, setCustomImageData] = useLocalStorage<string | null>('sliding-puzzle-custom-image', null);
  const [highScores, setHighScores] = useLocalStorage<Record<number, HighScore>>('sliding-puzzle-scores', {});
  const [soundEnabled, setSoundEnabled] = useLocalStorage<boolean>('sliding-puzzle-sound', true);
  const [themeFilter, setThemeFilter] = useState<ThemeCategory>('All');
  const [touchStartPos, setTouchStartPos] = useState<{x: number, y: number} | null>(null);

  const activeTheme = THEMES.find((t) => t.id === activeThemeId) || THEMES[0];
  const filteredThemes = themeFilter === 'All' ? THEMES : THEMES.filter(t => t.category === themeFilter);
  const imageUrl = activeThemeId === 'custom' && customImageData ? customImageData : `https://picsum.photos/seed/${activeTheme.seed}/800/800`;

  const [board, setBoard] = useState<number[]>([]);
  const [boardHistory, setBoardHistory] = useState<number[][]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        
        canvas.width = maxDim;
        canvas.height = maxDim;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, startX, startY, size, size, 0, 0, maxDim, maxDim);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setCustomImageData(dataUrl);
          setActiveThemeId('custom');
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Initialize Solved Board
  useEffect(() => {
    if (!isPlaying && !isWon) {
      setBoard(Array.from({ length: gridSize * gridSize }, (_, i) => i));
    }
  }, [gridSize, isPlaying, isWon]);

  // Interactive Confetti on Win
  useEffect(() => {
    if (!isWon) return;
    
    let lastTime = 0;
    const handleMouseMove = (e: MouseEvent) => {
        const now = Date.now();
        if (now - lastTime < 75) return;
        lastTime = now;
        
        confetti({
            particleCount: 6,
            spread: 45,
            origin: { 
                x: e.clientX / window.innerWidth,
                y: e.clientY / window.innerHeight
            },
            colors: ['#22c55e', '#ec4899', '#3b82f6', '#f59e0b'],
            startVelocity: 15,
            ticks: 80,
            zIndex: 150
        });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isWon]);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !isWon) {
      interval = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isWon]);

  const startGame = useCallback((sizeOverride?: GridSize | React.MouseEvent) => {
    const targetSize = typeof sizeOverride === 'number' ? sizeOverride : gridSize;
    const totalTiles = targetSize * targetSize;
    let newBoard = Array.from({ length: totalTiles }, (_, i) => i);
    
    // We shuffle by randomly walking the empty tile to guarantee a solvable state.
    let emptyIndex = totalTiles - 1;
    const shuffleMoves = targetSize * targetSize * 15;
    
    for (let i = 0; i < shuffleMoves; i++) {
        const validMoves = [];
        const ex = emptyIndex % targetSize;
        const ey = Math.floor(emptyIndex / targetSize);
        
        if (ex > 0) validMoves.push(emptyIndex - 1);
        if (ex < targetSize - 1) validMoves.push(emptyIndex + 1);
        if (ey > 0) validMoves.push(emptyIndex - targetSize);
        if (ey < targetSize - 1) validMoves.push(emptyIndex + targetSize);
        
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        [newBoard[emptyIndex], newBoard[randomMove]] = [newBoard[randomMove], newBoard[emptyIndex]];
        emptyIndex = randomMove;
    }

    if (typeof sizeOverride === 'number') {
      setGridSize(targetSize as GridSize);
    }
    setBoard([...newBoard]);
    setBoardHistory([]);
    setIsPlaying(true);
    setIsWon(false);
    setMoves(0);
    setTime(0);
    playSound('click', soundEnabled);
  }, [gridSize, soundEnabled, setGridSize]);

  const quitGame = () => {
    setIsPlaying(false);
    setIsWon(false);
    setTime(0);
    setMoves(0);
    setBoardHistory([]);
    setBoard(Array.from({ length: gridSize * gridSize }, (_, i) => i));
    playSound('click', soundEnabled);
  };

  const handleTileClick = (originalIndex: number) => {
    if (!isPlaying || isWon) return;

    const currentIndex = board.indexOf(originalIndex);
    const emptyOriginalIndex = gridSize * gridSize - 1;
    const emptyIndex = board.indexOf(emptyOriginalIndex);

    const currentX = currentIndex % gridSize;
    const currentY = Math.floor(currentIndex / gridSize);
    const emptyX = emptyIndex % gridSize;
    const emptyY = Math.floor(emptyIndex / gridSize);

    const isAdjacent = Math.abs(currentX - emptyX) + Math.abs(currentY - emptyY) === 1;

    if (isAdjacent) {
      const newBoard = [...board];
      [newBoard[currentIndex], newBoard[emptyIndex]] = [newBoard[emptyIndex], newBoard[currentIndex]];
      setBoardHistory((prev) => [...prev, board]);
      setBoard(newBoard);
      setMoves((m) => m + 1);
      playSound('slide', soundEnabled);

      // Check Win
      if (newBoard.every((val, i) => val === i)) {
        setIsWon(true);
        setIsPlaying(false);
        playSound('win', soundEnabled);
        
        // Initial celebration burst
        const end = Date.now() + 2000;
        const colors = ['#22c55e', '#ec4899', '#3b82f6', '#f59e0b'];
        (function frame() {
            confetti({
                particleCount: 4,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.8 },
                colors: colors,
                zIndex: 100
            });
            confetti({
                particleCount: 4,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.8 },
                colors: colors,
                zIndex: 100
            });
            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());

        // Update High Score
        const currentHighScore = highScores[gridSize];
        if (!currentHighScore || time < currentHighScore.time || (time === currentHighScore.time && moves < currentHighScore.moves)) {
          setHighScores((prev) => ({
            ...prev,
            [gridSize]: { moves: moves + 1, time } // +1 for the final move
          }));
        }
      }
    }
  };

  const handleUndo = () => {
    if (boardHistory.length === 0 || isWon || !isPlaying) return;
    const previousBoard = boardHistory[boardHistory.length - 1];
    setBoard(previousBoard);
    setBoardHistory((prev) => prev.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
    playSound('slide', soundEnabled);
  };

  const emptyOriginalIndex = gridSize * gridSize - 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos || !isPlaying || isWon) return;
    const dx = e.changedTouches[0].clientX - touchStartPos.x;
    const dy = e.changedTouches[0].clientY - touchStartPos.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 30) { // minimum swipe distance of 30px
      const emptyIndex = board.indexOf(emptyOriginalIndex);
      const emptyX = emptyIndex % gridSize;
      const emptyY = Math.floor(emptyIndex / gridSize);
      let targetIndex = -1;

      if (absDx > absDy) {
        if (dx > 0 && emptyX > 0) targetIndex = emptyIndex - 1; // Swipe Right
        else if (dx < 0 && emptyX < gridSize - 1) targetIndex = emptyIndex + 1; // Swipe Left
      } else {
        if (dy > 0 && emptyY > 0) targetIndex = emptyIndex - gridSize; // Swipe Down
        else if (dy < 0 && emptyY < gridSize - 1) targetIndex = emptyIndex + gridSize; // Swipe Up
      }

      if (targetIndex !== -1) {
        handleTileClick(board[targetIndex]);
      }
    }
    setTouchStartPos(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500/30 relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-150 mix-blend-overlay"></div>
         <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-violet-600/30 blur-[120px] animate-pulse mix-blend-screen" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[80vw] h-[80vw] rounded-full bg-blue-500/20 blur-[150px] animate-pulse mix-blend-screen" style={{ animationDelay: '2s', animationDuration: '7s' }} />
         <div className="absolute top-[30%] left-[50%] w-[50vw] h-[50vw] rounded-full bg-fuchsia-500/20 blur-[100px] animate-pulse mix-blend-screen" style={{ animationDelay: '4s', animationDuration: '8s' }} />
      </div>
      
      {/* Container for content above background */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
            MG
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Mysterio Grid</h1>
        </div>
        <button
          onClick={() => {
            setShowSettings(!showSettings);
            playSound('click', soundEnabled);
          }}
          className="p-2 -mr-2 text-slate-300 hover:bg-white/10 rounded-full transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8 lg:gap-12 relative overflow-hidden">
        
        {/* Settings Panel Drawer (Mobile) or Side Panel (Desktop) */}
        {showSettings && (
          <motion.div 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             className="lg:w-80 flex-shrink-0 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-8 h-fit"
          >
            {isPlaying && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 mb-2 text-amber-800">
                 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                 <div className="text-sm">
                    <p className="font-semibold">Game in Progress</p>
                    <p className="opacity-90 mt-0.5 leading-snug">Settings cannot be changed now. Quit the current game to configure.</p>
                 </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Grid Size
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {GRID_SIZES.map((size) => {
                  return (
                    <button
                      key={size}
                      disabled={isPlaying}
                      onClick={() => {
                        setGridSize(size as GridSize);
                        playSound('click', soundEnabled);
                      }}
                      className={cn(
                        "relative py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all overflow-hidden",
                        gridSize === size ? "border-indigo-600 bg-indigo-600/5 text-indigo-700 ring-1 ring-indigo-600" : "border-slate-200 hover:border-slate-300 text-slate-600",
                        isPlaying && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <span className="font-semibold text-lg">{size}x{size}</span>
                      {gridSize === size ? (
                          <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                              <Check className="w-3 h-3" />
                              Active
                          </div>
                      ) : <div className="h-[18px]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Theme
              </h2>

              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {(['All', 'Nature', 'Urban', 'Cozy', 'Abstract', 'Space', 'Animals'] as ThemeCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setThemeFilter(cat);
                      playSound('click', soundEnabled);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors",
                      themeFilter === cat 
                        ? "bg-indigo-600 text-white" 
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredThemes.map((theme) => {
                  return (
                    <button
                      key={theme.id}
                      disabled={isPlaying}
                      onClick={() => {
                        setActiveThemeId(theme.id);
                        playSound('click', soundEnabled);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all",
                        activeThemeId === theme.id ? "border-indigo-600 bg-indigo-600/5 text-indigo-700 ring-1 ring-indigo-600" : "border-slate-200 hover:border-slate-300 text-slate-700",
                        isPlaying && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-md shadow-sm overflow-hidden relative border shrink-0 bg-slate-200 p-[1px] grid grid-cols-2 gap-[1px] border-slate-300")}>
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className={cn("w-full h-full relative overflow-hidden", i === 3 ? "bg-slate-50" : "bg-white")}>
                              {i !== 3 && (
                                <div 
                                  className="absolute inset-0"
                                  style={{
                                    backgroundImage: `url(https://picsum.photos/seed/${theme.seed}/100/100)`,
                                    backgroundSize: '200% 200%',
                                    backgroundPosition: `${(i % 2) * 100}% ${Math.floor(i / 2) * 100}%`
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-slate-800 truncate">{theme.name}</span>
                        </div>
                      </div>
                      {activeThemeId === theme.id && <Check className="w-5 h-5 text-indigo-600 shrink-0 ml-2" />}
                    </button>
                  )
                })}
              </div>

              <div className="relative pt-3 mt-3 border-t border-slate-200">
                  <input 
                    type="file" 
                    id="custom-image-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload} 
                    disabled={isPlaying}
                  />
                  <div
                      key="custom"
                      className={cn(
                        "w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer",
                        activeThemeId === 'custom' ? "border-indigo-600 bg-indigo-600/5 text-indigo-700 ring-1 ring-indigo-600" : "border-slate-200 hover:border-slate-300 text-slate-700",
                        isPlaying && "opacity-60 cursor-not-allowed",
                        !customImageData && activeThemeId !== 'custom' && "border-dashed"
                      )}
                      onClick={() => {
                        if (!isPlaying && customImageData) {
                          setActiveThemeId('custom');
                          playSound('click', soundEnabled);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <label 
                          htmlFor="custom-image-upload" 
                          className={cn(
                            "w-10 h-10 rounded-md shadow-sm overflow-hidden relative border shrink-0 bg-slate-200 p-[1px] grid grid-cols-2 gap-[1px]",
                             isPlaying ? "pointer-events-none" : "cursor-pointer hover:border-slate-400 border-slate-300"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {customImageData ? (
                            [0, 1, 2, 3].map((i) => (
                                <div key={i} className={cn("w-full h-full relative overflow-hidden", i === 3 ? "bg-slate-50" : "bg-white")}>
                                    {i !== 3 && (
                                        <div 
                                            className="absolute inset-0"
                                            style={{
                                                backgroundImage: `url(${customImageData})`,
                                                backgroundSize: '200% 200%',
                                                backgroundPosition: `${(i % 2) * 100}% ${Math.floor(i / 2) * 100}%`
                                            }}
                                        />
                                    )}
                                </div>
                            ))
                          ) : (
                            <div className="absolute col-span-2 row-span-2 inset-0 bg-slate-50 flex items-center justify-center">
                                <Upload className="w-4 h-4 text-slate-500" />
                            </div>
                          )}
                        </label>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium text-slate-800 truncate">Custom Image</span>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                            {customImageData ? 'Click icon to change' : 'Upload an image'}
                          </span>
                        </div>
                      </div>
                       {activeThemeId === 'custom' && <Check className="w-5 h-5 text-indigo-600 shrink-0 ml-2" />}
                    </div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-slate-200">
               <button
                  onClick={() => {
                     setSoundEnabled(!soundEnabled);
                     playSound('click', true); // Play sound even if we just enabled it
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
               >
                 <div className="flex items-center gap-3">
                   {soundEnabled ? <Volume2 className="w-5 h-5 text-indigo-600" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
                   <span>Sound Effects</span>
                 </div>
                 <div className={cn(
                   "w-11 h-6 rounded-full transition-colors relative",
                   soundEnabled ? "bg-indigo-600" : "bg-slate-300"
                 )}>
                   <div className={cn(
                     "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                     soundEnabled ? "translate-x-5" : "translate-x-0"
                   )} />
                 </div>
               </button>
            </div>

            {(time > 0 || isPlaying) && (
              <button 
                onClick={quitGame}
                className="w-full py-2 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors"
               >
                Quit Current Game
              </button>
            )}
          </motion.div>
        )}

        {/* Game Area */}
        <div className="flex-1 mx-auto w-full flex flex-col items-center">
          
          {/* Stats Bar */}
          <div className="w-full lg:max-w-[65vh] flex items-center justify-between mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex gap-6">
               <div className="flex flex-col">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time</span>
                 <span className="font-mono text-xl font-bold tracking-tight text-slate-700">{formatTime(time)}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Moves</span>
                 <span className="font-mono text-xl font-bold tracking-tight text-slate-700">{moves}</span>
               </div>
            </div>

            {isPlaying ? (
               <div className="flex gap-2">
                 <button 
                  onClick={handleUndo}
                  disabled={boardHistory.length === 0}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Undo2 className="w-4 h-4" /> <span className="hidden sm:inline">Undo</span>
                 </button>
                 <button 
                  onClick={startGame}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-full bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
                 >
                   <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Restart</span>
                 </button>
                 <button 
                  onClick={quitGame}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-full bg-red-50 text-red-600 font-medium hover:bg-red-100 border border-red-100 transition-colors"
                 >
                   <X className="w-4 h-4" /> <span className="hidden sm:inline">Quit</span>
                 </button>
               </div>
            ) : (
                <button 
                onClick={startGame}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-sm transition-colors"
               >
                 <Play className="w-4 h-4 fill-current" /> Play Now
               </button>
            )}
          </div>

          {/* Puzzle Board Container */}
          <div className="w-full lg:max-w-[65vh] relative aspect-square bg-white border-2 sm:border-4 border-white shadow-xl rounded-xl sm:rounded-2xl overflow-hidden touch-none p-0.5 sm:p-1 mb-8">
            <div 
              className="w-full h-full relative"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
                gap: '2px', // tiny gap for better aesthetics, or 0 for seamless
                backgroundColor: '#cbd5e1' // slate-300 gap color
              }}
            >
              {board.map((originalIndex, currentIndex) => {
                const isEmpty = originalIndex === emptyOriginalIndex;
                
                // When we win, fill in the empty piece!
                const hideEmpty = isEmpty && !isWon;

                return (
                  <motion.div
                    layout
                    initial={false}
                    animate={{ 
                      opacity: hideEmpty ? 0 : 1,
                      scale: hideEmpty ? 0.9 : 1
                    }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 400, 
                      damping: 30, 
                      mass: 0.8 
                    }}
                    whileHover={isPlaying && !isWon && !isEmpty ? { scale: 0.96, zIndex: 10, borderRadius: '8px' } : {}}
                    whileTap={isPlaying && !isWon && !isEmpty ? { scale: 0.9, rotate: originalIndex % 2 === 0 ? 2 : -2, zIndex: 10 } : {}}
                    key={originalIndex}
                    onClick={() => handleTileClick(originalIndex)}
                    className={cn(
                      "relative w-full h-full bg-slate-100 cursor-pointer overflow-hidden group shadow-sm",
                      hideEmpty && "pointer-events-none",
                      !isPlaying && !isWon && "pointer-events-none" // Disable clicking when not playing
                    )}
                    style={{
                      borderRadius: isWon ? '0px' : '6px',
                    }}
                  >
                    <div 
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                        backgroundPosition: getBackgroundPos(originalIndex, gridSize),
                        transition: 'filter 0.3s ease',
                        filter: (!isPlaying && !isWon && !isEmpty) ? 'grayscale(0.5) opacity(0.8)' : 'none'
                      }}
                    />
                    
                    {/* Number Overlay overlay (optional, makes it easier if image is confusing) */}
                    {!isEmpty && isPlaying && (
                       <div className="absolute inset-0 flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 bg-black/40 lg:bg-black/20 text-white font-bold text-xl sm:text-2xl drop-shadow-md transition-opacity pointer-events-none">
                         {originalIndex + 1}
                       </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Overlays */}
            {!isPlaying && !isWon && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center border border-slate-100 max-w-sm text-center">
                        <ImageIcon className="w-12 h-12 text-indigo-200 mb-4" />
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">Ready to Play?</h3>
                        <p className="text-slate-500 mb-6">Unscramble the tiles to build the complete image. Select your grid size and theme above.</p>
                        <button 
                            onClick={startGame}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-95"
                        >
                            <Play className="w-5 h-5 fill-current" /> Start Game
                        </button>
                    </div>
                </div>
            )}

            {isWon && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-500">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-slate-100 text-center animate-in zoom-in-95 duration-500 delay-150 relative overflow-hidden">
                        
                        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-6 shadow-inner">
                            <Trophy className="w-8 h-8" />
                        </div>
                        
                        <h3 className="text-3xl font-bold text-slate-800 mb-2">Puzzle Solved!</h3>
                        <p className="text-slate-500 mb-6 font-medium">You completed the {gridSize}x{gridSize} grid</p>
                        
                        <div className="flex gap-4 mb-8 w-full">
                            <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Time</p>
                                <p className="text-2xl font-mono text-slate-700 font-bold">{formatTime(time)}</p>
                            </div>
                            <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Moves</p>
                                <p className="text-2xl font-mono text-slate-700 font-bold">{moves}</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <button 
                                onClick={startGame}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-100 text-slate-700 font-semibold text-lg hover:bg-slate-200 shadow-sm transition-all active:scale-95 border border-slate-200"
                            >
                                <RefreshCw className="w-5 h-5" /> Play Again
                            </button>
                            {gridSize < 6 && (
                              <button 
                                  onClick={() => startGame((gridSize + 1) as GridSize)}
                                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                              >
                                  Next Level <Play className="w-5 h-5 fill-current" />
                              </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* High Scores (Mobile mainly, or bottom page) */}
          <div className="mt-8 sm:mt-12 w-full max-w-4xl pb-16">
             <div className="flex items-center gap-3 mb-6">
               <Trophy className="w-6 h-6 text-amber-500" />
               <h2 className="text-xl font-bold text-slate-800">Local High Scores</h2>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                 {GRID_SIZES.map((size) => {
                     const score = highScores[size];
                     return (
                         <div key={size} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                             <div className="flex items-center justify-between">
                                 <span className="font-bold text-slate-700">{size}x{size} Grid</span>
                                 {score && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Record</span>}
                             </div>
                             {score ? (
                                 <div className="flex justify-between items-end mt-2">
                                     <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time</p>
                                        <p className="font-mono font-semibold text-lg text-slate-700">{formatTime(score.time)}</p>
                                     </div>
                                     <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Moves</p>
                                        <p className="font-mono font-semibold text-lg text-slate-700">{score.moves}</p>
                                     </div>
                                 </div>
                             ) : (
                                 <div className="py-4 text-center">
                                     <p className="text-sm text-slate-400 font-medium">No record yet</p>
                                 </div>
                             )}
                         </div>
                     )
                 })}
             </div>
          </div>
        </div>
      </main>
      
      {/* Credit Footer */}
      <div className="fixed bottom-4 right-4 z-50 text-slate-400 text-xs font-medium tracking-wide drop-shadow-md">
        Created by <span className="text-slate-200 font-bold">ShamilCoded</span>
      </div>
      </div>
    </div>
  );
}
