// Pseudo-3D character: an AI-generated PNG with CSS 3D transform parallax,
// idle float, click-to-wobble + emoji burst. No Three.js needed.

const IMG_URL = 'assets/character-art.jpg?v=1';

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    window.char3dActive = true;
    const container = document.getElementById('character');
    const wrap = document.getElementById('characterWrap');
    if (!container || !wrap) return;

    container.innerHTML = '';
    wrap.style.pointerEvents = 'auto';
    wrap.style.display = '';
    wrap.style.perspective = '1000px';

    const isMobile = window.innerWidth < 900;

    /* ── Load image, chroma-key white background to transparent ── */
    const sourceImg = new Image();
    sourceImg.crossOrigin = 'anonymous';
    sourceImg.onload = () => {
      const cv = document.createElement('canvas');
      cv.width  = sourceImg.naturalWidth;
      cv.height = sourceImg.naturalHeight;
      const ctx = cv.getContext('2d');
      ctx.drawImage(sourceImg, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      const px = data.data;
      // Threshold tuned for AI-generated white studio backgrounds — fades edges smoothly
      const LOW = 220, HIGH = 252;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        // Only fade near-grey/white pixels (avoid touching saturated regions)
        const isNearWhite = r > LOW && g > LOW && b > LOW
          && Math.abs(r - g) < 12 && Math.abs(g - b) < 12;
        if (isNearWhite) {
          const avg = (r + g + b) / 3;
          if (avg >= HIGH) {
            px[i + 3] = 0;
          } else {
            const t = (avg - LOW) / (HIGH - LOW);
            px[i + 3] = Math.round(255 * (1 - t));
          }
        }
      }
      ctx.putImageData(data, 0, 0);

      const img = document.createElement('img');
      img.src = cv.toDataURL('image/png');
      img.alt = 'Kim';
      img.draggable = false;
      Object.assign(img.style, {
        height: '100%',
        width: '100%',
        objectFit: 'contain',
        objectPosition: 'center bottom',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserDrag: 'none',
        filter: 'drop-shadow(-12px 22px 32px rgba(124, 58, 237, 0.5))',
      });
      container.appendChild(img);
      console.log('[character] image processed and mounted');
    };
    sourceImg.onerror = () => {
      console.error('[character] failed to load', IMG_URL);
      wrap.style.display = 'none';
    };
    sourceImg.src = IMG_URL;

    /* ── Parallax + idle ── */
    container.style.transformStyle = 'preserve-3d';
    container.style.willChange = 'transform';
    container.style.transition = 'none';

    let tX = 0, tY = 0, cX = 0, cY = 0;
    if (!isMobile) {
      window.addEventListener('mousemove', e => {
        tX = (e.clientX / window.innerWidth  - 0.5) * 12; // ±6°
        tY = (e.clientY / window.innerHeight - 0.5) * 5;  // ±2.5°
      });
    }

    let t = 0, wobble = 0;
    function tick() {
      requestAnimationFrame(tick);
      t += 0.016;
      cX += (tX - cX) * 0.06;
      cY += (tY - cY) * 0.06;

      const floatY     = Math.sin(t * 0.8)  * 4;       // gentle bob
      const idleRotZ   = Math.sin(t * 0.45) * 0.6;     // subtle sway
      let wobbleRotZ = 0;
      if (wobble > 0) {
        wobbleRotZ = Math.sin(wobble * 28) * wobble * 9;
        wobble -= 0.022;
        if (wobble < 0) wobble = 0;
      }

      container.style.transform =
        `translateY(${floatY}px) ` +
        `rotateY(${cX}deg) ` +
        `rotateX(${-cY}deg) ` +
        `rotateZ(${idleRotZ + wobbleRotZ}deg)`;
    }
    tick();

    /* ── Click → wobble + emoji burst ── */
    wrap.addEventListener('click', e => {
      if (e.target.closest('.bubble')) return;
      wobble = 1.0;

      const emojiPool = ['👋', '✨', '💖', '🚀', '🎯'];
      const el = document.createElement('div');
      el.textContent = emojiPool[Math.floor(Math.random() * emojiPool.length)];
      Object.assign(el.style, {
        position: 'absolute',
        fontSize: isMobile ? '24px' : '38px',
        pointerEvents: 'none',
        top: '24%',
        left: (32 + Math.random() * 32) + '%',
        zIndex: '100',
        animation: 'char-emojiBurst 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      });
      wrap.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    });
  }
})();
