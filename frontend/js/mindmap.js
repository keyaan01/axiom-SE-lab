/* Build 10 curriculum mind map — REV 2 (minimal, Obsidian-graph-view style).
   See frontend/MINDMAP.md for the full spec (look, feel/physics, data,
   panels, integration). This file is a classic script loaded BETWEEN ui.js
   and app.js: it may reference app.js globals (accentKey, openReader, api,
   ui) but ONLY from inside function bodies that run after boot (route()
   calls window.mindmap.render()), never at parse time.

   Exposes exactly `window.mindmap = { render, stop }`. Everything else is
   module-scoped (functions prefixed `mm`, one state object `mmState`).

   Step 2R scope (this file): the render core, rebuilt against REV 2 — plain
   theme-following background, flat colored dot nodes (no sprites/glow), a
   SINGLE canvas, live d3-force physics with draggable nodes, quiet edges,
   the hover/selection focus-fade effect, semantic-zoom labels, a minimal
   top-right zoom cluster, and empty/error states. Step 3 added the hierarchy
   sidebar, detail card, and "mark done" ring-pulse effects. Step 4 added the
   top-bar discovery control (five states + a 2s status poll + an in-place
   graph refresh on completion) and the "zero links yet" soft hint
   (MINDMAP.md §4). */

/* ================================ 1. Constants (MINDMAP.md §1/§2) ================================ */

const MM_R_SEM = 14, MM_R_COURSE = 9;
const MM_R_CONCEPT_BASE = 4, MM_R_CONCEPT_DEGREE_MAX = 3, MM_R_CONCEPT_DEGREE_MUL = 0.6;
const MM_ZOOM_MIN = 0.05, MM_ZOOM_MAX = 3;
const MM_FOCUS_FADE = 0.15;
// Exponential-smoothing time constant approximating the spec's single
// ~150ms eased focusT 0→1 transition (reaches ~95% of the way in ~3×tau).
const MM_FOCUS_TAU = 0.05;
const MM_VELOCITY_DECAY = 0.6;
const MM_ALPHA_MIN = 0.003;
const MM_REST_PRETICKS = 300; // reduced-motion: synchronous ticks to settle the sim before first paint

/* ================================ 2. Small deterministic utilities ================================ */

// mulberry32: fast deterministic PRNG. Every bit of jitter/seeding in this
// file goes through this (or mmSeed→this) — never Math.random (MINDMAP.md §2).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mmHashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Any id (numeric concept/course/semester id, or a string) to a stable
// 32-bit seed.
function mmSeed(id) {
  if (typeof id === 'number') return id >>> 0;
  if (typeof id === 'string' && /^-?\d+$/.test(id)) return Number(id) >>> 0;
  return mmHashStr(String(id));
}
const mmClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mmLerp = (a, b, t) => a + (b - a) * t;
function mmSmoothstep(e0, e1, x) {
  const t = mmClamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function mmEaseInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function mmEaseOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function mmHexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
// One-time offscreen-canvas color probe for non-hex CSS color strings (theme
// vars are hex today, but this stays correct if that ever changes — e.g. an
// hsl()/named color). Results are cached by the literal string (module-level,
// never cleared — a handful of entries per theme, never invalidated because a
// theme switch always produces a *different* string for a changed color).
const mmRgbCache = new Map();
let mmProbeCtx = null;
function mmProbeColorRgb(str) {
  if (!mmProbeCtx) {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    mmProbeCtx = c.getContext('2d', { willReadFrequently: true });
  }
  mmProbeCtx.clearRect(0, 0, 1, 1);
  try { mmProbeCtx.fillStyle = str; } catch (_) { mmProbeCtx.fillStyle = '#808080'; }
  mmProbeCtx.fillRect(0, 0, 1, 1);
  const d = mmProbeCtx.getImageData(0, 0, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2] };
}
function mmColorRgb(str) {
  if (!str) return { r: 128, g: 128, b: 128 };
  if (mmRgbCache.has(str)) return mmRgbCache.get(str);
  const rgb = str[0] === '#' ? mmHexToRgb(str) : mmProbeColorRgb(str);
  mmRgbCache.set(str, rgb);
  return rgb;
}
function mmRgba(colorStr, a) {
  const c = mmColorRgb(colorStr);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}
function mmMix(colorA, colorB, t) {
  const a = mmColorRgb(colorA), b = mmColorRgb(colorB);
  return `rgb(${Math.round(mmLerp(a.r, b.r, t))},${Math.round(mmLerp(a.g, b.g, t))},${Math.round(mmLerp(a.b, b.b, t))})`;
}
function mmTodayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function mmRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ================================ 3. Theme tokens (MINDMAP.md §1) ================================
   Every drawing color comes from here. Read once via mmSetupThemeObserver()
   at mount, re-read whenever a MutationObserver sees <html>'s class attribute
   change (the app toggles `.dark` there) — the map repaints in the new theme
   on the very next frame (mmRequestFrame() from the observer callback). */

let mmTheme = {
  bg: '#141019', surface: '#1E1826', border: '#332A40',
  text: '#F3EFFA', textMuted: '#B4A9C6', primary: '#9B84FF', danger: '#FF6B7A',
  accents: { mint: '#12B886', peach: '#FF7A59', sky: '#3AB6F0', lilac: '#C77DFF', lemon: '#F2B705' },
};

function mmReadTheme() {
  const cs = getComputedStyle(document.documentElement);
  const read = (name, fallback) => { const v = cs.getPropertyValue(name).trim(); return v || fallback; };
  mmTheme = {
    bg: read('--bg', mmTheme.bg),
    surface: read('--surface', mmTheme.surface),
    border: read('--border', mmTheme.border),
    text: read('--text', mmTheme.text),
    textMuted: read('--text-muted', mmTheme.textMuted),
    primary: read('--primary', mmTheme.primary),
    danger: read('--danger', mmTheme.danger),
    accents: {
      mint: read('--mint', mmTheme.accents.mint),
      peach: read('--peach', mmTheme.accents.peach),
      sky: read('--sky', mmTheme.accents.sky),
      lilac: read('--lilac', mmTheme.accents.lilac),
      lemon: read('--lemon', mmTheme.accents.lemon),
    },
  };
  return mmTheme;
}

