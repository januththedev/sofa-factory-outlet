/** Flat front-view sofa that follows the chosen fabric colour: the explorer's fallback and its loading state. */
export function SofaSvg({ color, accent }: { color: string; accent: string }) {
  const fill = { fill: color };
  const pillow = { fill: accent };
  return (
    <svg
      viewBox="0 0 400 260"
      role="img"
      aria-label="Illustration of a three-seater sofa"
      className="h-full w-full motion-safe:[&_rect]:transition-[fill] motion-safe:[&_rect]:duration-200"
    >
      <ellipse cx="200" cy="238" rx="168" ry="9" fill="rgb(20 18 17 / 0.13)" />
      <g fill="#3a2a20">
        <rect x="58" y="214" width="11" height="22" rx="3" />
        <rect x="331" y="214" width="11" height="22" rx="3" />
        <rect x="118" y="218" width="9" height="18" rx="3" />
        <rect x="273" y="218" width="9" height="18" rx="3" />
      </g>
      {/* back */}
      <rect x="62" y="58" width="276" height="112" rx="28" style={fill} />
      {/* back cushions */}
      <rect x="84" y="70" width="114" height="92" rx="20" style={fill} />
      <rect x="202" y="70" width="114" height="92" rx="20" style={fill} />
      {/* base */}
      <rect x="40" y="150" width="320" height="68" rx="16" style={fill} />
      {/* seat cushions */}
      <rect x="82" y="138" width="118" height="46" rx="14" style={fill} />
      <rect x="200" y="138" width="118" height="46" rx="14" style={fill} />
      {/* arms */}
      <rect x="30" y="104" width="52" height="114" rx="20" style={fill} />
      <rect x="318" y="104" width="52" height="114" rx="20" style={fill} />
      {/* pillows */}
      <rect x="96" y="96" width="52" height="46" rx="10" transform="rotate(-8 122 119)" style={pillow} />
      <rect x="252" y="96" width="52" height="46" rx="10" transform="rotate(8 278 119)" style={pillow} />
      {/* soft shading for depth */}
      <g fill="rgb(0 0 0 / 0.1)">
        <rect x="199" y="72" width="2.5" height="88" />
        <rect x="82" y="182" width="236" height="3" rx="1.5" />
      </g>
      <g fill="rgb(255 255 255 / 0.1)">
        <rect x="90" y="76" width="100" height="6" rx="3" />
        <rect x="208" y="76" width="100" height="6" rx="3" />
        <rect x="88" y="144" width="104" height="5" rx="2.5" />
        <rect x="206" y="144" width="104" height="5" rx="2.5" />
      </g>
    </svg>
  );
}

/** Light fabrics get a dark cushion, dark fabrics a light one. */
export function accentFor(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#53352a' : '#e8d9c8';
}
