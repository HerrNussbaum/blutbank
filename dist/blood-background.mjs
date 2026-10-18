/* Procedural pigment: a still surface that yields to the pointer and content.
   No images, dependencies or perpetual animation loop. */
const vertexSource = `
  attribute vec2 aPosition;
  varying vec2 vUV;
  void main() {
    vUV = aPosition * .5 + .5;
    gl_Position = vec4(aPosition, 0., 1.);
  }
`;
const fragmentSource = `
  precision mediump float;
  varying vec2 vUV;
  uniform vec2 uSize;
  uniform vec3 uPointer;
  uniform vec3 uTrail[5];
  uniform vec4 uAnchors[2];
  uniform vec4 uContent[CONTENT_FIELDS];
  uniform vec2 uContentState[CONTENT_FIELDS];

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 s = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), s.x),
               mix(hash(i + vec2(0., 1.)), hash(i + 1.), s.x), s.y);
  }
  float fbm(vec2 p) {
    float value = 0., weight = .5;
    mat2 turn = mat2(.8, .6, -.6, .8);
    for (int i = 0; i < 4; i++) {
      value += weight * noise(p);
      p = turn * p * 2.03 + 7.1;
      weight *= .5;
    }
    return value;
  }
  float boxDistance(vec2 p, vec4 box) {
    vec2 d = abs(p - box.xy) - box.zw;
    return length(max(d, 0.)) + min(max(d.x, d.y), 0.);
  }
  void main() {
    float aspect = uSize.x / uSize.y;
    vec2 screen = vec2(vUV.x * aspect, 1. - vUV.y);
    vec2 p = screen;
    float touch = 0.;
    vec2 delta = p - uPointer.xy;
    float influence = exp(-dot(delta, delta) * 24.) * uPointer.z;
    p += vec2(-delta.y, delta.x) * influence * .21;
    p += delta * influence * .13;
    touch += influence;
    for (int i = 0; i < 5; i++) {
      vec2 d = screen - uTrail[i].xy;
      float wake = exp(-dot(d, d) * 60.) * uTrail[i].z;
      p += vec2(-d.y, d.x) * wake * .055;
      touch += wake * .12;
    }
    float rim = 0.;
    for (int i = 0; i < 2; i++) {
      if (uAnchors[i].z > 0.) {
        float distance = boxDistance(screen, uAnchors[i]);
        float edge = exp(-abs(distance) * 16.);
        rim += edge * (i == 0 ? .55 : .8);
        p.y += edge * .012;
      }
    }
    float pressure = 0., coverage = 0.;
    for (int i = 0; i < CONTENT_FIELDS; i++) {
      float weight = uContentState[i].x;
      if (weight > .001) {
        vec4 box = uContent[i];
        float distance = boxDistance(screen, box);
        vec2 delta = screen - box.xy;
        vec2 outward = sign(delta) * max(abs(delta) - box.zw, 0.);
        vec2 normal = normalize(outward + delta * .018 + .0001);
        float edge = exp(-abs(distance) * 15.) * weight;
        float age = uContentState[i].y;
        // A single soft swell moves away from newly visible content, then rests.
        float front = (max(distance, 0.) - age * .22) * 22.;
        float swell = exp(-front * front) * sin(age * 3.141593) * weight;
        p += normal * (edge * .014 + swell * .028);
        p += vec2(-normal.y, normal.x) * swell * .008;
        pressure = max(pressure, edge * .45 + swell * .65);
        coverage = max(coverage, (1. - smoothstep(-.025, .02, distance)) * weight);
      }
    }
    // Warped layers resemble pigment suspended in a dense, dark liquid.
    vec2 q = p * 3.1;
    vec2 warp = vec2(fbm(q + 3.2), fbm(q + vec2(8.3, 2.8)));
    float flow = fbm(q + warp * 3.8);
    float folds = fbm(q * 1.8 + warp * 4.6 + flow * 2.);
    float pigment = smoothstep(.26, .75, flow);
    float filaments = pow(1. - abs(folds * 2. - 1.), 12.);
    float cloud = fbm(p * 1.4 + 12.);
    vec3 color = vec3(.057, .052, .058);
    color += pigment * vec3(.058, .010, .019);
    color += filaments * vec3(.028, .007, .011) * (.3 + cloud);
    color += cloud * vec3(.014, .007, .008);
    color += (touch * .7 + rim * .45) * vec3(.026, .005, .008);
    color += pressure * vec3(.018, .003, .006);
    color *= 1. - coverage * .07;
    float vignette = smoothstep(.18, .85, length(vUV - .5));
    color *= 1. - vignette * .22;
    // Fine, fixed grain breaks up gradients without flickering.
    color += (hash(floor(screen * 1100.)) - .5) * .008;
    gl_FragColor = vec4(color, 1.);
  }
`;