function mmSetupThemeObserver() {
  mmReadTheme();
  const obs = new MutationObserver(() => {
    mmReadTheme();
    mmRequestFrame();
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  mmState.themeObserver = obs;
  mmState.cleanup.push(() => { try { obs.disconnect(); } catch (_) { /* ignore */ } });
}

/* ================================ 4. Module state ================================ */

let mmState = null;

function mmFreshState() {
  return {
    nodes: [], nodesById: new Map(),
    structEdges: [], aiEdges: [],
    quadtree: null, maxNodeR: MM_R_SEM,
    sim: null,
    camera: { x: 0, y: 0, scale: 0.6 },
    camAnim: null,
    focusT: 0,
    hover: null, focusSet: null, selected: null,
    canvasEl: null, ctx: null,
    dpr: 1, cssW: 0, cssH: 0,
    rafId: null, lastFrameTime: 0,
    reducedMotion: false,
    resizeObserver: null, resizeTimer: null,
    themeObserver: null,
    pointer: { down: false, lastX: 0, lastY: 0, startX: 0, startY: 0, moved: false, downNode: null, dragging: false },
    _pulseActive: false,
    // Step 3: hierarchy sidebar + detail card + "mark done" ring-pulse effects.
    sidebarCollapsed: false,       // hydrated from localStorage in mmRender()
    sidebarSemCollapsed: new Set(), // semester node ids whose course list is collapsed (in-memory only)
    sidebarCourseCollapsed: new Set(), // course node ids whose concept list is hidden (in-memory only; default collapsed — see mmSidebarCourseRowHtml)
    sidebarQuery: '',              // live search box text
    sidebarActiveKey: null,        // last-clicked sidebar row / selection ancestor, for the active-row highlight
    doneBusy: false,               // guards a concurrent double-submit on Mark done/undone
    effects: [],                   // one-shot ring pulses: {nodeId, t0, dur}
    // Concept card link manager (edit mind-map links): cache of
    // GET /mindmap/links?concept_id=<refId> for the currently selected
    // concept, so mmRenderCard() can render it synchronously and mutations
    // can re-fetch just this list without reloading the whole graph.
    cardLinks: null,               // array once loaded, else null (loading/none)
    cardLinksFor: null,            // concept refId the above belongs to (also the in-flight marker)
    cardLinksError: null,          // last fetch error message, if any
    // Step 4: top-bar discovery control (MINDMAP.md §4).
    discoverMeta: null,            // {status,message,stale} — from graph.meta, kept fresh by mmRenderTopbarDiscovery/mmRefreshLinks
    discoverPollTimer: null,       // setInterval id while a discovery run is in flight (2s /mindmap/status poll)
    cleanup: [],
  };
}

/* ================================ 5. Data fetch ================================ */

async function mmFetchGraph() {
  return api.get('/mindmap/graph');
}

/* ================================ 6. Node build (MINDMAP.md §1/§3) — NO root node ================================ */

function mmBuildNodes(graph) {
  const nodes = [];
  const byId = new Map();

  const semesters = graph.semesters || [];
  const courses = graph.courses || [];
  const concepts = graph.concepts || [];
  const links = graph.links || [];

  // Semester clusters are anchored in layout space (spread around the world
  // origin) — NOT connected to each other or to any root.
  const nSem = semesters.length;
  const R_SEM = 340 + 40 * Math.max(0, nSem - 3);
  const semStartAngle = nSem ? mulberry32(mmSeed(semesters[0].id))() * Math.PI * 2 : 0;

  const coursesBySem = new Map();
  courses.forEach((c) => {
    if (!coursesBySem.has(c.semester_id)) coursesBySem.set(c.semester_id, []);
    coursesBySem.get(c.semester_id).push(c);
  });

  semesters.forEach((s, i) => {
    const angle = semStartAngle + (i / Math.max(1, nSem)) * Math.PI * 2;
    const ax = Math.cos(angle) * R_SEM, ay = Math.sin(angle) * R_SEM;
    const semNode = {
      id: 's' + s.id, kind: 'semester', refId: s.id, parentId: null,
      name: s.name, archived: !!s.archived,
      colorKey: accentKey(s.id),
      x: ax, y: ay, anchorX: ax, anchorY: ay, r: MM_R_SEM,
      totalCount: 0, doneCount: 0,
    };
    nodes.push(semNode); byId.set(semNode.id, semNode);

    const semCourses = coursesBySem.get(s.id) || [];
    const nC = semCourses.length;
    const R_COURSE = 140 + 14 * nC;
    const courseStartAngle = mulberry32(mmSeed(s.id))() * Math.PI * 2;
    semCourses.forEach((c, j) => {
      const cAngle = courseStartAngle + (j / Math.max(1, nC)) * Math.PI * 2;
      const cx = ax + Math.cos(cAngle) * R_COURSE, cy = ay + Math.sin(cAngle) * R_COURSE;
      const courseNode = {
        id: 'k' + c.id, kind: 'course', refId: c.id, parentId: semNode.id,
        name: c.name, code: c.code, semesterId: s.id,
        colorKey: accentKey(c.id),
        x: cx, y: cy, anchorX: cx, anchorY: cy, r: MM_R_COURSE,
        totalCount: 0, doneCount: 0,
      };
      nodes.push(courseNode); byId.set(courseNode.id, courseNode);
    });
  });

  // AI-link degree per concept (drives dot radius: 4 + min(3, 0.6×degree)) —
  // computed only over links whose both endpoints resolve to a concept we're
  // actually placing (defensive — backend join normally guarantees this).
  const resolvableConceptIds = new Set();
  concepts.forEach((co) => { if (byId.has('k' + co.course_id)) resolvableConceptIds.add(co.id); });
  const validLinks = links.filter((l) => l.a !== l.b && resolvableConceptIds.has(l.a) && resolvableConceptIds.has(l.b));
  const degree = new Map();
  validLinks.forEach((l) => {
    degree.set(l.a, (degree.get(l.a) || 0) + 1);
    degree.set(l.b, (degree.get(l.b) || 0) + 1);
  });

  concepts.forEach((co) => {
    const courseNode = byId.get('k' + co.course_id);
    if (!courseNode) return; // defensive — backend join guarantees this normally resolves
    const rng = mulberry32(mmSeed(co.id));
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 90; // sqrt for uniform-area jitter within the disk
    const done = !!co.done;
    const deg = degree.get(co.id) || 0;
    const node = {
      id: 'c' + co.id, kind: 'concept', refId: co.id, parentId: courseNode.id,
      courseId: co.course_id, semesterId: courseNode.semesterId,
      name: co.name, summary: co.summary || '',
      colorKey: courseNode.colorKey,
      noteId: co.note_id, noteStatus: co.note_status,
      done, bestScore: co.best_score, bestTotal: co.best_total,
      quizStatus: co.quiz_status, nextStudyDate: co.next_study_date,
      x: courseNode.anchorX + Math.cos(ang) * rad, y: courseNode.anchorY + Math.sin(ang) * rad,
      anchorX: courseNode.anchorX, anchorY: courseNode.anchorY,
      r: MM_R_CONCEPT_BASE + Math.min(MM_R_CONCEPT_DEGREE_MAX, MM_R_CONCEPT_DEGREE_MUL * deg),
    };
    nodes.push(node); byId.set(node.id, node);
    courseNode.totalCount++; if (done) courseNode.doneCount++;
  });

  nodes.forEach((n) => {
    if (n.kind !== 'course') return;
    const sem = byId.get(n.parentId);
    if (sem) { sem.totalCount += n.totalCount; sem.doneCount += n.doneCount; }
  });

  // Structural edges: semester→course and course→concept ONLY (semester
  // nodes have parentId=null so no edge is ever emitted for/between them).
  const structEdges = [];
  nodes.forEach((n) => {
    if (n.parentId) structEdges.push({ id: n.parentId + '__' + n.id, source: n.parentId, target: n.id, kind: 'struct' });
  });

  const aiEdges = validLinks.map((l, i) => ({
    id: 'ai' + i + '_c' + l.a + '_c' + l.b, source: 'c' + l.a, target: 'c' + l.b, kind: 'ai',
    label: l.label || '', strength: mmClamp(Number(l.strength) || 0.5, 0, 1),
  }));

  return { nodes, byId, structEdges, aiEdges };
}

/* ================================ 7. Layout: live d3-force + no-d3 fallback (MINDMAP.md §2) ================================ */

function mmRunLayout(built) {
  const { nodes, byId, structEdges, aiEdges } = built;
  const hasD3 = typeof window.d3 !== 'undefined' && d3.forceSimulation && d3.forceLink && d3.forceManyBody && d3.forceCollide && d3.forceX && d3.forceY;

  if (!hasD3) {
    console.warn('[mindmap] d3 did not load — using the static golden-angle fallback layout (no physics, no drag).');
    const byParent = new Map();
    nodes.forEach((n) => {
      if (n.kind !== 'concept') return;
      if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
      byParent.get(n.parentId).push(n);
    });
    byParent.forEach((list) => {
      list.sort((a, b) => a.refId - b.refId);
      list.forEach((n, i) => {
        const angle = i * 2.39996, radius = 14 * Math.sqrt(i) + 26;
        n.x = n.anchorX + Math.cos(angle) * radius;
        n.y = n.anchorY + Math.sin(angle) * radius;
      });
    });
    return {
      sim: null,
      structEdges: structEdges.map((e) => ({ ...e, source: byId.get(e.source), target: byId.get(e.target) })),
      aiEdges: aiEdges.map((e) => ({ ...e, source: byId.get(e.source), target: byId.get(e.target) })),
    };
  }

  const simEdges = structEdges.map((e) => ({ ...e })).concat(aiEdges.map((e) => ({ ...e })));

  const sim = d3.forceSimulation(nodes)
    .velocityDecay(MM_VELOCITY_DECAY)
    .alphaMin(MM_ALPHA_MIN)
    .force('link', d3.forceLink(simEdges).id((d) => d.id)
      .distance((d) => {
        if (d.kind === 'struct') return d.target.kind === 'course' ? 150 : 55;
        return 120 - 60 * d.strength;
      })
      .strength((d) => {
        if (d.kind === 'struct') return d.target.kind === 'course' ? 0.7 : 0.5;
        return 0.10 + 0.25 * d.strength;
      }))
    .force('charge', d3.forceManyBody().strength((d) => (d.kind === 'concept' ? -55 : -520)))
    .force('collide', d3.forceCollide().radius((d) => d.r + 8))
    .force('x', d3.forceX((d) => d.anchorX).strength((d) => (d.kind === 'concept' ? 0.06 : 0.55)))
    .force('y', d3.forceY((d) => d.anchorY).strength((d) => (d.kind === 'concept' ? 0.06 : 0.55)));
  // No .stop() here for the normal case — the sim keeps running live via its
  // own internal timer (MINDMAP.md §2): started warm at alpha(1), it decays
  // toward alphaMin on its own schedule and its timer self-stops at rest.

  if (mmState.reducedMotion) {
    // Pre-tick to rest synchronously so there's no drift-in on first paint;
    // the sim stays fully usable afterwards (e.g. a drag can still reheat it).
    sim.stop();
    for (let i = 0; i < MM_REST_PRETICKS; i++) sim.tick();
  }

  return {
    sim,
    structEdges: simEdges.filter((e) => e.kind === 'struct'),
    aiEdges: simEdges.filter((e) => e.kind === 'ai'),
  };
}

function mmBuildQuadtree(nodes) {
  if (typeof window.d3 === 'undefined' || !d3.quadtree) return null;
  return d3.quadtree().x((d) => d.x).y((d) => d.y).addAll(nodes);
}

/* ================================ 8. Canvas sizing (single canvas, DPR-aware, debounced resize) ================================ */

function mmSetupCanvases(root) {
  mmState.canvasEl = root.querySelector('#mm-canvas');
  mmState.ctx = mmState.canvasEl.getContext('2d');
  mmResize();
  const ro = new ResizeObserver(() => mmScheduleResize());
  ro.observe(root);
  mmState.resizeObserver = ro;
  mmState.cleanup.push(() => ro.disconnect());
}

function mmScheduleResize() {
  if (!mmState) return;
  clearTimeout(mmState.resizeTimer);
  mmState.resizeTimer = setTimeout(mmResize, 120);
}

function mmResize() {
  if (!mmState || !mmState.canvasEl) return;
  const rect = mmState.canvasEl.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // DPR cap 2 (perf guardrail)
  mmState.dpr = dpr;
  mmState.cssW = rect.width;
  mmState.cssH = rect.height;
  mmState.canvasEl.width = Math.max(1, Math.round(rect.width * dpr));
  mmState.canvasEl.height = Math.max(1, Math.round(rect.height * dpr));
  mmState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mmRequestFrame();
}

/* ================================ 9. Camera (MINDMAP.md §2) ================================ */

function mmWorldToScreen(wx, wy) {
  const c = mmState.camera;
  return { x: (wx - c.x) * c.scale + mmState.cssW / 2, y: (wy - c.y) * c.scale + mmState.cssH / 2 };
}
function mmScreenToWorld(sx, sy) {
  const c = mmState.camera;
  return { x: (sx - mmState.cssW / 2) / c.scale + c.x, y: (sy - mmState.cssH / 2) / c.scale + c.y };
}
function mmClampScale(s) { return mmClamp(s, MM_ZOOM_MIN, MM_ZOOM_MAX); }

function mmZoomAt(factor, sx, sy) {
  const c = mmState.camera;
  const before = mmScreenToWorld(sx, sy);
  c.scale = mmClampScale(c.scale * factor);
  c.x = before.x - (sx - mmState.cssW / 2) / c.scale;
  c.y = before.y - (sy - mmState.cssH / 2) / c.scale;
  mmUpdateZoomLabel();
  mmRequestFrame();
}
function mmZoomCenter(factor) { mmZoomAt(factor, mmState.cssW / 2, mmState.cssH / 2); }

function mmPanBy(dxScreen, dyScreen) {
  const c = mmState.camera;
  c.x -= dxScreen / c.scale;
  c.y -= dyScreen / c.scale;
  mmRequestFrame();
}

function mmSubtreeIds(nodeId) {
  const ids = [nodeId], queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift();
    mmState.nodes.forEach((n) => { if (n.parentId === cur) { ids.push(n.id); queue.push(n.id); } });
  }
  return ids;
}
function mmBoundsFor(ids) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ids.forEach((id) => {
    const n = mmState.nodesById.get(id);
    if (!n) return;
    x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r);
    x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r);
  });
  if (!isFinite(x0)) return { x0: -100, y0: -100, x1: 100, y1: 100 };
  return { x0, y0, x1, y1 };
}
function mmFitAllBounds() { return mmBoundsFor(mmState.nodes.map((n) => n.id)); }
function mmFitScaleFor(b, pad = 0.12) {
  const w = Math.max(1, b.x1 - b.x0), h = Math.max(1, b.y1 - b.y0);
  const sx = mmState.cssW / (w + 2 * w * pad), sy = mmState.cssH / (h + 2 * h * pad);
  return mmClampScale(Math.min(sx, sy));
}

// mmFlyTo(target, ms=900): target is a node / node id (concepts center at
// scale~1.15; hubs fit their subtree) or a bounds {x0,y0,x1,y1} (fit w/ 12%
// padding). Position tweens linearly; scale tweens in LOG space.
function mmFlyTo(target, ms = 900) {
  let endX, endY, endScale;
  if (target && target.x0 !== undefined) {
    const c = mmFitScaleFor(target);
    endX = (target.x0 + target.x1) / 2; endY = (target.y0 + target.y1) / 2; endScale = c;
  } else {
    const node = typeof target === 'string' ? mmState.nodesById.get(target) : target;
    if (!node) return;
    if (node.kind === 'concept') {
      endX = node.x; endY = node.y; endScale = 1.15;
    } else {
      const b = mmBoundsFor(mmSubtreeIds(node.id));
      endX = (b.x0 + b.x1) / 2; endY = (b.y0 + b.y1) / 2; endScale = mmFitScaleFor(b);
    }
  }
  mmStartCameraTween(endX, endY, endScale, ms);
}

function mmStartCameraTween(endX, endY, endScale, ms) {
  const c = mmState.camera;
  if (mmState.reducedMotion) {
    c.x = endX; c.y = endY; c.scale = mmClampScale(endScale);
    mmState.camAnim = null;
    mmUpdateZoomLabel();
    mmRequestFrame();
    return;
  }
  mmState.camAnim = {
    x0: c.x, y0: c.y, ls0: Math.log(c.scale),
    x1: endX, y1: endY, ls1: Math.log(mmClampScale(endScale)),
    t0: performance.now(), dur: ms,
  };
  mmRequestFrame();
}

// Applies the in-flight camera tween for this frame. Returns true while
// still animating (drives the "keep looping" decision in mmLoop).
function mmTickCamera(now) {
  const a = mmState.camAnim;
  if (!a) return false;
  const t = mmClamp((now - a.t0) / a.dur, 0, 1);
  const k = mmEaseInOutCubic(t);
  const c = mmState.camera;
  c.x = mmLerp(a.x0, a.x1, k);
  c.y = mmLerp(a.y0, a.y1, k);
  c.scale = mmClampScale(Math.exp(mmLerp(a.ls0, a.ls1, k)));
  if (t >= 1) { mmState.camAnim = null; return false; }
  return true;
}

function mmUpdateZoomLabel() {
  const el = document.getElementById('mm-zoom-level');
  if (!el) return;
  const pct = Math.round(mmState.camera.scale * 100) + '%';
  if (el.textContent !== pct) el.textContent = pct;
}

/* ================================ 10. Focus/emphasis (hover & selection — the Obsidian signature) ================================ */

function mmComputeFocusSet(id) {
  const set = new Set([id]);
  mmState.structEdges.forEach((e) => {
    if (e.source.id === id) set.add(e.target.id);
    if (e.target.id === id) set.add(e.source.id);
  });
  mmState.aiEdges.forEach((e) => {
    if (e.source.id === id) set.add(e.target.id);
    if (e.target.id === id) set.add(e.source.id);
  });
  return set;
}

