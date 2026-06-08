import './styles.css';

type GuestDirectory = {
  universalMessages: string[];
  guests: Guest[];
};

type Guest = {
  id: string;
  passkey: string;
  name: string;
  schools: string[];
  signature: string;
  messages: string[];
};

type FlowerRecord = {
  id: string;
  x: number;
  y: number;
  variant: number;
  scale: number;
  rotation: number;
};

type FlowerVariant = {
  petals: number;
  petalA: string;
  petalB: string;
  center: string;
  stem: string;
  leaf: string;
  texture: 'dappled' | 'ribbed' | 'ringed' | 'veined' | 'sunburst';
};

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('Missing #app root.');
}

const app = appRoot;

const SESSION_KEY = 'teacherappreciation:guest-id';
const FLOWER_LIMIT = 90;
const CHAT_LIMIT = 4;
const MESSAGE_INTERVAL_MS = 3800;
const MESSAGE_LANES = [10, 24, 38, 52, 66];

const flowerVariants: FlowerVariant[] = [
  {
    petals: 8,
    petalA: '#f47f72',
    petalB: '#ffe1b5',
    center: '#7a4b19',
    stem: '#477a52',
    leaf: '#6fa46c',
    texture: 'dappled',
  },
  {
    petals: 12,
    petalA: '#68b7a4',
    petalB: '#d9f3df',
    center: '#f1b84b',
    stem: '#3f7355',
    leaf: '#7fbf87',
    texture: 'ribbed',
  },
  {
    petals: 7,
    petalA: '#f2c14e',
    petalB: '#fff5c7',
    center: '#9c6c26',
    stem: '#466f41',
    leaf: '#8bbf5b',
    texture: 'ringed',
  },
  {
    petals: 10,
    petalA: '#9f8edb',
    petalB: '#f0e9ff',
    center: '#e28d3f',
    stem: '#496b58',
    leaf: '#77a983',
    texture: 'veined',
  },
  {
    petals: 9,
    petalA: '#df6f9f',
    petalB: '#ffd8e6',
    center: '#684b85',
    stem: '#3f7569',
    leaf: '#73b8a6',
    texture: 'sunburst',
  },
  {
    petals: 11,
    petalA: '#79a7d3',
    petalB: '#e7f3ff',
    center: '#efb84f',
    stem: '#426b4b',
    leaf: '#7ab06c',
    texture: 'dappled',
  },
];

let directory: GuestDirectory | null = null;
let activeGuest: Guest | null = null;
let activeFlowers: FlowerRecord[] = [];
let messageTimer = 0;
let lastMessageIndex = -1;
let nextMessageLane = 0;

void boot();

async function boot(): Promise<void> {
  renderLoading();

  try {
    directory = await loadDirectory();
    const storedGuest = findGuestById(sessionStorage.getItem(SESSION_KEY));

    if (storedGuest) {
      openGarden(storedGuest);
      return;
    }

    renderGate();
  } catch (error) {
    renderFatal(error);
  }
}

