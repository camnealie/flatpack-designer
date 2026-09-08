import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Assembly, AssemblyPart } from '../lib/model3d/assembly';
import type { ProjectItem, CabinetItem } from '../lib/project/types';
import type { SheetMaterial } from '../lib/pricing/suppliers';
import type { Warning } from '../lib/project/summary';

interface ModelViewerProps {
  assembly: Assembly;
  material: SheetMaterial;
  selected: ProjectItem | undefined;
  onSelectItem: (id: string) => void;
  warnings: Warning[];
  /** Material thickness, for working out a carcass's clear opening */
  thickness: number;
}

/**
 * Live 3D view of the job.
 *
 * The scene is rebuilt from scratch whenever anything changes - a few dozen
 * boxes, so a rebuild is cheaper than diffing and keeps the model honest.
 * The renderer, camera and controls are set up once and survive rebuilds, so
 * the view you orbited to stays put while the furniture changes underneath it.
 *
 * Panels are drawn the way the material actually is: laminate on the two big
 * faces, bare ply on all four sawn edges. That is not decoration - the edges
 * are the ones that need sanding and rounding over, and seeing which ones will
 * show is most of deciding how much finishing work a design costs.
 */
export function ModelViewer({
  assembly,
  material,
  selected,
  onSelectItem,
  warnings,
  thickness,
}: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const framedRef = useRef<ViewFit | null>(null);
  // Which panels changed, and when that happened, so the rest can be held back
  // long enough to see it
  const focusRef = useRef<{ ids: Set<string>; startedAt: number } | null>(null);
  // Where each panel actually is on screen right now. Panels are rebuilt from
  // scratch on every change, so this is what lets a rebuilt shelf start from
  // where the old one was rather than appearing at its new height.
  const livePosesRef = useRef(new Map<string, THREE.Vector3>());
  const movingRef = useRef<MovingPart[]>([]);
  const frameViewRef = useRef<() => void>(() => {});
  // Latest click handler, so the one-time scene setup never goes stale
  const pickRef = useRef<(x: number, y: number) => void>(() => {});

  const [doorsOpen, setDoorsOpen] = useState(false);
  const [showEdges, setShowEdges] = useState(true);

  const selectedId = selected?.id;

  // One-time scene setup. Everything created here is disposed on unmount.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef1f5');

    const camera = new THREE.PerspectiveCamera(
      40,
      mount.clientWidth / mount.clientHeight,
      1,
      20000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // Stop the orbit at the floor - looking up through the ground reads as a bug
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(1400, 2200, 1800);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 100;
    key.shadow.camera.far = 12000;
    key.shadow.camera.left = -4000;
    key.shadow.camera.right = 4000;
    key.shadow.camera.top = 4000;
    key.shadow.camera.bottom = -4000;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.42);
    fill.position.set(-1600, 900, -1200);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30000, 30000),
      new THREE.ShadowMaterial({ opacity: 0.15 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(9000, 45, 0xc3cbd6, 0xdfe4ea);
    grid.position.y = -0.5;
    scene.add(grid);

    const content = new THREE.Group();
    scene.add(content);
    contentRef.current = content;

    // Click to select, but only when it was a click and not the end of an orbit
    let downAt = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const moved =
        Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y);
      if (moved > 4) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pickRef.current(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    let frame = 0;
    let lastFrame = performance.now();

    const animate = () => {
      frame = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;

      settle(movingRef.current, livePosesRef.current, delta);
      applyFocus(content, focusRef.current, now);

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);

      // First real size: the job has never actually been framed, so do it now
      if (!framedRef.current) frameViewRef.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      disposeChildren(scene);
      // The next mount gets a fresh camera at the origin, so the framing it
      // inherited from this one no longer means anything.
      framedRef.current = null;
    };
  }, []);

  // Rebuild whenever the job, the material or the view options change
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const previous = livePosesRef.current;

    disposeChildren(content);
    const moving = buildMeshes(content, assembly, {
      doorAngle: doorsOpen ? Math.PI / 2.4 : 0,
      showEdges,
      selectedId,
      faceColor: material.faceColor,
      edgeColor: material.edgeColor,
      gloss: material.finish === 'gloss',
    });

    // What the user just did is whatever appeared or shifted. Tracking moves as
    // well as arrivals is what makes removing a shelf register at all: nothing
    // is added, but every remaining shelf slides to a new height.
    const changed = new Set<string>();

    for (const part of moving) {
      const was = previous.get(part.partId);

      if (!was) {
        changed.add(part.partId);
        continue;
      }

      if (was.distanceToSquared(part.target) > MOVED_MM * MOVED_MM) {
        changed.add(part.partId);
      }

      // Pick up where the old panel left off, then walk to the new position
      part.object.position.copy(was);
    }

    movingRef.current = moving;

    // Nothing to point at if the whole scene is new - that is a first paint or
    // a wholesale change, not an edit worth highlighting
    if (previous.size > 0 && changed.size > 0 && changed.size < moving.length) {
      focusRef.current = { ids: changed, startedAt: performance.now() };
    }

    livePosesRef.current = new Map(
      moving.map((part) => [part.partId, part.object.position.clone()])
    );

    // Sit the job on the origin so orbiting spins it about its own middle
    const { min, max } = assembly.bounds;
    content.position.set(-(min.x + max.x) / 2, 0, -(min.z + max.z) / 2);
  }, [assembly, doorsOpen, showEdges, selectedId, material]);

  const frameView = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    // A panel not laid out yet has no aspect ratio to solve against. The resize
    // observer comes back for it once it has a size.
    if (!Number.isFinite(camera.aspect) || camera.aspect <= 0) return;

    const fit = viewFit(assembly);

    // A three-quarter view onto the front - the angle that shows the face, one
    // side and the top at once.
    const azimuth = Math.PI / 5;
    const elevation = Math.PI / 7;

    const direction = new THREE.Vector3(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(azimuth) * Math.cos(elevation)
    );

    const target = new THREE.Vector3(0, fit.centreY, 0);
    const distance = fitDistance(camera, fit, direction) * FRAMING_MARGIN;

    camera.position.copy(target).addScaledVector(direction, distance);
    controls.target.copy(target);
    controls.update();

    framedRef.current = fit;
  }, [assembly]);

  // Re-frame when the job changes scale enough to fall out of view - adding an
  // item, or going from a wall cabinet to a full-height one. Small edits leave
  // the camera alone, because re-framing on every keystroke fights whatever the
  // user just orbited to.
  useEffect(() => {
    frameViewRef.current = frameView;

    if (needsReframe(framedRef.current, viewFit(assembly))) frameView();
  }, [assembly, frameView]);

  // Picking needs the current camera, scene and callback
  useEffect(() => {
    pickRef.current = (x, y) => {
      const camera = cameraRef.current;
      const content = contentRef.current;
      if (!camera || !content) return;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      for (const hit of raycaster.intersectObjects(content.children, true)) {
        const itemId = hit.object.userData.itemId;
        if (typeof itemId === 'string') {
          onSelectItem(itemId);
          return;
        }
      }
    };
  }, [onSelectItem]);

  const panelCount = assembly.parts.filter((p) => p.role !== 'hinge').length;
  const inside =
    selected?.kind === 'cabinet' ? clearOpening(selected, thickness) : null;
  const hasDoors = assembly.parts.some((p) => p.role === 'door');

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <PanelBar title="The job">
        {hasDoors && (
          <ViewToggle label="Doors open" checked={doorsOpen} onChange={setDoorsOpen} />
        )}
        <ViewToggle label="Edges" checked={showEdges} onChange={setShowEdges} />
        <button
          type="button"
          onClick={frameView}
          className="rounded px-1.5 py-0.5 text-[12px] text-signal hover:bg-signal/10
            focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
        >
          Reset view
        </button>
      </PanelBar>

      <div ref={mountRef} className="min-h-0 flex-1 bg-[#eef1f5]" />

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-rule
        px-3 py-1 text-[11px]">
        {inside && (
          // The item list already carries the outside size. What it cannot tell
          // you is whether your things will go in.
          <Readout label="Inside">
            {Math.round(inside.width)} × {Math.round(inside.height)} ×{' '}
            {Math.round(inside.depth)}mm
          </Readout>
        )}
        <Readout label="Panels">{panelCount}</Readout>
        <span className="ml-auto text-[11px] text-graphite/40">
          Click a part to select it · drag to orbit
        </span>
      </div>

      {warnings.length > 0 && (
        <div className="border-t border-amber-200 bg-amber-50 px-3 py-1">
          {warnings.map((warning) => (
            <p key={warning.message} className="text-[11px] leading-snug text-amber-800">
              {warning.message}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** The title bar every panel in the console shares. */
export function PanelBar({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-rule bg-white
      px-3 py-1">
      <h2 className="text-[12px] font-medium text-graphite">{title}</h2>
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  );
}

function ViewToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-graphite/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-rule text-signal focus:ring-1
          focus:ring-signal focus:ring-offset-0"
      />
      {label}
    </label>
  );
}

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-graphite/40">{label}</span>
      <span className="font-medium tabular-nums text-graphite">{children}</span>
    </span>
  );
}

/**
 * The clear opening inside a carcass - what will actually fit in it.
 *
 * Width loses both side panels, height loses whichever fixed shelves are
 * fitted, and depth is the full depth since nothing obstructs it.
 */
function clearOpening(item: CabinetItem, t: number) {
  return {
    width: Math.max(0, item.width - 2 * t),
    height: Math.max(
      0,
      item.height - (item.fixedTop ? t : 0) - (item.fixedBottom ? t : 0)
    ),
    depth: item.depth,
  };
}

interface BuildOptions {
  doorAngle: number;
  showEdges: boolean;
  selectedId: string | undefined;
  faceColor: string;
  edgeColor: string;
  gloss: boolean;
}

/**
 * The envelope for holding the rest of the piece back.
 *
 * Quick to dim so the change registers immediately, a beat to look at it, then
 * a brisk return - the way back is deliberately short because by then you have
 * already seen what you needed to and waiting for it is just waiting.
 */
const FOCUS_ATTACK_MS = 110;
const FOCUS_HOLD_MS = 780;
const FOCUS_RELEASE_MS = 430;
const FOCUS_TOTAL_MS = FOCUS_ATTACK_MS + FOCUS_HOLD_MS + FOCUS_RELEASE_MS;

/** How far a panel has to shift before it counts as having moved (mm) */
const MOVED_MM = 1;

/** How long a panel takes to travel to a new position, seconds */
const SETTLE_SECONDS = 0.42;

const HINGE_COLOR = 0x8d96a3;
const EDGE_LINE = 0x6b5334;
const SELECT_LINE = 0x1d4ed8;

interface DoorPivot {
  group: THREE.Group;
  x: number;
  z: number;
}

/**
 * A thing in the scene that can be asked to move somewhere.
 *
 * Panels are rebuilt from scratch on every change, so without this a shelf
 * that shifts to make room for a new one simply teleports. Handing back what
 * was built, and where it belongs, lets the caller start each piece wherever
 * it was last seen and walk it to its new home.
 */
interface MovingPart {
  partId: string;
  /** The mesh, or for a door the group it swings in */
  object: THREE.Object3D;
  target: THREE.Vector3;
}

function buildMeshes(
  root: THREE.Group,
  assembly: Assembly,
  options: BuildOptions
): MovingPart[] {
  // Each door hangs in its own group pivoted on the hinge axis, so opening it
  // is one rotation rather than trigonometry on the door and every cup.
  const pivots = new Map<string, DoorPivot>();
  const moving: MovingPart[] = [];

  for (const part of assembly.parts) {
    if (part.role === 'hinge') continue;

    const mesh = meshFor(part, options);

    if (!part.swing) {
      mesh.position.set(part.position.x, part.position.y, part.position.z);
      root.add(mesh);
      moving.push({
        partId: part.id,
        object: mesh,
        target: mesh.position.clone(),
      });
      continue;
    }

    // The hinge runs down the door's back face at the hinge edge, not through
    // the middle of the panel - a door pivoted on its centreline swings into
    // the carcass it is supposed to clear.
    const pivotZ = part.position.z - part.size.z / 2;

    const group = new THREE.Group();
    group.position.set(part.swing.pivotX, 0, pivotZ);
    group.rotation.y = part.swing.direction * options.doorAngle;
    root.add(group);

    mesh.position.set(
      part.position.x - part.swing.pivotX,
      part.position.y,
      part.position.z - pivotZ
    );
    group.add(mesh);

    pivots.set(part.id, { group, x: part.swing.pivotX, z: pivotZ });
    moving.push({
      partId: part.id,
      object: group,
      target: group.position.clone(),
    });
  }

  for (const part of assembly.parts) {
    if (part.role !== 'hinge' || !part.attachedTo) continue;

    const pivot = pivots.get(part.attachedTo);
    if (!pivot) continue;

    const mesh = meshFor(part, options);
    mesh.position.set(
      part.position.x - pivot.x,
      part.position.y,
      part.position.z - pivot.z
    );
    pivot.group.add(mesh);
  }

  return moving;
}

function meshFor(part: AssemblyPart, options: BuildOptions): THREE.Mesh {
  const selected = part.itemId === options.selectedId;

  const geometry =
    part.shape === 'cylinder'
      ? cylinderGeometry(part)
      : new THREE.BoxGeometry(part.size.x, part.size.y, part.size.z);

  const mesh = new THREE.Mesh(geometry, materialsFor(part, options));
  mesh.castShadow = !part.ghost;
  mesh.receiveShadow = true;
  mesh.userData.itemId = part.itemId;
  mesh.userData.partId = part.id;

  if (options.showEdges && part.shape === 'box') {
    // Without outlines a stack of same-coloured panels turns into one white
    // blob; they are also how the selected item is picked out.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: selected ? SELECT_LINE : EDGE_LINE,
        transparent: true,
        opacity: selected ? 0.95 : 0.35,
      })
    );
    edges.userData.itemId = part.itemId;
    mesh.add(edges);
  }

  return mesh;
}