// Hover takes visual priority while active; releasing hover reverts to the
// persistent selection's focus set (if any), or to no emphasis.
function mmSyncFocus() {
  const id = mmState.hover != null ? mmState.hover : mmState.selected;
  mmState.focusSet = id ? mmComputeFocusSet(id) : null;
}

function mmSetHover(id) {
  if (!mmState || mmState.hover === id) return;
  mmState.hover = id;
  mmSyncFocus();
  mmRequestFrame();
}

function mmSelect(id) {
  if (!mmState) return;
  mmState.selected = id;
  mmSyncFocus();
  // Step 3: keep the sidebar's active-row + the detail card in lock-step with
  // selection, from every path that can change it (canvas click, search
  // result click, Esc, empty-space click) — MINDMAP.md §4: "hook into the
  // existing mmSelect... render/remove the card there so canvas clicks,
  // search clicks, and Esc all stay consistent."
  mmSidebarSyncFromSelection();
  mmCardLinksOnSelect(id); // link-manager cache: reset/kick a fetch for the newly selected concept
  mmRenderCard();
  mmRequestFrame();
}

// Advances the single global focusT 0→1 transition (MINDMAP.md §1: "a single
// focusT 0→1 transition"). Both node alpha and AI-edge alpha are computed as
// mmLerp(baseline, target, focusT) so one scalar drives the whole fade.
function mmAdvanceFocusT(dt) {
  const target = mmState.focusSet ? 1 : 0;
  if (mmState.reducedMotion) { mmState.focusT = target; return; }
  const k = 1 - Math.exp(-dt / MM_FOCUS_TAU);
  mmState.focusT = mmLerp(mmState.focusT, target, k);
  if (Math.abs(mmState.focusT - target) < 0.002) mmState.focusT = target;
}

/* ================================ 11. Viewport culling ================================ */

function mmViewportWorldBounds(margin = 80) {
  const c = mmState.camera;
  const halfW = (mmState.cssW / 2) / c.scale + margin;
  const halfH = (mmState.cssH / 2) / c.scale + margin;
  return { x0: c.x - halfW, y0: c.y - halfH, x1: c.x + halfW, y1: c.y + halfH };
}
function mmInView(n, vb) {
  return n.x + n.r >= vb.x0 && n.x - n.r <= vb.x1 && n.y + n.r >= vb.y0 && n.y - n.r <= vb.y1;
}

/* ================================ 12. Frame draw (flat circles, quiet edges — MINDMAP.md §1) ================================
   Single canvas. No shadowBlur/ctx.filter/gradient-creation here — flat
   fills/strokes only, batched per style where practical (perf guardrails). */

function mmDrawEdgeLabel(ctx, x, y, text, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '500 11px Inter, ui-sans-serif, system-ui, sans-serif';
  const w = ctx.measureText(text).width;
  const padX = 7, h = 18;
  ctx.fillStyle = mmTheme.surface;
  mmRoundRect(ctx, x - w / 2 - padX, y - h / 2, w + padX * 2, h, 5);
  ctx.fill();
  ctx.fillStyle = mmTheme.textMuted;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function mmDrawProgressArc(ctx, p, radiusPx, frac, colorHex) {
  if (radiusPx < 3) return;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = mmRgba(mmTheme.text, 0.14);
  ctx.beginPath(); ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2); ctx.stroke();
  if (frac > 0) {
    ctx.strokeStyle = colorHex;
    ctx.beginPath(); ctx.arc(p.x, p.y, radiusPx, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
  }
  ctx.restore();
}

// Draws one node; returns true iff it's actively pulsing right now (used to
// decide whether the rAF loop needs to keep running — MINDMAP.md §2: "pulses
// pause too unless a pulsing node is actually present and visible").
function mmDrawNode(ctx, n, now) {
  const p = mmWorldToScreen(n.x, n.y);
  const scale = mmState.camera.scale;
  const rPx = n.r * scale;
  if (p.x + rPx < -20 || p.y + rPx < -20 || p.x - rPx > mmState.cssW + 20 || p.y - rPx > mmState.cssH + 20) return false;

  const isMember = !mmState.focusSet || mmState.focusSet.has(n.id);
  const alphaMul = mmLerp(1, isMember ? 1 : MM_FOCUS_FADE, mmState.focusT);
  const accentHex = mmTheme.accents[n.colorKey] || mmTheme.primary;
  let pulsing = false;

  ctx.save();
  ctx.globalAlpha = alphaMul;

  if (n.kind === 'semester' || n.kind === 'course') {
    ctx.fillStyle = accentHex;
    ctx.beginPath(); ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2); ctx.fill();
    // Crisp rim for definition on the big hub dots (bolder/more-colorful pass
    // — MINDMAP.md follow-up, Build 14 Phase C): a hairline stroke just inside
    // the fill edge, not a new hue — keeps hubs reading as one flat accent
    // color with a sharp edge instead of a soft blob.
    ctx.strokeStyle = mmRgba(mmTheme.text, 0.16);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, rPx - 0.5), 0, Math.PI * 2); ctx.stroke();
    if (n.totalCount > 0) mmDrawProgressArc(ctx, p, rPx + 4, n.doneCount / n.totalCount, accentHex);
  } else {
    // concept — quiet state treatment (MINDMAP.md §1)
    if (n.done) {
      ctx.fillStyle = accentHex;
      ctx.beginPath(); ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, rPx + 2.5, 0, Math.PI * 2); ctx.stroke();
    } else if (n.noteStatus === 'failed') {
      ctx.strokeStyle = mmTheme.danger;
      ctx.lineWidth = 1.75;
      ctx.beginPath(); ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2); ctx.stroke();
    } else if (n.noteStatus === 'generating') {
      let pulseA = 0.8;
      if (!mmState.reducedMotion) {
        pulsing = true;
        const phase = mulberry32(mmSeed(n.id))() * 6.283;
        const s = Math.sin((now / 1200) * Math.PI * 2 + phase);
        pulseA = 0.65 + 0.3 * (s * 0.5 + 0.5);
      }
      ctx.globalAlpha = alphaMul * pulseA;
      ctx.fillStyle = accentHex;
      ctx.beginPath(); ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alphaMul;
    } else if (n.noteStatus === 'compiled') {
      // Bolder/more-colorful pass (MINDMAP.md follow-up, Build 14 Phase C):
      // compiled concepts were 0.75 — raised so they read vivid, not washed out.
      ctx.globalAlpha = alphaMul * 0.92;
      ctx.fillStyle = accentHex;
      ctx.beginPath(); ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alphaMul;
    } else {
      // No note yet — still clearly "to make" (kept lower-alpha than
      // compiled/done), but a low-alpha FILLED dot + a crisp accent ring
      // reads far more colorful than a faint hollow circle did.
      ctx.globalAlpha = alphaMul * 0.45;
      ctx.fillStyle = accentHex;
      ctx.beginPath(); ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alphaMul;
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2); ctx.stroke();
    }

    // next_study_date today/overdue — small pulsing ring in --primary
    if (!n.done && n.nextStudyDate && n.nextStudyDate <= mmTodayISO()) {
      ctx.strokeStyle = mmTheme.primary;
      ctx.lineWidth = 1.5;
      if (mmState.reducedMotion) {
        ctx.globalAlpha = alphaMul * 0.55;
        ctx.beginPath(); ctx.arc(p.x, p.y, rPx + 6, 0, Math.PI * 2); ctx.stroke();
      } else {
        pulsing = true;
        const pr = (now / 1400) % 1;
        ctx.globalAlpha = alphaMul * (1 - pr) * 0.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, rPx + 4 + pr * 8, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = alphaMul;
    }
  }

  if (n.id === mmState.selected) {
    ctx.strokeStyle = mmTheme.primary;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, rPx + 6, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
  return pulsing;
}

/* ---- Label declutter + legibility (MINDMAP.md follow-up, Build 14 Phase C) ----
   Split the old single-pass mmDrawLabel into "measure" (position/font/bbox,
   no drawing) + "draw at" (paint an already-measured label) so a full frame
   can measure every visible candidate FIRST, drop any whose screen bbox would
   collide with a higher-priority label already placed, and only then draw
   the survivors — see mmDrawLabels() below, called once per frame from
   mmDrawFrame() in place of the old `visible.forEach(mmDrawLabel)`. */

function mmLabelBaseAlpha(n, scale) {
  if (n.kind === 'semester') return 1;
  if (n.kind === 'course') return mmSmoothstep(0.25, 0.45, scale);
  return mmSmoothstep(0.70, 1.00, scale);
}

function mmLabelStyle(n) {
  if (n.kind === 'semester') {
    return { text: n.name + (n.archived ? '  ·  archived' : ''), font: '600 13px Inter, ui-sans-serif, system-ui, sans-serif', size: 13 };
  }
  if (n.kind === 'course') {
    return { text: n.name, font: '600 12.5px Inter, ui-sans-serif, system-ui, sans-serif', size: 12.5 };
  }
  const text = n.name.length > 28 ? n.name.slice(0, 27) + '…' : n.name;
  return { text, font: '500 11.5px Inter, ui-sans-serif, system-ui, sans-serif', size: 11.5 };
}

// Computes one node's label position/font/screen-bbox WITHOUT drawing it.
// Returns null exactly when the old mmDrawLabel would have skipped drawing:
// off-screen, or alpha≈0 (below the semantic-zoom/focus floor) — same early
// returns as before, just relocated here.
function mmMeasureLabel(ctx, n) {
  const scale = mmState.camera.scale;
  const baseAlpha = mmLabelBaseAlpha(n, scale);
  const isMember = !!(mmState.focusSet && mmState.focusSet.has(n.id));
  const alpha = isMember ? mmLerp(baseAlpha, 1, mmState.focusT) : baseAlpha;
  if (alpha < 0.02) return null;

  const p = mmWorldToScreen(n.x, n.y);
  if (p.x < -100 || p.y < -20 || p.x > mmState.cssW + 100 || p.y > mmState.cssH + 40) return null;

  const rPx = n.r * scale;
  const y = p.y + rPx + 13;
  const { text, font, size } = mmLabelStyle(n);

  ctx.font = font; // measureText reads the context's current font
  const w = ctx.measureText(text).width;
  const padX = 5, padY = 3, textH = size * 1.25;
  return {
    n, text, font, alpha, isMember,
    x: p.x, y,
    bbox: { x0: p.x - w / 2 - padX, y0: y - padY, x1: p.x + w / 2 + padX, y1: y + textH + padY },
  };
}

function mmBBoxOverlaps(a, b, margin) {
  return !(a.x1 + margin < b.x0 || b.x1 + margin < a.x0 || a.y1 + margin < b.y0 || b.y1 + margin < a.y0);
}

// Draws one already-measured label: a subtle rounded halo/pill behind the
// text (mirrors mmDrawEdgeLabel's rounded-surface pattern) for legibility
// over nodes/edges/background, then the same muted→text focus crossfade as
// before (two cheap fillText passes instead of per-frame color mixing).
function mmDrawLabelAt(ctx, m) {
  ctx.save();
  ctx.globalAlpha = m.alpha * 0.7; // subtle — aids contrast without a heavy box
  ctx.fillStyle = mmTheme.surface;
  mmRoundRect(ctx, m.bbox.x0, m.bbox.y0, m.bbox.x1 - m.bbox.x0, m.bbox.y1 - m.bbox.y0, 5);
  ctx.fill();

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = m.font;
  ctx.globalAlpha = m.alpha;
  ctx.fillStyle = mmTheme.textMuted;
  ctx.fillText(m.text, m.x, m.y);
  if (m.isMember && mmState.focusT > 0.01) {
    ctx.globalAlpha = m.alpha * mmState.focusT;
    ctx.fillStyle = mmTheme.text;
    ctx.fillText(m.text, m.x, m.y);
  }
  ctx.restore();
}

