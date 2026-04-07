"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import AnalysisModal from "@/components/AnalysisModal";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

type GraphNode = {
  id: string;
  title: string;
  group?: string;
  __color?: string;
  __threeObj?: unknown;
};
type GraphLink = { source: string; target: string };

// Loose type alias for the underlying force-graph instance
type FGInstance = {
  renderer: () => {
    xr: {
      enabled: boolean;
      getController: (i: number) => unknown;
      addEventListener: (ev: string, cb: () => void) => void;
      removeEventListener: (ev: string, cb: () => void) => void;
    };
    setAnimationLoop: (cb: (() => void) | null) => void;
    render: (s: unknown, c: unknown) => void;
  };
  scene: () => { add: (...obj: unknown[]) => void; remove: (...obj: unknown[]) => void };
  camera: () => unknown;
  pauseAnimation?: () => void;
  resumeAnimation?: () => void;
  graphData: () => { nodes: GraphNode[]; links: GraphLink[] };
  refresh?: () => void;
};

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [labelsOn, setLabelsOn] = useState(true);
  const [vrSupported, setVrSupported] = useState(false);
  const [vrActive, setVrActive] = useState(false);
  const [vrError, setVrError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<FGInstance | null>(null);
  const vrButtonRef = useRef<HTMLElement | null>(null);
  const vrCleanupRef = useRef<(() => void) | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((j) => {
        setNodes(j.nodes || []);
        setLinks(j.links || []);
      });
  }, []);

  useEffect(() => {
    function onResize() {
      if (containerRef.current) {
        setSize({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight,
        });
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & {
      xr?: { isSessionSupported?: (m: string) => Promise<boolean> };
    };
    if (nav.xr?.isSessionSupported) {
      nav.xr
        .isSessionSupported("immersive-vr")
        .then((ok) => setVrSupported(ok))
        .catch(() => setVrSupported(false));
    }
  }, []);

  const data = useMemo(() => ({ nodes: [...nodes], links: [...links] }), [nodes, links]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const nodeThreeObject = useCallback((node: object) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SpriteText = require("three-spritetext").default;
    const n = node as GraphNode;
    const sprite = new SpriteText(n.title || "Untitled");
    const isSelected = selectedRef.current.has(n.id);
    sprite.color = isSelected ? "#60a5fa" : n.__color || "#ffffff";
    sprite.textHeight = isSelected ? 6 : 3.5;
    sprite.fontFace = "system-ui, sans-serif";
    sprite.fontWeight = isSelected ? "700" : "500";
    sprite.backgroundColor = "rgba(0,0,0,0.4)";
    sprite.padding = 1.5;
    sprite.borderRadius = 2;
    return sprite;
  }, []);

  useEffect(() => {
    fgRef.current?.refresh?.();
  }, [selected, labelsOn]);

  const enableVR = useCallback(async () => {
    setVrError(null);
    try {
      const fg = fgRef.current;
      if (!fg) return;
      const THREE = await import("three");
      const { VRButton } = await import("three/examples/jsm/webxr/VRButton.js");

      const renderer = fg.renderer();
      const scene = fg.scene();
      const camera = fg.camera();

      renderer.xr.enabled = true;
      fg.pauseAnimation?.();
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });

      // --- Controllers with laser pointer rays ---
      const controller1 = renderer.xr.getController(0) as unknown as {
        addEventListener: (ev: string, cb: (e: { target: unknown }) => void) => void;
        removeEventListener: (ev: string, cb: (e: { target: unknown }) => void) => void;
        matrixWorld: unknown;
        add: (o: unknown) => void;
      };
      const controller2 = renderer.xr.getController(1) as unknown as typeof controller1;

      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -50),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x60a5fa });
      const line1 = new THREE.Line(lineGeom, lineMat);
      const line2 = new THREE.Line(lineGeom.clone(), lineMat.clone());
      controller1.add(line1);
      controller2.add(line2);
      scene.add(controller1, controller2);

      const raycaster = new THREE.Raycaster();
      const tempMatrix = new THREE.Matrix4();

      const onSelect = (event: { target: unknown }) => {
        const ctrl = event.target as {
          matrixWorld: { elements: number[] };
        };
        tempMatrix.identity().extractRotation(ctrl.matrixWorld as never);
        raycaster.ray.origin.setFromMatrixPosition(
          ctrl.matrixWorld as never
        );
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        const allNodes = fg.graphData().nodes;
        const objs = allNodes
          .map((n) => n.__threeObj)
          .filter(Boolean) as never[];
        const hits = raycaster.intersectObjects(objs, true);
        if (hits.length > 0) {
          let hit: { parent: unknown } | null = hits[0].object as { parent: unknown };
          // walk up to a top-level node object
          while (hit && !allNodes.find((n) => n.__threeObj === hit)) {
            hit = (hit.parent as { parent: unknown } | null) ?? null;
          }
          if (hit) {
            const node = allNodes.find((n) => n.__threeObj === hit);
            if (node) toggleSelect(node.id);
          }
        }
      };
      controller1.addEventListener("selectstart", onSelect);
      controller2.addEventListener("selectstart", onSelect);

      // --- Session lifecycle ---
      const onSessionStart = () => setVrActive(true);
      const onSessionEnd = () => {
        setVrActive(false);
        renderer.setAnimationLoop(null);
        fg.resumeAnimation?.();
      };
      renderer.xr.addEventListener("sessionstart", onSessionStart);
      renderer.xr.addEventListener("sessionend", onSessionEnd);

      if (!vrButtonRef.current) {
        const btn = VRButton.createButton(
          renderer as unknown as Parameters<typeof VRButton.createButton>[0]
        );
        btn.style.position = "absolute";
        btn.style.bottom = "16px";
        btn.style.left = "50%";
        btn.style.transform = "translateX(-50%)";
        btn.style.zIndex = "10";
        containerRef.current?.appendChild(btn);
        vrButtonRef.current = btn;
      }

      vrCleanupRef.current = () => {
        controller1.removeEventListener("selectstart", onSelect);
        controller2.removeEventListener("selectstart", onSelect);
        renderer.xr.removeEventListener("sessionstart", onSessionStart);
        renderer.xr.removeEventListener("sessionend", onSessionEnd);
        scene.remove(controller1, controller2);
        vrButtonRef.current?.remove();
        vrButtonRef.current = null;
        renderer.setAnimationLoop(null);
        fg.resumeAnimation?.();
      };
    } catch (e) {
      setVrError((e as Error).message);
    }
  }, [toggleSelect]);

  useEffect(() => {
    return () => {
      vrCleanupRef.current?.();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 flex-wrap">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <Link href="/space" className="text-sm hover:underline">Space →</Link>
        <h1 className="font-semibold">3D Graph</h1>
        <span className="text-xs text-zinc-500 hidden md:inline">
          ドラッグで回転 / ホイールでズーム / クリックで選択
        </span>
        <label className="flex items-center gap-1 text-xs ml-2">
          <input
            type="checkbox"
            checked={labelsOn}
            onChange={(e) => setLabelsOn(e.target.checked)}
          />
          ラベル表示
        </label>
        <span className="ml-auto text-sm">選択中: {selected.size}</span>
        <button
          disabled={selected.size === 0}
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >AI解析</button>
        <button
          onClick={() => setSelected(new Set())}
          className="px-2 py-1 text-xs border rounded"
        >クリア</button>
        {vrSupported ? (
          <button
            onClick={enableVR}
            className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded"
            title="WebXR / VR モードを有効化"
          >🥽 VR有効化</button>
        ) : (
          <span className="text-xs text-zinc-500" title="このブラウザ/デバイスはWebXRに非対応です">VR非対応</span>
        )}
      </div>
      {vrActive && (
        <div className="px-3 py-1 text-xs text-purple-300 bg-purple-950/40 border-b border-purple-900">
          🥽 VRセッション中 — ヘッドセットのメニューまたは画面下「EXIT VR」で終了
        </div>
      )}
      {vrError && (
        <div className="px-3 py-1.5 text-xs text-red-400 bg-red-950/40 border-b border-red-900">
          VRエラー: {vrError}
        </div>
      )}
      <div ref={containerRef} className="flex-1 relative bg-black">
        <ForceGraph3D
          ref={fgRef as unknown as React.MutableRefObject<undefined>}
          graphData={data}
          width={size.w}
          height={size.h}
          backgroundColor="#000010"
          nodeLabel={(n: object) => (n as GraphNode).title}
          nodeAutoColorBy="group"
          nodeOpacity={0.95}
          nodeRelSize={5}
          nodeVal={(n: object) => (selected.has((n as GraphNode).id) ? 8 : 2)}
          nodeThreeObject={labelsOn ? nodeThreeObject : undefined}
          nodeThreeObjectExtend={true}
          linkColor={() => "rgba(180,180,200,0.4)"}
          linkOpacity={0.6}
          linkWidth={0.5}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          onNodeClick={(n: object) => toggleSelect((n as GraphNode).id)}
          enableNodeDrag={true}
        />
      </div>
      {showModal && (
        <AnalysisModal noteIds={[...selected]} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
