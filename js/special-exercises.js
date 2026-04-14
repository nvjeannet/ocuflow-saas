'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// SPECIAL EXERCISES ENGINE — Canvas-based interactive exercises
// ══════════════════════════════════════════════════════════════════════════════

// ── SHARED UTILITIES ────────────────────────────────────────────────────────
const SpecialUtils = {
  rand: (min, max) => Math.random() * (max - min) + min,
  dist: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  formatTime: (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  }
};

// ── SCORING SYSTEM ──────────────────────────────────────────────────────────
class ScoreTracker {
  constructor() {
    this.clicks = 0;
    this.hits = 0;
    this.misses = 0;
    this.totalReactionMs = 0;
    this.bestReactionMs = Infinity;
    this.rounds = 0;
    this.bonuses = 0;
    this.startTime = 0;
  }

  start() { this.startTime = performance.now(); }

  recordHit(reactionMs, bonus = 0) {
    this.clicks++;
    this.hits++;
    this.rounds++;
    this.totalReactionMs += reactionMs;
    if (reactionMs < this.bestReactionMs) this.bestReactionMs = reactionMs;
    this.bonuses += bonus;
  }

  recordMiss() {
    this.clicks++;
    this.misses++;
  }

  get accuracy() { return this.clicks > 0 ? Math.round((this.hits / this.clicks) * 100) : 0; }
  get avgReaction() { return this.hits > 0 ? Math.round(this.totalReactionMs / this.hits) : 0; }
  get bestReaction() { return this.bestReactionMs === Infinity ? 0 : Math.round(this.bestReactionMs); }
  get totalScore() {
    const base = this.hits * 100;
    const accuracyBonus = this.accuracy > 80 ? this.hits * 20 : 0;
    const speedBonus = this.avgReaction > 0 && this.avgReaction < 1000 ? Math.round((1000 - this.avgReaction) / 10) * this.hits : 0;
    return base + accuracyBonus + speedBonus + this.bonuses;
  }

