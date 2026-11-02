/*
 * Локальный стенд: подменяет @supabase/supabase-js данными в памяти.
 * Включается только переменной INNER_MOCK=1 (см. next.config.ts), в сборку для Vercel не попадает.
 * В консоли: __mock.emit('messages', {...}) — прислать событие как realtime, __mock.db — таблицы.
 */

type Row = Record<string, any>;
type Listener = { event: string; table: string; filter?: string; cb: (p: { new: Row; old?: Row }) => void };

const ME = 'u-me';
const now = Date.now();
const ago = (min: number) => new Date(now - min * 60000).toISOString();
const photo = (seed: string, w = 1080, h = 1350) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const people: [string, string, string, string | null][] = [
  [ME, 'maks.zh', 'Макс Железняк', null],
  ['u-anya', 'anya.koval', 'Аня Коваль', photo('inner-anya', 300, 300)],
  ['u-dima', 'dima.melnyk', 'Дима Мельник', photo('inner-dima', 300, 300)],
  ['u-olena', 'olena.sh', 'Олена Шевчук', null],
  ['u-ivan', 'ivan.petrov', 'Иван Петров', photo('inner-ivan', 300, 300)],
  ['u-katya', 'katya.r', 'Катя Руденко', photo('inner-katya', 300, 300)],
  ['u-sasha', 'sasha.bond', 'Саша Бондаренко', null],
  ['u-marta', 'marta.liepa', 'Marta Liepa', photo('inner-marta', 300, 300)],
  ['u-georgi', 'georgi.d', 'Георги Димитров', photo('inner-georgi', 300, 300)],
  ['u-lena', 'lena.v', 'Лена Василенко', null],
  ['u-taras', 'taras.k', 'Тарас Кравец', photo('inner-taras', 300, 300)],
  ['u-nika', 'nika.m', 'Ника Морозова', photo('inner-nika', 300, 300)],
  ['u-oleg', 'oleg.s', 'Олег Савчук', null],
  ['u-vera', 'vera.n', 'Вера Нестеренко', photo('inner-vera', 300, 300)]
];

const db: Record<string, Row[]> = {
  profiles: people.map(([id, username, display_name, avatar_path]) => ({
    id,
    username,
    display_name,
    avatar_path,
    bio: id === ME ? 'Делаю сайты в DevFlow. Пишите в чат, звоните вечером' : '',
    plus: false,
    created_at: ago(60 * 24 * 90)
  })),
  friend_requests: [],
  posts: [],
  likes: [],
  comments: [],
  stories: [],
  conversations: [],
  messages: [],
  calls: []
};

// Круг: все, кроме двух последних; Вера ждёт ответа, Олег — посторонний
let fr = 0;
for (const p of people.slice(1, 12)) db.friend_requests.push({ id: 'fr' + fr++, from_id: p[0], to_id: ME, status: 'accepted', created_at: ago(60 * 24 * 30) });
db.friend_requests.push({ id: 'fr' + fr++, from_id: 'u-vera', to_id: ME, status: 'pending', created_at: ago(35) });

const posts: [string, string, string, string | null, number][] = [
  ['p1', 'u-anya', 'Первый снег на Подоле. Город сразу стал тише', photo('inner-snow'), 42],
  ['p2', 'u-dima', 'Кто в субботу на велике вдоль Днепра? Старт в 10:00 от Почтовой', null, 95],
  ['p3', ME, 'Собрал новый стол для работы. Теперь только лампа и тишина', photo('inner-desk', 1080, 1080), 180],
  ['p4', 'u-katya', '', photo('inner-coffee', 1080, 1350), 240],
  ['p5', 'u-georgi', 'София, утро. Витоша в облаках, кофе на балконе', photo('inner-sofia', 1080, 720), 600],
  ['p6', 'u-marta', 'Rīga vakarā. Vecrīga ir tukša un skaista', photo('inner-riga', 1080, 1350), 1440]
];
for (const [id, author_id, body, image_path, min] of posts)
  db.posts.push({ id, author_id, body, image_path, repost_of: null, allow_reposts: true, created_at: ago(min) });