/**
 * Laminate on the faces, bare ply on the edges.
 *
 * A sheet is laminated on its two big faces and raw everywhere the saw has
 * been, so the faces are whichever pair is perpendicular to the panel's
 * thinnest axis and the other four sides are core. Box faces come in the order
 * +x, -x, +y, -y, +z, -z, which is what the index arithmetic below is picking
 * out.
 */
function materialsFor(
  part: AssemblyPart,
  options: BuildOptions
): THREE.Material | THREE.Material[] {
  if (part.role === 'hinge') {
    return new THREE.MeshStandardMaterial({
      color: HINGE_COLOR,
      roughness: 0.4,
      metalness: 0.6,
    });
  }

  const face = new THREE.MeshStandardMaterial({
    color: options.faceColor,
    roughness: options.gloss ? 0.25 : 0.7,
    metalness: 0.02,
    transparent: part.ghost === true,
    opacity: part.ghost ? 0.45 : 1,
  });
  face.userData.ghost = part.ghost === true;

  const edge = new THREE.MeshStandardMaterial({
    color: options.edgeColor,
    roughness: 0.85,
    metalness: 0,
    transparent: part.ghost === true,
    opacity: part.ghost ? 0.45 : 1,
  });
  edge.userData.ghost = part.ghost === true;

  if (part.shape !== 'box') return face;

  const thinAxis =
    part.size.x <= part.size.y && part.size.x <= part.size.z
      ? 0
      : part.size.y <= part.size.z
        ? 1
        : 2;

  // Two entries per axis, so the laminated pair starts at twice the axis index
  return [0, 1, 2, 3, 4, 5].map((slot) =>
    Math.floor(slot / 2) === thinAxis ? face : edge
  );
}

