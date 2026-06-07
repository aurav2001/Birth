// State & Configuration
let appState = 'lobby'; // 'lobby', 'counting', 'celebration'
let countdownInterval = null;
let targetDate = getTargetDate();

// Canvas Particle System Variables
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');
let particles = [];
let cursor = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };
let width = window.innerWidth;
let height = window.innerHeight;

// Particle Color Palette (Gold/Amber and White theme)
const GOLD_COLORS = [
  'rgba(255, 215, 0, opacity)',   // Gold
  'rgba(255, 223, 0, opacity)',   // Golden Yellow
  'rgba(255, 140, 0, opacity)',   // Dark Orange
  'rgba(255, 69, 0, opacity)',    // Orange Red
  'rgba(255, 255, 255, opacity)', // White Sparkle
  'rgba(184, 134, 11, opacity)'   // Dark Golden Rod
];

// Helper: Calculate Target Date (June 8, 12:00 AM / Midnight of June 7)
function getTargetDate() {
  const now = new Date();
  const currentYear = now.getFullYear();
  // June is month Index 5 in JavaScript (0-indexed)
  let tDate = new Date(currentYear, 5, 8, 0, 0, 0);
  
  // If we are already past June 8th 12:00 AM of the current year, target next year
  if (now > tDate) {
    tDate = new Date(currentYear + 1, 5, 8, 0, 0, 0);
  }
  return tDate;
}

// -------------------------------------------------------------
// PARTICLE SYSTEM CLASSES
// -------------------------------------------------------------

class Star {
  constructor() {
    this.reset();
    // Start at random position on initial load
    this.x = Math.random() * width;
    this.y = Math.random() * height;
  }

  reset() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    
    // Choose a depth layer for parallax and size variety
    const rand = Math.random();
    if (rand < 0.6) {
      // Layer 1: Distant background stars (tiny, faint, slow)
      this.size = Math.random() * 0.7 + 0.3;
      this.baseSpeedX = Math.random() * 0.04 - 0.02;
      this.baseSpeedY = Math.random() * 0.04 - 0.02;
      this.maxOpacity = Math.random() * 0.35 + 0.1;
    } else if (rand < 0.9) {
      // Layer 2: Midground stars (medium size and speed)
      this.size = Math.random() * 1.1 + 0.7;
      this.baseSpeedX = Math.random() * 0.12 - 0.06;
      this.baseSpeedY = Math.random() * 0.12 - 0.06;
      this.maxOpacity = Math.random() * 0.6 + 0.3;
    } else {
      // Layer 3: Foreground twinkling stars (bright, larger, some flare)
      this.size = Math.random() * 1.7 + 1.2;
      this.baseSpeedX = Math.random() * 0.25 - 0.125;
      this.baseSpeedY = Math.random() * 0.25 - 0.125;
      this.maxOpacity = Math.random() * 0.8 + 0.5;
      this.hasFlare = Math.random() > 0.6; // Some special stars have cross flares!
    }