db.posts.push({ id: 'p7', author_id: 'u-ivan', body: '', image_path: null, repost_of: 'p1', allow_reposts: true, created_at: ago(30) });

const likers = ['u-anya', 'u-dima', 'u-katya', 'u-ivan', 'u-taras', 'u-nika', 'u-sasha', 'u-lena'];
likers.forEach((u, i) => db.likes.push({ post_id: 'p1', user_id: u, created_at: ago(40 - i) }));
likers.slice(0, 5).forEach((u, i) => db.likes.push({ post_id: 'p3', user_id: u, created_at: ago(20 + i * 7) }));
db.likes.push({ post_id: 'p2', user_id: ME, created_at: ago(80) });
db.likes.push({ post_id: 'p5', user_id: ME, created_at: ago(500) });
db.comments.push({ id: 'c1', post_id: 'p3', author_id: 'u-anya', body: 'Лампа огонь, откуда?', created_at: ago(15) });
db.comments.push({ id: 'c2', post_id: 'p3', author_id: 'u-dima', body: 'Теперь точно будешь сдавать проекты вовремя', created_at: ago(9) });
db.comments.push({ id: 'c3', post_id: 'p1', author_id: 'u-katya', body: 'Хочу туда', created_at: ago(38) });

const stories: [string, string, number][] = [
  ['u-anya', 'inner-st1', 50],
  ['u-anya', 'inner-st2', 20],
  ['u-katya', 'inner-st3', 120],
  ['u-georgi', 'inner-st4', 300],
  ['u-taras', 'inner-st5', 600],
  ['u-nika', 'inner-st6', 900]
];
stories.forEach(([author_id, seed, min], i) =>
  db.stories.push({ id: 's' + i, author_id, image_path: photo(seed, 1080, 1920), caption: '', created_at: ago(min) })
);

const convs: [string, string, [string, string, number, boolean][]][] = [
  ['cv1', 'u-anya', [
    ['u-anya', 'Привет! Ты завтра на созвоне?', 190, true],
    [ME, 'Да, в 11. Скину ссылку утром', 186, true],
    ['u-anya', 'Супер. И фотки со снега тебе отправлю', 12, false],
    ['u-anya', 'Вот, смотри какой Подол', 11, false]
  ]],
  ['cv2', 'u-dima', [
    [ME, 'Покатаемся в субботу?', 100, true],
    ['u-dima', 'Конечно, я с Олей', 95, false]
  ]],
  ['cv3', 'u-georgi', [
    ['u-georgi', 'Здравей! Как е сайтът?', 1500, true],
    [ME, 'Почти готов, завтра покажу', 1490, true]
  ]],
  ['cv4', 'u-katya', [
    ['u-katya', 'Спасибо за вчера', 3000, true],
    [ME, 'Тебе спасибо, было классно', 2990, true]
  ]],
  ['cv5', 'u-marta', [
    ['u-marta', 'Paldies! Rīt piezvanīšu', 5000, true]
  ]]
];
let mi = 0;
for (const [id, other, msgs] of convs) {
  db.conversations.push({ id, user_a: ME, user_b: other, created_at: ago(9000), last_message_at: ago(msgs[msgs.length - 1][2]) });
  for (const [sender_id, body, min, read] of msgs)
    db.messages.push({ id: 'm' + mi++, conversation_id: id, sender_id, body, shared_post_id: null, created_at: ago(min), read_at: read ? ago(min - 1) : null });
}
db.messages.push({ id: 'm' + mi++, conversation_id: 'cv1', sender_id: 'u-anya', body: '', shared_post_id: 'p1', created_at: ago(10), read_at: null });