async function loadDirectory(): Promise<GuestDirectory> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/guests.json`, {
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error(`Could not load guest data: ${response.status}`);
  }

  return (await response.json()) as GuestDirectory;
}

function renderLoading(): void {
  app.innerHTML = `
    <main class="gate-shell" aria-live="polite">
      <section class="gate-panel">
        <div class="seed-mark" aria-hidden="true"></div>
        <p class="eyebrow">Staff Appreciation Garden</p>
        <h1>Opening the garden</h1>
      </section>
    </main>
  `;
}

function renderFatal(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unexpected startup error.';

  app.innerHTML = `
    <main class="gate-shell">
      <section class="gate-panel">
        <div class="seed-mark is-wilted" aria-hidden="true"></div>
        <p class="eyebrow">Staff Appreciation Garden</p>
        <h1>The garden could not open.</h1>
        <p class="form-error">${escapeHtml(message)}</p>
      </section>
    </main>
  `;
}

function renderGate(errorMessage = ''): void {
  app.innerHTML = `
    <main class="gate-shell">
      <section class="gate-panel">
        <div class="seed-mark" aria-hidden="true"></div>
        <p class="eyebrow">Staff Appreciation Garden</p>
        <h1>For invited colleagues</h1>
        <form class="passkey-form" novalidate>
          <label for="passkey">Passkey</label>
          <div class="passkey-row">
            <input
              id="passkey"
              name="passkey"
              type="text"
              autocomplete="one-time-code"
              spellcheck="false"
              aria-invalid="${errorMessage ? 'true' : 'false'}"
              aria-describedby="passkey-error"
              required
            />
            <button type="submit">Enter</button>
          </div>
          <p id="passkey-error" class="form-error" aria-live="polite">${escapeHtml(errorMessage)}</p>
        </form>
      </section>
    </main>
  `;

  const form = app.querySelector<HTMLFormElement>('.passkey-form');
  const input = app.querySelector<HTMLInputElement>('#passkey');

  input?.focus();

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const passkey = input?.value ?? '';
    const guest = findGuestByPasskey(passkey);

    if (!guest) {
      renderGate('That passkey was not found.');
      return;
    }

    sessionStorage.setItem(SESSION_KEY, guest.id);
    openGarden(guest);
  });
}

function openGarden(guest: Guest): void {
  activeGuest = guest;
  activeFlowers = loadFlowers(guest.id);
  renderGarden(guest);
  renderFlowers();
  startMessageStream();
}

function renderGarden(guest: Guest): void {
  const allMessages = getMessagesForGuest(guest);
  const firstMessage = allMessages[0] ?? 'Thank you for all you do.';

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-cluster">
          <div class="seed-mark small" aria-hidden="true"></div>
          <div>
            <p class="eyebrow">Staff Appreciation Garden</p>
            <h1>${escapeHtml(guest.name)}</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <button class="reset-button" type="button">Reset flowers</button>
          <button class="lock-button" type="button">Log Out</button>
        </div>
      </header>

      <main class="garden-card" id="garden-card" tabindex="0" aria-label="Appreciation garden for ${escapeAttribute(guest.name)}">
        <section class="card-copy" aria-labelledby="card-title">
          <p class="eyebrow">Special Education Team</p>
          <h2 id="card-title">Every student grows because of the care you bring.</h2>
          <p class="signature">${escapeHtml(guest.signature)}</p>
        </section>

        <section class="school-panel" aria-labelledby="schools-title">
          <h2 id="schools-title">Schools</h2>
          <ul class="school-list">
            ${guest.schools.map((school) => `<li>${escapeHtml(school)}</li>`).join('')}
          </ul>
        </section>

        <section class="note-panel" aria-labelledby="note-title">
          <p>${escapeHtml(firstMessage)}</p>
        </section>

        <section class="garden-stage" aria-label="Blooming appreciation garden">
          <div class="sun-ribbon" aria-hidden="true"></div>
          <div class="message-layer" aria-live="polite" aria-atomic="false"></div>
          <div class="vine vine-left" aria-hidden="true"></div>
          <div class="vine vine-right" aria-hidden="true"></div>
          <div class="flower-bed" aria-hidden="true"></div>
        </section>
      </main>
    </div>
  `;

  app.querySelector<HTMLButtonElement>('.lock-button')?.addEventListener('click', () => {
    stopMessageStream();
    sessionStorage.removeItem(SESSION_KEY);
    activeGuest = null;
    activeFlowers = [];
    renderGate();
  });

  app.querySelector<HTMLButtonElement>('.reset-button')?.addEventListener('click', () => {
    if (!activeGuest || !window.confirm('Reset this garden back to no flowers?')) {
      return;
    }

    activeFlowers = [];
    clearFlowers(activeGuest.id);
    renderFlowers();
  });

  const card = app.querySelector<HTMLElement>('#garden-card');
  card?.addEventListener('pointerdown', handleGardenPointer, { passive: true });
  card?.addEventListener('keydown', handleGardenKeyboard);
}

function handleGardenPointer(event: PointerEvent): void {
  if (!activeGuest || isInteractiveElement(event.target)) {
    return;
  }

  const stage = app.querySelector<HTMLElement>('.garden-stage');

  if (!stage) {
    return;
  }

  const rect = stage.getBoundingClientRect();
  const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96);
  const yFromTop = clamp(((event.clientY - rect.top) / rect.height) * 100, 18, 90);
  const y = clamp(100 - yFromTop, 2, 74);

  addFlower(activeGuest, x, y);
}

function handleGardenKeyboard(event: KeyboardEvent): void {
  if (!activeGuest || (event.key !== 'Enter' && event.key !== ' ')) {
    return;
  }

  event.preventDefault();
  addFlower(activeGuest, randomBetween(16, 84), randomBetween(5, 55));
}

function addFlower(guest: Guest, x: number, y: number): void {
  const record: FlowerRecord = {
    id: crypto.randomUUID(),
    x,
    y,
    variant: pickVariantIndex(),
    scale: randomBetween(0.72, 1.28),
    rotation: randomBetween(-8, 8),
  };

  activeFlowers = [...activeFlowers, record].slice(-FLOWER_LIMIT);
  saveFlowers(guest.id, activeFlowers);
  renderFlowers();
  showBurstMessage();
}

function renderFlowers(): void {
  const bed = app.querySelector<HTMLElement>('.flower-bed');

  if (!bed) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const flower of activeFlowers) {
    fragment.append(createFlowerElement(flower));
  }

  bed.replaceChildren(fragment);
}