/**
 * Walk every panel toward where it now belongs.
 *
 * Shelves redistribute whenever one is added or removed, and a redistribution
 * you cannot see happen is indistinguishable from the model glitching. Easing
 * a fixed fraction of the remaining distance each frame gets there quickly and
 * settles rather than stopping dead, and it survives being interrupted - which
 * matters, because dragging the shelf slider interrupts it constantly.
 */
function settle(
  moving: MovingPart[],
  live: Map<string, THREE.Vector3>,
  delta: number
): void {
  if (moving.length === 0) return;

  const rate = 1 - Math.pow(0.001, delta / SETTLE_SECONDS);

  for (const part of moving) {
    const at = part.object.position;

    if (at.distanceToSquared(part.target) < 0.01) {
      at.copy(part.target);
    } else {
      at.lerp(part.target, rate);
    }

    live.get(part.partId)?.copy(at);
  }
}

/**
 * Hold everything back except what just changed.
 *
 * Once the window has passed every panel is left fully opaque and
 * non-transparent again, because a scene of transparent meshes sorts badly and
 * costs more to draw than it is worth.
 */
function applyFocus(
  root: THREE.Object3D,
  focus: { ids: Set<string>; startedAt: number } | null,
  now: number
): void {
  if (!focus) return;

  const elapsed = now - focus.startedAt;
  if (elapsed > FOCUS_TOTAL_MS + 200) return;

  const dim =
    elapsed < FOCUS_ATTACK_MS
      ? elapsed / FOCUS_ATTACK_MS
      : elapsed < FOCUS_ATTACK_MS + FOCUS_HOLD_MS
        ? 1
        : Math.max(
            0,
            1 - (elapsed - FOCUS_ATTACK_MS - FOCUS_HOLD_MS) / FOCUS_RELEASE_MS
          );

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;

    const id = node.userData.partId;
    if (typeof id !== 'string') return;

    const held = dim > 0.01 && !focus.ids.has(id);
    const opacity = held ? 1 - 0.72 * dim : 1;

    for (const material of materialsOf(node)) {
      // Ghost panels carry their own transparency and must keep it
      if (material.userData.ghost) continue;

      const transparent = opacity < 0.999;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
      material.depthWrite = !transparent;
    }
  });
}

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** A hinge cup: a disc lying in the door's face, so its axis runs along Z. */
function cylinderGeometry(part: AssemblyPart): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(
    part.size.x / 2,
    part.size.x / 2,
    part.size.z,
    24
  );
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/**
 * Drop everything under an object and release its GPU memory.
 *
 * The scene is rebuilt on every change, so geometries and materials would
 * otherwise pile up in VRAM one keystroke at a time.
 */