// One declutter pass over the frame's visible nodes: measure every candidate
// (alpha >= ~0.06 — a hair above the "basically invisible" floor already
// enforced by mmMeasureLabel), sort by priority (hub labels before concept
// labels; within a tier, focus-set members first, then the selected node,
// then bigger nodes), then draw each in that order UNLESS its screen bbox
// overlaps an already-placed higher-priority label's bbox. This is what stops
// zoomed-out semester/course labels (and dense concept clusters) from piling
// into unreadable overlapping text — semantic-zoom tiers still control WHICH
// labels are even in play; this only resolves collisions among them.
// O(n^2) over the candidate set, which is bounded by the viewport culling
// already applied to `visible` upstream — fine per MINDMAP.md perf guardrails.
function mmDrawLabels(ctx, visible) {
  const kindRank = { semester: 0, course: 1, concept: 2 };
  const candidates = [];
  visible.forEach((n) => {
    const m = mmMeasureLabel(ctx, n);
    if (m && m.alpha >= 0.06) candidates.push(m);
  });
  candidates.sort((a, b) => {
    const ka = kindRank[a.n.kind], kb = kindRank[b.n.kind];
    if (ka !== kb) return ka - kb;
    const fa = a.isMember ? 0 : 1, fb = b.isMember ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const sa = a.n.id === mmState.selected ? 0 : 1, sb = b.n.id === mmState.selected ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return b.n.r - a.n.r;
  });
  const placed = [];
  const margin = 3;
  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i];
    let blocked = false;
    for (let j = 0; j < placed.length; j++) {
      if (mmBBoxOverlaps(m.bbox, placed[j], margin)) { blocked = true; break; }
    }
    if (blocked) continue;
    placed.push(m.bbox);
    mmDrawLabelAt(ctx, m);
  }
}

