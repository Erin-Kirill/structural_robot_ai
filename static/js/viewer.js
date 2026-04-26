let scene, camera, renderer, controls;
let model = null;

const VIEWER_HEIGHT = 380;

document.addEventListener("DOMContentLoaded", () => {
  initViewer();
  loadModel();
});

function initViewer() {
  const container = document.getElementById("viewer");
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / VIEWER_HEIGHT,
    0.1,
    10000
  );
  camera.position.set(120, 120, 120);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, VIEWER_HEIGHT);

  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));

  const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
  light1.position.set(100, 120, 120);
  scene.add(light1);

  const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
  light2.position.set(-120, -100, -80);
  scene.add(light2);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  renderer.render(scene, camera);
}

// ================= COLOR LOGIC =================

function severityColor(thickness, threshold) {
  const safe = new THREE.Color(0x22c55e);
  const warn = new THREE.Color(0xfacc15);
  const danger = new THREE.Color(0xef4444);

  const ratio = thickness / threshold;

  if (ratio <= 1) return danger;
  if (ratio <= 1.5) return warn;
  return safe;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ================= HEATMAP =================

function buildVertexColors(geometry, thickness, threshold) {

  const pos = geometry.attributes.position;
  const count = pos.count;

  const colors = new Float32Array(count * 3);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  const targetColor = severityColor(thickness, threshold);
  const safe = new THREE.Color(0x22c55e);

  for (let i = 0; i < count; i++) {

    const y = pos.getY(i);

    // верх модели = зона риска
    const heightRatio = (y - box.min.y) / size.y;

    const intensity = smoothstep(0.6, 1.0, heightRatio);

    const c = safe.clone().lerp(targetColor, intensity);

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// ================= MODEL =================

async function loadModel() {
  const res = await fetch("/robot/model");
  const data = await res.json();

  if (!data.model) return;

  const loader = new THREE.STLLoader();

  loader.load(data.model, geometry => {

    if (model) {
      scene.remove(model);
    }

    const g = geometry.toNonIndexed();
    g.computeVertexNormals();
    g.center();

    buildVertexColors(g, 10, 5); // начальный цвет

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9
    });

    model = new THREE.Mesh(g, material);
    scene.add(model);
  });
}

// ================= UPDATE =================

function renderModelIndicator(thickness, threshold) {
  if (!model) return;

  buildVertexColors(model.geometry, thickness, threshold);
  model.geometry.attributes.color.needsUpdate = true;
}

// ================= EXPORT =================

window.renderModelIndicator = renderModelIndicator;
window.loadModel = loadModel;