function disposeChildren(root: THREE.Object3D) {
  for (const child of [...root.children]) {
    child.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
        node.geometry.dispose();
        const material = node.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });
    root.remove(child);
  }
}

// Breathing room once the job fits the frame exactly
const FRAMING_MARGIN = 1.08;

/**
 * The job as the camera has to deal with it: half-extents about the point the
 * view is centred on, plus how far up that point sits.
 */
interface ViewFit {
  halfX: number;
  halfY: number;
  halfZ: number;
  centreY: number;
}

function viewFit(assembly: Assembly): ViewFit {
  const { min, max } = assembly.bounds;

  return {
    halfX: Math.max((max.x - min.x) / 2, 50),
    halfY: Math.max((max.y - min.y) / 2, 50),
    halfZ: Math.max((max.z - min.z) / 2, 50),
    centreY: (min.y + max.y) / 2,
  };
}

/**
 * How far back the camera has to sit for the whole job to be in shot.
 *
 * Estimating this from the largest dimension looks right until the job is wide
 * and the view is angled: in perspective the near end of a long run projects
 * bigger than the far end, and a distance that fits the box on paper crops it
 * on screen. So this solves the real constraint - for each corner of the
 * bounding box, the distance at which it lands exactly on the frustum edge -
 * and takes the furthest.
 */
