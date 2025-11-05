import { rnd, clamp } from './utils.js';
import { CLOUD_SIZE, FENCE_SIZE, SPACING, PROGRESSION } from './config.js';

// Спавн препятствий
export function spawnObstacle(state, IMGS, getAspect) {
  const t = Math.random();
  const groundY = state.metrics.groundY;

  // Прогресс скорости 0..1
  const prog = clamp(
      (state.speed - PROGRESSION.speedStart) /
      Math.max(1, PROGRESSION.maxSpeed - PROGRESSION.speedStart),
      0, 1
  );

  // Минимальный зазор по "времени реакции"
  const last = state.obstacles[state.obstacles.length - 1];
  if (last) {
    const spawnX = state.metrics.VW + 10;
    const lastRight = last.x + last.w;
    const dist = spawnX - lastRight;

    const baseStartTime =
        last.kind === 'lowcloud'
            ? (SPACING.reactTimeSecCloud ?? 0.4)
            : (SPACING.reactTimeSecFence ?? 0.7);

    const kTo = clamp(SPACING.speedGapFactorTo ?? 0.8, 0.4, 1.0);
    const timeEff = baseStartTime * (1 - prog + prog * kTo);

    const minGapPx = state.speed * timeEff + state.player.w * (SPACING.extraSheepWidths ?? 0.4);

    if (dist < minGapPx) {
      const need = (minGapPx - dist) / Math.max(1, state.speed);
      state.obstTimer = Math.max(state.obstTimer, need);
      return;
    }
  }

  if (t < 0.65) {
    // Забор
    const usePx = Number.isFinite(FENCE_SIZE?.minPx) || Number.isFinite(FENCE_SIZE?.maxPx);
    let hMin = usePx ? (FENCE_SIZE.minPx ?? 12) : state.player.h * (FENCE_SIZE?.hMinFactor ?? 1.0);
    let hMax = usePx ? (FENCE_SIZE.maxPx ?? hMin) : state.player.h * (FENCE_SIZE?.hMaxFactor ?? 1.2);
    if (hMax < hMin) [hMin, hMax] = [hMax, hMin];

    const maxFenceH = Math.max(12, groundY - 20);
    const desiredH = clamp(rnd(hMin, hMax), 12, maxFenceH);
    const aspect = getAspect('fence', 0.6); // ширина = высота * aspect
    const w = desiredH * aspect;

    state.obstacles.push({ kind: 'fence', x: state.metrics.VW + 10, y: groundY - desiredH, w, h: desiredH });
    state.runTicks = (state.runTicks || 0) + 1;

    // Двойной
    if (Math.random() < (SPACING.doubleFenceChance ?? 0.4)) {
      const baseMinW = SPACING.doubleFenceGapW?.min ?? 1.6;
      const baseMaxW = SPACING.doubleFenceGapW?.max ?? 2.1;
      const sFrom = Math.max(0.2, SPACING.doubleFenceGapScaleFrom ?? 1.0);
      const sTo   = Math.max(0.2, SPACING.doubleFenceGapScaleTo   ?? 1.5);
      const scale = sFrom + (sTo - sFrom) * prog;

      const gapSheepW = rnd(baseMinW, baseMaxW) * scale;
      const gap = gapSheepW * state.player.w;

      const h2 = clamp(desiredH + rnd(-12, 12), 12, maxFenceH);
      const w2 = h2 * aspect;

      state.obstacles.push({ kind: 'fence', x: state.metrics.VW + 10 + w + gap, y: groundY - h2, w: w2, h: h2 });
      state.runTicks = (state.runTicks || 0) + 1;
    }
  } else {
    // Низкое облако — фикс нижняя грань хитбокса
    const s = CLOUD_SIZE.low;
    const desiredH = rnd(s.hMin, s.hMax) * s.scale;
    const aspect = getAspect('cloud', 2.5);
    const w = desiredH * aspect;

    const cfg = state.hitbox.lowcloud;
    const cloudBottom = groundY - (state.player.h * state.playerDuckHeight + s.clearance);
    const y = cloudBottom - desiredH * (1 - (cfg?.bottom ?? 0));

    state.obstacles.push({ kind: 'lowcloud', x: state.metrics.VW + 10, y, w, h: desiredH });
    state.runTicks = (state.runTicks || 0) + 1;
  }
}

// Движение и очистка
export function updateObstacles(state, dt) {
  const vx = state.speed;
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const o = state.obstacles[i];
    o.x -= vx * dt;
    if (o.x + o.w < -20) state.obstacles.splice(i, 1);
  }
}