import {
  VW, VH, GROUND_OFFSET, PHYSICS, PROGRESSION, BG_TIMERS,
  PLAYER_BOX, HITBOX,
  PLAYER_BASE_SIZE, SHEEP_SCALE
} from './config.js';

export function createState() {
  const groundY = VH - GROUND_OFFSET;
  const size = Math.round(PLAYER_BASE_SIZE * SHEEP_SCALE);

  return {
    // Метрики
    metrics: { VW, VH, groundY },

    // Состояние процесса
    started: false,
    running: false,
    gameOver: false,

    // Прогресс
    score: 0,

    // Данные текущего забега
    challenge: null,       // одноразовый challenge от сервера
    runTicks: 0,           // количество сгенерированных препятствий (для proof)

    // Физика/скорость
    gravity: PHYSICS.gravity,
    jumpVel: PHYSICS.jumpVel,
    maxFall: PHYSICS.maxFall,
    speed: PROGRESSION.speedStart,
    maxSpeed: PROGRESSION.maxSpeed,
    accelPerSec: PROGRESSION.accelPerSec,

    // Игрок (увеличенный размер)
    player: { x: 90, y: groundY - size, w: size, h: size, vy: 0, onGround: true, duck: false },
    playerDuckHeight: PLAYER_BOX.duckHeight,

    // Анимация овечки
    anim: { runPhase: 0, runFrame: 0 },

    // Коллекции
    obstacles: [],
    bgClouds: [],
    stars: [],

    // Таймеры
    obstTimer: 0,
    obstInterval: PROGRESSION.obstIntervalBase,
    bgCloudTimer: 0,
    bgCloudInterval: BG_TIMERS.cloudInterval,

    hitbox: HITBOX,
  };
}

export function resetGame(state) {
  const { groundY } = state.metrics;
  const size = Math.round(PLAYER_BASE_SIZE * SHEEP_SCALE);

  state.speed = PROGRESSION.speedStart;
  state.score = 0;
  state.obstacles.length = 0;
  state.bgClouds.length = 0;
  state.stars.length = 0;
  state.obstTimer = 0;
  state.bgCloudTimer = 0;

  // Данные забега
  state.runTicks = 0;

  // Сброс игрока
  state.player = { x: 90, y: groundY - size, w: size, h: size, vy: 0, onGround: true, duck: false };

  state.gameOver = false;
  state.anim.runPhase = 0;
  state.anim.runFrame = 0;
}