export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/** 2× 降採樣：四個雙線性取樣平均。 */
export const DOWNSAMPLE_FRAGMENT = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c * 0.25, 1.0);
}
`

/** 降採樣並擷取高亮部分（柔性門檻），作為 bloom 的來源。 */
export const BRIGHT_FRAGMENT = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tInput, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c = min(c * 0.25, vec3(40.0));
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(c * contrib, 1.0);
}
`

/** 9-tap 高斯模糊（利用雙線性取樣只讀 5 次）。 */
export const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 0.2270270270;
  c += texture2D(tInput, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tInput, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tInput, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tInput, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`

/** 最終合成：景深、bloom、色差、放射模糊、ACES 色調映射、黃昏調色、無雙調色、暗角、sRGB 與顆粒。 */
export const FINAL_FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBlur1;
uniform sampler2D tBlur2;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tBloom3;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uFocusRange;
uniform float uDof;
uniform float uBloom;
uniform float uExposure;
uniform float uMusou;
uniform float uFlash;
uniform float uAberration;
uniform float uRadial;
uniform float uDanger;
uniform float uBars;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

float viewZ(float depth) {
  return (uNear * uFar) / ((uFar - uNear) * depth - uFar);
}

vec3 sceneAt(vec2 uv) {
  vec3 sharp = texture2D(tColor, uv).rgb;
  float z = -viewZ(texture2D(tDepth, uv).x);
  float dist = z - uFocus;
  float coc = smoothstep(uFocusRange, uFocusRange * 4.0, abs(dist)) * uDof;
  coc *= dist < 0.0 ? 0.35 : 1.0;
  vec3 b1 = texture2D(tBlur1, uv).rgb;
  vec3 b2 = texture2D(tBlur2, uv).rgb;
  vec3 blurred = mix(b1, b2, smoothstep(0.45, 1.0, coc));
  return mix(sharp, blurred, smoothstep(0.0, 0.45, coc));
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  vec2 fromCenter = uv - 0.5;
  vec3 col;
  if (uRadial > 0.001) {
    col = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float s = 1.0 - uRadial * 0.08 * float(i) / 7.0;
      col += sceneAt(0.5 + fromCenter * s);
    }
    col /= 8.0;
  } else {
    col = sceneAt(uv);
  }
  if (uAberration > 0.001) {
    vec2 off = fromCenter * uAberration * 0.012;
    col.r = mix(col.r, texture2D(tColor, uv + off).r, 0.7);
    col.b = mix(col.b, texture2D(tColor, uv - off).b, 0.7);
  }
  vec3 bloom = texture2D(tBloom1, uv).rgb * 0.6 + texture2D(tBloom2, uv).rgb * 0.8 + texture2D(tBloom3, uv).rgb;
  col += bloom * uBloom;
  col *= uExposure;
  // 高亮又飽和的 HDR 顏色（龍、火焰、火花）在無雙調色中保留原色
  float hdrPeak = max(col.r, max(col.g, col.b));
  float hdrSat = hdrPeak > 1e-4 ? (hdrPeak - min(col.r, min(col.g, col.b))) / hdrPeak : 0.0;
  float keep = smoothstep(1.2, 2.6, hdrPeak) * smoothstep(0.3, 0.7, hdrSat);
  col = aces(col);

  // 黃昏調色：陰影偏紫藍、亮部偏暖
  float l = luma(col);
  col = mix(vec3(l), col, 1.08);
  col = (col - 0.5) * 1.06 + 0.5;
  col += vec3(-0.012, -0.004, 0.022) * (1.0 - smoothstep(0.0, 0.45, l));
  col += vec3(0.03, 0.012, -0.018) * smoothstep(0.45, 1.0, l);

  // 無雙：墨色與金色雙色調
  if (uMusou > 0.001) {
    float ml = luma(col);
    vec3 duo = mix(vec3(0.07, 0.015, 0.03), vec3(1.0, 0.78, 0.38), smoothstep(0.04, 0.8, ml));
    duo = mix(duo, vec3(1.0, 0.97, 0.9), smoothstep(0.8, 1.0, ml));
    col = mix(col, duo, uMusou * 0.82 * (1.0 - keep));
  }

  float aspect = uResolution.x / uResolution.y;
  float vig = smoothstep(0.95, 0.25, length(fromCenter * vec2(aspect, 1.0)) * 0.9);
  col *= mix(1.0, vig, 0.35 + uMusou * 0.35);
  col = mix(col, vec3(0.55, 0.02, 0.02), uDanger * (1.0 - vig) * 0.7);
  col = mix(col, vec3(1.0), uFlash);
  float bar = uBars * 0.1;
  if (uv.y < bar || uv.y > 1.0 - bar) col = vec3(0.0);
  col = toSRGB(clamp(col, 0.0, 1.0));
  col += (hash(uv * uResolution + fract(uTime) * 91.0) - 0.5) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}
`
