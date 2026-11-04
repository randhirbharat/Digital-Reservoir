"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Reading, SensorRec } from "@/lib/twin";
import { COND_COLOR } from "@/lib/twin";

export interface Layers { structure: boolean; foundation: boolean; reservoir: boolean; galleries: boolean; sensors: boolean; labels: boolean }
export interface Pick { kind: "sensor" | "component"; id: string; label: string; point?: [number, number, number] }

/**
 * Parametric demonstration dam. Local coordinates (from the asset record): x along the crest, y downstream from the
 * upstream face, z above the foundation. Three.js uses y-up, so (x, y, z)_dam → (x, z, y)_three.
 */
export function DamScene({ geometry, sensors, readings, layers, selected, levelM, onPick, focusKey }: {
  geometry: any; sensors: SensorRec[]; readings: Reading[]; layers: Layers; selected: string | null; levelM: number | null;
  onPick: (p: Pick) => void; focusKey?: string | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setLayers: (l: Layers) => void; setSelected: (id: string | null) => void; setColors: (r: Reading[]) => void; setLevel: (z: number | null) => void; focus: (id: string) => void } | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const el = host.current!;
    const g = geometry || {};
    const L = g.length_m ?? 140, Ht = g.height_m ?? 60, crestW = g.crest_width_m ?? 8, baseW = g.base_width_m ?? 52, brk = g.downstream_break_m ?? 50, blocks = g.blocks ?? 7;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0B1820");
    scene.fog = new THREE.Fog("#0B1820", 350, 700);
    const camera = new THREE.PerspectiveCamera(42, el.clientWidth / el.clientHeight, 0.5, 2000);
    camera.position.set(-150, 95, 170);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const labels = new CSS2DRenderer();
    labels.setSize(el.clientWidth, el.clientHeight);
    Object.assign(labels.domElement.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none" });
    el.appendChild(labels.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 25, 20);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 40;
    controls.maxDistance = 600;

    scene.add(new THREE.HemisphereLight("#DCE9E4", "#10232D", 1.1));
    const sun = new THREE.DirectionalLight("#ffffff", 1.4);
    sun.position.set(-120, 200, -60);
    scene.add(sun);

    const groups = { structure: new THREE.Group(), foundation: new THREE.Group(), reservoir: new THREE.Group(), galleries: new THREE.Group(), sensors: new THREE.Group(), labels: [] as CSS2DObject[] };
    Object.values(groups).forEach((gr) => gr instanceof THREE.Group && scene.add(gr));

    // Dam blocks: extrude the cross-section (y, z) along x.
    const section = (spill: boolean) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(baseW, 0);
      if (spill) { const sc = g.spillway?.crest_level_m ?? Ht - 8; s.lineTo(crestW + 4, sc - 6); s.lineTo(4, sc); s.lineTo(0, sc); }
      else { s.lineTo(crestW, brk); s.lineTo(crestW, Ht); s.lineTo(0, Ht); }
      s.lineTo(0, 0);
      return s;
    };
    const bw = L / blocks;
    const concrete = new THREE.MeshStandardMaterial({ color: "#C9D6D0", roughness: 0.85, metalness: 0.02 });
    const spillMat = new THREE.MeshStandardMaterial({ color: "#B3A07E", roughness: 0.8 });
    const pickables: THREE.Object3D[] = [];
    for (let b = 0; b < blocks; b++) {
      const x0 = -L / 2 + b * bw;
      const spill = !!g.spillway && x0 + bw / 2 > g.spillway.x_from && x0 + bw / 2 < g.spillway.x_to;
      const geo = new THREE.ExtrudeGeometry(section(spill), { depth: bw - 0.6, bevelEnabled: false });
      geo.rotateY(-Math.PI / 2); // shape-x (dam y) → three z; extrusion → −x
      const m = new THREE.Mesh(geo, spill ? spillMat : concrete);
      m.position.x = x0 + bw - 0.3;
      m.userData = { kind: "block", block: b + 1, spill };
      groups.structure.add(m);
      pickables.push(m);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: "#10232D", transparent: true, opacity: 0.45 }));
      edges.position.copy(m.position);
      groups.structure.add(edges);
    }
    // Foundation
    const fd = g.foundation_depth_m ?? 12;
    const found = new THREE.Mesh(new THREE.BoxGeometry(L + 60, fd, baseW + 120), new THREE.MeshStandardMaterial({ color: "#4E5E63", roughness: 1 }));
    found.position.set(0, -fd / 2, baseW / 2 - 20);
    found.userData = { kind: "foundation" };
    groups.foundation.add(found);
    pickables.push(found);
    // Reservoir (upstream: negative dam-y → negative three z)
    const water = new THREE.Mesh(new THREE.BoxGeometry(L + 40, 1, 160), new THREE.MeshStandardMaterial({ color: "#2C8C9E", transparent: true, opacity: 0.45, roughness: 0.2 }));
    water.userData = { kind: "reservoir" };
    groups.reservoir.add(water);
    const setLevel = (z: number | null) => {
      const h = Math.max(1, Math.min(Ht - 1, z ?? Ht * 0.85));
      water.scale.y = h; water.position.set(0, h / 2, -80.5);
    };
    setLevel(levelM);
    // Galleries
    for (const gal of g.galleries ?? []) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, L - 2, 12), new THREE.MeshStandardMaterial({ color: "#E0AE52", transparent: true, opacity: 0.75 }));
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0, gal.z, gal.y);
      tube.userData = { kind: "gallery" };
      groups.galleries.add(tube);
      pickables.push(tube);
    }
    // Sensors
    const sensorMeshes = new Map<string, THREE.Mesh>();
    const sphere = new THREE.SphereGeometry(2.1, 20, 16);
    for (const s of sensors) {
      const m = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: "#72BEB1", emissive: "#0B1820", depthTest: false, transparent: true }));
      m.position.set(s.x, s.z, s.y);
      m.renderOrder = 10;
      m.userData = { kind: "sensor", id: s.id, code: s.code };
      groups.sensors.add(m);
      sensorMeshes.set(s.id, m);
      const div = document.createElement("div");
      div.textContent = s.code;
      div.className = "font-mono";
      Object.assign(div.style, { fontSize: "11px", color: "#E6EEEB", background: "rgba(11,24,32,0.75)", padding: "1px 5px", borderRadius: "4px", transform: "translateY(-16px)" });
      const lab = new CSS2DObject(div);
      m.add(lab);
      groups.labels.push(lab);
    }
    pickables.push(...sensorMeshes.values());
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.45, 8, 32), new THREE.MeshBasicMaterial({ color: "#F5F4EF", depthTest: false }));
    ring.renderOrder = 11;
    ring.visible = false;
    scene.add(ring);
    const grid = new THREE.GridHelper(400, 40, "#26434D", "#16303C");
    grid.position.y = -fd - 0.01;
    scene.add(grid);

    // Picking: sensors first; surfaces identify components by their normal and position.
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // a drag, not a click
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pickables.filter((o) => o.visible && o.parent?.visible), false);
      if (!hits.length) return;
      const h = hits.find((x) => x.object.userData.kind === "sensor") ?? hits[0];
      const u = h.object.userData;
      const p: [number, number, number] = [+h.point.x.toFixed(1), +h.point.z.toFixed(1), +h.point.y.toFixed(1)];
      if (u.kind === "sensor") return onPickRef.current({ kind: "sensor", id: u.id, label: u.code });
      if (u.kind === "foundation") return onPickRef.current({ kind: "component", id: "FOUND", label: "Foundation", point: p });
      if (u.kind === "gallery") return onPickRef.current({ kind: "component", id: "GAL", label: "Gallery", point: p });
      const n = h.face!.normal.clone().transformDirection(h.object.matrixWorld);
      let code = "BODY", label = `Dam body · block ${u.block}`;
      if (Math.abs(n.x) > 0.8) { code = "JOINT"; label = `Contraction joint face · block ${u.block}`; }
      else if (n.y > 0.8) { code = u.spill ? "SPILL" : "CREST"; label = u.spill ? `Spillway crest · block ${u.block}` : `Crest · block ${u.block}`; }
      else if (n.z < -0.8) { code = "US-FACE"; label = `Upstream face · block ${u.block}`; }
      else if (n.z > 0.2) { code = u.spill ? "SPILL" : "DS-FACE"; label = u.spill ? `Spillway chute · block ${u.block}` : `Downstream face · block ${u.block}`; }
      else if (n.y < -0.8) { code = "FOUND"; label = "Dam–foundation contact"; }
      if (code === "US-FACE" && p[2] < 6) { code = "HEEL"; label = `Heel · block ${u.block}`; }
      if (code === "DS-FACE" && p[2] < 6) { code = "TOE"; label = `Toe · block ${u.block}`; }
      onPickRef.current({ kind: "component", id: code, label, point: p });
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      if (ring.visible) { ring.lookAt(camera.position); if (!reduce) { t += 0.05; ring.scale.setScalar(1 + 0.12 * Math.sin(t)); } }
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    loop();
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); labels.setSize(w, h);
    });
    ro.observe(el);

    api.current = {
      setLayers: (l) => {
        groups.structure.visible = l.structure; groups.foundation.visible = l.foundation; groups.reservoir.visible = l.reservoir;
        groups.galleries.visible = l.galleries; groups.sensors.visible = l.sensors; groups.labels.forEach((x) => (x.visible = l.labels && l.sensors));
      },
      setSelected: (id) => {
        const m = id ? sensorMeshes.get(id) : null;
        ring.visible = !!m;
        if (m) ring.position.copy(m.position);
        sensorMeshes.forEach((mesh, sid) => mesh.scale.setScalar(sid === id ? 1.5 : 1));
      },
      setColors: (rs) => {
        const byId = new Map(rs.map((r) => [r.sensor_id, r]));
        sensorMeshes.forEach((mesh, sid) => {
          const r = byId.get(sid);
          (mesh.material as THREE.MeshStandardMaterial).color.set(r ? (r.condition === "not_assessed" ? "#72BEB1" : COND_COLOR[r.condition]) : "#72BEB1");
        });
      },
      setLevel,
      focus: (id) => {
        const m = sensorMeshes.get(id);
        if (!m) return;
        controls.target.copy(m.position);
        camera.position.copy(m.position.clone().add(new THREE.Vector3(-60, 40, 70)));
      },
    };
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      scene.traverse((o: any) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm: any) => mm?.dispose?.()); });
      renderer.dispose(); el.innerHTML = ""; api.current = null;
    };
  }, [geometry, sensors]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { api.current?.setLayers(layers); }, [layers, geometry, sensors]);
  useEffect(() => { api.current?.setSelected(selected); }, [selected, geometry, sensors]);
  useEffect(() => { api.current?.setColors(readings); }, [readings, geometry, sensors]);
  useEffect(() => { api.current?.setLevel(levelM); }, [levelM]);
  useEffect(() => { if (focusKey) api.current?.focus(focusKey); }, [focusKey, geometry, sensors]);

  return <div ref={host} className="relative h-full w-full overflow-hidden" data-testid="dam-scene" />;
}
