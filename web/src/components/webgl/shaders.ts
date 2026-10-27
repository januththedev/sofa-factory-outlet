export const imageVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// One shader, two jobs: a pointer-driven ripple (hero) and a gentle bend (collection cards).
// uFit 0 = cover (like object-fit: cover), 1 = contain on white (pairs with CSS multiply blending).
export const imageFragment = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uPlane;
  uniform vec2 uImage;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uStrength;
  uniform float uBend;
  uniform float uFit;
  varying vec2 vUv;

  vec2 fitUv(vec2 uv) {
    float pa = uPlane.x / uPlane.y;
    float ia = uImage.x / uImage.y;
    vec2 scale;
    if (uFit < 0.5) {
      scale = pa > ia ? vec2(1.0, ia / pa) : vec2(pa / ia, 1.0);
    } else {
      scale = pa > ia ? vec2(pa / ia, 1.0) : vec2(1.0, ia / pa);
    }
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

    uv.y += sin(uv.x * 3.14159) * uBend * 0.05;
    uv.x += sin(uv.y * 3.14159) * uBend * 0.025;

    vec2 t = fitUv(uv);
    vec4 color = texture2D(uTexture, t);
    if (uFit > 0.5 && (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0)) {
      color = vec4(1.0);
    }
    gl_FragColor = vec4(color.rgb, 1.0);
    #include <colorspace_fragment>
  }
`;