  getSummary() {
    return {
      score: this.totalScore,
      hits: this.hits,
      misses: this.misses,
      accuracy: this.accuracy,
      avgReaction: this.avgReaction,
      bestReaction: this.bestReaction,
      rounds: this.rounds
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXERCISE 1 — FRACTAL NETWORK (Sierpiński Triangle)
// ══════════════════════════════════════════════════════════════════════════════
class FractalExercise {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.depth = options.depth || 3;
    this.mode = options.mode || 'search'; // 'search', 'pursuit', 'memory'
    this.targetColor = options.targetColor || '#00e5ff';
    this.targetRadius = options.targetRadius || 10;
    this.pursuitSpeed = options.pursuitSpeed || 1;
    this.duration = options.duration || 120; // seconds

    this.vertices = [];
    this.edges = [];
    this.edgePoints = [];
    this.target = { x: 0, y: 0, visible: true };
    this.trail = [];
    this.score = new ScoreTracker();

    this.running = false;
    this.elapsed = 0;
    this.lastTime = 0;
    this.roundStartTime = 0;

    // Memory mode
    this.memoryPhase = 'show'; // 'show' or 'guess'
    this.memoryShowDuration = 1.5;
    this.memoryShowTimer = 0;
    this.memoryTarget = { x: 0, y: 0 };

    // Pursuit mode
    this.pursuitIdx = 0;
    this.pursuitProgress = 0;

    this._animFrame = null;
    this._onClickBound = this._onClick.bind(this);
  }

  _generateTriangle() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const margin = 40;
    const cx = W / 2;
    const topY = margin;
    const botY = H - margin;
    const halfBase = (botY - topY) * Math.tan(Math.PI / 6) * Math.sqrt(3) / 2;
    const clampedHalf = Math.min(halfBase, (W / 2) - margin);

    this.vertices = [
      { x: cx, y: topY },
      { x: cx - clampedHalf, y: botY },
      { x: cx + clampedHalf, y: botY }
    ];

    this.edges = [];
    this.edgePoints = [];
    this._subdivide(this.vertices[0], this.vertices[1], this.vertices[2], this.depth);
    // Collect unique edge midpoints for target placement
    this.edgePoints = this.edges.map(e => ({
      x: (e.x1 + e.x2) / 2,
      y: (e.y1 + e.y2) / 2
    }));
    // Also add vertices of each edge
    this.edges.forEach(e => {
      this.edgePoints.push({ x: e.x1, y: e.y1 });
      this.edgePoints.push({ x: e.x2, y: e.y2 });
    });
  }

  _subdivide(a, b, c, depth) {
    if (depth === 0) {
      this.edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      this.edges.push({ x1: b.x, y1: b.y, x2: c.x, y2: c.y });
      this.edges.push({ x1: c.x, y1: c.y, x2: a.x, y2: a.y });
      return;
    }
    const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const ca = { x: (c.x + a.x) / 2, y: (c.y + a.y) / 2 };
    this._subdivide(a, ab, ca, depth - 1);
    this._subdivide(ab, b, bc, depth - 1);
    this._subdivide(ca, bc, c, depth - 1);
  }

  _placeTarget() {
    const pt = this.edgePoints[Math.floor(Math.random() * this.edgePoints.length)];
    this.target.x = pt.x;
    this.target.y = pt.y;
    this.target.visible = true;
    this.roundStartTime = performance.now();

    if (this.mode === 'memory') {
      this.memoryPhase = 'show';
      this.memoryShowTimer = 0;
      this.memoryTarget = { x: pt.x, y: pt.y };
    }
  }

  _initPursuit() {
    this.pursuitIdx = Math.floor(Math.random() * this.edges.length);
    this.pursuitProgress = 0;
    this.trail = [];
    this.roundStartTime = performance.now();
  }

  start() {
    this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1);
    this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    this._generateTriangle();
    this.score.start();
    this.running = true;
    this.elapsed = 0;
    this.lastTime = performance.now();

    if (this.mode === 'pursuit') {
      this._initPursuit();
    } else {
      this._placeTarget();
    }

    this.canvas.addEventListener('click', this._onClickBound);
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this.canvas.removeEventListener('click', this._onClickBound);
  }

  _onClick(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (this.mode === 'search') {
      const d = SpecialUtils.dist(mx, my, this.target.x, this.target.y);
      if (d <= this.targetRadius * 2.5) {
        const reactionMs = performance.now() - this.roundStartTime;
        const depthBonus = this.depth * 15;
        this.score.recordHit(reactionMs, depthBonus);
        this._placeTarget();
      } else {
        this.score.recordMiss();
      }
    } else if (this.mode === 'pursuit') {
      const d = SpecialUtils.dist(mx, my, this.target.x, this.target.y);
      if (d <= this.targetRadius * 3) {
        const reactionMs = performance.now() - this.roundStartTime;
        this.score.recordHit(reactionMs, 25);
        this.roundStartTime = performance.now();
      } else {
        this.score.recordMiss();
      }
    } else if (this.mode === 'memory') {
      if (this.memoryPhase === 'guess') {
        const d = SpecialUtils.dist(mx, my, this.memoryTarget.x, this.memoryTarget.y);
        const reactionMs = performance.now() - this.roundStartTime;
        if (d <= this.targetRadius * 4) {
          const precisionBonus = Math.max(0, Math.round((1 - d / (this.targetRadius * 4)) * 50));
          this.score.recordHit(reactionMs, precisionBonus);
        } else {
          this.score.recordMiss();
        }
        this._placeTarget();
      }
    }
  }

  _loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += dt;

    if (this.elapsed >= this.duration) {
      this.stop();
      if (this.onFinish) this.onFinish(this.score.getSummary());
      return;
    }