function createFlowerElement(record: FlowerRecord): HTMLElement {
  const variant = flowerVariants[record.variant % flowerVariants.length];
  const flower = document.createElement('div');
  flower.className = `flower texture-${variant.texture}`;
  flower.style.setProperty('--x', record.x.toFixed(2));
  flower.style.setProperty('--y', record.y.toFixed(2));
  flower.style.setProperty('--scale', record.scale.toFixed(2));
  flower.style.setProperty('--rotation', `${record.rotation.toFixed(2)}deg`);
  flower.style.setProperty('--petals', String(variant.petals));
  flower.style.setProperty('--petal-a', variant.petalA);
  flower.style.setProperty('--petal-b', variant.petalB);
  flower.style.setProperty('--center', variant.center);
  flower.style.setProperty('--stem', variant.stem);
  flower.style.setProperty('--leaf', variant.leaf);

  const petals = Array.from(
    { length: variant.petals },
    (_, index) => `<span class="petal" style="--i: ${index}"></span>`,
  ).join('');

  flower.innerHTML = `
    <span class="stem"></span>
    <span class="leaf leaf-left"></span>
    <span class="leaf leaf-right"></span>
    <span class="blossom">
      ${petals}
      <span class="center"></span>
    </span>
  `;

  return flower;
}

function startMessageStream(): void {
  stopMessageStream();
  showBurstMessage();
  messageTimer = window.setInterval(showBurstMessage, MESSAGE_INTERVAL_MS);
}

function stopMessageStream(): void {
  if (messageTimer) {
    window.clearInterval(messageTimer);
    messageTimer = 0;
  }
}

function showBurstMessage(): void {
  if (!activeGuest) {
    return;
  }

  const layer = app.querySelector<HTMLElement>('.message-layer');

  if (!layer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  if (layer.childElementCount >= CHAT_LIMIT) {
    return;
  }

  const message = document.createElement('p');
  message.className = 'stream-message';
  message.textContent = pickMessage(activeGuest);
  message.style.setProperty('--top', `${pickMessageLane().toFixed(2)}%`);
  message.style.setProperty('--duration', `${randomBetween(11, 15).toFixed(2)}s`);

  message.addEventListener('animationend', () => message.remove(), { once: true });
  layer.append(message);
  message.style.setProperty(
    '--travel-distance',
    `${-(layer.clientWidth + message.offsetWidth + 32)}px`,
  );
}

function pickMessageLane(): number {
  const lane = MESSAGE_LANES[nextMessageLane % MESSAGE_LANES.length] ?? MESSAGE_LANES[0];
  nextMessageLane = (nextMessageLane + 1) % MESSAGE_LANES.length;
  return clamp(lane + randomBetween(-2, 2), 7, 70);
}

function pickMessage(guest: Guest): string {
  const messages = getMessagesForGuest(guest);

  if (messages.length === 0) {
    return 'Thank you for all you do.';
  }

  let index = Math.floor(Math.random() * messages.length);

  if (messages.length > 1 && index === lastMessageIndex) {
    index = (index + 1) % messages.length;
  }

  lastMessageIndex = index;
  return messages[index] ?? messages[0] ?? 'Thank you for all you do.';
}

function getMessagesForGuest(guest: Guest): string[] {
  return [...guest.messages, ...(directory?.universalMessages ?? [])];
}

function findGuestByPasskey(passkey: string): Guest | null {
  const normalized = normalizePasskey(passkey);
  return directory?.guests.find((guest) => normalizePasskey(guest.passkey) === normalized) ?? null;
}

function findGuestById(id: string | null): Guest | null {
  if (!id) {
    return null;
  }

  return directory?.guests.find((guest) => guest.id === id) ?? null;
}

function loadFlowers(guestId: string): FlowerRecord[] {
  const raw = localStorage.getItem(flowersKey(guestId));

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as FlowerRecord[];
    return Array.isArray(parsed) ? parsed.slice(-FLOWER_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveFlowers(guestId: string, flowers: FlowerRecord[]): void {
  localStorage.setItem(flowersKey(guestId), JSON.stringify(flowers));
}

function clearFlowers(guestId: string): void {
  localStorage.removeItem(flowersKey(guestId));
}

function flowersKey(guestId: string): string {
  return `teacherappreciation:flowers:${guestId}`;
}

function pickVariantIndex(): number {
  if (activeFlowers.length === 0) {
    return Math.floor(Math.random() * flowerVariants.length);
  }

  const previous = activeFlowers.at(-1)?.variant;
  let next = Math.floor(Math.random() * flowerVariants.length);

  if (flowerVariants.length > 1 && next === previous) {
    next = (next + 1) % flowerVariants.length;
  }

  return next;
}

function isInteractiveElement(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('button, input, textarea, select, a'));
}

function normalizePasskey(passkey: string): string {
  return passkey.trim().replace(/\s+/g, '').toUpperCase();
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#039;';
    }
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