    this.speedX = this.baseSpeedX;
    this.speedY = this.baseSpeedY;
    this.opacity = Math.random() * this.maxOpacity;
    this.twinkleSpeed = Math.random() * 0.015 + 0.003;
    this.twinkleDir = Math.random() > 0.5 ? 1 : -1;
  }

  update() {
    // Parallax/magnetic drift from cursor (more pronounced for foreground stars!)
    if (cursor.x > -1000) {
      const dx = this.x - cursor.x;
      const dy = this.y - cursor.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 180) {
        const force = (180 - dist) / 180;
        const speedMult = this.size > 1.2 ? 1.6 : (this.size > 0.7 ? 1.0 : 0.4);
        this.speedX += (dx / dist) * force * 0.07 * speedMult;
        this.speedY += (dy / dist) * force * 0.07 * speedMult;
      }
    }

    // Apply speed and return to base speed gradually
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedX += (this.baseSpeedX - this.speedX) * 0.05;
    this.speedY += (this.baseSpeedY - this.speedY) * 0.05;

    // Twinkle opacity
    this.opacity += this.twinkleSpeed * this.twinkleDir;
    if (this.opacity >= this.maxOpacity) {
      this.opacity = this.maxOpacity;
      this.twinkleDir = -1;
    } else if (this.opacity <= 0.05) {
      this.opacity = 0.05;
      this.twinkleDir = 1;
    }

    // Wrap around screen boundaries
    if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
      this.reset();
      if (Math.random() > 0.5) {
        this.x = Math.random() > 0.5 ? 0 : width;
      } else {
        this.y = Math.random() > 0.5 ? 0 : height;
      }
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
    ctx.fill();

    // Draw a subtle cross flare for bright foreground stars
    if (this.hasFlare && this.opacity > 0.45) {
      ctx.strokeStyle = `rgba(255, 223, 100, ${this.opacity * 0.35})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      // Horizontal flare
      ctx.moveTo(this.x - this.size * 3.5, this.y);
      ctx.lineTo(this.x + this.size * 3.5, this.y);
      // Vertical flare
      ctx.moveTo(this.x, this.y - this.size * 3.5);
      ctx.lineTo(this.x, this.y + this.size * 3.5);
      ctx.stroke();
    }
  }
}

class Confetti {
  constructor(x, y, isExplosion = false) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const velocity = isExplosion ? Math.random() * 8 + 3 : Math.random() * 4 + 1;
    
    this.speedX = Math.cos(angle) * velocity;
    this.speedY = Math.sin(angle) * velocity - (isExplosion ? 3.5 : 0); // initial upward boost
    this.size = Math.random() * 3 + 2;
    
    // Assign a beautiful gold/amber color
    const baseColor = GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)];
    this.colorPattern = baseColor;
    
    this.opacity = 1;
    this.decay = Math.random() * 0.012 + 0.008;
    this.gravity = 0.12;
    this.friction = 0.98;
    this.rotation = Math.random() * Math.PI;
    this.rotationSpeed = Math.random() * 0.2 - 0.1;

    // Track historical positions to render beautiful sparkles trails
    this.history = [];
    this.historyLength = 4;
  }

  update() {
    // Save history
    this.history.push({ x: this.x, y: this.y, rotation: this.rotation });
    if (this.history.length > this.historyLength) {
      this.history.shift();
    }

    this.speedX *= this.friction;
    this.speedY *= this.friction;
    this.speedY += this.gravity;
    this.x += this.speedX;
    this.y += this.speedY;
    this.opacity -= this.decay;
    this.rotation += this.rotationSpeed;
  }

  draw() {
    // Draw motion trail
    for (let i = 0; i < this.history.length; i++) {
      const pos = this.history[i];
      const trailOpacity = this.opacity * ((i + 1) / this.history.length) * 0.35;
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(pos.rotation);
      ctx.beginPath();
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size * 0.5, 0);
      ctx.lineTo(0, this.size);
      ctx.lineTo(-this.size * 0.5, 0);
      ctx.closePath();
      ctx.fillStyle = this.colorPattern.replace('opacity', trailOpacity);
      ctx.fill();
      ctx.restore();
    }

    // Draw main active spark
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(this.size * 0.5, 0);
    ctx.lineTo(0, this.size);
    ctx.lineTo(-this.size * 0.5, 0);
    ctx.closePath();
    ctx.fillStyle = this.colorPattern.replace('opacity', this.opacity);
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.colorPattern.replace('opacity', 0.9);
    ctx.fill();
    ctx.restore();
  }
}

// -------------------------------------------------------------
// ENGINE FUNCTIONS
// -------------------------------------------------------------

function initBackground() {
  particles = particles.filter(p => p instanceof Confetti); // keep active confetti
  // Generate background stars
  const numStars = Math.floor((width * height) / 8000);
  for (let i = 0; i < Math.max(numStars, 85); i++) {
    particles.push(new Star());
  }
}

function animate() {
  // Clear with a beautiful moving cosmic radial gradient (Nebula effect)
  let gradientX = width / 2;
  let gradientY = height / 2;
  if (cursor.x > -1000) {
    // Faintly drag the center of the nebula toward the cursor
    gradientX += (cursor.x - width / 2) * 0.15;
    gradientY += (cursor.y - height / 2) * 0.15;
  }
  
  const spaceGrad = ctx.createRadialGradient(
    gradientX, gradientY, 50,
    width / 2, height / 2, Math.max(width, height) * 0.8
  );
  spaceGrad.addColorStop(0, '#0a122e');      // Deep violet-blue nebula core
  spaceGrad.addColorStop(0.4, '#050814');    // Rich midnight blue
  spaceGrad.addColorStop(1, '#020306');      // Infinite space void black
  
  ctx.fillStyle = spaceGrad;
  ctx.fillRect(0, 0, width, height);

  // Update cursor position smoothly
  cursor.x += (cursor.targetX - cursor.x) * 0.1;
  cursor.y += (cursor.targetY - cursor.y) * 0.1;

  // Filter out faded particles and update remaining
  particles = particles.filter(p => {
    p.update();
    p.draw();
    if (p instanceof Confetti && p.opacity <= 0) {
      return false;
    }
    return true;
  });

  // Keep drawing stars if we drop below minimum
  const starCount = particles.filter(p => p instanceof Star).length;
  const targetStars = Math.floor((width * height) / 8000);
  if (starCount < Math.max(targetStars, 85)) {
    particles.push(new Star());
  }

  requestAnimationFrame(animate);
}

// Sparkle Burst Trigger (e.g. from Diya center or mouse click)
function spawnSparkBurst(x, y, count = 80, isExplosion = true) {
  for (let i = 0; i < count; i++) {
    particles.push(new Confetti(x, y, isExplosion));
  }
}

// Set Canvas Size with devicePixelRatio for High DPI sharpness
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);
  initBackground();
}

// -------------------------------------------------------------
// SCREEN STATE MANAGEMENT
// -------------------------------------------------------------

function switchScreen(screenId) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  // Show active screen
  const target = document.getElementById(screenId);
  target.classList.add('active');
}

function startTimer() {
  updateCountdown(); // run once immediately
  countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const now = new Date();
  const diff = targetDate - now;

  if (diff <= 0) {
    clearInterval(countdownInterval);
    triggerCelebration();
    return;
  }

  // Time calculations
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  // Format to two digits
  document.getElementById('timer-hours').textContent = String(hours).padStart(2, '0');
  document.getElementById('timer-mins').textContent = String(mins).padStart(2, '0');
  document.getElementById('timer-secs').textContent = String(secs).padStart(2, '0');
}

function triggerCelebration() {
  appState = 'celebration';
  switchScreen('screen-celebration');
  
  // Wait a short moment for screen fade, then light the Diya
  setTimeout(() => {
    const celebrationScreen = document.getElementById('screen-celebration');
    celebrationScreen.classList.add('celebrating');
    
    // Spawn initial beautiful gold fireworks/sparks from the Diya location
    const diyaRect = document.querySelector('.diya-svg').getBoundingClientRect();
    const diyaX = diyaRect.left + diyaRect.width / 2;
    const diyaY = diyaRect.top + 40; // close to flame position
    
    spawnSparkBurst(diyaX, diyaY, 150, true);
    
    // Trigger Age Roller translation after diya flame settles (1.2s)
    setTimeout(() => {
      const roller = document.getElementById('age-roller-wrapper');
      roller.classList.add('roll');
      
      // Secondary spark burst to celebrate the age roll
      setTimeout(() => {
        spawnSparkBurst(diyaX, diyaY + 80, 80, true);
      }, 1000);
      
    }, 1200);
    
  }, 300);
}

// -------------------------------------------------------------
// EVENT LISTENERS & INITIALIZATION
// -------------------------------------------------------------

// Mouse Interaction for parallax star movement
window.addEventListener('mousemove', (e) => {
  cursor.targetX = e.clientX;
  cursor.targetY = e.clientY;
});

window.addEventListener('mouseleave', () => {
  cursor.targetX = -1000;
  cursor.targetY = -1000;
});

// Click to spawn sparkles during celebration
window.addEventListener('click', (e) => {
  if (appState === 'celebration') {
    // Only spawn if they didn't click the dev control button
    if (!e.target.closest('.dev-controls')) {
      spawnSparkBurst(e.clientX, e.clientY, 35, false);
    }
  }
});

// Resize window handler
window.addEventListener('resize', resizeCanvas);

// UI Buttons
document.getElementById('btn-start').addEventListener('click', () => {
  appState = 'counting';
  switchScreen('screen-countdown');
  startTimer();
});

// Dev Tool / Preview trigger
document.getElementById('btn-test-celebrate').addEventListener('click', () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  // Reset roller class in case they are re-testing
  const roller = document.getElementById('age-roller-wrapper');
  roller.classList.remove('roll');
  const celebrationScreen = document.getElementById('screen-celebration');
  celebrationScreen.classList.remove('celebrating');
  
  triggerCelebration();
});

// Start Code Execution
resizeCanvas(); // Sets size, scale, and initializes background stars
animate();