    // Memory timer
    if (this.mode === 'memory' && this.memoryPhase === 'show') {
      this.memoryShowTimer += dt;
      if (this.memoryShowTimer >= this.memoryShowDuration) {
        this.memoryPhase = 'guess';
        this.target.visible = false;
        this.roundStartTime = performance.now();
      }
    }

    // Pursuit movement
    if (this.mode === 'pursuit') {
      this.pursuitProgress += dt * this.pursuitSpeed * 0.3;
      if (this.pursuitProgress >= 1) {
        this.pursuitProgress = 0;
        this.pursuitIdx = (this.pursuitIdx + 1) % this.edges.length;
      }
      const edge = this.edges[this.pursuitIdx];
      this.target.x = SpecialUtils.lerp(edge.x1, edge.x2, this.pursuitProgress);
      this.target.y = SpecialUtils.lerp(edge.y1, edge.y2, this.pursuitProgress);
      this.trail.push({ x: this.target.x, y: this.target.y, age: 0 });
      if (this.trail.length > 30) this.trail.shift();
      this.trail.forEach(t => t.age += dt);
    }

    this._render();
    this._animFrame = requestAnimationFrame(() => this._loop());
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Draw edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    this.edges.forEach(e => {
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
    });

    // Draw trail (pursuit mode)
    if (this.mode === 'pursuit' && this.trail.length > 1) {
      for (let i = 1; i < this.trail.length; i++) {
        const alpha = 1 - (i / this.trail.length);
        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.6})`;
        ctx.lineWidth = 3 * alpha;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
    }

    // Draw target
    const showTarget = this.mode !== 'memory' || this.memoryPhase === 'show';
    if (showTarget) {
      // Glow
      const grd = ctx.createRadialGradient(this.target.x, this.target.y, 0, this.target.x, this.target.y, this.targetRadius * 3);
      grd.addColorStop(0, this.targetColor + '66');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(this.target.x - this.targetRadius * 3, this.target.y - this.targetRadius * 3, this.targetRadius * 6, this.targetRadius * 6);

      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, this.targetRadius, 0, Math.PI * 2);
      ctx.fillStyle = this.targetColor;
      ctx.fill();
    }

    // Memory mode hint
    if (this.mode === 'memory' && this.memoryPhase === 'guess') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '16px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Cliquez à l\'emplacement mémorisé', W / 2, 30);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXERCISE 2 — LUMINOUS POINTS (Saccades & Convergence)
// ══════════════════════════════════════════════════════════════════════════════
class LuminousPointsExercise {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = options.mode || 'saccades'; // 'saccades', 'convergence', 'relaxation'
    this.duration = options.duration || 120;
    this.speed = options.speed || 1;

    this.points = [];
    this.activeIdx = 0;
    this.score = new ScoreTracker();

    this.running = false;
    this.elapsed = 0;
    this.lastTime = 0;
    this.phaseTime = 0;

    // Convergence state
    this.convergenceOffset = 0;
    this.convergenceDir = 1; // 1 = converging, -1 = diverging

    // Relaxation state
    this.breathPhase = 0; // 0-12s cycle

    // Saccade state
    this.saccadeInterval = 1.2; // seconds between jumps
    this.saccadeTimer = 0;

    this._animFrame = null;
  }

  _generatePoints() {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    const cx = W / 2;
    const cy = H / 2;
    const spacing = W * 0.08;
    const rowGap = H * 0.12;

    this.points = [];
    // 2 rows × 5 points
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        this.points.push({
          baseX: cx + (col - 2) * spacing,
          baseY: cy + (row - 0.5) * rowGap,
          x: cx + (col - 2) * spacing,
          y: cy + (row - 0.5) * rowGap,
          intensity: 0.3,
          size: 8,
          row: row
        });
      }
    }
  }

  start() {
    this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1);
    this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    this._generatePoints();
    this.score.start();
    this.running = true;
    this.elapsed = 0;
    this.lastTime = performance.now();
    this.activeIdx = 0;
    this.saccadeTimer = 0;

    this._loop();
  }

  stop() {
    this.running = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }

  _loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += dt;
    this.phaseTime += dt;

    if (this.elapsed >= this.duration) {
      this.stop();
      if (this.onFinish) this.onFinish(this.score.getSummary());
      return;
    }

    this._update(dt);
    this._render();
    this._animFrame = requestAnimationFrame(() => this._loop());
  }

  _update(dt) {
    if (this.mode === 'saccades') {
      this.saccadeTimer += dt;
      if (this.saccadeTimer >= this.saccadeInterval / this.speed) {
        this.saccadeTimer = 0;
        // Alternate: horizontal sweep or vertical alternation
        const pattern = Math.floor(this.elapsed / 10) % 2;
        if (pattern === 0) {
          // Horizontal sweep
          this.activeIdx = (this.activeIdx + 1) % this.points.length;
        } else {
          // Random jump
          this.activeIdx = Math.floor(Math.random() * this.points.length);
        }
        this.score.rounds++;
      }
      this.points.forEach((p, i) => {
        p.intensity = SpecialUtils.lerp(p.intensity, i === this.activeIdx ? 1.0 : 0.15, 0.15);
      });
    }

    else if (this.mode === 'convergence') {
      const cycleSpeed = 0.15 * this.speed;
      this.convergenceOffset += this.convergenceDir * cycleSpeed * dt;
      const maxOffset = this.canvas.clientWidth * 0.15;

      if (this.convergenceOffset >= maxOffset) { this.convergenceDir = -1; }
      if (this.convergenceOffset <= 0) { this.convergenceDir = 1; this.score.rounds++; }

      this.points.forEach(p => {
        const sign = p.row === 0 ? -1 : 1;
        p.y = p.baseY + sign * this.convergenceOffset;
        p.intensity = 0.8;
      });
    }

    else if (this.mode === 'relaxation') {
      this.breathPhase += dt;
      const cycle = this.breathPhase % 12;
      let scale;
      if (cycle < 4) {
        // Expansion (inhale) 4s
        scale = 0.6 + (cycle / 4) * 0.8;
      } else if (cycle < 8) {
        // Hold 4s
        scale = 1.4;
      } else {
        // Reduction (exhale) 4s
        scale = 1.4 - ((cycle - 8) / 4) * 0.8;
      }

      this.points.forEach(p => {
        p.size = 8 * scale;
        p.intensity = 0.5 + scale * 0.3;
      });

      if (Math.floor(this.breathPhase) % 12 === 0 && this.breathPhase > 1) {
        this.score.rounds++;
      }
    }
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Draw points
    this.points.forEach((p, i) => {
      const alpha = p.intensity;
      const size = p.size || 8;

      // Glow
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
      grd.addColorStop(0, `rgba(0, 230, 100, ${alpha * 0.4})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
      ctx.fill();

