(function () {
  'use strict';

  function init() {
    if (!window.THREE) return;
    window.char3dActive = true;

    const THREE = window.THREE;
    const container = document.getElementById('character');
    if (!container) return;
    container.innerHTML = '';

    const isMobile = window.innerWidth < 900;
    const W = container.offsetWidth  || (isMobile ? 130 : 320);
    const H = container.offsetHeight || (isMobile ? 130 : 500);

    /* ── SCENE ── */
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    if (isMobile) {
      camera.position.set(0, 3.05, 2.8);
      camera.lookAt(0, 3.05, 0);
    } else {
      camera.position.set(0, 1.65, 6.0);
      camera.lookAt(0, 1.65, 0);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      width: '100%', height: '100%', display: 'block', pointerEvents: 'auto'
    });

    /* ── LIGHTS ── */
    scene.add(new THREE.AmbientLight(0x9955ff, 0.75));

    const sun = new THREE.DirectionalLight(0xfff8e8, 1.5);
    sun.position.set(2, 4, 6);
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0xd946ef, 1.0);
    rim.position.set(-3, 3, -3);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x3dd6c8, 0.4);
    fill.position.set(0, -1, 4);
    scene.add(fill);

    /* ── MATERIALS ── */
    const M = {
      skin:   new THREE.MeshPhongMaterial({ color: 0xf5ccb0, shininess: 18 }),
      hair:   new THREE.MeshPhongMaterial({ color: 0x24c4b5, shininess: 90,  specular: 0x88ffee }),
      coat:   new THREE.MeshPhongMaterial({ color: 0xbfcfdf, shininess: 110, specular: 0x99aacc }),
      inner:  new THREE.MeshPhongMaterial({ color: 0x180840 }),
      goggle: new THREE.MeshPhongMaterial({ color: 0xf59e0b, shininess: 160, specular: 0xffe060 }),
      lens:   new THREE.MeshPhongMaterial({ color: 0x88eeff, shininess: 220, transparent: true, opacity: 0.6 }),
      pants:  new THREE.MeshPhongMaterial({ color: 0x140c38 }),
      shoe:   new THREE.MeshPhongMaterial({ color: 0x0c0c1a, shininess: 50 }),
      gold:   new THREE.MeshPhongMaterial({ color: 0xd4af37, shininess: 180, specular: 0xffee88 }),
    };

    /* ── FACE CANVAS TEXTURE ── */
    function drawAnimeEye(g, cx, cy, smiling, isRight) {
      if (smiling) {
        g.strokeStyle = '#1e0f38';
        g.lineWidth = 9; g.lineCap = 'round';
        g.beginPath();
        g.arc(cx, cy + 20, 44, Math.PI + 0.38, Math.PI * 2 - 0.38);
        g.stroke();
        // lash tips
        [Math.PI + 0.38, Math.PI * 2 - 0.38].forEach(a => {
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * 44, cy + 20 + Math.sin(a) * 44);
          g.lineTo(cx + Math.cos(a) * 56, cy + 20 + Math.sin(a) * 44 - 12);
          g.stroke();
        });
        return;
      }

      const R = 43;
      // white
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); g.fill();

      // iris gradient
      const ig = g.createRadialGradient(cx - 8, cy - 8, 3, cx, cy + 4, R * 0.68);
      ig.addColorStop(0,   '#62f0e0');
      ig.addColorStop(0.5, '#18b8a8');
      ig.addColorStop(1,   '#0a7070');
      g.fillStyle = ig;
      g.beginPath(); g.ellipse(cx, cy + 5, R * 0.65, R * 0.65, 0, 0, Math.PI * 2); g.fill();

      // pupil
      g.fillStyle = '#0a1818';
      g.beginPath(); g.ellipse(cx, cy + 6, R * 0.33, R * 0.35, 0, 0, Math.PI * 2); g.fill();

      // main highlight
      g.fillStyle = 'rgba(255,255,255,0.96)';
      g.beginPath(); g.ellipse(cx - 12, cy - 9, 14, 14, 0, 0, Math.PI * 2); g.fill();

      // small highlight
      g.fillStyle = 'rgba(255,255,255,0.72)';
      g.beginPath(); g.ellipse(cx + 14, cy + 8, 7, 7, 0, 0, Math.PI * 2); g.fill();

      // outline
      g.strokeStyle = '#18082e';
      g.lineWidth = 5;
      g.beginPath(); g.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); g.stroke();

      // thick upper lash
      g.lineWidth = 10;
      g.beginPath(); g.ellipse(cx, cy, R + 2, (R + 2) * 0.8, 0, Math.PI + 0.35, Math.PI * 2 - 0.35); g.stroke();

      // lash tips
      [Math.PI + 0.35, Math.PI * 2 - 0.35].forEach(a => {
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2) * 0.8);
        g.lineTo(cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 2) * 0.8 - 10);
        g.stroke();
      });

      // eyebrow
      g.strokeStyle = '#1c0e30';
      g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath();
      const bl = cx - R - 2, br = cx + R + 2, by = cy - R - 6;
      if (isRight) {
        g.moveTo(bl, by + 5); g.quadraticCurveTo(cx, by - 10, br, by + 2);
      } else {
        g.moveTo(bl, by + 2); g.quadraticCurveTo(cx, by - 10, br, by + 5);
      }
      g.stroke();
    }

    function buildFaceTex(smiling) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 512;
      const g = cv.getContext('2d');

      // skin
      const sg = g.createRadialGradient(256, 200, 20, 256, 270, 300);
      sg.addColorStop(0, '#fad8c0'); sg.addColorStop(1, '#f0bc98');
      g.fillStyle = sg; g.fillRect(0, 0, 512, 512);

      // blush
      g.fillStyle = 'rgba(255,120,120,0.20)';
      [96, 416].forEach(bx => {
        g.beginPath(); g.ellipse(bx, 315, 58, 40, 0, 0, Math.PI * 2); g.fill();
      });

      // freckles
      g.fillStyle = 'rgba(185,105,65,0.40)';
      [[172,295],[200,308],[312,308],[340,295]].forEach(([fx,fy]) => {
        g.beginPath(); g.arc(fx, fy, 5, 0, Math.PI * 2); g.fill();
      });

      // eyes (left = our right at cx≈160, right = our left at cx≈352)
      drawAnimeEye(g, 158, 232, smiling, false);
      drawAnimeEye(g, 354, 232, smiling, true);

      // nose bridge highlight
      g.fillStyle = 'rgba(255,240,230,0.4)';
      g.beginPath(); g.ellipse(256, 280, 14, 30, 0, 0, Math.PI * 2); g.fill();

      // nose
      g.strokeStyle = 'rgba(160,95,65,0.42)';
      g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(234, 315); g.lineTo(222, 345); g.lineTo(290, 345);
      g.stroke();

      // mouth
      g.strokeStyle = '#c05070';
      g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath();
      if (smiling) {
        g.arc(256, 378, 50, 0.1 * Math.PI, 0.9 * Math.PI);
        // show teeth hint
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fill();
      } else {
        g.arc(256, 388, 26, Math.PI + 0.28, Math.PI * 2 - 0.28);
      }
      g.stroke();

      // chin shadow
      g.fillStyle = 'rgba(0,0,0,0.04)';
      g.beginPath(); g.ellipse(256, 470, 160, 50, 0, 0, Math.PI * 2); g.fill();

      return new THREE.CanvasTexture(cv);
    }

    const faceTex  = buildFaceTex(false);
    const smileTex = buildFaceTex(true);
    const faceMat  = new THREE.MeshPhongMaterial({ map: faceTex, shininess: 8 });
    // BoxGeometry material order: +x, -x, +y, -y, +z(front), -z
    const headMats = [M.skin, M.skin, M.skin, M.skin, faceMat, M.skin];

    /* ── HELPER: rounded box ── */
    function roundedBox(w, h, d, t) {
      const geo = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const len = Math.sqrt(x*x + y*y + z*z) || 0.001;
        pos.setXYZ(i, x + (x/len - x)*t, y + (y/len - y)*t, z + (z/len - z)*t);
      }
      geo.computeVertexNormals();
      return geo;
    }

    /* ── CHARACTER ROOT ── */
    const root = new THREE.Group();
    scene.add(root);

    /* ── HEAD ── */
    const headGrp = new THREE.Group();
    headGrp.position.y = 3.05;
    root.add(headGrp);

    const headMesh = new THREE.Mesh(roundedBox(1.1, 1.22, 1.02, 0.28), headMats);
    headGrp.add(headMesh);

    // Ear stubs
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), M.skin);
      ear.position.set(s * 0.57, 0.05, 0);
      headGrp.add(ear);
    });

    // Hair - main top mass
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.62, 1.1), M.hair);
    hairTop.position.y = 0.66;
    headGrp.add(hairTop);

    // Hair - sides
    [-1, 1].forEach(s => {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.96, 0.96), M.hair);
      sh.position.set(s * 0.66, 0.05, 0);
      headGrp.add(sh);
    });

    // Hair - back flap
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.2, 0.28), M.hair);
    hairBack.position.set(0, 0.08, -0.62);
    headGrp.add(hairBack);

    // Spikes
    [
      [0,    1.14, 0,  0, 0, 0   ],
      [-0.28,1.08, 0,  0, 0, 0.2 ],
      [ 0.28,1.08, 0,  0, 0,-0.2 ],
      [-0.56,0.97, 0,  0, 0, 0.44],
      [ 0.56,0.97, 0,  0, 0,-0.44],
    ].forEach(([x,y,z,rx,ry,rz]) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.44, 6), M.hair);
      spike.position.set(x, y, z);
      spike.rotation.set(rx, ry, rz);
      headGrp.add(spike);
    });

    // Fringe (front hair strand)
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.2), M.hair);
    fringe.position.set(0.2, 0.36, 0.56);
    fringe.rotation.z = -0.12;
    headGrp.add(fringe);

    // Goggles (forehead)
    const gogGrp = new THREE.Group();
    gogGrp.position.set(0, 0.37, 0.53);
    headGrp.add(gogGrp);

    gogGrp.add(new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.19, 0.09), M.goggle)); // strap

    [-0.28, 0.28].forEach(ox => {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.11, 16), M.lens);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(ox, 0, 0.04);
      gogGrp.add(lens);

      const rim2 = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.036, 8, 16), M.goggle);
      rim2.rotation.x = Math.PI / 2;
      rim2.position.set(ox, 0, 0.05);
      gogGrp.add(rim2);
    });
    // bridge between lenses
    gogGrp.add(Object.assign(
      new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.08, 0.09), M.goggle),
      { position: new THREE.Vector3(0, 0, 0) }
    ));

    /* ── NECK ── */
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.36, 8), M.skin);
    neck.position.y = 2.62;
    root.add(neck);

    /* ── TORSO ── */
    const bodyGrp = new THREE.Group();
    bodyGrp.position.y = 1.85;
    root.add(bodyGrp);

    bodyGrp.add(new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.48, 0.82), M.coat)); // coat

    // collar/inner
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.64, 0.17), M.inner);
    collar.position.set(0, 0.36, 0.41);
    bodyGrp.add(collar);

    // lapels
    [-1, 1].forEach(s => {
      const lap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.85, 0.07), M.coat);
      lap.position.set(s * 0.22, 0.2, 0.42);
      lap.rotation.z = s * -0.13;
      bodyGrp.add(lap);
    });

    // belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.15, 0.88), M.gold);
    belt.position.y = -0.68;
    bodyGrp.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.24, 0.11), M.gold);
    buckle.position.set(0, -0.68, 0.44);
    bodyGrp.add(buckle);

    /* ── ARMS ── */
    const armData = {};
    [-1, 1].forEach(s => {
      const grp = new THREE.Group();
      grp.position.set(s * 0.9, 2.42, 0);
      root.add(grp);

      // upper arm
      grp.add(Object.assign(
        new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.9, 8), M.coat),
        { position: new THREE.Vector3(0, -0.45, 0) }
      ));

      // forearm sub-group (elbow pivot)
      const fGrp = new THREE.Group();
      fGrp.position.y = -0.9;
      grp.add(fGrp);

      fGrp.add(Object.assign(
        new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.78, 8), M.coat),
        { position: new THREE.Vector3(0, -0.39, 0) }
      ));

      // cuff
      fGrp.add(Object.assign(
        new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.11, 8), M.goggle),
        { position: new THREE.Vector3(0, -0.64, 0) }
      ));

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), M.skin);
      hand.scale.set(1, 0.82, 1);
      hand.position.y = -0.84;
      fGrp.add(hand);

      armData[s] = { grp, fGrp };
    });

    // resting angle
    armData[-1].grp.rotation.z =  0.13;
    armData[ 1].grp.rotation.z = -0.13;

    /* ── LEGS ── */
    [-0.34, 0.34].forEach(ox => {
      const lg = new THREE.Group();
      lg.position.set(ox, 1.12, 0);
      root.add(lg);

      lg.add(Object.assign(
        new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 1.08, 8), M.pants),
        { position: new THREE.Vector3(0, -0.54, 0) }
      ));
      lg.add(Object.assign(
        new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.18, 0.96, 8), M.pants),
        { position: new THREE.Vector3(0, -1.54, 0) }
      ));

      // boot
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.62), M.shoe);
      boot.position.set(0, -2.1, 0.1);
      lg.add(boot);

      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), M.shoe);
      toe.scale.set(1, 0.65, 1.3);
      toe.position.set(0, -2.1, 0.33);
      lg.add(toe);
    });

    /* ── ANIMATION STATE ── */
    let isWaving = false, waveElapsed = 0;
    const WAVE_DUR = 2.8;
    let idleT = 0;
    let tRY = 0, tRX = 0, cRY = 0, cRX = 0;
    let smiling = false;

    if (!isMobile) {
      window.addEventListener('mousemove', e => {
        tRY = (e.clientX / window.innerWidth  - 0.5) * 0.65;
        tRX = (e.clientY / window.innerHeight - 0.5) * 0.28;
      });
    }

    renderer.domElement.addEventListener('click', () => {
      if (isMobile) {
        smiling = !smiling;
        faceMat.map = smiling ? smileTex : faceTex;
        faceMat.needsUpdate = true;
      } else {
        if (!isWaving) { isWaving = true; waveElapsed = 0; }
      }
    });

    const wrap = document.getElementById('characterWrap');
    if (wrap) wrap.style.pointerEvents = 'auto';

    /* ── RENDER LOOP ── */
    const clock = new THREE.Clock();

    function tick() {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      idleT += dt;

      // Idle float + gentle sway
      root.position.y = Math.sin(idleT * 0.75) * 0.1;

      // Subtle head bob
      headGrp.rotation.z = Math.sin(idleT * 0.58) * 0.024;
      headGrp.rotation.x = Math.sin(idleT * 0.46) * 0.018;

      // Mouse parallax (PC)
      if (!isMobile) {
        cRY += (tRY - cRY) * 0.06;
        cRX += (tRX - cRX) * 0.06;
        root.rotation.y = cRY;
        root.rotation.x = cRX * 0.4;
        headGrp.rotation.y = cRY * 0.55;
      }

      // Wave
      if (isWaving) {
        waveElapsed += dt;
        if (waveElapsed >= WAVE_DUR) {
          isWaving = false;
          armData[1].grp.rotation.z = -0.13;
          armData[1].fGrp.rotation.z = 0;
        } else {
          const raise = Math.min(1, waveElapsed * 4);
          const wave  = Math.sin(waveElapsed * 6.5) * 0.38;
          armData[1].grp.rotation.z = -0.13 + (-1.5 - (-0.13)) * raise + wave * raise;
          armData[1].fGrp.rotation.z = 0.55 * raise;
        }
      } else {
        armData[1].grp.rotation.z += (-0.13 - armData[1].grp.rotation.z) * 0.08;
        armData[1].fGrp.rotation.z += (0    - armData[1].fGrp.rotation.z) * 0.08;
      }

      // Idle left arm drift
      armData[-1].grp.rotation.z = 0.13 + Math.sin(idleT * 0.75) * 0.016;

      renderer.render(scene, camera);
    }

    tick();

    window.addEventListener('resize', () => {
      const nW = container.offsetWidth;
      const nH = container.offsetHeight;
      if (nW && nH) {
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
        renderer.setSize(nW, nH);
      }
    });
  }

  // Load Three.js if not already present, then init
  if (window.THREE) {
    init();
  } else {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
    s.onload  = init;
    s.onerror = () => console.warn('[character3d] Three.js failed to load');
    document.head.appendChild(s);
  }
})();
