/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Heart, RefreshCw, Play } from 'lucide-react';

// --- Audio Engine ---
class SoundEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playCollision() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playScore() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playGameOver() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 1);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1);
  }
}

const sounds = new SoundEngine();

// --- Game Constants ---
const INITIAL_HEALTH = 100;
const METEOR_SPAWN_RATE = 0.05;
const TRAIL_LIFETIME = 60; // frames

// --- Types ---
interface Point {
  x: number;
  y: number;
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;

  constructor(x: number, y: number, color: string, size: number = 2) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.maxLife = Math.random() * 30 + 20;
    this.life = this.maxLife;
    this.color = color;
    this.size = size;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;

  constructor(width: number, height: number, level: number) {
    const side = Math.floor(Math.random() * 4);
    const margin = 50;
    
    if (side === 0) { // top
      this.x = Math.random() * width;
      this.y = -margin;
    } else if (side === 1) { // right
      this.x = width + margin;
      this.y = Math.random() * height;
    } else if (side === 2) { // bottom
      this.x = Math.random() * width;
      this.y = height + margin;
    } else { // left
      this.x = -margin;
      this.y = Math.random() * height;
    }

    const targetX = width / 2 + (Math.random() - 0.5) * width * 0.8;
    const targetY = height / 2 + (Math.random() - 0.5) * height * 0.8;
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    const speed = (Math.random() * 3 + 2) * (1 + level * 0.1);
    
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = Math.random() * 10 + 5;
    
    const colors = [
      { fill: 'rgba(255, 100, 100, 0.6)', glow: '#ff4444' },
      { fill: 'rgba(100, 255, 100, 0.6)', glow: '#44ff44' },
      { fill: 'rgba(100, 100, 255, 0.6)', glow: '#4444ff' },
      { fill: 'rgba(255, 255, 100, 0.6)', glow: '#ffff44' },
      { fill: 'rgba(255, 100, 255, 0.6)', glow: '#ff44ff' },
      { fill: 'rgba(100, 255, 255, 0.6)', glow: '#44ffff' },
    ];
    const choice = colors[Math.floor(Math.random() * colors.length)];
    this.color = choice.fill;
    this.glowColor = choice.glow;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.glowColor;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(INITIAL_HEALTH);
  const [flash, setFlash] = useState(false);
  const [highScore, setHighScore] = useState(0);

  // Game refs
  const playerPos = useRef<Point>({ x: 0, y: 0 });
  const meteors = useRef<Meteor[]>([]);
  const particles = useRef<Particle[]>([]);
  const trail = useRef<{ x: number, y: number, hue: number }[]>([]);
  const frameCount = useRef(0);
  const lastTime = useRef(0);

  const resetGame = useCallback(() => {
    setScore(0);
    setHealth(INITIAL_HEALTH);
    meteors.current = [];
    particles.current = [];
    trail.current = [];
    frameCount.current = 0;
    setGameState('playing');
  }, []);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = (e as React.MouseEvent).clientX - rect.left;
      y = (e as React.MouseEvent).clientY - rect.top;
    }
    playerPos.current = { x, y };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (gameState === 'start') {
        playerPos.current = { x: canvas.width / 2, y: canvas.height / 2 };
      }
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;