function fitDistance(
  camera: THREE.PerspectiveCamera,
  fit: ViewFit,
  direction: THREE.Vector3
): number {
  const tanV = Math.tan((camera.fov * Math.PI) / 360);
  const tanH = tanV * camera.aspect;

  const forward = direction.clone().negate();
  const right = new THREE.Vector3()
    .crossVectors(forward, new THREE.Vector3(0, 1, 0))
    .normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  const corner = new THREE.Vector3();
  let distance = 0;

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corner.set(sx * fit.halfX, sy * fit.halfY, sz * fit.halfZ);

        const depth = corner.dot(forward);
        const needed =
          Math.max(
            Math.abs(corner.dot(right)) / tanH,
            Math.abs(corner.dot(up)) / tanV
          ) - depth;

        distance = Math.max(distance, needed);
      }
    }
  }

  return distance;
}

// How far the job can drift from the framing before the camera catches up
const REFRAME_TOLERANCE = 0.25;

function needsReframe(framed: ViewFit | null, current: ViewFit): boolean {
  if (!framed) return true;

  return (
    driftedTooFar(framed.halfX, current.halfX) ||
    driftedTooFar(framed.halfY, current.halfY) ||
    driftedTooFar(framed.halfZ, current.halfZ)
  );
}

function driftedTooFar(before: number, after: number): boolean {
  if (before <= 0) return after > 0;

  const ratio = after / before;
  return ratio < 1 - REFRAME_TOLERANCE || ratio > 1 + REFRAME_TOLERANCE;
}
