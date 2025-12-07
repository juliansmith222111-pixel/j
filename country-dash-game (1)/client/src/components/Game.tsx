import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: "jump" | "run";
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "spike" | "platform";
}

type GameScreen = "menu" | "levelSelect" | "playing" | "gameover";

// Fixed level design - spawns at specific x positions
const LEVEL_1_OBSTACLES = [
  { spawnX: 800, type: "spike" as const },
  { spawnX: 1200, type: "platform" as const, width: 100 },
  { spawnX: 1600, type: "spike" as const },
  { spawnX: 2000, type: "platform" as const, width: 80 },
  { spawnX: 2400, type: "spike" as const },
  { spawnX: 2800, type: "platform" as const, width: 120 },
  { spawnX: 3200, type: "spike" as const },
  { spawnX: 3600, type: "platform" as const, width: 90 },
  { spawnX: 4000, type: "spike" as const },
  { spawnX: 4400, type: "platform" as const, width: 110 },
  { spawnX: 4800, type: "spike" as const },
  { spawnX: 5200, type: "platform" as const, width: 100 },
  { spawnX: 5600, type: "spike" as const },
  { spawnX: 6000, type: "platform" as const, width: 95 },
  { spawnX: 6400, type: "spike" as const },
  { spawnX: 6800, type: "platform" as const, width: 110 },
];

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<GameScreen>("menu");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(
    typeof window !== "undefined" ? parseInt(localStorage.getItem("highScore") || "0") : 0
  );
  const [selectedLevel, setSelectedLevel] = useState(1);

  // Game state refs
  const playerRef = useRef({
    x: 100,
    y: 0,
    width: 40,
    height: 40,
    velocityY: 0,
    isGrounded: false,
    rotation: 0,
  });

  const gameStateRef = useRef({
    scrollX: 0,
    spawnedObstacles: new Set<number>(),
  });

  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const gameRunningRef = useRef(false);
  const runParticleCounterRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  const GRAVITY = 0.6;
  const JUMP_FORCE = -14;
  const PLATFORM_HEIGHT = 80;
  const GROUND_Y_OFFSET = PLATFORM_HEIGHT;
  const SCROLL_SPEED = 4.2; // pixels per frame - slightly faster Geometry Dash pace

  // Generate jump particles when player jumps
  const generateJumpParticles = (x: number, y: number, count: number = 5) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * (2 + Math.random() * 2),
        vy: Math.sin(angle) * (2 + Math.random() * 2) - 1,
        life: 1,
        maxLife: 1,
        size: 3 + Math.random() * 3,
        type: "jump",
      });
    }
  };

  // Generate running particles that trail behind the character
  const generateRunParticles = (x: number, y: number) => {
    particlesRef.current.push({
      x: x - 5 - Math.random() * 10,
      y: y + 30 + Math.random() * 10,
      vx: -2 - Math.random() * 1.5,
      vy: Math.random() * 1 - 0.5,
      life: 1,
      maxLife: 0.8,
      size: 2 + Math.random() * 2,
      type: "run",
    });
  };

  const startGame = (level: number) => {
    setScreen("playing");
    setSelectedLevel(level);
    setScore(0);

    playerRef.current = {
      x: 100,
      y: 0,
      width: 40,
      height: 40,
      velocityY: 0,
      isGrounded: false,
      rotation: 0,
    };

    gameStateRef.current = {
      scrollX: 0,
      spawnedObstacles: new Set(),
    };

    obstaclesRef.current = [];
    particlesRef.current = [];
    runParticleCounterRef.current = 0;
    gameRunningRef.current = true;
  };

  const goToMenu = () => {
    setScreen("menu");
    gameRunningRef.current = false;
  };

  const goToLevelSelect = () => {
    setScreen("levelSelect");
  };

  const resetGame = () => {
    setScreen("gameover");
    gameRunningRef.current = false;
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("highScore", score.toString());
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && screen === "playing") {
      e.preventDefault();
      if (playerRef.current.isGrounded) {
        playerRef.current.velocityY = JUMP_FORCE;
        playerRef.current.isGrounded = false;
        generateJumpParticles(playerRef.current.x + playerRef.current.width / 2, playerRef.current.y + playerRef.current.height, 5);
      }
    }
  };

  const handleCanvasClick = () => {
    if (screen === "playing" && playerRef.current.isGrounded) {
      playerRef.current.velocityY = JUMP_FORCE;
      playerRef.current.isGrounded = false;
      generateJumpParticles(playerRef.current.x + playerRef.current.width / 2, playerRef.current.y + playerRef.current.height, 5);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const platformY = canvas.height - GROUND_Y_OFFSET;

    const gameLoop = () => {
      // Clear canvas with background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#0f0518");
      gradient.addColorStop(0.5, "#1a0a2e");
      gradient.addColorStop(1, "#16213e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid background
      ctx.strokeStyle = "rgba(255, 0, 255, 0.15)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      const offset = gameStateRef.current.scrollX % gridSize;

      for (let x = -offset; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // PLAYING SCREEN
      if (screen === "playing" && gameRunningRef.current) {
        if (playerRef.current.y === 0) {
          playerRef.current.y = platformY - playerRef.current.height;
        }

        // Update player physics
        playerRef.current.velocityY += GRAVITY;
        playerRef.current.y += playerRef.current.velocityY;
        playerRef.current.rotation += 0.05;

        // Platform collision (main floor)
        if (playerRef.current.y + playerRef.current.height >= platformY) {
          playerRef.current.y = platformY - playerRef.current.height;
          playerRef.current.velocityY = 0;
          playerRef.current.isGrounded = true;
          playerRef.current.rotation = 0;
        } else {
          playerRef.current.isGrounded = false;
        }

        // Generate running particles when on ground
        if (playerRef.current.isGrounded) {
          runParticleCounterRef.current++;
          if (runParticleCounterRef.current > 3) {
            generateRunParticles(playerRef.current.x, playerRef.current.y);
            runParticleCounterRef.current = 0;
          }
        }

        // Scroll the world
        gameStateRef.current.scrollX += SCROLL_SPEED;

        // Spawn obstacles from fixed level design
        LEVEL_1_OBSTACLES.forEach((obstacleData, index) => {
          const screenSpawnX = canvas.width + 50;
          const worldSpawnX = gameStateRef.current.scrollX + screenSpawnX;

          if (!gameStateRef.current.spawnedObstacles.has(index) && worldSpawnX >= obstacleData.spawnX) {
            gameStateRef.current.spawnedObstacles.add(index);

            if (obstacleData.type === "spike") {
              obstaclesRef.current.push({
                x: screenSpawnX,
                y: platformY - 50,
                width: 35,
                height: 50,
                type: "spike",
              });
            } else {
              obstaclesRef.current.push({
                x: screenSpawnX,
                y: platformY - 100,
                width: obstacleData.width,
                height: 20,
                type: "platform",
              });
            }
          }
        });

        // Update obstacles
        obstaclesRef.current.forEach((obs) => {
          obs.x -= SCROLL_SPEED;

          if (obs.type === "spike") {
            // Spike always kills on contact
            if (
              playerRef.current.x < obs.x + obs.width &&
              playerRef.current.x + playerRef.current.width > obs.x &&
              playerRef.current.y < obs.y + obs.height &&
              playerRef.current.y + playerRef.current.height > obs.y
            ) {
              resetGame();
            }
          } else if (obs.type === "platform") {
            // Platform collision - only die on sides and top corners
            const playerBottom = playerRef.current.y + playerRef.current.height;
            const playerTop = playerRef.current.y;
            const playerLeft = playerRef.current.x;
            const playerRight = playerRef.current.x + playerRef.current.width;

            const obsTop = obs.y;
            const obsBottom = obs.y + obs.height;
            const obsLeft = obs.x;
            const obsRight = obs.x + obs.width;

            // Check if player is overlapping with platform
            if (playerRight > obsLeft && playerLeft < obsRight && playerBottom > obsTop && playerTop < obsBottom) {
              // Safe landing on top (from above)
              if (playerRef.current.velocityY >= 0 && playerBottom - obsTop < 15 && playerBottom - obsTop > -5) {
                // Landing on top - safe
                playerRef.current.y = obsTop - playerRef.current.height;
                playerRef.current.velocityY = 0;
                playerRef.current.isGrounded = true;
                playerRef.current.rotation = 0;
              } else if (playerBottom <= obsTop) {
                // Hitting from below (bottom of platform) - safe
                // Do nothing, let player pass through
              } else {
                // Hit from side or top corner - die
                resetGame();
              }
            }
          }
        });

        // Remove off-screen obstacles
        obstaclesRef.current = obstaclesRef.current.filter((obs) => obs.x + obs.width > 0);

        // Update score based on scroll distance
        // Only update score every 10 frames to reduce re-renders
        if (Math.floor(gameStateRef.current.scrollX / 10) % 10 === 0) {
          setScore(Math.floor(gameStateRef.current.scrollX / 10));
        }

        // Draw main platform
        ctx.fillStyle = "#00f3ff";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#00f3ff";
        ctx.fillRect(0, platformY, canvas.width, GROUND_Y_OFFSET);
        ctx.shadowBlur = 0;

        // Draw platform grid
        ctx.strokeStyle = "rgba(0, 243, 255, 0.3)";
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 20) {
          ctx.beginPath();
          ctx.moveTo(x, platformY);
          ctx.lineTo(x, platformY + GROUND_Y_OFFSET);
          ctx.stroke();
        }

        // Draw obstacles
        obstaclesRef.current.forEach((obs) => {
          if (obs.type === "platform") {
            // Draw platform - purple like Super Mario
            ctx.fillStyle = "#9d4edd";
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#9d4edd";
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

            // Platform outline
            ctx.strokeStyle = "#c77dff";
            ctx.lineWidth = 2;
            ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
            ctx.shadowBlur = 0;

            // Platform details (blocks on top)
            ctx.fillStyle = "#c77dff";
            const blockSize = 15;
            for (let i = 0; i < obs.width; i += blockSize) {
              ctx.fillRect(obs.x + i, obs.y - 3, blockSize - 2, 3);
            }
          } else if (obs.type === "spike") {
            // Draw spike
            ctx.fillStyle = "#ff0055";
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#ff0055";

            ctx.beginPath();
            ctx.moveTo(obs.x + obs.width / 2, obs.y);
            ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
            ctx.lineTo(obs.x, obs.y + obs.height);
            ctx.closePath();
            ctx.fill();

            // Spike outline
            ctx.strokeStyle = "#ff00ff";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        });

        // Draw particles
        particlesRef.current.forEach((p) => {
          if (p.type === "jump") {
            ctx.fillStyle = `rgba(0, 243, 255, ${p.life})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#00f3ff";
          } else {
            // Running particles - more subtle
            ctx.fillStyle = `rgba(0, 243, 255, ${p.life * 0.6})`;
            ctx.shadowBlur = 5;
            ctx.shadowColor = "#00f3ff";
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        });

        // Update particles
        particlesRef.current.forEach((p, index) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.15; // gravity
          p.life -= 1 / p.maxLife / 30;

          if (p.life <= 0) {
            particlesRef.current.splice(index, 1);
          }
        });

        // Draw player (unique square design)
        ctx.save();
        ctx.translate(playerRef.current.x + playerRef.current.width / 2, playerRef.current.y + playerRef.current.height / 2);
        ctx.rotate(playerRef.current.rotation);

        // Main cube body
        ctx.fillStyle = "#00f3ff";
        ctx.shadowBlur = 25;
        ctx.shadowColor = "#00f3ff";
        ctx.fillRect(-playerRef.current.width / 2, -playerRef.current.height / 2, playerRef.current.width, playerRef.current.height);

        // Inner glow
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(-playerRef.current.width / 2, -playerRef.current.height / 2, playerRef.current.width, playerRef.current.height);

        // Circuit pattern
        ctx.strokeStyle = "rgba(255, 0, 255, 0.6)";
        ctx.lineWidth = 1;
        const innerPad = 8;
        ctx.strokeRect(
          -playerRef.current.width / 2 + innerPad,
          -playerRef.current.height / 2 + innerPad,
          playerRef.current.width - innerPad * 2,
          playerRef.current.height - innerPad * 2
        );

        // Corner dots
        ctx.fillStyle = "#ff00ff";
        const dotSize = 3;
        const corners = [
          [-playerRef.current.width / 2 + 5, -playerRef.current.height / 2 + 5],
          [playerRef.current.width / 2 - 5, -playerRef.current.height / 2 + 5],
          [-playerRef.current.width / 2 + 5, playerRef.current.height / 2 - 5],
          [playerRef.current.width / 2 - 5, playerRef.current.height / 2 - 5],
        ];
        corners.forEach((corner) => {
          ctx.beginPath();
          ctx.arc(corner[0], corner[1], dotSize, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore();

        // Draw UI
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = "bold 24px 'Courier New'";
        ctx.textAlign = "left";
        ctx.fillText(`DISTANCE: ${Math.floor(score)}`, 20, 40);
        ctx.fillText(`HIGH: ${highScore}`, 20, 70);
        ctx.textAlign = "right";
        ctx.fillText(`SPEED: 1.0x`, canvas.width - 20, 40);
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [screen]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      {screen === "menu" && (
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-lg">
            COUNTRY DASH
          </h1>
          <p className="text-white text-lg font-mono">Jump on platforms and avoid spikes!</p>
          <button
            onClick={() => goToLevelSelect()}
            className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xl rounded border-2 border-cyan-400 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_30px_rgba(6,182,212,0.6)]"
          >
            PLAY
          </button>
        </div>
      )}

      {screen === "levelSelect" && (
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          <h1 className="text-5xl font-black text-cyan-400 drop-shadow-lg">SELECT LEVEL</h1>
          <button
            onClick={() => startGame(1)}
            className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xl rounded border-2 border-cyan-400 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_30px_rgba(6,182,212,0.6)]"
          >
            LEVEL 1
          </button>
          <p className="text-gray-400 text-sm font-mono">(More levels coming soon!)</p>
        </div>
      )}

      {screen === "playing" && (
        <div className="relative overflow-hidden rounded-lg border-2 border-cyan-500 bg-black shadow-[0_0_50px_rgba(0,243,255,0.3)]">
          <canvas
            ref={canvasRef}
            className="w-full h-[600px] block cursor-pointer bg-black"
            onClick={handleCanvasClick}
          />
        </div>
      )}

      {screen === "gameover" && (
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          <h1 className="text-6xl font-black text-red-500 drop-shadow-lg">GAME OVER</h1>
          <p className="text-white text-3xl font-bold font-mono">DISTANCE: {Math.floor(score)}</p>
          <div className="flex gap-4">
            <button
              onClick={() => startGame(selectedLevel)}
              className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xl rounded border-2 border-cyan-400 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_30px_rgba(6,182,212,0.6)]"
            >
              RETRY
            </button>
            <button
              onClick={() => goToMenu()}
              className="px-12 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-black font-bold text-xl rounded border-2 border-purple-400 hover:from-purple-400 hover:to-pink-500 transition-all shadow-[0_0_30px_rgba(168,85,247,0.6)]"
            >
              MENU
            </button>
          </div>
        </div>
      )}

      {screen === "playing" && (
        <div className="mt-4 text-center text-cyan-400 font-mono text-sm">
          <p>Click canvas or press SPACE to jump</p>
        </div>
      )}
    </div>
  );
}
