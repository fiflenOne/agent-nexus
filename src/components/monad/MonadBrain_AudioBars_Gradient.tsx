import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { useMonad } from "@/context/MonadContext";

const TAU = Math.PI * 2;

export default function MonadBrain_AudioBars_Gradient() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { rli, triggerResonance, isResonating } = useMonad();

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rliRef = useRef(rli);
  rliRef.current = rli;

  const initAudio = useCallback(async () => {
    if (audioContextRef.current) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    audioContextRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.76;
    analyserRef.current = analyser;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ctx.createMediaStreamSource(stream).connect(analyser);
    } catch {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 52;
      const gain = ctx.createGain();
      gain.gain.value = 0.28;
      osc.connect(gain).connect(analyser);
      osc.start();
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth || 1;
    const H = container.clientHeight || 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010c0d);
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 200);
    camera.position.z = 20;

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const point = new THREE.PointLight(0xffffff, 1.2);
    point.position.set(10, 10, 10);
    scene.add(point);

    const group = new THREE.Group();
    scene.add(group);

    const barCount = 64;
    const barsGroup = new THREE.Group();
    scene.add(barsGroup);

    const barMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * TAU;
      const radius = 8.7;
      const geo = new THREE.BoxGeometry(0.17, 4.8, 0.17);
      const mat = new THREE.MeshPhongMaterial({ shininess: 110 });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.x = Math.cos(angle) * radius;
      bar.position.z = Math.sin(angle) * radius;
      bar.position.y = 1.8;
      bar.userData = { baseHeight: 4.8, angle, index: i };
      barsGroup.add(bar);
      barMeshes.push(bar);
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 2.45, 0.8, 0.08);
    composer.addPass(bloom);
    composer.addPass(new SMAAPass(W, H));

    const dataArray = new Uint8Array(128);
    let t = 0;
    let rafId = 0;
    let disposed = false;

    const tick = () => {
      if (disposed) return;
      rafId = requestAnimationFrame(tick);
      t += 0.016;
      group.rotation.y = t * 0.068;
      barsGroup.rotation.y = t * 0.04;

      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        analyserRef.current.getByteFrequencyData(dataArray);

        barMeshes.forEach((bar, i) => {
          const freqIndex = Math.floor((i / barCount) * bufferLength * 0.75);
          const value = dataArray[freqIndex] / 255;

          const targetScale = 0.6 + value * 5.4;
          bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetScale, 0.32);
          bar.position.y = (bar.scale.y * (bar.userData.baseHeight as number)) / 2;

          const normalizedPos = i / barCount;
          let hue = 0.72 - normalizedPos * 1.35;
          hue = hue + value * 0.3;
          const saturation = 0.8 + value * 0.2;
          const lightness = 0.48 + value * 0.52;
          const col = new THREE.Color().setHSL(hue, saturation, lightness);

          const m = bar.material as THREE.MeshPhongMaterial;
          m.emissive = col;
          m.emissiveIntensity = 0.8 + value * 6.8;
          m.color = col;
        });
      }

      bloom.strength = 1.7 + rliRef.current.stability * 2.4 + (isResonating ? 0.8 : 0);
      composer.render();
    };
    tick();

    const onResize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      barMeshes.forEach((b) => {
        b.geometry.dispose();
        (b.material as THREE.Material).dispose();
      });
    };
  }, [isResonating]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-300/80 font-mono pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        Live FFT · Spectrum Gradient Bars
      </div>
      <div className="absolute bottom-3 right-3 flex gap-2 pointer-events-auto">
        <button
          onClick={initAudio}
          className="px-3 py-1.5 rounded-md text-xs uppercase tracking-widest font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 backdrop-blur"
        >
          Enable Mic
        </button>
        <button
          onClick={() => triggerResonance()}
          className="px-3 py-1.5 rounded-md text-xs uppercase tracking-widest font-mono bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/30 text-cyan-200 backdrop-blur"
        >
          Resonate
        </button>
      </div>
    </div>
  );
}