function mmDrawFrame(now, dt) {
  const ctx = mmState.ctx;

  ctx.fillStyle = mmTheme.bg;
  ctx.fillRect(0, 0, mmState.cssW, mmState.cssH);

  mmAdvanceFocusT(dt);

  const vb = mmViewportWorldBounds();
  const visible = mmState.nodes.filter((n) => mmInView(n, vb));
  const visibleIds = new Set(visible.map((n) => n.id));

  // Structural edges: quiet, constant, not hover-reactive — the always-on skeleton.
  if (mmState.structEdges.length) {
    ctx.save();
    ctx.globalAlpha = 0.11;
    ctx.strokeStyle = mmTheme.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    mmState.structEdges.forEach((e) => {
      if (!visibleIds.has(e.source.id) && !visibleIds.has(e.target.id)) return;
      const p0 = mmWorldToScreen(e.source.x, e.source.y), p1 = mmWorldToScreen(e.target.x, e.target.y);
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  // AI links: baseline 0.25, emphasized (both endpoints in the focus set) → 0.8 + label.
  const emphEdges = [], plainEdges = [];
  mmState.aiEdges.forEach((e) => {
    if (!visibleIds.has(e.source.id) && !visibleIds.has(e.target.id)) return;
    const isEmph = !!(mmState.focusSet && mmState.focusSet.has(e.source.id) && mmState.focusSet.has(e.target.id));
    (isEmph ? emphEdges : plainEdges).push(e);
  });
  if (plainEdges.length) {
    ctx.save();
    ctx.globalAlpha = mmLerp(0.25, MM_FOCUS_FADE, mmState.focusT);
    ctx.strokeStyle = mmTheme.text;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    plainEdges.forEach((e) => {
      const p0 = mmWorldToScreen(e.source.x, e.source.y), p1 = mmWorldToScreen(e.target.x, e.target.y);
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    });
    ctx.stroke();
    ctx.restore();
  }
  if (emphEdges.length) {
    ctx.save();
    ctx.globalAlpha = mmLerp(0.25, 0.8, mmState.focusT);
    ctx.strokeStyle = mmTheme.text;
    ctx.lineWidth = 1.25 * 1.4;
    ctx.beginPath();
    emphEdges.forEach((e) => {
      const p0 = mmWorldToScreen(e.source.x, e.source.y), p1 = mmWorldToScreen(e.target.x, e.target.y);
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    });
    ctx.stroke();
    ctx.restore();
    if (mmState.focusT > 0.05) {
      emphEdges.forEach((e) => {
        if (!e.label) return;
        const p0 = mmWorldToScreen(e.source.x, e.source.y), p1 = mmWorldToScreen(e.target.x, e.target.y);
        mmDrawEdgeLabel(ctx, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, e.label, mmState.focusT);
      });
    }
  }

  let pulseActive = false;
  visible.forEach((n) => { if (mmDrawNode(ctx, n, now)) pulseActive = true; });
  mmDrawLabels(ctx, visible); // measure→sort→declutter→draw (Build 14 Phase C)
  mmDrawEffects(ctx, now); // Step 3: "mark done" one-shot ring pulses (§15d)

  mmState._pulseActive = pulseActive;
}

/* ================================ 13. Loop driver — rAF runs ONLY while something is animating ================================ */

function mmRequestFrame() {
  if (!mmState || mmState.rafId) return;
  mmState.rafId = requestAnimationFrame(mmLoop);
}

function mmLoop(ts) {
  if (!mmState) return;
  mmState.rafId = null;
  const now = ts;
  const dt = mmState.lastFrameTime ? Math.min(0.1, (now - mmState.lastFrameTime) / 1000) : 0.016;
  mmState.lastFrameTime = now;

  const cameraAnimating = mmTickCamera(now);
  mmDrawFrame(now, dt); // also advances focusT for this frame
  mmUpdateZoomLabel();

  const simHot = !!(mmState.sim && mmState.sim.alpha() > mmState.sim.alphaMin());
  const focusTransitioning = Math.abs(mmState.focusT - (mmState.focusSet ? 1 : 0)) > 0.002;
  const pulseActive = !mmState.reducedMotion && mmState._pulseActive;
  const effectsActive = mmState.effects.length > 0; // Step 3: ring-pulse effects (§15d)

  // At rest (no sim heat, no camera tween, no focus transition, no visible
  // pulse/effect), this stops scheduling itself — zero per-frame work, per spec.
  if (cameraAnimating || simHot || focusTransitioning || pulseActive || effectsActive) {
    mmState.rafId = requestAnimationFrame(mmLoop);
  }
}

/* ================================ 14. Hit-testing (quadtree-backed) ================================ */

function mmQueryQuadtreeBox(qt, x0, y0, x1, y1) {
  // d3-quadtree v7 leaves are {data, next} wrappers (no cached x/y on the
  // wrapper itself) — read coordinates off leaf.data (our actual node
  // object) and walk .next for coincident-point chains.
  const results = [];
  qt.visit((node, nx0, ny0, nx1, ny1) => {
    if (!node.length) {
      let leaf = node;
      do {
        const d = leaf.data;
        if (d.x >= x0 && d.x < x1 && d.y >= y0 && d.y < y1) results.push(d);
      } while ((leaf = leaf.next));
    }
    return nx0 >= x1 || ny0 >= y1 || nx1 < x0 || ny1 < y0;
  });
  return results;
}

function mmHitTest(sx, sy) {
  if (!mmState || !mmState.nodes.length) return null;
  const w = mmScreenToWorld(sx, sy);
  const padWorld = 6 / mmState.camera.scale;
  let candidates;
  if (mmState.quadtree) {
    const half = mmState.maxNodeR + padWorld;
    candidates = mmQueryQuadtreeBox(mmState.quadtree, w.x - half, w.y - half, w.x + half, w.y + half);
  } else {
    candidates = mmState.nodes;
  }
  let best = null, bestD = Infinity, bestR = Infinity;
  candidates.forEach((n) => {
    const d = Math.hypot(n.x - w.x, n.y - w.y);
    if (d <= n.r + padWorld && (n.r < bestR || (n.r === bestR && d < bestD))) { best = n; bestD = d; bestR = n.r; }
  });
  return best;
}

/* ================================ 15. DOM: topbar + empty/error states (native theme, §4) ================================ */

function mmTopbarHtml() {
  return `
    <div id="mm-topbar" class="mm-topbar">
      <div class="card flex items-center gap-1 p-1">
        <button class="icon-btn" data-mm-action="zoom-out" title="Zoom out" aria-label="Zoom out">−</button>
        <span class="mm-zoom-level" id="mm-zoom-level" data-mm-action="zoom-reset" title="Fit all" role="button" tabindex="0">100%</span>
        <button class="icon-btn" data-mm-action="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
        <button class="btn btn-secondary" data-mm-action="zoom-reset" title="Fit all (press 0)">Fit</button>
      </div>
      <div class="card mm-discovery-cluster flex items-center gap-2 p-1">
        <div id="mm-discovery" class="mm-discovery"></div>
      </div>
    </div>`;
}

function mmMapGlyphSvg() {
  return `<svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <circle cx="7" cy="8" r="2.4"/><circle cx="21" cy="7" r="2.4"/><circle cx="14" cy="20" r="2.8"/>
    <line x1="9" y1="9.2" x2="18.6" y2="7.8"/><line x1="8" y1="10.2" x2="12.6" y2="17.8"/><line x1="19" y1="9" x2="15.4" y2="18"/>
  </svg>`;
}

function mmEmptyHtml(kind, message) {
  if (kind === 'error') {
    return `<div id="mm-empty" class="mm-empty">
      <div class="card p-7 text-center" style="max-width:380px">
        <div class="mb-3 flex justify-center text-red-500">${mmMapGlyphSvg()}</div>
        <div class="text-base font-semibold text-ink mb-1.5">Couldn't load the mind map</div>
        <div class="text-sm text-muted mb-4">${ui.escapeHtml(message || 'Something went wrong.')}</div>
        <button class="btn btn-primary" data-mm-action="retry">Retry</button>
      </div>
    </div>`;
  }
  return `<div id="mm-empty" class="mm-empty">
    <div class="card p-7 text-center" style="max-width:380px">
      <div class="mb-3 flex justify-center text-muted">${mmMapGlyphSvg()}</div>
      <div class="text-base font-semibold text-ink mb-1.5">Nothing to map yet</div>
      <div class="text-sm text-muted mb-4">Create a course and analyze its materials to grow your mind map.</div>
      <a href="#/courses" class="btn btn-primary">Go to courses</a>
    </div>
  </div>`;
}

/* ================================ 15b. DOM: hierarchy sidebar (MINDMAP.md §4 — Step 3) ================================
   Left overlay panel, native theme-token styling, present whenever the graph
   has nodes (never mounted in the empty/error states). Two independently
   refreshable pieces so typing in the search box never re-renders (and loses
   focus/cursor in) the input itself:
     mmRenderSidebar()     — the whole shell (mount, collapse/expand toggle).
     mmRenderSidebarList() — only #mm-sidebar-list (search results / tree),
                             called on every keystroke and every state change
                             (row clicks, chevron toggles, selection sync,
                             done-toggle count updates). */

function mmSidebarStoredCollapsed() {
  try { return localStorage.getItem('axiom_mm_sidebar') === '1'; } catch (_) { return false; }
}
function mmSetSidebarStoredCollapsed(val) {
  try { localStorage.setItem('axiom_mm_sidebar', val ? '1' : '0'); } catch (_) { /* ignore */ }
}

function mmSidebarChevronSvg(dir) {
  const d = dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7';
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

function mmSidebarAxiomRowHtml() {
  const active = mmState.sidebarActiveKey === 'axiom';
  return `<button class="mm-row mm-row-axiom${active ? ' active' : ''}" data-mm-action="sidebar-axiom">
    <span class="mm-row-glyph">${mmMapGlyphSvg()}</span>
    <span class="mm-row-title">Axiom</span>
  </button>`;
}

function mmSidebarSemesterRowHtml(sem) {
  const active = mmState.sidebarActiveKey === sem.id;
  const collapsed = mmState.sidebarSemCollapsed.has(sem.id);
  return `<div class="mm-row-wrap">
    <button class="mm-row mm-row-sem${active ? ' active' : ''}" data-mm-action="sidebar-sem" data-id="${sem.id}">
      <span class="dot dot-${sem.colorKey}"></span>
      <span class="mm-row-title">${ui.escapeHtml(sem.name)}</span>
      ${sem.archived ? '<span class="mm-tag">archived</span>' : ''}
    </button>
    <button class="mm-chevron${collapsed ? ' collapsed' : ''}" data-mm-action="sidebar-sem-chevron" data-id="${sem.id}"
      title="${collapsed ? 'Expand' : 'Collapse'}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${ui.escapeHtml(sem.name)}">${mmSidebarChevronSvg('right')}</button>
  </div>`;
}

function mmSidebarCourseRowHtml(course) {
  const active = mmState.sidebarActiveKey === course.id;
  const collapsed = mmState.sidebarCourseCollapsed.has(course.id);
  return `<div class="mm-row-wrap">
    <button class="mm-row mm-row-course${active ? ' active' : ''}" data-mm-action="sidebar-course" data-id="${course.id}">
      <span class="dot dot-${course.colorKey}"></span>
      <span class="mm-row-title">${ui.escapeHtml(course.name)}</span>
      <span class="mm-row-count">${course.doneCount}/${course.totalCount}</span>
    </button>
    <button class="mm-chevron${collapsed ? ' collapsed' : ''}" data-mm-action="sidebar-course-chevron" data-id="${course.id}"
      title="${collapsed ? 'Expand' : 'Collapse'}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${ui.escapeHtml(course.name)}">${mmSidebarChevronSvg('right')}</button>
  </div>`;
}

function mmSidebarConceptRowHtml(concept) {
  const active = mmState.sidebarActiveKey === concept.id;
  return `<button class="mm-row mm-row-concept${active ? ' active' : ''}" data-mm-action="sidebar-concept" data-id="${concept.id}">
    <span class="dot dot-${concept.colorKey}"></span>
    <span class="mm-row-title">${ui.escapeHtml(concept.name)}</span>
  </button>`;
}

function mmSidebarTreeHtml() {
  let html = mmSidebarAxiomRowHtml();
  mmState.nodes.forEach((n) => {
    if (n.kind !== 'semester') return;
    html += mmSidebarSemesterRowHtml(n);
    if (mmState.sidebarSemCollapsed.has(n.id)) return;
    mmState.nodes.forEach((c) => {
      if (c.kind !== 'course' || c.parentId !== n.id) return;
      html += mmSidebarCourseRowHtml(c);
      if (mmState.sidebarCourseCollapsed.has(c.id)) return;
      mmState.nodes.forEach((co) => { if (co.kind === 'concept' && co.parentId === c.id) html += mmSidebarConceptRowHtml(co); });
    });
  });
  return html;
}

function mmSidebarSearchResultsHtml(query) {
  const q = query.toLowerCase();
  const results = mmState.nodes.filter((n) => n.kind === 'concept' && n.name.toLowerCase().includes(q)).slice(0, 12);
  if (!results.length) return `<div class="mm-sidebar-empty">No matching concepts.</div>`;
  return results.map((n) => {
    const course = mmState.nodesById.get(n.parentId);
    return `<button class="mm-row mm-row-result" data-mm-action="sidebar-search-result" data-id="${n.id}">
      <span class="dot dot-${n.colorKey}"></span>
      <span class="mm-row-main">
        <span class="mm-row-title">${ui.escapeHtml(n.name)}</span>
        <span class="mm-row-sub">${ui.escapeHtml(course ? course.name : '')}</span>
      </span>
    </button>`;
  }).join('');
}

function mmSidebarListInnerHtml() {
  const q = (mmState.sidebarQuery || '').trim();
  return q ? mmSidebarSearchResultsHtml(q) : mmSidebarTreeHtml();
}

function mmSidebarHtml() {
  if (mmState.sidebarCollapsed) {
    return `<div id="mm-sidebar" class="mm-sidebar mm-sidebar-collapsed">
      <button class="icon-btn mm-sidebar-handle" data-mm-action="sidebar-expand" title="Show hierarchy" aria-label="Show hierarchy">${mmSidebarChevronSvg('right')}</button>
    </div>`;
  }
  return `<div id="mm-sidebar" class="mm-sidebar">
    <div class="mm-sidebar-head">
      <span class="mm-sidebar-heading">Curriculum</span>
      <button class="icon-btn mm-sidebar-handle" data-mm-action="sidebar-collapse" title="Collapse" aria-label="Collapse sidebar">${mmSidebarChevronSvg('left')}</button>
    </div>
    <div class="mm-sidebar-search">
      <input id="mm-search-input" class="field-input mm-search-input" type="text" placeholder="Search concepts…" autocomplete="off" spellcheck="false" value="${ui.escapeHtml(mmState.sidebarQuery)}" />
    </div>
    <div id="mm-sidebar-list" class="mm-sidebar-list">${mmSidebarListInnerHtml()}</div>
  </div>`;
}

// Wires the (freshly (re)inserted) search input's 'input' listener. Escape is
// handled by the single document-level keydown handler in mmWireEvents (the
// required fix — it special-cases #mm-search-input) so no listener is needed
// here for that. No explicit teardown: the input node lives inside
// #mindmap-root and is discarded (GC'd, listener and all) whenever the
// sidebar shell next re-renders (old.remove()) or the route changes.
function mmWireSidebarInput() {
  const input = document.getElementById('mm-search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    if (!mmState) return;
    mmState.sidebarQuery = input.value;
    mmRenderSidebarList();
  });
}

function mmRenderSidebar() {
  const root = document.getElementById('mindmap-root');
  if (!root) return;
  const old = document.getElementById('mm-sidebar');
  if (old) old.remove();
  root.insertAdjacentHTML('beforeend', mmSidebarHtml());
  if (!mmState.sidebarCollapsed) mmWireSidebarInput();
}

function mmRenderSidebarList() {
  const list = document.getElementById('mm-sidebar-list');
  if (!list) return;
  list.innerHTML = mmSidebarListInnerHtml();
}

// Keeps the sidebar's active-row highlight in step with selection (MINDMAP.md
// §4: "when a concept is selected on canvas, its course row" is the active
// row, auto-expanding its semester). A no-op in the empty/no-graph state
// (no sidebar mounted there) and while a search is in progress (the tree
// isn't visible then — the next query clear will pick up the fresh state).
function mmSidebarSyncFromSelection() {
  if (!mmState || !mmState.nodes.length) return;
  const id = mmState.selected;
  if (id) {
    const node = mmState.nodesById.get(id);
    if (node) {
      if (node.kind === 'concept') {
        // Reveal the concept row itself (now visible in the tree) — expand
        // its course (concept list) and that course's semester so the row
        // is actually reachable, and highlight the concept, not the course.
        mmState.sidebarActiveKey = node.id;
        mmState.sidebarCourseCollapsed.delete(node.parentId);
        const courseNode = mmState.nodesById.get(node.parentId);
        if (courseNode) mmState.sidebarSemCollapsed.delete(courseNode.parentId);
      } else if (node.kind === 'course') {
        mmState.sidebarActiveKey = node.id;
        mmState.sidebarSemCollapsed.delete(node.parentId);
      } else if (node.kind === 'semester') {
        mmState.sidebarActiveKey = node.id;
      }
    }
  }
  if (!mmState.sidebarQuery) mmRenderSidebarList();
}

/* ================================ 15c. DOM: detail card (MINDMAP.md §4 — Step 3) ================================
   Right overlay panel, shown/hidden entirely from mmSelect() so canvas
   clicks, sidebar search clicks, and Esc all stay consistent (single call
   site: mmRenderCard()). */

function mmCardCloseSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
}

function mmConceptChipsHtml(node) {
  const chips = [];
  if (node.noteStatus === 'compiled') chips.push('<span class="mm-chip mm-chip-success">Note compiled</span>');
  else if (node.noteStatus === 'failed') chips.push('<span class="mm-chip mm-chip-danger">Note failed</span>');
  else if (node.noteStatus === 'generating') chips.push('<span class="mm-chip mm-chip-muted">Note generating…</span>');
  else chips.push('<span class="mm-chip mm-chip-muted">No note yet</span>');
  if (node.bestTotal != null) chips.push(`<span class="mm-chip mm-chip-muted">Quiz ${node.bestScore != null ? node.bestScore : 0}/${node.bestTotal}</span>`);
  if (node.done) chips.push('<span class="mm-chip mm-chip-success">Done ✓</span>');
  if (node.nextStudyDate) chips.push(`<span class="mm-chip mm-chip-primary">Next study: ${ui.escapeHtml(typeof fmtDate === 'function' ? fmtDate(node.nextStudyDate) : node.nextStudyDate)}</span>`);
  return chips.join('');
}

function mmConceptActionsHtml(node) {
  const btns = [`<button class="btn btn-secondary" data-mm-action="card-open-lesson">Open lesson</button>`];
  if (node.noteStatus === 'compiled') btns.push(`<button class="btn btn-secondary" data-mm-action="card-read-note">Read note</button>`);
  btns.push(`<button class="btn btn-secondary" data-mm-action="card-start-quiz">Start quiz</button>`);
  btns.push(`<button class="btn ${node.done ? 'btn-ghost' : 'btn-primary'}" data-mm-action="card-toggle-done">${node.done ? 'Mark undone' : 'Mark done'}</button>`);
  return btns.join('');
}

function mmConceptCardHtml(node) {
  const course = mmState.nodesById.get(node.parentId);
  const sem = course ? mmState.nodesById.get(course.parentId) : null;
  const crumbs = [course ? course.name : '', sem ? sem.name : ''].filter(Boolean).map((s) => ui.escapeHtml(s));
  return `<div id="mm-card" class="mm-card">
    <button class="icon-btn mm-card-close" data-mm-action="card-close" title="Close" aria-label="Close">${mmCardCloseSvg()}</button>
    <div class="mm-card-kind">Concept</div>
    <h3 class="mm-card-title">${ui.escapeHtml(node.name)}</h3>
    ${crumbs.length ? `<p class="mm-card-breadcrumb">${crumbs.join(' &bull; ')}</p>` : ''}
    <div class="mm-card-body">
      ${node.summary ? `<p class="mm-card-summary">${ui.escapeHtml(node.summary)}</p>` : ''}
      <div class="mm-card-chips">${mmConceptChipsHtml(node)}</div>
      <div class="mm-card-actions">${mmConceptActionsHtml(node)}</div>
      <div id="mm-card-links" class="mm-card-links">${mmCardLinksSectionHtml(node)}</div>
    </div>
  </div>`;
}

function mmHubCardHtml(node) {
  const isCourse = node.kind === 'course';
  const progress = `${node.doneCount}/${node.totalCount} concept${node.totalCount === 1 ? '' : 's'} done`;
  let extra = '';
  if (!isCourse) {
    const courseCount = mmState.nodes.filter((n) => n.kind === 'course' && n.parentId === node.id).length;
    extra = `<p class="mm-card-meta">${courseCount} course${courseCount === 1 ? '' : 's'}</p>`;
  }
  return `<div id="mm-card" class="mm-card">
    <button class="icon-btn mm-card-close" data-mm-action="card-close" title="Close" aria-label="Close">${mmCardCloseSvg()}</button>
    <div class="mm-card-kind">${isCourse ? 'Course' : 'Semester'}</div>
    <h3 class="mm-card-title">${ui.escapeHtml(node.name)}</h3>
    ${isCourse && node.code ? `<p class="mm-card-breadcrumb">${ui.escapeHtml(node.code)}</p>` : ''}
    <div class="mm-card-body">
      ${extra}
      <p class="mm-card-progress">${progress}</p>
      <div class="mm-card-actions">${isCourse ? `<button class="btn btn-primary" data-mm-action="card-open-course">Open course</button>` : ''}</div>
    </div>
  </div>`;
}

function mmRenderCard() {
  const root = document.getElementById('mindmap-root');
  if (!root) return;
  const old = document.getElementById('mm-card');
  if (old) old.remove();
  const id = mmState && mmState.selected;
  if (!id) return;
  const node = mmState.nodesById.get(id);
  if (!node) return;
  root.insertAdjacentHTML('beforeend', node.kind === 'concept' ? mmConceptCardHtml(node) : mmHubCardHtml(node));
}

// "Mark done"/"Mark undone" (MINDMAP.md §4): flips the backend flag, then
// updates the node + its course/semester doneCounts + the sidebar + the card
// IN PLACE (no reload) and fires a one-shot ring-pulse effect on the node.
async function mmToggleDone(node) {
  if (!mmState || mmState.doneBusy) return;
  const wasDone = !!node.done;
  mmState.doneBusy = true;
  try {
    await api.post(`/concepts/${node.refId}/${wasDone ? 'undone' : 'done'}`, {});
  } catch (e) {
    mmState.doneBusy = false;
    ui.toast(e.message, 'error');
    return;
  }
  mmState.doneBusy = false;
  const nowDone = !wasDone;
  node.done = nowDone;
  const course = mmState.nodesById.get(node.parentId);
  if (course) {
    course.doneCount += nowDone ? 1 : -1;
    const sem = mmState.nodesById.get(course.parentId);
    if (sem) sem.doneCount += nowDone ? 1 : -1;
  }
  ui.toast(nowDone ? 'Marked done' : 'Marked not done');
  mmAddEffect(node.id);
  if (!mmState.sidebarQuery) mmRenderSidebarList();
  if (mmState.selected === node.id) mmRenderCard();
  mmRequestFrame();
}

/* ================================ 15c-ii. Concept card: link manager ("edit mind-map links") ================================
   A compact section inside the concept card (below the existing actions,
   #mm-card-links) listing every concept_link touching the selected concept
   (GET /mindmap/links?concept_id=), each with an AI/Manual tag + Edit label/
   Hide/Unhide/Delete, plus an "+ Add link" picker (POST /mindmap/links). The
   cache lives on mmState.cardLinks/.cardLinksFor/.cardLinksError so the
   section can be re-rendered in isolation (mmRenderCardLinksSection, mirrors
   mmRenderSidebarList) without touching the rest of the card or the canvas.
   Every mutation re-fetches this list AND calls mmRefreshLinks() so the graph
   edges update in place (camera/selection preserved) — mirrors mmToggleDone's
   in-place-mutate + re-render pattern. */

// Called from mmSelect (before mmRenderCard so the card's first paint already
// reflects loading/cached state). Resets the cache for a non-concept
// selection (or none); for a concept, kicks a fetch UNLESS the cache already
// belongs to this exact concept (repeat-selecting the same node keeps the
// list instead of flashing back to "Loading…").
function mmCardLinksOnSelect(id) {
  if (!mmState) return;
  const node = id ? mmState.nodesById.get(id) : null;
  if (!node || node.kind !== 'concept') {
    mmState.cardLinks = null;
    mmState.cardLinksFor = null;
    mmState.cardLinksError = null;
    return;
  }
  if (mmState.cardLinksFor === node.refId && Array.isArray(mmState.cardLinks)) return; // already have it
  mmState.cardLinks = null;
  mmState.cardLinksError = null;
  mmFetchCardLinksFor(node.refId);
}

// Fetches (or re-fetches) the link list for one concept and repaints just
// #mm-card-links. Guards against the selection having moved on (or the view
// having torn down) while the request was in flight — "concept deleted
// mid-flight" / navigated away, per spec.
async function mmFetchCardLinksFor(conceptRefId) {
  if (!mmState) return;
  const activeState = mmState;
  mmState.cardLinksFor = conceptRefId; // marks this concept as the in-flight/current target
  try {
    const links = await api.get(`/mindmap/links?concept_id=${conceptRefId}`);
    if (mmState !== activeState || mmState.cardLinksFor !== conceptRefId) return;
    mmState.cardLinks = Array.isArray(links) ? links : [];
    mmState.cardLinksError = null;
  } catch (e) {
    if (mmState !== activeState || mmState.cardLinksFor !== conceptRefId) return;
    mmState.cardLinks = null;
    mmState.cardLinksError = (e && e.message) || 'Failed to load links.';
  }
  mmRenderCardLinksSection();
}

function mmRenderCardLinksSection() {
  if (!mmState || !mmState.selected) return;
  const el = document.getElementById('mm-card-links');
  if (!el) return;
  const node = mmState.nodesById.get(mmState.selected);
  if (!node || node.kind !== 'concept') return;
  el.innerHTML = mmCardLinksSectionHtml(node);
}

function mmCardLinkRowHtml(l) {
  const hidden = !!l.hidden;
  const tagCls = l.manual ? 'mm-link-tag-manual' : 'mm-link-tag-ai';
  const tagText = l.manual ? 'Manual' : 'AI';
  return `<div class="mm-link-row${hidden ? ' mm-link-row-hidden' : ''}">
    <div class="mm-link-row-top">
      <span class="mm-link-name">${ui.escapeHtml(l.other_concept_name || '')}</span>
      <span class="mm-link-tag ${tagCls}">${tagText}</span>
      ${hidden ? '<span class="mm-link-tag mm-link-tag-hidden">Hidden</span>' : ''}
    </div>
    ${l.label ? `<div class="mm-link-label">${ui.escapeHtml(l.label)}</div>` : ''}
    <div class="mm-link-row-actions">
      <button class="mm-link-action" data-mm-action="card-edit-link" data-link-id="${l.id}">Edit label</button>
      ${hidden
        ? `<button class="mm-link-action" data-mm-action="card-unhide-link" data-link-id="${l.id}">Unhide</button>`
        : `<button class="mm-link-action" data-mm-action="card-hide-link" data-link-id="${l.id}">Hide</button>`}
      <button class="mm-link-action mm-link-action-danger" data-mm-action="card-delete-link" data-link-id="${l.id}">Delete</button>
    </div>
  </div>`;
}

function mmCardLinksListHtml(links) {
  if (!links.length) return `<div class="mm-link-empty">No links yet.</div>`;
  return links.map(mmCardLinkRowHtml).join('');
}

// "+ Add link" picker — a <select> of every OTHER concept node, excluding the
// card's own concept and any concept it's already linked to (regardless of
// hidden — the link row still exists; Unhide is the way back for those).
function mmCardAddLinkHtml(node) {
  const linkedIds = new Set([node.refId]);
  (mmState.cardLinks || []).forEach((l) => linkedIds.add(l.other_concept_id));
  const targets = mmState.nodes
    .filter((n) => n.kind === 'concept' && !linkedIds.has(n.refId))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!targets.length) {
    return `<div class="mm-link-add-empty">No other concepts available to link.</div>`;
  }
  const options = targets.map((n) => `<option value="${n.refId}">${ui.escapeHtml(n.name)}</option>`).join('');
  return `<div class="mm-link-add">
    <select id="mm-link-add-target" class="field-input mm-link-add-select">
      <option value="" disabled selected>Link to…</option>
      ${options}
    </select>
    <input id="mm-link-add-label" class="field-input mm-link-add-label" type="text" placeholder="Label (optional)" maxlength="80" autocomplete="off" />
    <button class="btn btn-secondary mm-link-add-btn" data-mm-action="card-add-link">+ Add link</button>
  </div>`;
}

function mmCardLinksSectionHtml(node) {
  const current = mmState.cardLinksFor === node.refId;
  const loaded = current && Array.isArray(mmState.cardLinks);
  let body;
  if (loaded) {
    body = mmCardLinksListHtml(mmState.cardLinks);
  } else if (current && mmState.cardLinksError) {
    body = `<div class="mm-link-empty mm-link-error-text">${ui.escapeHtml(mmState.cardLinksError)}</div>`;
  } else {
    body = `<div class="mm-link-empty">Loading links…</div>`;
  }
  return `
    <div class="mm-card-links-head">Links</div>
    <div class="mm-card-links-list">${body}</div>
    ${loaded ? mmCardAddLinkHtml(node) : ''}
  `;
}

// Shared post-mutation step for every link edit: re-fetch the card's own
// list (only if the card for this exact concept is still open — otherwise
// there's nothing to repaint) AND always refresh the graph's AI edges/degree
// in place (mmRefreshLinks preserves camera + selection).
async function mmAfterLinkMutation(activeState, node) {
  if (mmState === activeState && mmState.selected === node.id) {
    await mmFetchCardLinksFor(node.refId);
  }
  await mmRefreshLinks();
}

async function mmCardAddLink(node) {
  const select = document.getElementById('mm-link-add-target');
  if (!select) return;
  const targetId = Number(select.value);
  if (!targetId) { ui.toast('Choose a concept to link to first', 'error'); return; }
  const labelInput = document.getElementById('mm-link-add-label');
  const label = labelInput ? labelInput.value.trim() : '';
  const activeState = mmState;
  try {
    await api.post('/mindmap/links', { a_concept_id: node.refId, b_concept_id: targetId, label: label || undefined });
  } catch (e) {
    ui.toast((e && e.message) || 'Failed to add link', 'error');
    return;
  }
  ui.toast('Link added');
  await mmAfterLinkMutation(activeState, node);
}

function mmCardEditLink(node, linkId) {
  const links = (mmState.cardLinksFor === node.refId && mmState.cardLinks) || [];
  const existing = links.find((l) => l.id === linkId);
  const activeState = mmState;
  ui.formModal({
    title: 'Edit link label',
    submitLabel: 'Save',
    bodyHtml: `
      <label class="block text-sm">
        <span class="text-muted">Label (optional)</span>
        <input type="text" name="label" class="field-input mt-1 w-full" value="${ui.escapeHtml(existing ? (existing.label || '') : '')}" placeholder="e.g. builds on">
      </label>`,
    onSubmit: async (card) => {
      const label = card.querySelector('[name="label"]').value.trim();
      await api.patch(`/mindmap/links/${linkId}`, { label });
      await mmAfterLinkMutation(activeState, node);
    },
  });
}

async function mmCardSetLinkHidden(node, linkId, hidden) {
  const activeState = mmState;
  try {
    await api.patch(`/mindmap/links/${linkId}`, { hidden });
  } catch (e) {
    ui.toast((e && e.message) || 'Failed to update link', 'error');
    return;
  }
  ui.toast(hidden ? 'Link hidden' : 'Link unhidden');
  await mmAfterLinkMutation(activeState, node);
}

function mmCardDeleteLink(node, linkId) {
  ui.confirmModal({
    title: 'Delete this link?',
    message: 'This removes the connection between these two concepts. This can’t be undone.',
    confirmLabel: 'Delete',
    onConfirm: async () => {
      const activeState = mmState;
      try {
        await api.del(`/mindmap/links/${linkId}`);
      } catch (e) {
        ui.toast((e && e.message) || 'Failed to delete link', 'error');
        return;
      }
      ui.toast('Link deleted');
      await mmAfterLinkMutation(activeState, node);
    },
  });
}

/* ================================ 15d. Ring-pulse effects (MINDMAP.md §4 — "Mark done") ================================
   A tiny one-shot animation list, separate from the hover/selection focus
   fade. Counted as "animating" in mmLoop's rAF gate until each entry expires
   (~400ms) so the loop self-stops again afterwards — same "zero work at
   rest" contract as the sim/camera/pulse gates. Skipped entirely under
   reduced-motion (never pushed), per spec. */

function mmAddEffect(nodeId) {
  if (!mmState || mmState.reducedMotion) return;
  mmState.effects.push({ nodeId, t0: performance.now(), dur: 400 });
  mmRequestFrame();
}

function mmDrawEffects(ctx, now) {
  if (!mmState.effects.length) return;
  const keep = [];
  mmState.effects.forEach((fx) => {
    const t = (now - fx.t0) / fx.dur;
    if (t >= 1) return; // expired — drop
    keep.push(fx);
    const node = mmState.nodesById.get(fx.nodeId);
    if (!node) return;
    const p = mmWorldToScreen(node.x, node.y);
    const rPx = node.r * mmState.camera.scale;
    const k = mmEaseOutCubic(mmClamp(t, 0, 1));
    const accentHex = mmTheme.accents[node.colorKey] || mmTheme.primary;
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, rPx + 4 + k * 22, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
  mmState.effects = keep;
}

/* ================================ 15e. DOM: top-bar discovery control (MINDMAP.md §4 — Step 4) ================================
   A second `.card` cluster in #mm-topbar (mmTopbarHtml), filled from
   mmState.discoverMeta.status/.stale + mmState.aiEdges.length. Re-rendered
   in isolation (mmRenderTopbarDiscovery only touches #mm-discovery + the
   sibling soft-hint pill) on every meta change: initial mount (mmRender),
   after kicking off a run (mmRunDiscover), on each 2s status poll tick that
   settles (mmStartDiscoverPoll), and after an in-place graph refresh
   (mmRefreshLinks) — mirrors the mmRenderSidebarList "re-render just one
   container" pattern so the zoom cluster is never rebuilt. */

function mmDiscoveryRefreshIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>
  </svg>`;
}

// Neutral copy throughout (no space metaphors) — MINDMAP.md §4/§6.
function mmDiscoveryControlHtml() {
  const meta = mmState.discoverMeta || { status: 'idle', message: null, stale: false };
  const count = mmState.aiEdges.length;

  if (meta.status === 'running') {
    return `<button class="btn btn-secondary mm-discovery-btn" disabled>
        <span class="mm-discovery-spinner" aria-hidden="true"></span>Finding connections…
      </button>`;
  }
  if (meta.status === 'done' && meta.stale) {
    return `<button class="btn btn-primary mm-discovery-btn" data-mm-action="discover">✨ Refresh connections</button>
      <span class="mm-discovery-dot" title="Concepts changed since the last discovery run" aria-label="Connections may be out of date"></span>`;
  }
  if (meta.status === 'done') {
    return `<span class="mm-discovery-count">${count} connection${count === 1 ? '' : 's'}</span>
      <button class="icon-btn mm-discovery-icon" data-mm-action="discover" title="Refresh connections" aria-label="Refresh connections">${mmDiscoveryRefreshIconSvg()}</button>`;
  }
  if (meta.status === 'failed') {
    const msg = meta.message || 'Connection discovery failed.';
    const short = msg.length > 46 ? msg.slice(0, 45) + '…' : msg;
    return `<span class="mm-discovery-error" title="${ui.escapeHtml(msg)}">${ui.escapeHtml(short)}</span>
      <button class="btn btn-secondary mm-discovery-btn" data-mm-action="discover">Retry</button>`;
  }
  // idle (never run)
  return `<button class="btn btn-primary mm-discovery-btn" data-mm-action="discover">✨ Discover connections</button>`;
}

function mmDiscoveryHintHtml() {
  return `<div id="mm-discovery-hint" class="mm-discovery-hint">No connections yet — discover how your concepts relate.</div>`;
}

// Re-renders #mm-discovery in isolation + mounts/removes the "zero links yet"
// soft hint as a sibling inside #mm-topbar (MINDMAP.md §4 empty states) — never
// shown in the no-concepts empty state (mmState.nodes has no concept there).
function mmRenderTopbarDiscovery() {
  if (!mmState) return;
  const el = document.getElementById('mm-discovery');
  if (!el) return;
  el.innerHTML = mmDiscoveryControlHtml();

  const meta = mmState.discoverMeta || { status: 'idle', message: null, stale: false };
  const hasConcepts = mmState.nodes.some((n) => n.kind === 'concept');
  const showHint = hasConcepts && mmState.aiEdges.length === 0 && meta.status === 'idle';
  const hint = document.getElementById('mm-discovery-hint');
  const topbar = document.getElementById('mm-topbar');
  if (showHint) {
    if (!hint && topbar) topbar.insertAdjacentHTML('afterbegin', mmDiscoveryHintHtml());
  } else if (hint) {
    hint.remove();
  }
}

// Every discover/refresh/retry click confirms first, naming the single AI
// call + quota use (MINDMAP.md §4/§6) — neutral copy, no space metaphors.
function mmConfirmDiscover() {
  ui.confirmModal({
    title: 'Discover connections?',
    message: 'This makes one AI call, using your configured provider’s quota, to look for relationships between your concepts across every course. Continue?',
    confirmLabel: 'Discover',
    tone: 'primary', // safe, beneficial AI action — not a destructive delete
    onConfirm: mmRunDiscover,
  });
}

// Never throws (so the confirm modal always closes normally) — errors are
// surfaced via toast (400) or absorbed into the poll (409), per spec.
async function mmRunDiscover() {
  if (!mmState) return;
  try {
    await api.post('/mindmap/links/discover', {});
    mmState.discoverMeta = { status: 'running', message: null, stale: false };
    mmRenderTopbarDiscovery();
    mmStartDiscoverPoll();
  } catch (e) {
    const msg = (e && e.message) || 'Failed to start discovery.';
    if (/already running/i.test(msg)) {
      // 409 — a run is already in flight; just (re)join it via the poll.
      mmState.discoverMeta = Object.assign({}, mmState.discoverMeta, { status: 'running' });
      mmRenderTopbarDiscovery();
      mmStartDiscoverPoll();
    } else {
      // 400 (no concepts yet) or any other failure — visible, not silent.
      ui.toast(msg, 'error');
    }
  }
}

function mmStopDiscoverPoll() {
  if (!mmState || !mmState.discoverPollTimer) return;
  clearInterval(mmState.discoverPollTimer);
  mmState.discoverPollTimer = null;
}

function mmStartDiscoverPoll() {
  if (!mmState) return;
  mmStopDiscoverPoll();
  const activeState = mmState; // torn-down guard captured at start
  activeState.discoverPollTimer = setInterval(async () => {
    if (mmState !== activeState) return; // mmStop() nulled the module state — bail
    let status;
    try {
      status = await api.get('/mindmap/status');
    } catch (e) {
      if (mmState !== activeState) return; // torn down while awaiting
      mmStopDiscoverPoll();
      mmState.discoverMeta = { status: 'failed', message: (e && e.message) || 'Lost connection while checking discovery status.', stale: false };
      mmRenderTopbarDiscovery();
      return;
    }
    if (mmState !== activeState) return; // torn down while awaiting
    if (status.status === 'running') return; // keep polling
    mmStopDiscoverPoll();
    if (status.status === 'done') {
      await mmRefreshLinks();
    } else {
      // failed (or an unexpected idle) — show the message + a Retry button.
      mmState.discoverMeta = status;
      mmRenderTopbarDiscovery();
    }
  }, 2000);
  mmState.cleanup.push(mmStopDiscoverPoll);
}

// In-place refresh after a completed discovery run: only mmState.aiEdges +
// each concept node's radius change — nodes keep their positions, the camera
// and selection are untouched (NOT mmStop()+mmRender(), which would reset
// both and replay the drift-in). Mirrors mmBuildNodes's degree→radius formula
// exactly so a node's size after a live refresh matches a fresh page load.
async function mmRefreshLinks() {
  if (!mmState) return;
  const activeState = mmState;
  let graph;
  try {
    graph = await mmFetchGraph();
  } catch (e) {
    if (mmState !== activeState) return; // torn down while awaiting
    mmState.discoverMeta = { status: 'failed', message: (e && e.message) || 'Failed to refresh the graph.', stale: false };
    mmRenderTopbarDiscovery();
    return;
  }
  if (mmState !== activeState) return; // torn down while awaiting

  const links = graph.links || [];
  const resolvableConceptIds = new Set();
  mmState.nodes.forEach((n) => { if (n.kind === 'concept') resolvableConceptIds.add(n.refId); });
  const validLinks = links.filter((l) => l.a !== l.b && resolvableConceptIds.has(l.a) && resolvableConceptIds.has(l.b));

  const degree = new Map();
  validLinks.forEach((l) => {
    degree.set(l.a, (degree.get(l.a) || 0) + 1);
    degree.set(l.b, (degree.get(l.b) || 0) + 1);
  });
  mmState.nodes.forEach((n) => {
    if (n.kind !== 'concept') return;
    const deg = degree.get(n.refId) || 0;
    n.r = MM_R_CONCEPT_BASE + Math.min(MM_R_CONCEPT_DEGREE_MAX, MM_R_CONCEPT_DEGREE_MUL * deg);
  });
  mmState.maxNodeR = mmState.nodes.reduce((mx, n) => Math.max(mx, n.r), MM_R_SEM);

  const newAiEdges = [];
  validLinks.forEach((l, i) => {
    const source = mmState.nodesById.get('c' + l.a);
    const target = mmState.nodesById.get('c' + l.b);
    if (!source || !target) return; // defensive — resolvableConceptIds already guarantees this
    newAiEdges.push({
      id: 'ai' + i + '_c' + l.a + '_c' + l.b, source, target, kind: 'ai',
      label: l.label || '', strength: mmClamp(Number(l.strength) || 0.5, 0, 1),
    });
  });
  mmState.aiEdges = newAiEdges;

  if (mmState.sim) {
    mmState.sim.force('link').links(mmState.structEdges.concat(mmState.aiEdges));
    mmState.sim.alpha(0.3).restart();
  } else {
    mmRequestFrame(); // no-d3 fallback: just repaint with the new edges/radii
  }

  mmSyncFocus();
  mmState.discoverMeta = graph.meta || { status: 'done', message: null, stale: false };
  mmRenderTopbarDiscovery();
  mmRequestFrame();
}

/* ================================ 16. Event wiring (pointer/wheel/keydown/resize/sim — all undone in mmStop) ================================ */

function mmWireSim() {
  if (!mmState.sim) return;
  const sim = mmState.sim;
  const onTick = () => {
    if (!mmState) return;
    mmState.quadtree = mmBuildQuadtree(mmState.nodes);
    mmRequestFrame();
  };
  sim.on('tick.mm', onTick);
  mmState.cleanup.push(() => { try { sim.on('tick.mm', null); } catch (_) { /* ignore */ } });
}

// Step 3: DOM overlay panels (topbar/sidebar/card) sit inside #mindmap-root
// so their clicks bubble to the same pointerdown/pointermove/wheel listeners
// that drive canvas pan/hit-test/zoom. Without this guard, e.g. clicking a
// card button would ALSO run the coordinate-based hit-test (finding no node
// under a DOM panel) and fire mmSelect(null) on pointerup — BEFORE the
// bubbled click even reaches the data-mm-action delegate — closing the card
// out from under its own click. Panels handle their own clicks/scroll/cursor
// via normal DOM/CSS; the canvas-only handlers below bail out early for them.
const MM_PANEL_SELECTOR = '#mm-topbar, #mm-sidebar, #mm-card';

function mmWireEvents(root) {
  const cleanup = mmState.cleanup;

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest(MM_PANEL_SELECTOR)) return;
    const rect = root.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const hit = mmHitTest(sx, sy);
    mmState.pointer.down = true;
    mmState.pointer.lastX = e.clientX; mmState.pointer.lastY = e.clientY;
    mmState.pointer.startX = e.clientX; mmState.pointer.startY = e.clientY;
    mmState.pointer.moved = false;
    mmState.pointer.downNode = hit || null;
    // Node drag only when live physics exists (MINDMAP.md §2 fallback: "no
    // physics/drag") — pointer-down on a node begins a drag, not a pan.
    mmState.pointer.dragging = !!(hit && mmState.sim);
    if (mmState.pointer.dragging) {
      hit.fx = hit.x; hit.fy = hit.y;
      mmState.sim.alphaTarget(0.3).restart();
      mmRequestFrame();
    }
    try { root.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    root.classList.add('mm-panning');
  };
  const onPointerMove = (e) => {
    if (!mmState) return;
    const rect = root.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (mmState.pointer.down) {
      const dx = e.clientX - mmState.pointer.lastX, dy = e.clientY - mmState.pointer.lastY;
      if (Math.abs(e.clientX - mmState.pointer.startX) > 4 || Math.abs(e.clientY - mmState.pointer.startY) > 4) mmState.pointer.moved = true;
      mmState.pointer.lastX = e.clientX; mmState.pointer.lastY = e.clientY;
      if (mmState.pointer.dragging) {
        const w = mmScreenToWorld(sx, sy);
        mmState.pointer.downNode.fx = w.x;
        mmState.pointer.downNode.fy = w.y;
        mmRequestFrame();
      } else {
        mmPanBy(dx, dy);
      }
    } else if (e.target.closest(MM_PANEL_SELECTOR)) {
      // Hovering a DOM panel — clear any stale canvas hover emphasis and
      // leave the cursor to the panel's own CSS (buttons/input/etc).
      mmSetHover(null);
    } else {
      const hit = mmHitTest(sx, sy);
      mmSetHover(hit ? hit.id : null);
      root.style.cursor = hit ? 'pointer' : 'grab';
    }
  };
  const onPointerUp = (e) => {
    if (!mmState) return;
    if (mmState.pointer.down) {
      if (mmState.pointer.dragging) {
        mmState.pointer.downNode.fx = null;
        mmState.pointer.downNode.fy = null;
        mmState.sim.alphaTarget(0);
      }
      if (!mmState.pointer.moved) {
        mmSelect(mmState.pointer.downNode ? mmState.pointer.downNode.id : null);
      }
    }
    mmState.pointer.down = false;
    mmState.pointer.dragging = false;
    mmState.pointer.downNode = null;
    root.classList.remove('mm-panning');
    try { root.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  };
  const onWheel = (e) => {
    if (e.target.closest(MM_PANEL_SELECTOR)) return; // let the sidebar/card scroll natively
    e.preventDefault();
    const rect = root.getBoundingClientRect();
    mmZoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
  };
  // Required fix (Step 3): ignore map shortcuts while the user is typing
  // anywhere (the sidebar search input, or any other focused form field) —
  // previously '+'/'-'/'0' zoomed even mid-keystroke. The ONE exception is
  // Escape inside the search input itself, which clears the query first
  // (and must NOT also zoom or clear the canvas selection).
  const onKeydown = (e) => {
    if (!mmState) return;
    const t = e.target;
    const isTyping = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
    if (isTyping) {
      if (e.key === 'Escape' && t.id === 'mm-search-input' && mmState.sidebarQuery) {
        t.value = '';
        mmState.sidebarQuery = '';
        mmRenderSidebarList();
      }
      return;
    }
    if (e.key === '+' || e.key === '=') mmZoomCenter(1.2);
    else if (e.key === '-' || e.key === '_') mmZoomCenter(1 / 1.2);
    else if (e.key === '0') mmFlyTo(mmFitAllBounds());
    else if (e.key === 'Escape') {
      // The immersive PDF reader (opened from a concept card) is a separate
      // full-screen overlay with its OWN document-level Escape handler that
      // closes it. Both handlers live on `document`, and the map's was wired
      // first (the map is already open before a reader can be launched from
      // it), so it always runs before the reader's — the reader's own
      // stopPropagation() can't retroactively cancel this one. Guard here:
      // while the reader is open, Escape closes the reader ONLY, and must
      // NOT also clear the map's selection underneath it.
      if (typeof readerState !== 'undefined' && readerState) return;
      mmSelect(null);
    }
  };
  const onVisibility = () => { if (!document.hidden) mmRequestFrame(); };
  const onClick = (e) => {
    const t = e.target.closest('[data-mm-action]');
    if (!t) return;
    const action = t.dataset.mmAction;
    if (action === 'zoom-in') mmZoomCenter(1.25);
    else if (action === 'zoom-out') mmZoomCenter(1 / 1.25);
    else if (action === 'zoom-reset') mmFlyTo(mmFitAllBounds());
    else if (action === 'retry') { mmStop(); mmRender(); }
    // ---- Step 4: top-bar discovery control ----
    else if (action === 'discover') mmConfirmDiscover();
    // ---- Step 3: sidebar ----
    else if (action === 'sidebar-collapse') { mmState.sidebarCollapsed = true; mmSetSidebarStoredCollapsed(true); mmRenderSidebar(); }
    else if (action === 'sidebar-expand') { mmState.sidebarCollapsed = false; mmSetSidebarStoredCollapsed(false); mmRenderSidebar(); }
    else if (action === 'sidebar-axiom') { mmState.sidebarActiveKey = 'axiom'; mmFlyTo(mmFitAllBounds()); mmRenderSidebarList(); }
    else if (action === 'sidebar-sem') {
      const id = t.dataset.id;
      mmState.sidebarActiveKey = id;
      mmFlyTo(mmBoundsFor(mmSubtreeIds(id)));
      mmRenderSidebarList();
    } else if (action === 'sidebar-course') {
      const id = t.dataset.id;
      mmState.sidebarActiveKey = id;
      mmFlyTo(mmBoundsFor(mmSubtreeIds(id)));
      mmRenderSidebarList();
    } else if (action === 'sidebar-sem-chevron') {
      const id = t.dataset.id;
      if (mmState.sidebarSemCollapsed.has(id)) mmState.sidebarSemCollapsed.delete(id);
      else mmState.sidebarSemCollapsed.add(id);
      mmRenderSidebarList();
    } else if (action === 'sidebar-course-chevron') {
      const id = t.dataset.id;
      if (mmState.sidebarCourseCollapsed.has(id)) mmState.sidebarCourseCollapsed.delete(id);
      else mmState.sidebarCourseCollapsed.add(id);
      mmRenderSidebarList();
    } else if (action === 'sidebar-concept') {
      const id = t.dataset.id;
      const node = mmState.nodesById.get(id);
      if (node) { mmFlyTo(node); mmSelect(node.id); }
    } else if (action === 'sidebar-search-result') {
      const id = t.dataset.id;
      const node = mmState.nodesById.get(id);
      mmState.sidebarQuery = '';
      const input = document.getElementById('mm-search-input');
      if (input) input.value = '';
      if (node) { mmFlyTo(node); mmSelect(id); } else mmRenderSidebarList();
    }
    // ---- Step 3: detail card ----
    else if (action === 'card-close') mmSelect(null);
    else if (action === 'card-open-lesson') {
      const node = mmState.nodesById.get(mmState.selected);
      if (node && node.kind === 'concept') location.hash = `#/course/${node.courseId}/canvas/${node.refId}`;
    } else if (action === 'card-read-note') {
      const node = mmState.nodesById.get(mmState.selected);
      if (node && node.kind === 'concept' && node.noteStatus === 'compiled' && node.noteId) {
        openReader({ id: node.noteId, title: node.name }, { conceptId: node.refId, conceptName: node.name, conceptSummary: node.summary });
      }
    } else if (action === 'card-start-quiz') {
      const node = mmState.nodesById.get(mmState.selected);
      if (node && node.kind === 'concept') location.hash = `#/quiz/${node.refId}`;
    } else if (action === 'card-toggle-done') {
      const node = mmState.nodesById.get(mmState.selected);
      if (node && node.kind === 'concept') mmToggleDone(node);
    } else if (action === 'card-open-course') {
      const node = mmState.nodesById.get(mmState.selected);
      if (node && node.kind === 'course') location.hash = `#/course/${node.refId}`;
    }
    // ---- Concept card: link manager ----
    else if (action === 'card-add-link') {
      const node = mmState.nodesById.get(mmState.selected);
      if (node && node.kind === 'concept') mmCardAddLink(node);
    } else if (action === 'card-edit-link') {
      const node = mmState.nodesById.get(mmState.selected);
      const linkId = Number(t.dataset.linkId);
      if (node && node.kind === 'concept' && linkId) mmCardEditLink(node, linkId);
    } else if (action === 'card-hide-link') {
      const node = mmState.nodesById.get(mmState.selected);
      const linkId = Number(t.dataset.linkId);
      if (node && node.kind === 'concept' && linkId) mmCardSetLinkHidden(node, linkId, true);
    } else if (action === 'card-unhide-link') {
      const node = mmState.nodesById.get(mmState.selected);
      const linkId = Number(t.dataset.linkId);
      if (node && node.kind === 'concept' && linkId) mmCardSetLinkHidden(node, linkId, false);
    } else if (action === 'card-delete-link') {
      const node = mmState.nodesById.get(mmState.selected);
      const linkId = Number(t.dataset.linkId);
      if (node && node.kind === 'concept' && linkId) mmCardDeleteLink(node, linkId);
    }
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);
  root.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('visibilitychange', onVisibility);

  cleanup.push(() => {
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('pointercancel', onPointerUp);
    root.removeEventListener('wheel', onWheel);
    root.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('visibilitychange', onVisibility);
  });
}