const calls: [string, string, string, string, number, number][] = [
  ['u-dima', ME, 'voice', 'missed', 25, 0],
  ['u-anya', ME, 'video', 'cancelled', 70, 0],
  [ME, 'u-katya', 'video', 'ended', 300, 14],
  ['u-georgi', ME, 'voice', 'ended', 1500, 32],
  [ME, 'u-taras', 'voice', 'declined', 2000, 0],
  ['u-marta', ME, 'voice', 'ended', 4000, 6]
];
calls.forEach(([caller_id, callee_id, kind, status, min, dur], i) =>
  db.calls.push({
    id: 'call' + i,
    caller_id,
    callee_id,
    kind,
    status,
    created_at: ago(min),
    answered_at: dur ? ago(min - 0.2) : null,
    ended_at: dur ? ago(min - dur) : null
  })
);

/* ---------- Связи для select-строк ---------- */
const prof = (id: string) => {
  const p = db.profiles.find((x) => x.id === id);
  return p ? { id: p.id, username: p.username, display_name: p.display_name, avatar_path: p.avatar_path } : null;
};
const postBase = (p: Row) => ({ ...p, author: prof(p.author_id) });

function hydrate(table: string, r: Row): Row {
  switch (table) {
    case 'posts':
      return {
        ...postBase(r),
        likes: [{ count: db.likes.filter((l) => l.post_id === r.id).length }],
        comments: [{ count: db.comments.filter((c) => c.post_id === r.id).length }]
      };
    case 'stories':
    case 'comments':
      return { ...r, author: prof(r.author_id), post: db.posts.find((p) => p.id === r.post_id) };
    case 'likes':
      return { ...r, user: prof(r.user_id), post: db.posts.find((p) => p.id === r.post_id) };
    case 'friend_requests':
      return { ...r, from: prof(r.from_id), to: prof(r.to_id) };
    case 'conversations':
      return { ...r, a: prof(r.user_a), b: prof(r.user_b) };
    case 'calls':
      return { ...r, caller: prof(r.caller_id), callee: prof(r.callee_id) };
    default:
      return { ...r };
  }
}

function visible(table: string, r: Row) {
  const friendIds = new Set(
    db.friend_requests.filter((f) => f.status === 'accepted' && (f.from_id === ME || f.to_id === ME)).map((f) => (f.from_id === ME ? f.to_id : f.from_id))
  );
  const canSee = (u: string) => u === ME || friendIds.has(u);
  if (table === 'posts' || table === 'stories') return canSee(r.author_id);
  if (table === 'conversations') return r.user_a === ME || r.user_b === ME;
  if (table === 'calls') return r.caller_id === ME || r.callee_id === ME;
  if (table === 'friend_requests') return r.from_id === ME || r.to_id === ME;
  return true;
}

const get = (r: Row, path: string) => path.split('.').reduce((o: any, k) => (o == null ? o : o[k]), r);

