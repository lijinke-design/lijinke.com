// VRM character — loads a real rigged 3D anime model and animates it.
// Uses @pixiv/three-vrm v3 (VRM 1.0 standard).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const MODEL_URL = 'assets/me.vrm?v=1';

window.char3dActive = true;

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const container = document.getElementById('character');
    const wrap = document.getElementById('characterWrap');
    if (!container || !wrap) { console.warn('[character] DOM nodes missing'); return; }

    container.innerHTML = '';
    wrap.style.display = '';
    wrap.style.pointerEvents = 'auto';

    const isMobile = window.innerWidth < 900;
    const wrapRect = wrap.getBoundingClientRect();
    const W = (wrapRect.width  | 0) || container.offsetWidth  || (isMobile ? 130 : 320);
    const H = (wrapRect.height | 0) || container.offsetHeight || (isMobile ? 130 : 500);

    /* ── SCENE / CAMERA / RENDERER ── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 50);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      width: '100%', height: '100%', display: 'block', pointerEvents: 'auto'
    });

    /* ── LIGHTS (purple/pink theme to match site) ── */
    scene.add(new THREE.AmbientLight(0xb8a8ff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff5e8, 1.4);
    sun.position.set(2, 4, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xd946ef, 0.85);
    rim.position.set(-3, 3, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x88ccff, 0.35);
    fill.position.set(0, -1, 4);
    scene.add(fill);

    /* ── ROOT GROUP (parallax target) ── */
    const root = new THREE.Group();
    scene.add(root);

    /* ── STATE ── */
    let currentVrm = null;
    let modelReady = false;
    let waveT = 0;
    let restRotR = null;  // saved rest rotation of right upper arm

    /* ── LOAD VRM ── */
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));

    loader.load(
      MODEL_URL,
      gltf => {
        const vrm = gltf.userData.vrm;
        if (!vrm) {
          console.error('[character] no VRM data in file');
          return showFallback();
        }
        currentVrm = vrm;

        // Optimize the model
        VRMUtils.removeUnnecessaryVertices(vrm.scene);
        VRMUtils.combineSkeletons(vrm.scene);

        // VRM 1.0 default forward is +Z (toward camera). No rotation needed.
        root.add(vrm.scene);

        // Mesh-only bbox (skip bones)
        vrm.scene.updateMatrixWorld(true);
        const box = new THREE.Box3();
        const tmp = new THREE.Box3();
        vrm.scene.traverse(c => {
          if ((c.isMesh || c.isSkinnedMesh) && c.geometry) {
            if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
            tmp.copy(c.geometry.boundingBox).applyMatrix4(c.matrixWorld);
            box.union(tmp);
          }
        });
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Camera framing
        const fov = camera.fov * Math.PI / 180;
        if (isMobile) {
          // Mobile circle: zoom in on head + shoulders
          const headY = center.y + size.y * 0.32;
          const dist = (size.y * 0.20) / Math.tan(fov / 2);
          camera.position.set(0, headY, dist);
          camera.lookAt(0, headY, 0);
        } else {
          // Desktop: full body with small margin
          const dist = (size.y * 0.58) / Math.tan(fov / 2);
          camera.position.set(0, center.y, dist);
          camera.lookAt(0, center.y, 0);
        }

        // Save rest pose for right upper arm (for wave animation)
        const rArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
        if (rArm) restRotR = rArm.rotation.clone();

        modelReady = true;
        console.log('[character] VRM ready',
          'size_y=', size.y.toFixed(2),
          'center_y=', center.y.toFixed(2),
          'meta=', vrm.meta?.name || vrm.meta?.title || '(no name)',
          'humanoid=', !!vrm.humanoid
        );
      },
      xhr => {
        if (xhr.lengthComputable) {
          const pct = (xhr.loaded / xhr.total * 100).toFixed(0);
          if (['10','25','50','75','100'].includes(pct)) {
            console.log('[character] downloading', pct + '%');
          }
        }
      },
      err => {
        console.error('[character] VRM load failed:', err);
        showFallback();
      }
    );

    /* ── MOUSE PARALLAX ── */
    let tRY = 0, tRX = 0, cRY = 0, cRX = 0;
    if (!isMobile) {
      window.addEventListener('mousemove', e => {
        tRY = (e.clientX / window.innerWidth  - 0.5) * 0.55;
        tRX = (e.clientY / window.innerHeight - 0.5) * 0.22;
      });
    }

    /* ── CLICK → WAVE + EMOJI ── */
    wrap.addEventListener('click', e => {
      if (e.target.closest('.bubble')) return;
      if (waveT <= 0) waveT = 1.0;

      const el = document.createElement('div');
      el.textContent = '👋';
      Object.assign(el.style, {
        position: 'absolute',
        fontSize: isMobile ? '24px' : '38px',
        pointerEvents: 'none',
        top: '20%',
        left: (38 + Math.random() * 24) + '%',
        zIndex: '100',
        animation: 'char-emojiBurst 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      });
      wrap.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    });

    /* ── RENDER LOOP ── */
    const clock = new THREE.Clock();
    const WAVE_DUR = 2.4;

    function tick() {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);

      if (modelReady && currentVrm) {
        // VRM update (spring bones, expressions)
        currentVrm.update(dt);

        // Idle float
        currentVrm.scene.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.015;

        // Body parallax
        if (!isMobile) {
          cRY += (tRY - cRY) * 0.06;
          cRX += (tRX - cRX) * 0.06;
          root.rotation.y = cRY;

          // Head looks at cursor (counter-rotate)
          const head = currentVrm.humanoid?.getNormalizedBoneNode('head');
          if (head) {
            head.rotation.y = -cRY * 0.6;
            head.rotation.x = cRX * 0.35;
          }
        }

        // Wave animation on right upper arm (sign chosen to raise to the side)
        const rArm = currentVrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
        if (rArm && restRotR) {
          if (waveT > 0) {
            const elapsed = (1 - waveT) * WAVE_DUR;
            // 3 phases: raise (0..0.4s) → wave (0.4..2.0s) → lower (2.0..2.4s)
            let lift, wave;
            if (elapsed < 0.4) {
              lift = elapsed / 0.4;
              wave = 0;
            } else if (elapsed < 2.0) {
              lift = 1;
              wave = Math.sin((elapsed - 0.4) * 9) * 0.32;
            } else {
              lift = (2.4 - elapsed) / 0.4;
              wave = 0;
            }
            // Negative Z rotation raises the right arm to the side
            rArm.rotation.z = restRotR.z + (-1.55 * lift) + wave * lift;
            rArm.rotation.x = restRotR.x;
            rArm.rotation.y = restRotR.y;
            waveT -= dt / WAVE_DUR;
            if (waveT < 0) {
              waveT = 0;
              rArm.rotation.copy(restRotR);
            }
          }
        }
      }

      renderer.render(scene, camera);
    }
    tick();

    /* ── RESIZE ── */
    function resize() {
      const r = wrap.getBoundingClientRect();
      const nW = (r.width | 0) || container.offsetWidth;
      const nH = (r.height | 0) || container.offsetHeight;
      if (nW && nH) {
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
        renderer.setSize(nW, nH);
      }
    }
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    requestAnimationFrame(resize);
  }

  function showFallback() {
    const wrap = document.getElementById('characterWrap');
    if (wrap) wrap.style.display = 'none';
    console.error('[character] hidden due to load failure');
  }
})();
