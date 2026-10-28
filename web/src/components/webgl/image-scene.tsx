'use client';

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { LinearFilter, SRGBColorSpace, type ShaderMaterial, type Texture, TextureLoader, Vector2 } from 'three';
import { imageFragment, imageVertex } from './shaders';

type SceneProps = {
  src: string;
  paused?: boolean;
  onReady?: () => void;
};

/** Three.js owns the texture, so its settings are applied here rather than on React-managed values. */
function configureTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}

function ImagePlane({ src, paused = false, onReady }: SceneProps) {
  const loadedTexture = useLoader(TextureLoader, src);
  // Keep the cached source image, but own and release this canvas's GPU texture.
  const texture = useMemo(() => loadedTexture.clone(), [loadedTexture]);
  const { size, invalidate, gl } = useThree();
  const material = useRef<ShaderMaterial>(null);
  const strength = useRef(0);
  const mouse = useRef(new Vector2(0.5, 0.5));
  const ready = useRef(false);

  // Configure the loaded texture before the first frame (effects run before the render loop ticks).
  useEffect(() => {
    configureTexture(texture);
    invalidate();
    return () => texture.dispose();
  }, [texture, invalidate]);

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uPlane: { value: new Vector2(1, 1) },
      uImage: { value: new Vector2(texture.image?.width ?? 1, texture.image?.height ?? 1) },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      uStrength: { value: 0 },
    }),
    [texture],
  );

  // Track the pointer over the whole canvas area (the canvas itself sits under page content).
  useEffect(() => {
    if (paused) return;
    const canvas = gl.domElement;
    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return;
      mouse.current.set(x, y);
      strength.current = 1;
      invalidate();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [gl, invalidate, paused]);

  useEffect(() => {
    invalidate();
  }, [paused, invalidate]);

  useFrame((state, delta) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uPlane.value.set(size.width, size.height);
    m.uniforms.uTime.value += delta;

    strength.current *= Math.exp(-delta * 2.2);
    m.uniforms.uMouse.value.lerp(mouse.current, 1 - Math.exp(-delta * 14));
    m.uniforms.uStrength.value = strength.current;
    if (strength.current > 0.003) state.invalidate();

    if (!ready.current) {
      ready.current = true;
      onReady?.();
    }
  });

  return (
    <mesh scale={[size.width, size.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={imageVertex} fragmentShader={imageFragment} />
    </mesh>
  );
}

/** A canvas holding one textured plane; the page's own <picture> stays underneath as the fallback. */
export default function ImageScene(props: SceneProps) {
  return (
    <Canvas
      flat
      orthographic
      frameloop={props.paused ? 'never' : 'demand'}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 10], zoom: 1, near: 0.1, far: 100 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'default' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Suspense fallback={null}>
        <ImagePlane {...props} />
      </Suspense>
    </Canvas>
  );
}
