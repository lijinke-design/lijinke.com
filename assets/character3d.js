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
    // Use the WRAP rect (not container) — container hasn't been laid out yet on first paint
    const wrapRect = wrap?.getBoundingClientRect();
    const W = (wrapRect?.width  | 0) || container.offsetWidth  || (isMobile ? 130 : 320);
    const H = (wrapRect?.height | 0) || container.offsetHeight || (isMobile ? 130 : 500);
    console.log('[character3d] init dims', {
      wrapRect: wrapRect ? [wrapRect.x|0, wrapRect.y|0, wrapRect.width|0, wrapRect.height|0] : null,
      container: [container.offsetWidth, container.offsetHeight],
      computed: [W, H],
      isMobile,
      innerWidth: window.innerWidth
    });

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

    /* ── DEBUG: axes + test cube — visible BEFORE the model loads ── */
    const axes = new THREE.AxesHelper(1.0);
    scene.add(axes);
    const testCube = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
    );
    scene.add(testCube);
    // Temporary camera while model loads so cube + axes are visible
    camera.position.set(1.5, 1.5, 3);
    camera.lookAt(0, 0, 0);

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

        // Center model at world origin (cleaner framing math)
        model.position.sub(center);
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

        // Simple, robust camera framing: fit largest dimension with margin
        const fov = camera.fov * Math.PI / 180;
        const maxDim = Math.max(size.x, size.y);
        const aspect = camera.aspect;
        // Account for aspect ratio when fitting horizontally
        const fitDist = (size.y * 0.55) / Math.tan(fov / 2);
        const fitDistX = (size.x * 0.55) / (Math.tan(fov / 2) * aspect);
        const dist = Math.max(fitDist, fitDistX);

        if (isMobile) {
          // Mobile circle: aim a bit higher to favor face/upper body
          const yLook = size.y * 0.20;
          camera.position.set(0, yLook, dist * 0.85);
          camera.lookAt(0, yLook, 0);
        } else {
          camera.position.set(0, 0, dist);
          camera.lookAt(0, 0, 0);
        }
        // Keep axes + cube as anchors so we can compare positions
        axes.scale.setScalar(Math.max(size.y * 0.6, 0.3));
        testCube.position.set(size.x * 0.7 + 0.2, 0, 0);
        testCube.scale.setScalar(size.y * 0.15);

        // Probe: solid red cube at world origin (model center, MeshBasic = not light-dependent)
        const probe = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 0.2),
          new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        probe.scale.setScalar(size.y);
        scene.add(probe);

        // Verify the model is in the scene tree
        let meshCount = 0, hasSkinnedMesh = false;
        model.traverse(o => {
          if (o.isMesh) meshCount++;
          if (o.isSkinnedMesh) hasSkinnedMesh = true;
        });

        modelReady = true;
        console.log('[character3d] model ready', {
          url: MODEL_URL,
          size_xyz: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)],
          center_xyz: [+center.x.toFixed(2), +center.y.toFixed(2), +center.z.toFixed(2)],
          dist: +dist.toFixed(2),
          camera: camera.position.toArray().map(v => +v.toFixed(2)),
          meshCount,
          hasSkinnedMesh,
          animations: gltf.animations.map(a => a.name),
          modelVisible: model.visible
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

    function resize() {
      const r = wrap?.getBoundingClientRect();
      const nW = (r?.width | 0) || container.offsetWidth;
      const nH = (r?.height | 0) || container.offsetHeight;
      if (nW && nH) {
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
        renderer.setSize(nW, nH);
        console.log('[character3d] resized canvas to', nW, 'x', nH);
      }
    }
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap || container);
    // Trigger an extra resize after layout has settled
    requestAnimationFrame(resize);
    setTimeout(resize, 300);
  }

  function showFallback() {
    const wrap = document.getElementById('characterWrap');
    if (wrap) wrap.style.display = 'none';
    console.error('[character3d] character hidden — see error above');
  }
})();
