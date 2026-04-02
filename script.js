(() => {
    'use strict';

    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    const mouse = { x: -9999, y: -9999, active: false, trail: [] };
    let W, H;
    let particles = [];
    let floatingShapes = [];
    let shootingStars = [];
    let ripples = [];

    const PALETTE = [
        [108, 99, 255],   // violet
        [139, 131, 255],  // light violet
        [0, 200, 255],    // cyan
        [224, 78, 198],   // magenta
        [80, 220, 180],   // teal-green
    ];

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    /* ===== Particle ===== */
    class Particle {
        constructor() {
            this.spawn();
        }
        spawn() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.z = Math.random();
            const speed = 0.1 + this.z * 0.25;
            const angle = Math.random() * Math.PI * 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.baseR = 0.6 + this.z * 2.4;
            this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            this.baseAlpha = 0.25 + this.z * 0.55;
            this.phase = Math.random() * Math.PI * 2;
            this.freq = 0.004 + Math.random() * 0.012;
        }
        update(t) {
            const pulse = Math.sin(t * this.freq + this.phase);
            this.r = Math.max(0.1, this.baseR * (1 + pulse * 0.25));
            this.alpha = this.baseAlpha * (0.75 + pulse * 0.25);

            if (mouse.active) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const d2 = dx * dx + dy * dy;
                const reach = 220 + this.z * 60;
                if (d2 < reach * reach && d2 > 1) {
                    const dist = Math.sqrt(d2);
                    const f = (1 - dist / reach) * 0.018 * (0.5 + this.z);
                    this.vx += (dx / dist) * f;
                    this.vy += (dy / dist) * f;
                    this.alpha = Math.min(1, this.alpha + (1 - dist / reach) * 0.35);
                }
            }

            this.vx *= 0.998;
            this.vy *= 0.998;
            this.x += this.vx;
            this.y += this.vy;

            const m = 60;
            if (this.x < -m) this.x += W + 2 * m;
            if (this.x > W + m) this.x -= W + 2 * m;
            if (this.y < -m) this.y += H + 2 * m;
            if (this.y > H + m) this.y -= H + 2 * m;
        }
        draw() {
            const [r, g, b] = this.color;
            const glowR = Math.max(0.1, this.r * 4);
            ctx.beginPath();
            ctx.arc(this.x, this.y, glowR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${this.alpha * 0.06})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, Math.max(0.1, this.r), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${this.alpha})`;
            ctx.fill();
        }
    }

    /* ===== Floating Geometry ===== */
    class FloatingShape {
        constructor() {
            this.spawn();
        }
        spawn() {
            this.type = Math.floor(Math.random() * 3); // 0=hex, 1=triangle, 2=diamond
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.size = 20 + Math.random() * 50;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.003;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.15 - 0.1;
            this.alpha = 0.02 + Math.random() * 0.04;
            this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            this.phase = Math.random() * Math.PI * 2;
        }
        update(t) {
            this.x += this.vx;
            this.y += this.vy;
            this.rotation += this.rotSpeed;
            this.currentAlpha = this.alpha * (0.7 + 0.3 * Math.sin(t * 0.002 + this.phase));

            if (this.x < -100 || this.x > W + 100 || this.y < -100 || this.y > H + 100) {
                this.spawn();
                this.y = H + 80;
                this.x = Math.random() * W;
            }
        }
        draw() {
            const [r, g, b] = this.color;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.strokeStyle = `rgba(${r},${g},${b},${this.currentAlpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            const sides = this.type === 0 ? 6 : this.type === 1 ? 3 : 4;
            const angleOff = this.type === 2 ? Math.PI / 4 : 0;
            for (let i = 0; i <= sides; i++) {
                const a = (i / sides) * Math.PI * 2 + angleOff;
                const px = Math.cos(a) * this.size;
                const py = Math.sin(a) * this.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
    }

    /* ===== Shooting Star ===== */
    class ShootingStar {
        constructor() {
            this.active = true;
            if (Math.random() < 0.5) {
                this.x = Math.random() * W;
                this.y = -10;
            } else {
                this.x = W + 10;
                this.y = Math.random() * H * 0.4;
            }
            const angle = Math.PI * 0.55 + Math.random() * 0.6;
            const speed = 8 + Math.random() * 10;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.tailLen = 80 + Math.random() * 120;
            this.life = 1;
            this.decay = 0.008 + Math.random() * 0.014;
            this.color = PALETTE[Math.floor(Math.random() * 3)];
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.life -= this.decay;
            if (this.life <= 0) this.active = false;
        }
        draw() {
            if (this.life <= 0) return;
            const [r, g, b] = this.color;
            const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (spd < 0.01) return;
            const tx = this.x - (this.vx / spd) * this.tailLen;
            const ty = this.y - (this.vy / spd) * this.tailLen;
            const grad = ctx.createLinearGradient(this.x, this.y, tx, ty);
            grad.addColorStop(0, `rgba(${r},${g},${b},${this.life * 0.8})`);
            grad.addColorStop(0.4, `rgba(${r},${g},${b},${this.life * 0.2})`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(tx, ty);
            ctx.strokeStyle = grad;
            ctx.lineWidth = Math.max(0.1, 1.8 * this.life);
            ctx.lineCap = 'round';
            ctx.stroke();
            const headR = Math.max(0.1, 2.5 * this.life);
            ctx.beginPath();
            ctx.arc(this.x, this.y, headR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${this.life * 0.9})`;
            ctx.fill();
        }
    }

    /* ===== Click Ripple ===== */
    class Ripple {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.radius = 0;
            this.maxRadius = 250 + Math.random() * 150;
            this.life = 1;
            this.speed = 3 + Math.random() * 2;
            this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        }
        update() {
            this.radius += this.speed;
            this.life = 1 - this.radius / this.maxRadius;
            return this.life > 0;
        }
        draw() {
            if (this.life <= 0) return;
            const [r, g, b] = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, Math.max(0.1, this.radius), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${r},${g},${b},${this.life * 0.4})`;
            ctx.lineWidth = Math.max(0.1, 2 * this.life);
            ctx.stroke();

            if (this.life > 0.5) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, Math.max(0.1, this.radius * 0.6), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${r},${g},${b},${(this.life - 0.5) * 0.3})`;
                ctx.lineWidth = Math.max(0.1, 1 * this.life);
                ctx.stroke();
            }
        }
    }

    /* ===== Aurora Waves ===== */
    function drawAurora(t) {
        const layers = [
            { color: [108, 99, 255], yBase: 0.7, amp: 60, freq: 0.002, speed: 0.0004, alpha: 0.025 },
            { color: [0, 200, 255], yBase: 0.65, amp: 80, freq: 0.0015, speed: 0.0003, alpha: 0.02 },
            { color: [224, 78, 198], yBase: 0.75, amp: 50, freq: 0.0025, speed: 0.0005, alpha: 0.018 },
            { color: [80, 220, 180], yBase: 0.6, amp: 70, freq: 0.0018, speed: 0.00035, alpha: 0.015 },
        ];

        for (const layer of layers) {
            const [r, g, b] = layer.color;
            ctx.beginPath();
            ctx.moveTo(0, H);

            for (let x = 0; x <= W; x += 4) {
                const wave1 = Math.sin(x * layer.freq + t * layer.speed) * layer.amp;
                const wave2 = Math.sin(x * layer.freq * 1.8 + t * layer.speed * 1.3 + 2) * layer.amp * 0.4;
                const wave3 = Math.sin(x * layer.freq * 0.5 + t * layer.speed * 0.7 + 5) * layer.amp * 0.6;
                const y = H * layer.yBase + wave1 + wave2 + wave3;
                ctx.lineTo(x, y);
            }

            ctx.lineTo(W, H);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, H * layer.yBase - layer.amp * 2, 0, H);
            grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
            grad.addColorStop(0.3, `rgba(${r},${g},${b},${layer.alpha})`);
            grad.addColorStop(0.7, `rgba(${r},${g},${b},${layer.alpha * 0.6})`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    /* ===== Connections ===== */
    function drawConnections() {
        const maxD2 = 130 * 130;
        const mouseD = 200;
        const mouseD2 = mouseD * mouseD;

        for (let i = 0; i < particles.length; i++) {
            const a = particles[i];
            for (let j = i + 1; j < particles.length; j++) {
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < maxD2) {
                    const alpha = (1 - d2 / maxD2) * 0.14 * Math.min(a.z, b.z);
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(108,99,255,${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }

            if (mouse.active) {
                const dx = a.x - mouse.x;
                const dy = a.y - mouse.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < mouseD2 && d2 > 1) {
                    const dist = Math.sqrt(d2);
                    const alpha = (1 - dist / mouseD) * 0.3 * a.z;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = `rgba(139,131,255,${alpha})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }
    }

    /* ===== Mouse Trail ===== */
    function drawMouseTrail() {
        const trail = mouse.trail;
        if (trail.length < 2) return;

        for (let i = 1; i < trail.length; i++) {
            const p = trail[i];
            const prev = trail[i - 1];
            const progress = i / trail.length;
            const alpha = progress * 0.3;
            const width = progress * 2.5;

            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = `rgba(108,99,255,${alpha})`;
            ctx.lineWidth = Math.max(0.1, width);
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        if (trail.length > 0) {
            const tip = trail[trail.length - 1];
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(139,131,255,0.4)';
            ctx.fill();
        }
    }

    /* ===== Vignette ===== */
    function drawVignette() {
        const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    /* ===== Init ===== */
    function init() {
        resize();
        particles = [];
        floatingShapes = [];
        const pCount = Math.min(Math.floor((W * H) / 6500), 200);
        for (let i = 0; i < pCount; i++) particles.push(new Particle());
        const sCount = Math.min(Math.floor(W / 120), 12);
        for (let i = 0; i < sCount; i++) floatingShapes.push(new FloatingShape());
    }

    /* ===== Animate ===== */
    function animate(t = 0) {
        ctx.clearRect(0, 0, W, H);

        // Ambient radial center glow
        const cg = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.55);
        cg.addColorStop(0, 'rgba(108,99,255,0.035)');
        cg.addColorStop(0.5, 'rgba(60,50,180,0.012)');
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(0, 0, W, H);

        drawAurora(t);

        for (const s of floatingShapes) { s.update(t); s.draw(); }
        for (const p of particles) { p.update(t); p.draw(); }
        drawConnections();

        // Shooting stars
        if (Math.random() < 0.003) shootingStars.push(new ShootingStar());
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            shootingStars[i].update();
            if (!shootingStars[i].active) { shootingStars.splice(i, 1); continue; }
            shootingStars[i].draw();
        }

        // Click ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
            if (!ripples[i].update()) { ripples.splice(i, 1); continue; }
            ripples[i].draw();
        }

        drawMouseTrail();
        drawVignette();

        requestAnimationFrame(animate);
    }

    /* ===== Events ===== */
    window.addEventListener('resize', () => { resize(); if (!particles.length) init(); });

    const heroEl = document.getElementById('hero');
    const glowEl = document.getElementById('mouseGlow');
    const heroContent = document.getElementById('heroContent');

    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
        mouse.trail.push({ x: e.clientX, y: e.clientY });
        if (mouse.trail.length > 30) mouse.trail.shift();

        glowEl.style.left = e.clientX + 'px';
        glowEl.style.top = e.clientY + 'px';
        const heroRect = heroEl.getBoundingClientRect();
        glowEl.classList.toggle('visible', e.clientY < heroRect.bottom);

        if (heroContent && e.clientY < heroRect.bottom) {
            const cx = (e.clientX / W - 0.5) * 14;
            const cy = (e.clientY / H - 0.5) * 10;
            heroContent.style.transform = `translate(${cx}px, ${cy}px)`;
        }
    });

    document.addEventListener('mouseleave', () => {
        mouse.active = false;
        mouse.trail.length = 0;
        glowEl.classList.remove('visible');
    });

    document.addEventListener('click', (e) => {
        const heroRect = heroEl.getBoundingClientRect();
        if (e.clientY < heroRect.bottom) {
            ripples.push(new Ripple(e.clientX, e.clientY));
            ripples.push(new Ripple(e.clientX, e.clientY));
        }
    });

    init();
    animate();

    /* ===========================================
       Typing Animation
       =========================================== */
    const phrases = [
        'scalable cloud platforms.',
        'distributed systems.',
        'ML-driven security.',
        'high-throughput pipelines.',
        'enterprise DLP solutions.',
    ];
    let phraseIdx = 0, charIdx = 0, deleting = false;
    const typedEl = document.getElementById('typedText');

    function type() {
        const cur = phrases[phraseIdx];
        typedEl.textContent = cur.substring(0, deleting ? charIdx-- : charIdx++);
        let delay = deleting ? 30 : 60;
        if (!deleting && charIdx > cur.length) { delay = 2200; deleting = true; }
        else if (deleting && charIdx < 0) { deleting = false; phraseIdx = (phraseIdx + 1) % phrases.length; delay = 500; }
        setTimeout(type, delay);
    }
    type();

    /* ===========================================
       Navigation
       =========================================== */
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const sections = document.querySelectorAll('.section, .hero');

    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
        let cur = '';
        sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) cur = s.id; });
        document.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + cur);
        });
    }, { passive: true });

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('open');
        navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => { navToggle.classList.remove('open'); navLinks.classList.remove('open'); });
    });

    /* ===========================================
       Scroll Reveal
       =========================================== */
    const revealObs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const siblings = e.target.parentElement.querySelectorAll('.reveal');
                const idx = Array.from(siblings).indexOf(e.target);
                e.target.style.transitionDelay = `${idx * 0.08}s`;
                e.target.classList.add('visible');
                revealObs.unobserve(e.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

    /* ===========================================
       Animated Counters
       =========================================== */
    const ctrObs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) { animCtr(e.target); ctrObs.unobserve(e.target); }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.stat-number').forEach(el => ctrObs.observe(el));

    function animCtr(el) {
        const target = parseInt(el.dataset.target, 10);
        const dur = 1800, start = performance.now();
        function step(now) {
            const p = Math.min((now - start) / dur, 1);
            el.textContent = Math.floor((1 - Math.pow(1 - p, 4)) * target);
            if (p < 1) requestAnimationFrame(step); else el.textContent = target;
        }
        requestAnimationFrame(step);
    }

    /* ===========================================
       Smooth Scroll
       =========================================== */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const t = document.querySelector(a.getAttribute('href'));
            if (t) t.scrollIntoView({ behavior: 'smooth' });
        });
    });
})();