    const loop = (time: number) => {
      if (gameState === 'playing') {
        frameCount.current++;
        const level = Math.floor(frameCount.current / 600);
        
        // Update score
        if (frameCount.current % 10 === 0) {
          setScore(s => s + 1);
        }

        // Spawn meteors
        if (Math.random() < METEOR_SPAWN_RATE + level * 0.005) {
          meteors.current.push(new Meteor(canvas.width, canvas.height, level));
        }

        // Update trail
        trail.current.push({ ...playerPos.current, hue: (frameCount.current * 2) % 360 });
        if (trail.current.length > TRAIL_LIFETIME) {
          trail.current.shift();
        }

        // Update meteors
        meteors.current.forEach((m, index) => {
          m.update();
          
          // Collision check
          const dx = m.x - playerPos.current.x;
          const dy = m.y - playerPos.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < m.radius + 40) {
            // Collision!
            setHealth(h => {
              const next = h - 10;
              if (next <= 0) {
                setGameState('gameover');
                sounds.playGameOver();
                return 0;
              }
              return next;
            });
            sounds.playCollision();
            setFlash(true);
            setTimeout(() => setFlash(false), 100);

            // Explosion particles
            for (let i = 0; i < 20; i++) {
              particles.current.push(new Particle(m.x, m.y, '#ffffff', 3));
              particles.current.push(new Particle(m.x, m.y, m.glowColor, 2));
            }
            meteors.current.splice(index, 1);
          }

          // Remove off-screen
          if (m.x < -100 || m.x > canvas.width + 100 || m.y < -100 || m.y > canvas.height + 100) {
            meteors.current.splice(index, 1);
          }
        });

        // Update particles
        particles.current.forEach((p, index) => {
          p.update();
          if (p.life <= 0) particles.current.splice(index, 1);
        });
      }

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (flash) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw trail
      trail.current.forEach((p, i) => {
        const alpha = i / trail.current.length;
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30 * alpha, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw player (Earth)
      if (gameState !== 'gameover') {
        const { x, y } = playerPos.current;
        const radius = 40;

        // Atmosphere Glow
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#4488ff';
        
        // Ocean (Deep Blue)
        ctx.fillStyle = '#1a4a9e';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Continents (Green Blobs)
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.clip();
        
        const rotation = frameCount.current * 0.005;
        ctx.translate(x, y);
        ctx.rotate(rotation);
        
        ctx.fillStyle = '#2d8a4e';
        // Draw some random landmasses
        const drawLand = (lx: number, ly: number, lr: number) => {
          ctx.beginPath();
          ctx.arc(lx, ly, lr, 0, Math.PI * 2);
          ctx.fill();
        };
        drawLand(-15, -10, 20);
        drawLand(20, 15, 15);
        drawLand(5, -25, 12);
        drawLand(-25, 20, 10);
        drawLand(30, -10, 8);
        
        // Clouds (White Wisps)
        ctx.rotate(rotation * 0.5); // Clouds move at different speed
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        const drawCloud = (cx: number, cy: number, cr: number) => {
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();
        };
        drawCloud(10, 5, 22);
        drawCloud(-20, -15, 18);
        drawCloud(15, -20, 15);
        
        ctx.restore();

        // Shading (3D Sphere Effect)
        const innerGrad = ctx.createRadialGradient(
          x - radius * 0.3, y - radius * 0.3, 0,
          x, y, radius
        );
        innerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        innerGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
        innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Rim Light
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw meteors
      meteors.current.forEach(m => m.draw(ctx));

      // Draw particles
      particles.current.forEach(p => p.draw(ctx));

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [gameState, flash]);

  useEffect(() => {
    if (score > highScore) setHighScore(score);
  }, [score, highScore]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans select-none">
      {/* Dynamic Gradient Background */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute inset-0 animate-gradient-bg bg-gradient-to-br from-purple-900 via-pink-900 to-cyan-900 blur-3xl scale-150" />
      </div>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        className="absolute inset-0 cursor-none touch-none"
      />

      {/* UI Overlay: Score */}
      <div className="absolute top-8 left-8 z-10">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-widest text-cyan-400/60 font-mono">Mission Score</span>
          <span className="text-5xl font-bold text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] italic">
            {score.toString().padStart(6, '0')}
          </span>
        </div>
      </div>

      {/* UI Overlay: Health Ring */}
      <div className="absolute top-8 right-8 z-10 flex items-center gap-4">
        <div className="text-right">
          <span className="text-xs uppercase tracking-widest text-pink-400/60 font-mono">Shield Integrity</span>
          <div className="text-2xl font-bold text-white">{health}%</div>
        </div>
        <div className="relative w-16 h-16">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              className="text-gray-800"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={175.9}
              strokeDashoffset={175.9 * (1 - health / 100)}
              strokeLinecap="round"
              className={`transition-all duration-300 ${
                health < 30 ? 'text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]'
              }`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className={`w-6 h-6 ${health < 30 ? 'text-red-500' : 'text-cyan-400'}`} />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-300 to-white opacity-20 italic">
          流浪地球
        </h1>
      </div>

      {/* Start Screen */}
      <AnimatePresence>
        {gameState === 'start' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.h2
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-8xl font-black italic tracking-tighter text-white mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"
            >
              流浪地球
            </motion.h2>
            <p className="text-cyan-400 font-mono tracking-[0.3em] mb-12 uppercase">Wandering Earth: Meteor Escape</p>
            
            <button
              onClick={resetGame}
              className="group relative px-12 py-4 bg-white text-black font-bold text-xl rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10 flex items-center gap-2">
                <Play className="w-6 h-6 fill-current" />
                启动引擎 START ENGINE
              </span>
            </button>
            
            <div className="mt-12 grid grid-cols-2 gap-8 text-white/40 text-sm font-mono">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                鼠标/触摸 移动
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pink-500" />
                躲避彩色陨石
              </div>
            </div>
          </motion.div>
        )}

        {/* Game Over Screen */}
        {gameState === 'gameover' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/40 backdrop-blur-md"
          >
            <h2 className="text-7xl font-black italic text-white mb-2">任务中止</h2>
            <p className="text-red-400 font-mono tracking-widest mb-8">MISSION ABORTED</p>
            
            <div className="bg-black/40 p-8 rounded-2xl border border-white/10 mb-8 w-80">
              <div className="flex justify-between items-center mb-4">
                <span className="text-white/60 font-mono">FINAL SCORE</span>
                <span className="text-3xl font-bold text-white">{score}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60 font-mono">BEST RECORD</span>
                <span className="text-xl font-bold text-cyan-400">{highScore}</span>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-10 py-4 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              重新部署 RE-DEPLOY
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes gradient-bg {
          0% { transform: translate(-10%, -10%) rotate(0deg); }
          50% { transform: translate(10%, 10%) rotate(180deg); }
          100% { transform: translate(-10%, -10%) rotate(360deg); }
        }
        .animate-gradient-bg {
          animation: gradient-bg 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