      // Point
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 230, 100, ${alpha})`;
      ctx.fill();

      // Bright center for active
      if (i === this.activeIdx && this.mode === 'saccades') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    });

    // Relaxation breathing guide
    if (this.mode === 'relaxation') {
      const cycle = this.breathPhase % 12;
      let label;
      if (cycle < 4) label = 'Inspirez...';
      else if (cycle < 8) label = 'Maintenez...';
      else label = 'Expirez...';

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '18px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, W / 2, H - 40);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXERCISE 3 — POINT CLOUD (Discrimination & Tracking)
// ══════════════════════════════════════════════════════════════════════════════
class PointCloudExercise {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = options.mode || 'speed'; // 'speed', 'tracking', 'memory'
    this.duration = options.duration || 120;
    this.numPoints = options.numPoints || 80;
    this.speed = options.speed || 1;

    this.whitePoints = [];
    this.target = { x: 0, y: 0, visible: true };
    this.score = new ScoreTracker();

    this.running = false;
    this.elapsed = 0;
    this.lastTime = 0;
    this.roundStartTime = 0;

    // Tracking mode
    this.trackVx = 0;
    this.trackVy = 0;

    // Memory mode
    this.memoryPhase = 'show'; // 'show' or 'guess'
    this.memoryShowDuration = 2.5;
    this.memoryShowTimer = 0;
    this.memoryTarget = { x: 0, y: 0 };

    this._animFrame = null;
    this._onClickBound = this._onClick.bind(this);
  }

  _generateCloud() {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    const margin = 30;
    this.whitePoints = [];
    for (let i = 0; i < this.numPoints; i++) {
      this.whitePoints.push({
        x: SpecialUtils.rand(margin, W - margin),
        y: SpecialUtils.rand(margin, H - margin),
        size: SpecialUtils.rand(2, 5),
        vx: this.mode === 'tracking' ? SpecialUtils.rand(-0.3, 0.3) * this.speed : 0,
        vy: this.mode === 'tracking' ? SpecialUtils.rand(-0.3, 0.3) * this.speed : 0,
        opacity: SpecialUtils.rand(0.3, 0.8)
      });
    }
  }

  _placeRedTarget() {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    const margin = 50;
    this.target.x = SpecialUtils.rand(margin, W - margin);
    this.target.y = SpecialUtils.rand(margin, H - margin);
    this.target.visible = true;
    this.roundStartTime = performance.now();

    if (this.mode === 'tracking') {
      const angle = Math.random() * Math.PI * 2;
      const sp = 0.5 * this.speed;
      this.trackVx = Math.cos(angle) * sp;
      this.trackVy = Math.sin(angle) * sp;
    }

    if (this.mode === 'memory') {
      this.memoryPhase = 'show';
      this.memoryShowTimer = 0;
      this.memoryTarget = { x: this.target.x, y: this.target.y };
    }
  }

  start() {
    this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1);
    this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    this._generateCloud();
    this._placeRedTarget();
    this.score.start();
    this.running = true;
    this.elapsed = 0;
    this.lastTime = performance.now();

    this.canvas.addEventListener('click', this._onClickBound);
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this.canvas.removeEventListener('click', this._onClickBound);
  }

  _onClick(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (this.mode === 'speed') {
      const d = SpecialUtils.dist(mx, my, this.target.x, this.target.y);
      if (d <= 20) {
        const reactionMs = performance.now() - this.roundStartTime;
        this.score.recordHit(reactionMs);
        this._placeRedTarget();
      } else {
        this.score.recordMiss();
      }
    } else if (this.mode === 'tracking') {
      const d = SpecialUtils.dist(mx, my, this.target.x, this.target.y);
      if (d <= 25) {
        const reactionMs = performance.now() - this.roundStartTime;
        this.score.recordHit(reactionMs, 15);
        this.roundStartTime = performance.now();
      } else {
        this.score.recordMiss();
      }
    } else if (this.mode === 'memory') {
      if (this.memoryPhase === 'guess') {
        const d = SpecialUtils.dist(mx, my, this.memoryTarget.x, this.memoryTarget.y);
        const reactionMs = performance.now() - this.roundStartTime;
        if (d <= 30) {
          const precisionBonus = Math.max(0, Math.round((1 - d / 30) * 40));
          this.score.recordHit(reactionMs, precisionBonus);
        } else {
          this.score.recordMiss();
        }
        this._placeRedTarget();
      }
    }
  }

  _loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += dt;

    if (this.elapsed >= this.duration) {
      this.stop();
      if (this.onFinish) this.onFinish(this.score.getSummary());
      return;
    }

    this._update(dt);
    this._render();
    this._animFrame = requestAnimationFrame(() => this._loop());
  }

  _update(dt) {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;

    // Move white points in tracking mode
    if (this.mode === 'tracking') {
      this.whitePoints.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 10 || p.x > W - 10) p.vx *= -1;
        if (p.y < 10 || p.y > H - 10) p.vy *= -1;
      });

      // Move red target
      this.target.x += this.trackVx;
      this.target.y += this.trackVy;
      if (this.target.x < 30 || this.target.x > W - 30) this.trackVx *= -1;
      if (this.target.y < 30 || this.target.y > H - 30) this.trackVy *= -1;
    }

    // Memory timer
    if (this.mode === 'memory' && this.memoryPhase === 'show') {
      this.memoryShowTimer += dt;
      if (this.memoryShowTimer >= this.memoryShowDuration) {
        this.memoryPhase = 'guess';
        this.target.visible = false;
        this.roundStartTime = performance.now();
      }
    }
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Draw white points
    this.whitePoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.fill();
    });

    // Draw red target
    const showTarget = this.mode !== 'memory' || this.memoryPhase === 'show';
    if (showTarget) {
      // Glow
      const grd = ctx.createRadialGradient(this.target.x, this.target.y, 0, this.target.x, this.target.y, 25);
      grd.addColorStop(0, 'rgba(255, 60, 60, 0.5)');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, 25, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3c3c';
      ctx.fill();
    }

    // Memory hint
    if (this.mode === 'memory' && this.memoryPhase === 'guess') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '16px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Où était le point rouge ? Cliquez !', W / 2, 30);
    }
  }
}

// ── EXERCISE REGISTRY ───────────────────────────────────────────────────────
const SPECIAL_EXERCISES = [
  {
    id: 'fractal',
    name: 'Réseau Fractal',
    icon: '🔺',
    desc: 'Recherche visuelle et poursuite oculaire dans un réseau géométrique complexe.',
    modes: [
      { id: 'search', name: 'Recherche', desc: 'Trouvez et cliquez sur la cible cachée dans le maillage.' },
      { id: 'pursuit', name: 'Poursuite', desc: 'Suivez la cible qui se déplace le long des arêtes.' },
      { id: 'memory', name: 'Mémoire', desc: 'Mémorisez la position de la cible puis cliquez à l\'aveugle.' }
    ],
    ExClass: FractalExercise,
    params: [
      { key: 'depth', label: 'Profondeur', min: 2, max: 5, step: 1, default: 3 },
      { key: 'pursuitSpeed', label: 'Vitesse (poursuite)', min: 0.5, max: 3, step: 0.5, default: 1 }
    ]
  },
  {
    id: 'luminous',
    name: 'Points Lumineux',
    icon: '💡',
    desc: 'Saccades, convergence et relaxation avec des points disposés en rangées.',
    modes: [
      { id: 'saccades', name: 'Saccades', desc: 'Suivez le point qui s\'allume intensément.' },
      { id: 'convergence', name: 'Convergence', desc: 'Les rangées se rapprochent puis s\'éloignent.' },
      { id: 'relaxation', name: 'Relaxation', desc: 'Les points pulsent avec votre respiration.' }
    ],
    ExClass: LuminousPointsExercise,
    params: [
      { key: 'speed', label: 'Vitesse', min: 0.5, max: 3, step: 0.5, default: 1 }
    ]
  },
  {
    id: 'cloud',
    name: 'Nuage de Points',
    icon: '☁️',
    desc: 'Discrimination de cible dans un environnement bruité.',
    modes: [
      { id: 'speed', name: 'Recherche Rapide', desc: 'Cliquez sur le point rouge le plus vite possible.' },
      { id: 'tracking', name: 'Suivi', desc: 'Le point rouge se déplace dans le nuage. Suivez-le et cliquez !' },
      { id: 'memory', name: 'Mémoire', desc: 'Mémorisez l\'emplacement du point rouge puis cliquez.' }
    ],
    ExClass: PointCloudExercise,
    params: [
      { key: 'numPoints', label: 'Densité', min: 30, max: 150, step: 10, default: 80 },
      { key: 'speed', label: 'Vitesse', min: 0.5, max: 3, step: 0.5, default: 1 }
    ]
  }
];
