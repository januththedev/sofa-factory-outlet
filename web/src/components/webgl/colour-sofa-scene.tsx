'use client';

import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';

/** Tileable woven-fabric bump texture, generated once in a canvas (no image to download). */
function makeFabricBump() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 4) {
    ctx.fillStyle = i % 8 === 0 ? '#9a9a9a' : '#6c6c6c';
    ctx.fillRect(i, 0, 2, size);
    ctx.fillStyle = i % 8 === 0 ? '#8c8c8c' : '#747474';
    ctx.fillRect(0, i, size, 2);
  }
  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 36;
    image.data[i] += n;
    image.data[i + 1] += n;
    image.data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Upholstery material: eased colour change, woven bump and a soft velvet-like rim light. */
function useFabricMaterial() {
  return useMemo(() => {
    const material = new MeshStandardMaterial({ roughness: 0.9, metalness: 0, bumpMap: makeFabricBump(), bumpScale: 0.7 });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `float rim = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.4);
         outgoingLight += rim * 0.12 * diffuseColor.rgb;
         #include <opaque_fragment>`,
      );
    };
    return material;
  }, []);
}

const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

function Sofa({ color }: { color: string }) {
  const fabric = useFabricMaterial();
  const accent = useMemo(() => new MeshStandardMaterial({ roughness: 0.85 }), []);
  const wood = useMemo(() => new MeshStandardMaterial({ color: '#3a2a20', roughness: 0.55 }), []);
  const target = useMemo(() => new Color(color), [color]);
  const accentTarget = useMemo(() => new Color(luminance(target) > 0.45 ? '#53352a' : '#e8d9c8'), [target]);
  const { invalidate } = useThree();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      fabric.color.copy(target);
      accent.color.copy(accentTarget);
    }
    invalidate();
  }, [target, accentTarget, fabric, accent, invalidate]);

  useFrame((state, delta) => {
    const k = 1 - Math.exp(-delta * 5);
    fabric.color.lerp(target, k);
    accent.color.lerp(accentTarget, k);
    const gap = Math.abs(fabric.color.r - target.r) + Math.abs(fabric.color.g - target.g) + Math.abs(fabric.color.b - target.b);
    if (gap > 0.004) state.invalidate();
  });

  return (
    <group position={[0, 0, 0]}>
      {/* base, back and arms */}
      <RoundedBox args={[3.6, 0.46, 1.5]} radius={0.09} smoothness={4} position={[0, 0.4, 0]} material={fabric} castShadow />
      <RoundedBox args={[3.6, 0.9, 0.34]} radius={0.12} smoothness={4} position={[0, 1.0, -0.58]} material={fabric} castShadow />
      <RoundedBox args={[0.4, 0.88, 1.5]} radius={0.12} smoothness={4} position={[-1.8, 0.82, 0]} material={fabric} castShadow />
      <RoundedBox args={[0.4, 0.88, 1.5]} radius={0.12} smoothness={4} position={[1.8, 0.82, 0]} material={fabric} castShadow />
      {/* seat and back cushions */}
      {[-0.8, 0.8].map((x) => (
        <group key={x}>
          <RoundedBox args={[1.56, 0.3, 1.04]} radius={0.12} smoothness={4} position={[x, 0.78, 0.2]} material={fabric} castShadow />
          <RoundedBox args={[1.56, 0.72, 0.34]} radius={0.14} smoothness={4} position={[x, 1.2, -0.3]} rotation={[-0.14, 0, 0]} material={fabric} castShadow />
        </group>
      ))}
      {/* throw pillows */}
      <RoundedBox args={[0.58, 0.52, 0.2]} radius={0.08} smoothness={4} position={[-1.18, 1.18, -0.02]} rotation={[-0.2, 0.35, 0.12]} material={accent} castShadow />
      <RoundedBox args={[0.58, 0.52, 0.2]} radius={0.08} smoothness={4} position={[1.18, 1.18, -0.02]} rotation={[-0.2, -0.35, -0.12]} material={accent} castShadow />
      {/* legs */}
      {[-1.55, 1.55].flatMap((x) =>
        [-0.55, 0.55].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.09, z]} material={wood} castShadow>
            <cylinderGeometry args={[0.065, 0.045, 0.18, 16]} />
          </mesh>
        )),
      )}
    </group>
  );
}

export default function ColourSofaScene({ color, autoRotate, interactive, paused, onReady }: { color: string; autoRotate: boolean; interactive: boolean; paused: boolean; onReady?: () => void }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      frameloop={paused ? 'never' : 'always'}
      camera={{ position: [4.9, 2.3, 5.8], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={() => onReady?.()}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3.5, 5, 3]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[0, 5, 2]} scale={[8, 3, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.4} position={[-5, 1.5, 1]} scale={[3, 5, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.1} position={[5, 1.5, -1]} scale={[3, 5, 1]} rotation-y={-Math.PI / 2} />
      </Environment>
      <Sofa color={color} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={9} blur={2.6} far={2.2} resolution={512} />
      <OrbitControls
        target={[0, 0.7, 0]}
        enabled={interactive}
        enableZoom={false}
        enablePan={false}
        enableDamping
        autoRotate={autoRotate}
        autoRotateSpeed={0.9}
        minPolarAngle={0.95}
        maxPolarAngle={1.48}
      />
    </Canvas>
  );
}
