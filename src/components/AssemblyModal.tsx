import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Assembly } from '../lib/model3d/assembly';
import { buildChoreography } from '../lib/model3d/choreography';
import type { PanelMove } from '../lib/model3d/choreography';
import { buildPlan } from '../lib/project/buildPlan';
import type { BuildStep } from '../lib/project/buildPlan';
import type { ProjectItem } from '../lib/project/types';
import type { NestedSheetResult } from '../lib/nesting/types';
import type { SheetMaterial, Supplier } from '../lib/pricing/suppliers';

interface AssemblyModalProps {
  onClose: () => void;
  assembly: Assembly;
  sheets: NestedSheetResult[];
  items: ProjectItem[];
  supplier: Supplier;
  material: SheetMaterial;
  holeCount: number;
}

/**
 * The build, one step at a time.
 *
 * This started as an animation and became a set of instructions, because the
 * thing standing between someone and ordering a sheet of ply is not curiosity,
 * it is nerve: a box of rectangles turns up and they have no idea where to
 * begin. A film of it assembling itself is nice to watch and answers none of
 * that. Nine numbered steps, each with the panels involved and the screws that
 * go in, answers all of it - and the count itself is the reassurance, because
 * nine is a number you can hold.
 *
 * Every panel is the same mesh in both poses, so nothing is faked: what lifts
 * off the sheet is the rectangle the machine actually cuts, holes and all.
 */