function test(r: Row, col: string, op: string, val: string): boolean {
  const v = get(r, col);
  if (op === 'eq') return String(v) === val;
  if (op === 'ilike') {
    const re = new RegExp('^' + val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
    return re.test(String(v ?? ''));
  }
  return false;
}

function splitTop(s: string) {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function orMatch(r: Row, expr: string): boolean {
  return splitTop(expr).some((term) => {
    const m = term.match(/^and\((.*)\)$/);
    if (m) return splitTop(m[1]).every((x) => orMatch(r, x));
    const [col, op, ...rest] = term.split('.');
    return test(r, col, op, rest.join('.'));
  });
}

let seq = 1000;
const uploads: Record<string, { url: string; size: number; type: string; width?: number; height?: number }> = {};
const listeners: Listener[] = [];

function emit(table: string, event: 'INSERT' | 'UPDATE', row: Row) {
  for (const l of listeners) {
    if (l.table !== table || (l.event !== '*' && l.event !== event)) continue;
    if (l.filter) {
      const [col, rest] = l.filter.split('=');
      const val = rest.replace(/^eq\./, '');
      if (String(row[col]) !== val) continue;
    }
    setTimeout(() => l.cb({ new: row }), 0);
  }
}

function defaults(table: string, v: Row): Row {
  const id = 'x' + seq++;
  const ts = new Date().toISOString();
  switch (table) {
    case 'posts':
      return { id, author_id: ME, body: '', image_path: null, repost_of: null, allow_reposts: true, created_at: ts, ...v };
    case 'likes':
      return { user_id: ME, created_at: ts, ...v };
    case 'comments':
      return { id, author_id: ME, created_at: ts, ...v };
    case 'stories':
      return { id, author_id: ME, caption: '', created_at: ts, ...v };
    case 'messages': {
      const conv = db.conversations.find((c) => c.id === v.conversation_id);
      if (conv) conv.last_message_at = ts;
      return { id, sender_id: ME, body: '', shared_post_id: null, read_at: null, created_at: ts, ...v };
    }
    case 'calls':
      return { id, caller_id: ME, status: 'ringing', created_at: ts, answered_at: null, ended_at: null, ...v };
    case 'friend_requests':
      return { id, from_id: ME, status: 'pending', created_at: ts, ...v };
    default:
      return { id, ...v };
  }
}

class Query implements PromiseLike<any> {
  private filters: ((r: Row) => boolean)[] = [];
  private sort: { col: string; asc: boolean } | null = null;
  private max = Infinity;
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row[] = [];
  private patch: Row = {};
  private wantRows = true;
  private countMode = false;
  private head = false;
  private one: 'single' | 'maybe' | null = null;

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.mode === 'select') this.wantRows = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(v: Row | Row[]) {
    this.mode = 'insert';
    this.payload = Array.isArray(v) ? v : [v];
    return this;
  }
  update(v: Row) {
    this.mode = 'update';
    this.patch = v;
    return this;
  }
  delete() {
    this.mode = 'delete';
    return this;
  }
  eq(c: string, v: any) {
    this.filters.push((r) => String(get(r, c)) === String(v));
    return this;
  }
  neq(c: string, v: any) {
    this.filters.push((r) => String(get(r, c)) !== String(v));
    return this;
  }
  in(c: string, vs: any[]) {
    this.filters.push((r) => vs.map(String).includes(String(get(r, c))));
    return this;
  }
  is(c: string, v: null) {
    this.filters.push((r) => (get(r, c) ?? null) === v);
    return this;
  }
  gte(c: string, v: any) {
    this.filters.push((r) => String(get(r, c)) >= String(v));
    return this;
  }
  gt(c: string, v: any) {
    this.filters.push((r) => String(get(r, c)) > String(v));
    return this;
  }
  lt(c: string, v: any) {
    this.filters.push((r) => String(get(r, c)) < String(v));
    return this;
  }
  or(expr: string) {
    this.filters.push((r) => orMatch(r, expr));
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) {
    this.sort = { col, asc: o?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.one = 'single';
    return this;
  }
  maybeSingle() {
    this.one = 'maybe';
    return this;
  }

  private run() {
    const rows = db[this.table] || (db[this.table] = []);
    if (this.mode === 'insert') {
      const made = this.payload.map((v) => defaults(this.table, v));
      rows.push(...made);
      made.forEach((r) => emit(this.table, 'INSERT', r));
      const out = made.map((r) => hydrate(this.table, r));
      return { data: this.one ? out[0] : out, error: null };
    }
    const hits = rows.filter((r) => visible(this.table, r)).filter((r) => {
      const h = hydrate(this.table, r);
      return this.filters.every((f) => f(h));
    });
    if (this.mode === 'update') {
      hits.forEach((r) => {
        Object.assign(r, this.patch);
        emit(this.table, 'UPDATE', r);
      });
      return { data: null, error: null };
    }
    if (this.mode === 'delete') {
      db[this.table] = rows.filter((r) => !hits.includes(r));
      return { data: null, error: null };
    }
    let out = hits.map((r) => hydrate(this.table, r));
    if (this.sort) {
      const { col, asc } = this.sort;
      out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
    }
    const count = out.length;
    out = out.slice(0, this.max);
    if (this.head) return { data: null, count, error: null };
    if (this.one) {
      if (this.one === 'single' && !out[0]) return { data: null, error: { message: 'not found' } };
      return { data: out[0] ?? null, error: null };
    }
    return { data: out, count: this.countMode ? count : null, error: null };
  }

  then<A, B>(ok?: ((v: any) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null) {
    return new Promise((r) => setTimeout(() => r(this.run()), 120)).then(ok, bad);
  }
}

function rpc(name: string, args: Row) {
  let data: any = null;
  if (name === 'username_available') data = !db.profiles.some((p) => p.username === args.u);
  if (name === 'friend_count')
    data = db.friend_requests.filter((f) => f.status === 'accepted' && (f.from_id === args.u || f.to_id === args.u)).length;
  if (name === 'get_or_create_conversation') {
    let c = db.conversations.find((x) => [x.user_a, x.user_b].includes(args.other) && [x.user_a, x.user_b].includes(ME));
    if (!c) {
      c = { id: 'cv' + seq++, user_a: ME, user_b: args.other, created_at: new Date().toISOString(), last_message_at: new Date().toISOString() };
      db.conversations.push(c);
    }
    data = c.id;
  }
  return Promise.resolve({ data, error: null });
}

const signedOut = () => {
  try {
    return localStorage.getItem('mock.signedOut') === '1';
  } catch {
    return false;
  }
};
const session = () => (signedOut() ? null : { access_token: 'mock', user: { id: ME, email: 'maks@example.test' } });
const authListeners: ((e: string, s: any) => void)[] = [];
const setSignedOut = (v: boolean) => {
  try {
    localStorage.setItem('mock.signedOut', v ? '1' : '0');
  } catch {}
  authListeners.forEach((cb) => cb(v ? 'SIGNED_OUT' : 'SIGNED_IN', session()));
};

const client = {
  from: (t: string) => new Query(t),
  rpc,
  auth: {
    getSession: async () => ({ data: { session: session() }, error: null }),
    getUser: async () => ({ data: { user: session()?.user || null }, error: null }),
    onAuthStateChange: (cb: (e: string, s: any) => void) => {
      authListeners.push(cb);
      return { data: { subscription: { unsubscribe: () => authListeners.splice(authListeners.indexOf(cb), 1) } } };
    },
    signUp: async () => (setSignedOut(false), { data: { session: session() }, error: null }),
    signInWithPassword: async () => (setSignedOut(false), { data: { session: session() }, error: null }),
    signOut: async () => (setSignedOut(true), { error: null })
  },
  channel: () => {
    const mine: Listener[] = [];
    const ch = {
      on: (_kind: string, o: { event: string; table: string; filter?: string }, cb: Listener['cb']) => {
        mine.push({ event: o.event, table: o.table, filter: o.filter, cb });
        return ch;
      },
      subscribe: () => {
        listeners.push(...mine);
        return ch;
      },
      _mine: mine
    };
    return ch;
  },
  removeChannel: (ch: { _mine: Listener[] }) => {
    for (const l of ch._mine) {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    }
  },
  storage: {
    from: () => ({
      getPublicUrl: (path: string) => ({ data: { publicUrl: uploads[path]?.url || (/^(https?:|blob:|data:)/.test(path) ? path : photo(path)) } }),
      upload: async (path: string, blob: Blob) => {
        const bitmap = await createImageBitmap(blob).catch(() => null);
        uploads[path] = { url: URL.createObjectURL(blob), size: blob.size, type: blob.type, width: bitmap?.width, height: bitmap?.height };
        return { data: { path }, error: null };
      }
    })
  }
};

if (typeof window !== 'undefined') {
  (window as any).__mock = {
    db,
    uploads,
    emit: (table: string, v: Row) => {
      const r = defaults(table, v);
      db[table].push(r);
      emit(table, 'INSERT', r);
      return r;
    }
  };
}

export function createClient() {
  return client;
}
export type SupabaseClient = typeof client;
export type Session = any;
