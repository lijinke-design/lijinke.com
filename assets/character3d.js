// character3d.js — ES Module
// Loads a real 3D character via GLTFLoader and animates it.
// MODEL_URL is the only thing to swap when you have a better model.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

window.char3dActive = true;

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const container = document.getElementById('character');
    if (!container) { console.warn('[character3d] no #character container'); return; }
    container.innerHTML = '';

    const wrap = document.getElementById('characterWrap');
    if (wrap) {
      wrap.style.display = '';        // undo any prior hide
      wrap.style.pointerEvents = 'auto';
    }

    const isMobile = window.innerWidth < 900;
    const W = container.offsetWidth  || (isMobile ? 130 : 320);
    const H = container.offsetHeight || (isMobile ? 130 : 500);

    /* ── SCENE / CAMERA / RENDERER ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      width: '100%', height: '100%', display: 'block', pointerEvents: 'auto'
    });

    /* ── LIGHTS (matching site purple/pink theme) ── */
    scene.add(new THREE.AmbientLight(0x9988ff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.5);
    sun.position.set(2, 4, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xd946ef, 1.0);
    rim.position.set(-3, 3, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x88ccff, 0.4);
    fill.position.set(0, -1, 4);
    scene.add(fill);

    /* ── ROOT GROUP (we apply idle float + mouse parallax to this) ── */
    const root = new THREE.Group();
    scene.add(root);

    /* ── STATE ── */
    let mixer = null;
    const actions = {};
    let idleAction = null;
    let modelReady = false;
    let cycleActions = [];    // wave / yes / no / thumbsup — rotates on click
    let cycleIdx = 0;

    /* ── LOAD MODEL ── */
    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      gltf => {
        const model = gltf.scene;
        model.traverse(obj => {
          if (obj.isMesh) {
            obj.castShadow = false;
            obj.receiveShadow = false;
          }
        });

        // Auto-fit camera using bounding box
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Center horizontally, drop feet to y=0
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= box.min.y;
        root.add(model);

        // Animation mixer
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach(clip => {
          const a = mixer.clipAction(clip);
          actions[clip.name] = a;
        });

        // Find an idle clip
        idleAction =
          actions['Idle'] || actions['idle'] ||
          actions[Object.keys(actions)[0]];
        if (idleAction) {
          idleAction.play();
        }

        // One-shot reaction clips for clicks
        ['Wave', 'Yes', 'ThumbsUp', 'Punch', 'No'].forEach(name => {
          if (actions[name]) {
            actions[name].setLoop(THREE.LoopOnce);
            actions[name].clampWhenFinished = false;
            cycleActions.push(actions[name]);
          }
        });

        // Camera framing
        const fov = camera.fov * Math.PI / 180;
        if (isMobile) {
          // Head only — circular crop on mobile
          const headY = size.y * 0.92;
          const headRadius = size.y * 0.18;
          const dist = (headRadius * 2.2) / Math.tan(fov / 2);
          camera.position.set(0, headY, dist);
          camera.lookAt(0, headY, 0);
        } else {
          // Full body
          const centerY = size.y * 0.50;
          const dist = (size.y * 0.62) / Math.tan(fov / 2);
          camera.position.set(0, centerY + size.y * 0.04, dist);
          camera.lookAt(0, centerY, 0);
        }

        modelReady = true;
        console.log('[character3d] model ready', {
          url: MODEL_URL,
          size: size.toArray().map(v => +v.toFixed(2)),
          animations: gltf.animations.map(a => a.name)
        });
      },
      xhr => {
        if (xhr.lengthComputable) {
          const pct = (xhr.loaded / xhr.total * 100).toFixed(0);
          if (pct === '50' || pct === '100') console.log('[character3d] loading', pct + '%');
        }
      },
      err => {
        console.error('[character3d] model load failed:', err);
        showFallback();
      }
    );

    /* ── INTERACTION ── */
    let tRY = 0, tRX = 0, cRY = 0, cRX = 0;
    if (!isMobile) {
      window.addEventListener('mousemove', e => {
        tRY = (e.clientX / window.innerWidth  - 0.5) * 0.7;
        tRX = (e.clientY / window.innerHeight - 0.5) * 0.2;
      });
    }

    renderer.domElement.addEventListener('click', () => {
      if (!modelReady || !cycleActions.length) return;
      const a = cycleActions[cycleIdx % cycleActions.length];
      cycleIdx++;
      a.reset();
      a.fadeIn(0.15);
      a.play();
      // After clip ends, fade out so it doesn't linger
      const dur = a.getClip().duration;
      setTimeout(() => a.fadeOut(0.3), Math.max(0, dur * 1000 - 250));
    });

    /* ── RENDER LOOP ── */
    const clock = new THREE.Clock();
    function tick() {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (mixer) mixer.update(dt);

      if (modelReady) {
        // Idle bob
        root.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.04;

        // Mouse parallax (PC only)
        if (!isMobile) {
          cRY += (tRY - cRY) * 0.06;
          cRX += (tRX - cRX) * 0.06;
          root.rotation.y = cRY;
        }
      }
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

  function showFallback() {
    const wrap = document.getElementById('characterWrap');
    if (wrap) wrap.style.display = 'none';
    console.error('[character3d] character hidden — see error above');
  }
})();