/* ================================ 17. Entry point + teardown ================================ */

async function mmRender() {
  const view = document.getElementById('view');
  if (!view) return;
  view.classList.add('view-fullbleed');
  view.innerHTML = '<div id="mindmap-root" class="mm-root"><canvas id="mm-canvas" class="mm-canvas"></canvas></div>';
  const root = document.getElementById('mindmap-root');

  mmState = mmFreshState();
  mmState.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  mmState.sidebarCollapsed = mmSidebarStoredCollapsed(); // Step 3: persisted across mount/unmount
  const activeState = mmState;

  let graph;
  try {
    graph = await mmFetchGraph();
  } catch (e) {
    if (mmState !== activeState) return; // torn down while awaiting
    root.insertAdjacentHTML('beforeend', mmEmptyHtml('error', e.message));
    return;
  }
  if (mmState !== activeState) return; // torn down while awaiting

  mmSetupThemeObserver();
  mmSetupCanvases(root);
  root.insertAdjacentHTML('beforeend', mmTopbarHtml());

  const noConcepts = !graph.semesters.length || !graph.concepts.length;
  if (noConcepts) {
    root.insertAdjacentHTML('beforeend', mmEmptyHtml('empty'));
    mmState.nodes = []; mmState.nodesById = new Map();
    mmState.structEdges = []; mmState.aiEdges = [];
    mmState.quadtree = null; mmState.maxNodeR = MM_R_SEM;
    mmState.camera.x = 0; mmState.camera.y = 0; mmState.camera.scale = 1;
    mmState.discoverMeta = graph.meta || { status: 'idle', message: null, stale: false };
    mmWireEvents(root);
    mmUpdateZoomLabel();
    mmRenderTopbarDiscovery(); // no concepts here — never shows the soft hint (mmState.nodes has no concept node)
    // MINDMAP.md §3: "poll every 2s while running" — resume a run left in
    // flight from before this mount (e.g. a reload mid-discovery), not just
    // one started by a click in this session.
    if (mmState.discoverMeta.status === 'running') mmStartDiscoverPoll();
    mmRequestFrame();
    return;
  }

  const built = mmBuildNodes(graph);
  mmState.nodes = built.nodes;
  mmState.nodesById = built.byId;
  // Fix (mind-map sidebar concepts): every course starts with its concept
  // list hidden (a course can have many concepts — must not flood the
  // panel). Seed the collapsed set once at mount time, not in mmFreshState
  // (which runs before the graph/course ids are known).
  mmState.nodes.forEach((n) => { if (n.kind === 'course') mmState.sidebarCourseCollapsed.add(n.id); });

  const laid = mmRunLayout(built);
  mmState.sim = laid.sim;
  mmState.structEdges = laid.structEdges;
  mmState.aiEdges = laid.aiEdges;

  mmState.quadtree = mmBuildQuadtree(mmState.nodes);
  mmState.maxNodeR = mmState.nodes.reduce((mx, n) => Math.max(mx, n.r), MM_R_SEM);

  const fitBounds = mmFitAllBounds();
  mmState.camera.scale = mmFitScaleFor(fitBounds);
  mmState.camera.x = (fitBounds.x0 + fitBounds.x1) / 2;
  mmState.camera.y = (fitBounds.y0 + fitBounds.y1) / 2;

  mmState.discoverMeta = graph.meta || { status: 'idle', message: null, stale: false };

  mmRenderSidebar(); // Step 3: hierarchy sidebar — only mounted when the graph has nodes (MINDMAP.md §4)
  mmWireEvents(root);
  mmWireSim();
  mmUpdateZoomLabel();
  mmRenderTopbarDiscovery(); // Step 4: top-bar discovery control + zero-links soft hint (MINDMAP.md §4)
  // MINDMAP.md §3: "poll every 2s while running" — resume a run left in
  // flight from before this mount (e.g. a reload mid-discovery), not just
  // one started by a click in this session.
  if (mmState.discoverMeta.status === 'running') mmStartDiscoverPoll();
  mmRequestFrame();
}

function mmStop() {
  const view = document.getElementById('view');
  if (!mmState) {
    if (view) view.classList.remove('view-fullbleed');
    return;
  }
  const state = mmState;
  mmState = null; // guard first so any in-flight async/timer/sim callback becomes a no-op

  if (state.rafId) cancelAnimationFrame(state.rafId);
  clearTimeout(state.resizeTimer);
  clearInterval(state.discoverPollTimer); // Step 4: no discovery poll may survive teardown
  if (state.sim) { try { state.sim.stop(); } catch (_) { /* ignore */ } }
  state.cleanup.forEach((fn) => { try { fn(); } catch (_) { /* ignore */ } });

  if (view) view.classList.remove('view-fullbleed');
}

window.mindmap = { render: mmRender, stop: mmStop };