function initBloodBackground() {
  if (matchMedia('(forced-colors: active)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'blood-background';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return;
  // Fit the uniform budget even on WebGL implementations with the minimum limit.
  const contentLimit = Math.max(1, Math.min(16,
    Math.floor((gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) - 12) / 2)));
  const shaders = [];
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Background shader unavailable');
    return shader;
  };
  const program = gl.createProgram();
  let buffer;
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource.replaceAll('CONTENT_FIELDS', String(contentLimit))));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Background unavailable');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  } catch {
    shaders.forEach(shader => gl.deleteShader(shader));
    gl.deleteProgram(program);
    return; // The CSS texture remains available on unsupported devices.
  }
  shaders.forEach(shader => gl.deleteShader(shader));
  const uniforms = Object.fromEntries(['uSize', 'uPointer', 'uTrail[0]', 'uAnchors[0]', 'uContent[0]', 'uContentState[0]']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  document.body.prepend(canvas);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(any-pointer: fine)');
  const events = new AbortController();
  const on = (target, name, listener, options = {}) => target.addEventListener(name, listener, { ...options, signal: events.signal });
  const targets = '#home-search-form, .search-field, .catalog-search, .card, .selected-card-image, .presentation-card, .preview-name, .pill, header a, input, select, textarea, summary';
  const pointer = { x: -5, y: -5, tx: -5, ty: -5, strength: 0, active: false };
  const trail = [];
  const trailUniform = new Float32Array(15);
  const anchorUniform = new Float32Array(8);
  const contentUniform = new Float32Array(contentLimit * 4);
  const contentStateUniform = new Float32Array(contentLimit * 2);
  const content = document.querySelector('#content');
  const contentTargets = '.deck-list > article, .card, .selected-card-image, .presentation-card, .deck-cover > img, .deck-list-cover, h1, h2, h3, p, .rule-copy > ul, .rule-copy > ol, .card-rules, .card-errata > div, .glossary-item > .rule-copy, .deck-entry, .deck-search-result';
  const contentFields = new Map();
  let hovered = null, width = 1, height = 1, frame = 0, lastDraw = 0, lost = false, suspended = false;
  let geometryDirty = true, contentDirty = true;
  const interactive = () => finePointer.matches && !reducedMotion.matches;
  const stop = () => { cancelAnimationFrame(frame); frame = 0; lastDraw = 0; };
  const requestDraw = () => {
    if (!frame && !lost && !suspended && !document.hidden) frame = requestAnimationFrame(draw);
  };
  function measure(now) {
    anchorUniform.fill(0);
    const base = document.querySelector('#home-search-form, .selected-card-image, .catalog-search');
    const focused = document.activeElement?.closest(targets);
    const active = hovered?.isConnected ? hovered : focused;
    [base, active !== base ? active : null].forEach((element, i) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > height) return;
      anchorUniform.set([(rect.left + rect.width / 2) / height, (rect.top + rect.height / 2) / height,
        rect.width / 2 / height, rect.height / 2 / height], i * 4);
    });
    if (contentDirty && content) {
      for (const element of content.querySelectorAll(contentTargets)) {
        if (element.closest('.visually-hidden, .sr-only, .card-hint')) continue;
        if (element.closest('.deck-list > article') && !element.matches('.deck-list > article')) continue;
        if (!contentFields.has(element)) contentFields.set(element, {
          element, visible: false, strength: 0, enteredAt: now, rect: null,
        });
      }
      contentDirty = false;
    }
    // Only measure when layout changes; settling frames reuse these bounds.
    for (const field of contentFields.values()) {
      const rect = field.element.isConnected ? field.element.getBoundingClientRect() : null;
      const visible = !!rect && rect.width > 12 && rect.height > 8
        && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width;
      if (visible && !field.visible) {
        const delay = field.element.matches('.deck-reveal') ? parseFloat(getComputedStyle(field.element).animationDelay) * 1000 : 0;
        field.enteredAt = now + (Number.isFinite(delay) ? delay : 0);
      }
      if (visible) field.rect = rect;
      field.visible = visible;
    }
    geometryDirty = false;
  }
  function updateContent(now, ease) {
    let settling = false;
    const visibleFields = [];
    for (const [element, field] of contentFields) {
      const target = field.visible && (reducedMotion.matches || now >= field.enteredAt) ? 1 : 0;
      field.strength = reducedMotion.matches ? target : field.strength + (target - field.strength) * ease;
      const age = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (now - field.enteredAt) / 1900));
      if (Math.abs(target - field.strength) > .002 || (field.visible && age < 1)) settling = true;
      if (field.rect && field.strength > .002) visibleFields.push({ ...field, age });
      if (!element.isConnected && field.strength < .002) contentFields.delete(element);
    }
    // Visible elements take precedence over fading remnants from the previous view.
    visibleFields.sort((a, b) => Number(b.visible) - Number(a.visible));
    contentUniform.fill(0);
    contentStateUniform.fill(0);
    visibleFields.slice(0, contentLimit).forEach((field, i) => {
      const rect = field.rect;
      contentUniform.set([(rect.left + rect.width / 2) / height, (rect.top + rect.height / 2) / height,
        rect.width / 2 / height, rect.height / 2 / height], i * 4);
      contentStateUniform.set([field.strength, field.age], i * 2);
    });
    return settling;
  }
  function draw(now) {
    frame = 0;
    // At most 30 fps during interaction; the GPU rests when the surface settles.
    if (lastDraw && now - lastDraw < 32) { requestDraw(); return; }
    const dt = lastDraw ? Math.min(now - lastDraw, 64) : 32;
    lastDraw = now;
    const ease = 1 - Math.exp(-dt / 170);
    const active = interactive() && pointer.active;
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;
    pointer.strength += ((active ? 1 : 0) - pointer.strength) * ease;
    while (trail.length && now - trail[trail.length - 1].time > 1500) trail.pop();
    trailUniform.fill(0);
    if (interactive()) trail.forEach((point, i) => trailUniform.set([
      point.x / height, point.y / height, Math.pow(Math.max(0, 1 - (now - point.time) / 1500), 2),
    ], i * 3));
    if (geometryDirty) measure(now);
    const contentSettling = updateContent(now, ease);
    gl.uniform2f(uniforms.uSize, width, height);
    gl.uniform3f(uniforms.uPointer, pointer.x / height, pointer.y / height, interactive() ? pointer.strength : 0);
    gl.uniform3fv(uniforms['uTrail[0]'], trailUniform);
    gl.uniform4fv(uniforms['uAnchors[0]'], anchorUniform);
    gl.uniform4fv(uniforms['uContent[0]'], contentUniform);
    gl.uniform2fv(uniforms['uContentState[0]'], contentStateUniform);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const settling = Math.abs((active ? 1 : 0) - pointer.strength) > .002
      || Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) > .25;
    if ((interactive() && (settling || trail.length)) || (!reducedMotion.matches && contentSettling)) requestDraw();
    else lastDraw = 0;
  }
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    // Cap both total pixels and scale, including on high-density phones.
    const scale = Math.min(1, Math.sqrt(650000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    geometryDirty = true;
    requestDraw();
  }
  const updateGeometry = () => { geometryDirty = true; requestDraw(); };
  const resetPointer = () => { pointer.active = false; hovered = null; trail.length = 0; updateGeometry(); };
  on(window, 'pointermove', event => {
    if (!interactive() || event.pointerType === 'touch') return;
    if (!pointer.active) { pointer.x = event.clientX; pointer.y = event.clientY; }
    pointer.active = true;
    pointer.tx = event.clientX; pointer.ty = event.clientY;
    const previous = trail[0];
    if (!previous || Math.hypot(previous.x - event.clientX, previous.y - event.clientY) > 24) {
      trail.unshift({ x: event.clientX, y: event.clientY, time: performance.now() });
      trail.length = Math.min(trail.length, 5);
    }
    requestDraw();
  }, { passive: true });
  on(document, 'pointerover', event => {
    if (!interactive() || event.pointerType === 'touch') return;
    const next = event.target.closest(targets);
    if (next !== hovered) { hovered = next; updateGeometry(); }
  }, { passive: true });
  on(document.documentElement, 'pointerleave', resetPointer);
  on(window, 'blur', resetPointer);
  on(document, 'focusin', updateGeometry);
  on(document, 'focusout', updateGeometry);
  on(window, 'resize', resize, { passive: true });
  on(document, 'scroll', updateGeometry, { passive: true, capture: true });
  on(window, 'hashchange', resetPointer);
  on(reducedMotion, 'change', resetPointer);
  on(finePointer, 'change', resetPointer);
  on(document, 'visibilitychange', () => {
    if (document.hidden) { resetPointer(); stop(); }
    else resize();
  });
  on(window, 'pagehide', () => { suspended = true; stop(); });
  on(window, 'pageshow', () => { suspended = false; resize(); });
  const observer = new MutationObserver(mutations => {
    contentDirty = true;
    for (const mutation of mutations) {
      // Replacing text within an existing paragraph also disturbs the pigment.
      const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
      const field = contentFields.get(target?.closest(contentTargets));
      if (field?.visible && mutation.type !== 'attributes') field.enteredAt = performance.now();
    }
    updateGeometry();
  });
  if (content) observer.observe(content, {
    childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'],
  });
  // Fonts and images can change a target's bounds after its first measurement.
  on(document, 'load', event => {
    const field = contentFields.get(event.target.closest?.(contentTargets));
    if (field?.visible) field.enteredAt = performance.now();
    updateGeometry();
  }, { capture: true });
  on(document, 'toggle', updateGeometry, { capture: true });
  document.fonts?.ready.then(updateGeometry);
  on(canvas, 'webglcontextlost', () => {
    lost = true; stop(); events.abort(); observer.disconnect(); canvas.remove();
  });
  resize();
}

initBloodBackground();
