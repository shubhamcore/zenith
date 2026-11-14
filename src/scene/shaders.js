export const earthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const earthFrag = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D specMap;
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 lights = texture2D(nightMap, vUv).rgb;
    float ocean = texture2D(specMap, vUv).r;
    float cloud = texture2D(cloudMap, vUv).r;

    vec3 N = normalize(vNormal);
    vec3 L = normalize(sunDir);
    float ndl = dot(N, L);

    float dayW = smoothstep(-0.04, 0.28, ndl);
    float nightW = 1.0 - smoothstep(-0.02, 0.2, ndl);
    float term = pow(1.0 - abs(ndl), 2.6);

    vec3 nightBase = day * vec3(0.012, 0.028, 0.07);

    vec2 px = vec2(0.0024, 0.0024);
    vec3 glow = lights
      + texture2D(nightMap, vUv + vec2(px.x, 0.0)).rgb
      + texture2D(nightMap, vUv + vec2(-px.x, 0.0)).rgb
      + texture2D(nightMap, vUv + vec2(0.0, px.y)).rgb
      + texture2D(nightMap, vUv + vec2(0.0, -px.y)).rgb;
    glow *= 0.22;
    vec3 city = lights * lights * 2.8 + glow * glow * 1.6;
    float pulse = 0.92 + 0.08 * sin(time * 1.4 + vUv.x * 18.0);
    city *= pulse;

    vec3 color = mix(nightBase + city * nightW, day, dayW);
    color *= 1.0 - cloud * 0.38 * dayW;

    vec3 sunset = mix(vec3(1.0, 0.22, 0.06), vec3(1.0, 0.62, 0.22), smoothstep(-0.15, 0.25, ndl));
    color += sunset * term * 0.58;

    vec3 V = normalize(cameraPosition - vWorld);
    vec3 R = reflect(-L, N);
    float spec = pow(max(dot(R, V), 0.0), 48.0) * ocean * max(ndl, 0.0) * (1.0 - cloud);
    color += vec3(0.85, 0.93, 1.0) * spec * 0.85;

    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
    color += vec3(0.3, 0.52, 0.95) * fres * 0.2 * dayW;

    gl_FragColor = vec4(color, 1.0);
  }
`

export const atmosVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const atmosFrag = /* glsl */ `
  uniform vec3 sunDir;
  uniform float intensity;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 L = normalize(sunDir);
    float fres = pow(max(0.0, 0.72 - dot(N, V)), 2.35);
    float day = smoothstep(-0.35, 0.55, dot(N, L));
    vec3 blue = vec3(0.22, 0.48, 1.0);
    vec3 orange = vec3(1.0, 0.36, 0.1);
    float term = pow(1.0 - abs(dot(N, L)), 1.7);
    vec3 col = mix(blue, orange, term);
    float alpha = clamp(fres * intensity * (0.32 + day * 0.95), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`

export const cloudVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const cloudFrag = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float opacity;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec3 c = texture2D(cloudMap, vUv).rgb;
    float a = max(max(c.r, c.g), c.b);
    float ndl = dot(normalize(vNormal), normalize(sunDir));
    float day = smoothstep(-0.15, 0.35, ndl);
    vec3 col = mix(vec3(0.07, 0.09, 0.16), vec3(1.0, 0.98, 0.95), day);
    gl_FragColor = vec4(col, a * opacity * (0.32 + 0.68 * day));
  }
`

export const moonVert = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const moonFrag = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormal;
  void main() {
    vec3 N = normalize(vNormal);
    float ndl = dot(N, normalize(sunDir));
    float light = smoothstep(-0.02, 0.42, ndl);
    vec3 dark = vec3(0.02, 0.02, 0.03);
    vec3 lit = vec3(0.86, 0.84, 0.78);
    vec3 col = mix(dark, lit, light);
    float rim = pow(1.0 - abs(ndl), 4.0) * 0.12;
    col += vec3(0.4, 0.5, 0.7) * rim;
    gl_FragColor = vec4(col, 1.0);
  }
`

export const auroraVert = /* glsl */ `
  attribute float intensity;
  varying float vI;
  varying vec3 vNormal;
  void main() {
    vI = intensity;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (2.5 + intensity * 0.12) * (180.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

export const auroraFrag = /* glsl */ `
  varying float vI;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float glow = 1.0 - smoothstep(0.0, 0.5, d);
    vec3 col = mix(vec3(0.15, 0.95, 0.55), vec3(0.95, 0.35, 0.85), clamp(vI / 40.0, 0.0, 1.0));
    gl_FragColor = vec4(col, glow * clamp(vI / 28.0, 0.08, 0.85));
  }
`

export const starVert = /* glsl */ `
  attribute float size;
  uniform float time;
  varying float vS;
  varying float vTw;
  void main() {
    vS = size;
    vTw = 0.55 + 0.45 * sin(time * (1.2 + size) + position.x * 4.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * vTw * (180.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

export const starFrag = /* glsl */ `
  varying float vS;
  varying float vTw;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float g = 1.0 - smoothstep(0.0, 0.5, d);
    vec3 col = mix(vec3(0.82, 0.88, 1.0), vec3(1.0, 0.92, 0.78), clamp((vS - 1.0) * 0.4, 0.0, 1.0));
    gl_FragColor = vec4(col, g * vTw);
  }
`
