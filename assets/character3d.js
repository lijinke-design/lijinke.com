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

    /* ── STATE + REST POSE ── */
    let currentVrm = null;
    let modelReady = false;
    let waveT = 0;

    // Natural "稍息 / contrapposto" rest pose offsets (applied every frame after vrm.update)
    // VRM 1.0 normalized bones: T-pose = all identity. We override to a casual standing pose.
    const POSE = {
      // Arms hang down at ~75° from horizontal (slightly out from body, not stiff vertical)
      leftUpperArm:  { x: 0,    y: 0,    z:  Math.PI * 0.42 },  // +75° → arm down on the left
      rightUpperArm: { x: 0,    y: 0,    z: -Math.PI * 0.42 },  // -75° → arm down on the right
      // Slight inward forearm tuck so hands rest in front of thighs (not stuck out)
      leftLowerArm:  { x: 0,    y:  0.15, z: 0 },
      rightLowerArm: { x: 0,    y: -0.15, z: 0 },
      // Weight on LEFT leg → hips tilt slightly to the right side
      hips:          { x: 0,    y: 0,    z: -0.05 },
      // Right leg slightly bent + foot pointing out (the resting leg)
      rightUpperLeg: { x: 0.08, y: 0.06, z: 0 },
      leftUpperLeg:  { x: 0,    y: 0,    z: 0 },
      // Spine counter-tilts to keep the head over the supporting foot
      spine:         { x: 0,    y: 0,    z:  0.04 },
      // Subtle head tilt for personality
      head:          { x: 0,    y: 0,    z:  0.02 },
    };

    /* ── REST POSE APPLICATION HELPER ── */
    function applyRestPose(vrm) {
      if (!vrm.humanoid) return;
      for (const [boneName, rot] of Object.entries(POSE)) {
        const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
        if (bone) bone.rotation.set(rot.x, rot.y, rot.z);
      }
    }

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

        // Apply the rest pose ONCE before bbox so the body is compact (not T-pose)
        applyRestPose(vrm);

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

        // Camera framing — fit BOTH width and height of the bbox
        const fov = camera.fov * Math.PI / 180;
        const aspect = camera.aspect;
        const fitForHeight = (size.y * 0.55) / Math.tan(fov / 2);
        const fitForWidth  = (size.x * 0.55) / (Math.tan(fov / 2) * aspect);
        const dist = Math.max(fitForHeight, fitForWidth) + 0.2; // margin

        if (isMobile) {
          // Mobile circle: zoom in on head + shoulders
          const headY = center.y + size.y * 0.30;
          camera.position.set(0, headY, dist * 0.45);
          camera.lookAt(0, headY, 0);
        } else {
          // Desktop: full body
          camera.position.set(0, center.y, dist);
          camera.lookAt(0, center.y, 0);
        }

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
        // 1) VRM internal update (spring bones, expressions)
        currentVrm.update(dt);

        // 2) Idle float (gentle breathing)
        currentVrm.scene.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.012;

        // 3) Re-apply rest pose AFTER vrm.update so it persists each frame
        applyRestPose(currentVrm);

        // 4) Body parallax + head look-at cursor
        if (!isMobile) {
          cRY += (tRY - cRY) * 0.06;
          cRX += (tRX - cRX) * 0.06;
          root.rotation.y = cRY;

          // Layer head rotation on top of the rest pose tilt
          const head = currentVrm.humanoid?.getNormalizedBoneNode('head');
          if (head) {
            head.rotation.set(
              POSE.head.x + cRX * 0.35,
              POSE.head.y - cRY * 0.6,
              POSE.head.z
            );
          }
        }

        // 5) Wave animation overrides ONLY the right upper arm during waveT > 0
        if (waveT > 0) {
          const rArm = currentVrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
          if (rArm) {
            const elapsed = (1 - waveT) * WAVE_DUR;
            let lift, wiggle;
            if (elapsed < 0.4) {
              lift = elapsed / 0.4; wiggle = 0;
            } else if (elapsed < 2.0) {
              lift = 1; wiggle = Math.sin((elapsed - 0.4) * 9) * 0.32;
            } else {
              lift = (2.4 - elapsed) / 0.4; wiggle = 0;
            }
            // Wave target: arm raised up + slightly forward, opposite Z direction from rest (down)
            // Rest right arm: z = -1.32 (down). Wave target: z = +0.8 (up). Lerp by `lift`.
            const restZ = POSE.rightUpperArm.z;
            const waveZ = 0.9;
            rArm.rotation.set(
              POSE.rightUpperArm.x,
              POSE.rightUpperArm.y,
              restZ + (waveZ - restZ) * lift + wiggle * lift
            );
          }
          waveT -= dt / WAVE_DUR;
          if (waveT < 0) waveT = 0;
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
