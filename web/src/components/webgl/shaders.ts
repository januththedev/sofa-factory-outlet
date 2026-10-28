export const imageVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A pointer-driven ripple over a photo drawn like object-fit: cover. Used by the hero only.
export const imageFragment = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uPlane;
  uniform vec2 uImage;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uStrength;
  varying vec2 vUv;

  vec2 fitUv(vec2 uv) {
    float pa = uPlane.x / uPlane.y;
    float ia = uImage.x / uImage.y;
    vec2 scale = pa > ia ? vec2(1.0, ia / pa) : vec2(pa / ia, 1.0);
    return (uv - 0.5) * scale + 0.5;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uPlane.x / uPlane.y;

    vec2 d = (uv - uMouse) * vec2(aspect, 1.0);
    float dist = length(d);
    vec2 dir = d / max(dist, 0.0001);
    float wave = sin(dist * 34.0 - uTime * 4.5) * exp(-dist * 6.5) * uStrength;
    uv += vec2(dir.x / aspect, dir.y) * wave * 0.014;

    gl_FragColor = vec4(texture2D(uTexture, fitUv(uv)).rgb, 1.0);
    #include <colorspace_fragment>
  }
`;