export function AssemblyModal({
  onClose,
  assembly,
  sheets,
  items,
  supplier,
  material,
  holeCount,
}: AssemblyModalProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Set up by the scene effect, called when the step changes. Screws are the
  // one thing that has to be rebuilt rather than eased, so they get a hook of
  // their own rather than forcing the whole scene to rebuild.
  const screwRendererRef = useRef<((step: BuildStep) => void) | undefined>(undefined);
  const [index, setIndex] = useState(0);

  const plan = useMemo(
    () => buildPlan(assembly, items, supplier, material.thickness, holeCount),
    [assembly, items, supplier, material.thickness, holeCount]
  );

  const step = plan.steps[Math.min(index, plan.steps.length - 1)];

  // The render loop reads the step every frame, and React state does not move
  // at 60fps, so it reads this instead
  const stepRef = useRef<BuildStep>(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const choreography = buildChoreography(assembly, sheets, material.thickness);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101419');

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight),
      1,
      40000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(1800, 2600, 2000);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x89a7d6, 0.5);
    rim.position.set(-1800, 800, -1400);
    scene.add(rim);

    const content = new THREE.Group();
    scene.add(content);

    // The sheets the panels start out on
    const sheetMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1f27,
      transparent: true,
      opacity: 0.9,
    });
    const sheetGroup = new THREE.Group();
    for (const sheet of choreography.sheets) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(sheet.width, sheet.height),
        sheetMaterial
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(
        sheet.origin.x + sheet.width / 2,
        -1,
        sheet.origin.z + sheet.height / 2
      );
      sheetGroup.add(plane);

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(sheet.width, sheet.height)),
        new THREE.LineBasicMaterial({ color: 0x3f74d6 })
      );
      outline.rotation.x = -Math.PI / 2;
      outline.position.copy(plane.position);
      sheetGroup.add(outline);
    }
    content.add(sheetGroup);

    const face = new THREE.MeshStandardMaterial({
      color: material.faceColor,
      roughness: material.finish === 'gloss' ? 0.3 : 0.72,
      metalness: 0.02,
    });
    // The prep steps are about the edges, so the edges get their own material
    // that can be lit up without touching the faces
    const edge = new THREE.MeshStandardMaterial({
      color: material.edgeColor,
      roughness: 0.85,
      emissive: new THREE.Color(0x000000),
    });
    const holeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b1f26,
      roughness: 0.9,
    });
    // Screws are only on screen while they go in. Once a joint is made, what
    // matters is the joint, and a permanent row of markers just clutters the
    // piece you are trying to look at.
    const screwMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0a53a,
      roughness: 0.3,
      metalness: 0.6,
      emissive: new THREE.Color(0x4a2f06),
      transparent: true,
    });

    interface PanelView {
      group: THREE.Group;
      move: PanelMove;
      holes: THREE.Group;
    }

    const panels: PanelView[] = [];
    for (const move of choreography.panels) {
      const group = new THREE.Group();
      group.position.copy(move.from.position);
      group.quaternion.copy(move.from.quaternion);
      content.add(group);

      const geometry = new THREE.BoxGeometry(move.size.w, move.size.t, move.size.h);
      // Thickness runs along local Y, so the laminated faces are the Y pair
      const mesh = new THREE.Mesh(geometry, [edge, edge, face, face, edge, edge]);
      group.add(mesh);

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x7c8798, transparent: true, opacity: 0.55 })
      );
      group.add(outline);

      // Holes sit just proud of the face so they read as bores, not decals
      const holes = new THREE.Group();
      holes.visible = false;
      for (const hole of move.holes) {
        const bore = new THREE.Mesh(
          new THREE.CylinderGeometry(hole.diameter / 2, hole.diameter / 2, 1.4, 16),
          holeMaterial
        );
        bore.position.set(hole.x, hole.face * (move.size.t / 2), hole.z);
        holes.add(bore);
      }
      group.add(holes);

      panels.push({ group, move, holes });
    }

    // Screws are built once and revealed per step
    const screwGroup = new THREE.Group();
    content.add(screwGroup);

    // Each screw waits its turn, drives home, sits a moment, then goes. These
    // live out here because the render loop reads them every frame and is
    // defined before the step that fills them in.
    interface DrivingScrew {
      group: THREE.Group;
      material: THREE.MeshStandardMaterial;
      seated: THREE.Vector3;
      direction: THREE.Vector3;
      startAt: number;
    }

    let driving: DrivingScrew[] = [];
    let stepStartedAt = performance.now();
    // Small enough to read as a screw rather than a bollard, but still a few
    // pixels across at the distance a whole carcass is viewed from
    const SCREW_RADIUS = 4.5;
    const SCREW_LENGTH = 56;
    const screwGeometry = new THREE.CylinderGeometry(
      SCREW_RADIUS,
      SCREW_RADIUS,
      SCREW_LENGTH,
      10
    );
    const headGeometry = new THREE.CylinderGeometry(
      SCREW_RADIUS * 1.9,
      SCREW_RADIUS * 1.9,
      6,
      10
    );

    // A stand-in board for the two prep steps. Sanding and rounding over happen
    // to every panel, so showing them on the whole job says nothing; showing
    // one board up close says exactly what the work is. It is deliberately not
    // one of the real panels - this is a demonstration, not an instruction to
    // do it to that particular piece.
    const demo = new THREE.Group();
    demo.visible = false;
    // Turned so the edge being worked is the one facing the camera - there is
    // no point demonstrating on the side you cannot see
    demo.rotation.y = Math.PI;
    content.add(demo);

    const DEMO_LENGTH = 620;
    const DEMO_WIDTH = 240;

    const demoBoard = boardMesh(
      DEMO_WIDTH,
      material.thickness,
      DEMO_LENGTH,
      Math.min(3, material.thickness / 2 - 0.5),
      face,
      edge
    );
    demo.add(demoBoard);

    const toolMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f74d6,
      roughness: 0.45,
      metalness: 0.2,
    });
    const cutter = new THREE.Mesh(
      new THREE.CylinderGeometry(26, 26, 44, 20),
      toolMaterial
    );
    demo.add(cutter);

    // Camera: wide enough for the sheets, close enough for the finished piece
    const halfV = (camera.fov * Math.PI) / 360;
    const shotFor = (box: THREE.Box3) => {
      const centre = box.getCenter(new THREE.Vector3());
      const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 300);
      const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
      return { centre, distance: (radius / Math.sin(Math.min(halfV, halfH))) * 1.06 };
    };

    const wide = shotFor(choreography.flatBounds.clone().union(choreography.builtBounds));
    const close = shotFor(choreography.builtBounds);
    content.position.set(-wide.centre.x, 0, -wide.centre.z);

    // The demo sits where the camera already looks when it is pulled in close
    demo.position.set(close.centre.x, material.thickness / 2, close.centre.z);

    const recentre = (v: THREE.Vector3) =>
      new THREE.Vector3(v.x - wide.centre.x, v.y, v.z - wide.centre.z);
    const wideTarget = recentre(wide.centre);
    const closeTarget = recentre(close.centre);

    // The controls look in world space and the content group is offset, so the
    // demo's shot is recentred the same way the other two are
    const demoShot = {
      centre: new THREE.Vector3(closeTarget.x, 110, closeTarget.z),
      distance: DEMO_LENGTH * 1.9,
    };

    const direction = new THREE.Vector3(0.42, 0.5, 0.76).normalize();
    controls.target.copy(wideTarget);
    camera.position.copy(wideTarget).addScaledVector(direction, wide.distance);
    controls.update();

    let userDriving = false;
    controls.addEventListener('start', () => {
      userDriving = true;
    });

    // Each panel eases toward wherever this step wants it, so changing step
    // reads as the panel moving rather than teleporting
    const progress = new Map<string, number>();
    for (const panel of panels) progress.set(panel.move.id, 0);

    let frame = 0;
    let last = performance.now();

    const animate = () => {
      frame = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;

      const current = stepRef.current;
      const placed = new Set(current.placed);

      // Screws: wait, drive home, hold, then leave
      const sinceStep = now - stepStartedAt;
      for (const screw of driving) {
        const elapsed = sinceStep - screw.startAt;

        const drive = clamp01(elapsed / SCREW_DRIVE_MS);
        const gone = clamp01(
          (elapsed - SCREW_DRIVE_MS - SCREW_HOLD_MS) / SCREW_FADE_MS
        );

        screw.group.visible = elapsed > 0 && gone < 1;
        screw.group.position
          .copy(screw.seated)
          .addScaledVector(screw.direction, -SCREW_TRAVEL * (1 - ease(drive)));
        screw.material.opacity = 1 - gone;
      }

      let built = 0;
      for (const panel of panels) {
        const want = placed.has(panel.move.id) ? 1 : 0;
        const at = progress.get(panel.move.id) ?? 0;
        // A fixed rate rather than a spring: every panel takes the same time to
        // travel, so a step that moves three panels does not feel slower than
        // one that moves a single panel
        const stepped = at + Math.sign(want - at) * delta * 1.6;
        const clamped = Math.min(1, Math.max(0, stepped));
        const settled = Math.abs(want - clamped) < 0.01 ? want : clamped;
        progress.set(panel.move.id, settled);

        const t = ease(settled);
        built += t;

        panel.group.position.lerpVectors(
          panel.move.from.position,
          panel.move.to.position,
          t
        );
        panel.group.quaternion
          .copy(panel.move.from.quaternion)
          .slerp(panel.move.to.quaternion, t);
        panel.group.position.y += Math.sin(Math.PI * t) * 320;

        panel.holes.visible = current.showHoles && panel.move.holes.length > 0;
      }

      // Edges glow while the step is about the edges
      const glow = current.highlightEdges ? 0.55 + Math.sin(now / 380) * 0.12 : 0;
      edge.emissive.setRGB(glow * 0.75, glow * 0.45, glow * 0.1);

      const sheetFade = 1 - Math.min(1, built / Math.max(1, panels.length));
      sheetMaterial.opacity = 0.9 * sheetFade;
      sheetGroup.visible = sheetFade > 0.02;

      // The prep step is about one board, so the job steps aside for it
      const prepping = current.kind === 'prep';

      demo.visible = prepping;
      sheetGroup.visible = sheetGroup.visible && !prepping;
      for (const panel of panels) panel.group.visible = !prepping;

      if (prepping) {
        // The cutter runs back and forth along the edge being worked
        const sweep = triangle((now % 2600) / 2600);
        cutter.position.set(
          -DEMO_WIDTH / 2 - 14,
          material.thickness / 2,
          (sweep - 0.5) * (DEMO_LENGTH - 140)
        );
      }

      if (!userDriving) {
        const t = ease(Math.min(1, built / Math.max(1, panels.length)));
        const shot = prepping
          ? demoShot
          : {
              centre: wideTarget.clone().lerp(closeTarget, t),
              distance: wide.distance + (close.distance - wide.distance) * t,
            };

        const angle = camera.position.clone().sub(controls.target).normalize();
        controls.target.lerp(shot.centre, prepping ? 0.12 : 0.08);
        camera.position.copy(controls.target).addScaledVector(angle, shot.distance);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const renderScrews = (current: BuildStep) => {
      for (const screw of driving) screw.material.dispose();
      screwGroup.clear();
      driving = [];
      stepStartedAt = performance.now();

      current.screws.forEach((screw, index) => {
        const orientation = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          screw.direction
        );

        // Own material per screw, since each fades on its own schedule
        const material = screwMaterial.clone();

        const group = new THREE.Group();

        const shank = new THREE.Mesh(screwGeometry, material);
        shank.quaternion.copy(orientation);
        shank.position.addScaledVector(screw.direction, SCREW_LENGTH / 2 - 10);
        group.add(shank);

        const head = new THREE.Mesh(headGeometry, material);
        head.quaternion.copy(orientation);
        head.position.addScaledVector(screw.direction, -3);
        group.add(head);

        screwGroup.add(group);

        driving.push({
          group,
          material,
          seated: screw.head.clone(),
          direction: screw.direction.clone(),
          startAt: index * SCREW_STAGGER_MS,
        });
      });
    };
    renderScrews(step);
    screwRendererRef.current = renderScrews;

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      screwRendererRef.current = undefined;

      scene.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
          node.geometry.dispose();
        }
      });
      screwGeometry.dispose();
      headGeometry.dispose();
      toolMaterial.dispose();
      for (const screw of driving) screw.material.dispose();
      [face, edge, holeMaterial, screwMaterial, sheetMaterial].forEach((m) =>
        m.dispose()
      );
    };
    // The scene is built once for a given job; the step drives it through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembly, sheets, material]);

  useEffect(() => {
    screwRendererRef.current?.(step);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setIndex((i) => Math.min(plan.steps.length - 1, i + 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, plan.steps.length]);

  const atEnd = index >= plan.steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#101419]"
      role="dialog"
      aria-modal="true"
      aria-label="Build guide"
    >
      <div className="flex shrink-0 items-center gap-3 px-4 py-2.5">
        <h2 className="text-[14px] font-semibold text-white">Building it</h2>
        <p className="text-[12px] text-white/40">
          {plan.steps.length} steps &middot; arrow keys to move through
        </p>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded px-2 py-1 text-[13px] text-white/60
            hover:bg-white/10 hover:text-white focus:outline-none
            focus-visible:ring-1 focus-visible:ring-white/60"
        >
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div ref={mountRef} className="min-h-0 min-w-0 flex-1" />

        {/* The whole list stays visible, because seeing that it ends is most of
            what makes it feel doable */}
        <ol className="hidden w-[264px] shrink-0 overflow-y-auto border-l
          border-white/10 py-2 md:block">
          {plan.steps.map((s, i) => {
            const done = i < index;
            const current = i === index;

            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={current}
                  className={`flex w-full items-baseline gap-2.5 px-3 py-1.5 text-left
                    focus:outline-none focus-visible:bg-white/10 ${
                      current ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                >
                  <span
                    className={`w-4 shrink-0 text-[11px] tabular-nums ${
                      done ? 'text-emerald-400' : current ? 'text-white' : 'text-white/30'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span
                    className={`text-[12px] leading-snug ${
                      current ? 'text-white' : done ? 'text-white/45' : 'text-white/55'
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-white">
              <span className="text-white/40">Step {index + 1}. </span>
              {step.title}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/60">
              {step.instruction}
            </p>
            {(step.tool || step.screws.length > 0) && (
              <p className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-white/40">
                {step.tool && <span>{step.tool}</span>}
                {step.screws.length > 0 && (
                  <span>
                    {step.screws.length} screw
                    {step.screws.length === 1 ? '' : 's'} this step
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="rounded border border-white/20 px-2.5 py-1 text-[12px]
                text-white/70 hover:bg-white/10 disabled:border-white/5
                disabled:text-white/20 focus:outline-none focus-visible:ring-1
                focus-visible:ring-white/60"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                atEnd ? onClose() : setIndex((i) => i + 1)
              }
              className="rounded bg-white px-3 py-1 text-[12px] font-medium
                text-[#101419] hover:bg-white/90 focus:outline-none
                focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {atEnd ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// How a screw goes in: one after another, driven home, a beat, then gone
const SCREW_STAGGER_MS = 160;
const SCREW_DRIVE_MS = 420;
const SCREW_HOLD_MS = 900;
const SCREW_FADE_MS = 420;
/** How far out a screw starts, mm */
const SCREW_TRAVEL = 70;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 0 to 1 and back again, so a tool sweeps rather than teleporting home. */
function triangle(t: number): number {
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

/**
 * A board with one edge optionally rounded over.
 *
 * Built as a cross-section extruded along the length, so the round-over is the
 * actual profile rather than a shading trick - which matters, because the
 * whole point of the step is showing what that edge becomes.
 */
function boardMesh(
  width: number,
  thickness: number,
  length: number,
  radius: number,
  face: THREE.Material,
  edge: THREE.Material
): THREE.Mesh {
  const shape = new THREE.Shape();
  const r = Math.max(0, Math.min(radius, thickness / 2 - 0.2));

  // Cross-section: the worked edge is at x = 0, the rest runs back to x = width
  shape.moveTo(r, 0);
  shape.lineTo(width, 0);
  shape.lineTo(width, thickness);
  shape.lineTo(r, thickness);
  if (r > 0) {
    shape.quadraticCurveTo(0, thickness, 0, thickness - r);
    shape.lineTo(0, r);
    shape.quadraticCurveTo(0, 0, r, 0);
  } else {
    shape.lineTo(0, thickness);
    shape.lineTo(0, 0);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    curveSegments: 6,
  });
  // Extrusion runs along +Z from the profile plane; centre it on the origin
  geometry.translate(-width / 2, -thickness / 2, -length / 2);

  assignByNormal(geometry);
  return new THREE.Mesh(geometry, [face, edge]);
}

/**
 * Split a board's surfaces into laminate and bare ply.
 *
 * Extruding hands back two groups - the end caps and everything else - which
 * is not the split that matters here: the "everything else" run holds both the
 * laminated faces and the sawn edges. Since the whole point of these steps is
 * the edge, the groups are rebuilt from the surface normals instead, so the
 * two flat faces come out laminated and every edge, rounded or not, comes out
 * as ply.
 */
function assignByNormal(geometry: THREE.BufferGeometry): void {
  const normals = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  const count = index ? index.count : normals.count;

  geometry.clearGroups();

  let runStart = 0;
  let runMaterial = -1;

  for (let i = 0; i < count; i += 3) {
    const vertex = index ? index.getX(i) : i;
    // Thickness runs along Y, so a face pointing that way is a laminated one
    const material = Math.abs(normals.getY(vertex)) > 0.7 ? 0 : 1;

    if (material !== runMaterial) {
      if (runMaterial >= 0) geometry.addGroup(runStart, i - runStart, runMaterial);
      runStart = i;
      runMaterial = material;
    }
  }

  geometry.addGroup(runStart, count - runStart, Math.max(0, runMaterial));
}

/** easeInOutCubic - settles rather than stopping dead */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
