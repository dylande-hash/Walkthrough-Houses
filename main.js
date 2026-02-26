import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js';

const canvas = document.getElementById('c');
const loadingEl = document.getElementById('loading');
const pEl = document.getElementById('p');
const pctEl = document.getElementById('pct');
const msgEl = document.getElementById('msg');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c10);

// Lighting (developer sales vibe)
const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2f3a, 0.95);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(18, -18, 28);
key.castShadow = false;
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 0.55);
fill.position.set(-22, 22, 18);
scene.add(fill);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 500);
camera.position.set(10, -14, 3.2);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.06;
orbit.target.set(20, 10, 2.2);

const walk = new PointerLockControls(camera, renderer.domElement);

// Basic WASD controller for walk mode
const keys = { w:false, a:false, s:false, d:false, shift:false, space:false, c:false };
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') keys.w = true;
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS') keys.s = true;
  if (e.code === 'KeyD') keys.d = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
  if (e.code === 'Space') keys.space = true;
  if (e.code === 'KeyC') keys.c = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') keys.w = false;
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS') keys.s = false;
  if (e.code === 'KeyD') keys.d = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
  if (e.code === 'Space') keys.space = false;
  if (e.code === 'KeyC') keys.c = false;
});

let mode = 'orbit'; // 'orbit' | 'walk'
let overlaysVisible = true;
let modelRoot = null;

function setMode(next) {
  mode = next;
  if (mode === 'walk') {
    orbit.enabled = false;
    msgEl.textContent = 'Click canvas to enter walk mode';
  } else {
    orbit.enabled = true;
    walk.unlock();
  }
}

document.getElementById('btnWalk').addEventListener('click', () => setMode('walk'));
document.getElementById('btnOrbit').addEventListener('click', () => setMode('orbit'));

document.getElementById('btnReset').addEventListener('click', () => {
  setMode('orbit');
  camera.position.set(10, -14, 3.2);
  orbit.target.set(20, 10, 2.2);
  orbit.update();
});

document.getElementById('btnOverlays').addEventListener('click', () => {
  overlaysVisible = !overlaysVisible;
  if (!modelRoot) return;
  modelRoot.traverse((obj) => {
    if (!obj.isMesh) return;
    const n = (obj.name || '').toLowerCase();
    // overlays are semi-transparent in the exported model
    if (n.includes('overlay') || n.includes('turn') || n.includes('hoist')) {
      obj.visible = overlaysVisible;
    }
    // also toggle by material opacity heuristic
    if (obj.material && obj.material.transparent && obj.material.opacity < 0.9) {
      obj.visible = overlaysVisible;
    }
  });
});

renderer.domElement.addEventListener('click', () => {
  if (mode !== 'walk') return;
  if (!walk.isLocked) walk.lock();
});

walk.addEventListener('lock', () => { msgEl.textContent = 'Walk mode active'; });
walk.addEventListener('unlock', () => { msgEl.textContent = 'Orbit mode active'; });

// Load GLB
const loader = new GLTFLoader();
loader.load(
  './model.glb',
  (gltf) => {
    modelRoot = gltf.scene;
    // improve material response
    modelRoot.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = false;
      obj.receiveShadow = true;

      // Convert vertex colors into proper mesh material
      if (obj.material) {
        obj.material.vertexColors = true;
        obj.material.needsUpdate = true;

        // Make glass look like glass
        const n = (obj.name || '').toLowerCase();
        if (n.includes('glass')) {
          obj.material.transparent = true;
          obj.material.opacity = 0.45;
          obj.material.roughness = 0.08;
          obj.material.metalness = 0.0;
        } else {
          obj.material.roughness = 0.78;
          obj.material.metalness = 0.05;
        }
      }
    });

    scene.add(modelRoot);

    // Frame the model
    const box = new THREE.Box3().setFromObject(modelRoot);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    orbit.target.copy(center);
    camera.position.set(center.x, center.y - size.y * 0.65, center.z + Math.max(3.0, size.z * 0.18));
    orbit.update();

    loadingEl.style.display = 'none';
    setMode('orbit');
  },
  (xhr) => {
    if (!xhr.total) return;
    const pct = Math.round((xhr.loaded / xhr.total) * 100);
    pEl.style.width = pct + '%';
    pctEl.textContent = pct + '%';
    msgEl.textContent = 'Loading model';
  },
  (err) => {
    console.error(err);
    msgEl.textContent = 'Failed to load model';
  }
);

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (mode === 'walk' && walk.isLocked) {
    const speed = keys.shift ? 6.2 : 3.2;

    // Move in camera local space
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.z = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,0,1)).normalize();

    const move = new THREE.Vector3();
    if (keys.w) move.add(forward);
    if (keys.s) move.sub(forward);
    if (keys.d) move.add(right);
    if (keys.a) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      camera.position.add(move);
    }

    // simple vertical adjust
    const vSpeed = 2.4;
    if (keys.space) camera.position.z += vSpeed * dt;
    if (keys.c) camera.position.z -= vSpeed * dt;

    // keep within a sensible z band
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, 0.6, 10.0);
  } else {
    orbit.update();
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
