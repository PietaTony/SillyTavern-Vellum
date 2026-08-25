// server/index.ts
import { serve } from "@hono/node-server";
import { Hono as Hono6 } from "hono";

// server/static.ts
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
var DIST = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist");
var rootFor = () => relative(process.cwd(), DIST) || ".";
var distExists = () => existsSync(resolve(DIST, "index.html"));
function mountStatic(app2) {
  const root = rootFor();
  app2.use("/assets/*", serveStatic({ root }));
  app2.get("/favicon.ico", serveStatic({ root }));
  app2.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    return serveStatic({ root, path: "index.html", rewriteRequestPath: () => "/index.html" })(
      c,
      next
    );
  });
}

// server/routes/secrets.ts
import { Hono } from "hono";
import { z } from "zod";

// server/lib/storage.ts
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync as existsSync2 } from "node:fs";
import { dirname, join } from "node:path";
var ROOT = process.env["VELLUM_DATA"] ?? join(process.cwd(), "data");
var pathFor = (...parts2) => join(ROOT, ...parts2);
async function describeData() {
  const count = async (dir) => {
    try {
      return (await readdir(pathFor(dir))).filter((f) => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
  };
  const [chars, chats2] = [await count("characters"), await count("chats")];
  const key = existsSync2(pathFor("secrets.json")) ? "\u5DF2\u8A2D\u5B9A" : "\u672A\u8A2D\u5B9A";
  return `\u8CC7\u6599\u76EE\u9304 ${ROOT} \u2014\u2014 \u89D2\u8272 ${chars}\u3001\u5C0D\u8A71 ${chats2}\u3001\u91D1\u9470 ${key}`;
}
async function ensureDir(file) {
  await mkdir(dirname(file), { recursive: true });
}
async function readJson(rel, fallback) {
  const file = pathFor(rel);
  if (!existsSync2(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
}
async function writeJson(rel, value) {
  const file = pathFor(rel);
  await ensureDir(file);
  await writeFile(file, `${JSON.stringify(value, null, 2)}
`, "utf8");
}
async function listJson(relDir) {
  const dir = pathFor(relDir);
  if (!existsSync2(dir)) return [];
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
  const out = [];
  for (const n of names) out.push(JSON.parse(await readFile(join(dir, n), "utf8")));
  return out;
}

// server/lib/secrets.ts
var FILE = "secrets.json";
async function setKey(provider, value) {
  const s = await readJson(FILE, {});
  s[provider] = value;
  await writeJson(FILE, s);
}
async function getKey(provider) {
  return (await readJson(FILE, {}))[provider];
}
async function whichAreSet() {
  const s = await readJson(FILE, {});
  return { google: Boolean(s.google), anthropic: Boolean(s.anthropic) };
}
function redact(text, secrets2) {
  let out = text;
  for (const s of secrets2) if (s && s.length > 6) out = out.replaceAll(s, "<\u91D1\u9470\u5DF2\u906E\u7F69>");
  return out.replace(/AIza[0-9A-Za-z_-]{10,}/g, "<\u91D1\u9470\u5DF2\u906E\u7F69>").replace(/sk-ant-[0-9A-Za-z_-]{10,}/g, "<\u91D1\u9470\u5DF2\u906E\u7F69>");
}

// server/lib/gemini.ts
var BASE = "https://generativelanguage.googleapis.com/v1beta";
var DEFAULT_MODEL = "gemini-3.1-flash-lite";
async function testKey(key) {
  let res;
  try {
    res = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}`);
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "\u9023\u4E0D\u4E0A Google" };
  }
  const body = await res.json();
  if (!res.ok) return { ok: false, status: res.status, message: body.error?.message ?? `HTTP ${res.status}` };
  const models = (body.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace("models/", ""));
  return { ok: true, models };
}
function buildBody(messages, system, maxOutputTokens) {
  return {
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    ...system ? { systemInstruction: { parts: [{ text: system }] } } : {},
    // 🔴 不設 thinkingConfig —— 3.6-flash 上 thinkingBudget:0 會回 400。
    // 靠「預算給足」而不是「關掉 thinking」來避免被截斷。
    generationConfig: { maxOutputTokens }
  };
}
async function streamGenerate(key, model, body, signal) {
  return fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
}
function parseChunk(chunk) {
  const cand = chunk.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  const finishReason = cand?.finishReason;
  return finishReason === void 0 ? { text } : { text, finishReason };
}
async function draftFromImage(key, mimeType, base64, model = DEFAULT_MODEL) {
  const res = await fetch(
    `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: "\u770B\u9019\u5F35\u89D2\u8272\u5716\uFF0C\u70BA\u4E00\u500B\u89D2\u8272\u626E\u6F14 app \u7522\u751F\u89D2\u8272\u8A2D\u5B9A\u3002\u5168\u90E8\u7528\u7E41\u9AD4\u4E2D\u6587\u3002\u63CF\u8FF0\u5BEB\u5916\u8C8C\u8207\u6027\u683C\uFF0C\u521D\u59CB\u8A0A\u606F\u5BEB\u4ED6\u958B\u53E3\u7684\u7B2C\u4E00\u53E5\u8A71\u3002" }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              description: { type: "STRING" },
              firstMessage: { type: "STRING" }
            },
            required: ["name", "description", "firstMessage"]
          }
        }
      })
    }
  );
  const body = await res.json();
  if (!res.ok) return { ok: false, message: body.error?.message ?? `HTTP ${res.status}` };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, message: "\u6A21\u578B\u6C92\u6709\u56DE\u50B3\u5167\u5BB9" };
  return { ok: true, draft: JSON.parse(text) };
}

// server/routes/secrets.ts
var WriteBody = z.object({
  provider: z.enum(["google", "anthropic"]),
  value: z.string().min(1)
});
var secrets = new Hono().get("/", async (c) => c.json(await whichAreSet())).post("/", async (c) => {
  const parsed = WriteBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "\u53C3\u6578\u4E0D\u5408\u6CD5" }, 400);
  await setKey(parsed.data.provider, parsed.data.value);
  return c.json({ ok: true });
}).post("/test", async (c) => {
  const parsed = WriteBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "\u53C3\u6578\u4E0D\u5408\u6CD5" }, 400);
  const { provider, value } = parsed.data;
  if (provider !== "google") return c.json({ ok: false, message: "M2 \u76EE\u524D\u53EA\u505A Gemini" }, 400);
  const r = await testKey(value);
  if (!r.ok) {
    return c.json({ ok: false, status: r.status, message: redact(r.message, [value]) });
  }
  await setKey(provider, value);
  return c.json({ ok: true, models: r.models });
}).get("/models", async (c) => {
  const key = await getKey("google");
  if (!key) return c.json({ ok: false, message: "\u5C1A\u672A\u8A2D\u5B9A Gemini \u91D1\u9470" }, 400);
  const r = await testKey(key);
  return r.ok ? c.json({ ok: true, models: r.models }) : c.json({ ok: false, message: redact(r.message, [key]) }, 502);
});

// server/routes/characters.ts
import { Hono as Hono2 } from "hono";
import { z as z2 } from "zod";
var CharacterSchema = z2.object({
  id: z2.string(),
  name: z2.string().min(1),
  description: z2.string().default(""),
  firstMessage: z2.string().default(""),
  avatar: z2.string().default(""),
  createdAt: z2.string()
});
var CreateBody = CharacterSchema.omit({ id: true, createdAt: true });
var characters = new Hono2().get("/", async (c) => c.json(await listJson("characters"))).get("/:id", async (c) => {
  const ch = await readJson(`characters/${c.req.param("id")}.json`, null);
  return ch ? c.json(ch) : c.json({ error: "\u627E\u4E0D\u5230\u9019\u500B\u89D2\u8272" }, 404);
}).post("/from-image", async (c) => {
  const parsed = z2.object({ dataUrl: z2.string().startsWith("data:image/") }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "\u9700\u8981\u4E00\u5F35\u5716\u7247" }, 400);
  const key = await getKey("google");
  if (!key) return c.json({ error: "\u5C1A\u672A\u8A2D\u5B9A Gemini \u91D1\u9470", action: "setup-key" }, 400);
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(parsed.data.dataUrl);
  if (!m?.[1] || !m[2]) return c.json({ error: "\u5716\u7247\u683C\u5F0F\u770B\u4E0D\u61C2" }, 400);
  const r = await draftFromImage(key, m[1], m[2]);
  return r.ok ? c.json(r.draft) : c.json({ error: redact(r.message, [key]) }, 502);
}).post("/", async (c) => {
  const parsed = CreateBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "\u53C3\u6578\u4E0D\u5408\u6CD5", detail: parsed.error.issues }, 400);
  const ch = {
    ...parsed.data,
    id: crypto.randomUUID(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await writeJson(`characters/${ch.id}.json`, ch);
  return c.json(ch, 201);
});

// server/routes/chats.ts
import { Hono as Hono3 } from "hono";
import { z as z3 } from "zod";
var MessageSchema = z3.object({
  id: z3.string(),
  role: z3.enum(["user", "model"]),
  text: z3.string(),
  at: z3.string()
});
var ChatSchema = z3.object({
  id: z3.string(),
  characterId: z3.string(),
  characterName: z3.string(),
  messages: z3.array(MessageSchema),
  createdAt: z3.string()
});
var chats = new Hono3().get("/", async (c) => c.json(await listJson("chats"))).get("/:id", async (c) => {
  const chat = await readJson(`chats/${c.req.param("id")}.json`, null);
  return chat ? c.json(chat) : c.json({ error: "\u627E\u4E0D\u5230\u9019\u6BB5\u5C0D\u8A71" }, 404);
}).post("/", async (c) => {
  const body = z3.object({ characterId: z3.string() }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "\u53C3\u6578\u4E0D\u5408\u6CD5" }, 400);
  const ch = await readJson(`characters/${body.data.characterId}.json`, null);
  if (!ch) return c.json({ error: "\u627E\u4E0D\u5230\u9019\u500B\u89D2\u8272" }, 404);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const chat = {
    id: crypto.randomUUID(),
    characterId: ch.id,
    characterName: ch.name,
    messages: ch.firstMessage ? [{ id: crypto.randomUUID(), role: "model", text: ch.firstMessage, at: now }] : [],
    createdAt: now
  };
  await writeJson(`chats/${chat.id}.json`, chat);
  return c.json(chat, 201);
}).post("/:id/messages", async (c) => {
  const body = z3.object({ role: z3.enum(["user", "model"]), text: z3.string() }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "\u53C3\u6578\u4E0D\u5408\u6CD5" }, 400);
  const id = c.req.param("id");
  const chat = await readJson(`chats/${id}.json`, null);
  if (!chat) return c.json({ error: "\u627E\u4E0D\u5230\u9019\u6BB5\u5C0D\u8A71" }, 404);
  const msg = { id: crypto.randomUUID(), ...body.data, at: (/* @__PURE__ */ new Date()).toISOString() };
  chat.messages.push(msg);
  await writeJson(`chats/${id}.json`, chat);
  return c.json(msg, 201);
});

// server/routes/generate.ts
import { Hono as Hono4 } from "hono";
import { z as z4 } from "zod";
var Body = z4.object({
  chatId: z4.string(),
  model: z4.string().default(DEFAULT_MODEL),
  // 🔴 給足預算：3.6-flash 實測 thinking 吃掉 514 tokens 才吐 6 個字（07-gemini-facts §2）
  maxOutputTokens: z4.number().int().min(256).max(65536).default(4096)
});
var sse = (event, data) => `event: ${event}
data: ${JSON.stringify(data)}

`;
var generate = new Hono4().post("/", async (c) => {
  const parsed = Body.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "\u53C3\u6578\u4E0D\u5408\u6CD5" }, 400);
  const { chatId, model, maxOutputTokens } = parsed.data;
  const key = await getKey("google");
  if (!key) return c.json({ error: "\u5C1A\u672A\u8A2D\u5B9A Gemini \u91D1\u9470", action: "setup-key" }, 400);
  const chat = await readJson(`chats/${chatId}.json`, null);
  if (!chat) return c.json({ error: "\u627E\u4E0D\u5230\u9019\u6BB5\u5C0D\u8A71" }, 404);
  const body = buildBody(
    chat.messages.map((m) => ({ role: m.role, text: m.text })),
    `\u4F60\u6B63\u5728\u626E\u6F14\u300C${chat.characterName}\u300D\u3002\u5168\u7A0B\u4F7F\u7528\u7E41\u9AD4\u4E2D\u6587\uFF0C\u4FDD\u6301\u89D2\u8272\u8A9E\u6C23\u3002`,
    maxOutputTokens
  );
  const controller = new AbortController();
  c.req.raw.signal.addEventListener("abort", () => controller.abort());
  const upstream = await streamGenerate(key, model, body, controller.signal);
  if (!upstream.ok || !upstream.body) {
    const raw = await upstream.text();
    return c.json({ error: redact(raw, [key]).slice(0, 500), status: upstream.status }, 502);
  }
  const stream = new ReadableStream({
    async start(ctrl) {
      const enc = new TextEncoder();
      const reader = upstream.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let full = "";
      let finish;
      try {
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const chunk = JSON.parse(line.slice(6));
            const { text, finishReason } = parseChunk(chunk);
            if (finishReason) finish = finishReason;
            if (text) {
              full += text;
              ctrl.enqueue(enc.encode(sse("delta", { text })));
            }
          }
        }
        const msg = { id: crypto.randomUUID(), role: "model", text: full, at: (/* @__PURE__ */ new Date()).toISOString() };
        chat.messages.push(msg);
        await writeJson(`chats/${chatId}.json`, chat);
        ctrl.enqueue(enc.encode(sse("done", { message: msg, finishReason: finish ?? "STOP" })));
      } catch (e) {
        const detail = e instanceof Error ? redact(e.message, [key]) : "\u4E32\u6D41\u4E2D\u65B7";
        ctrl.enqueue(enc.encode(sse("error", { message: detail })));
      } finally {
        ctrl.close();
      }
    },
    cancel() {
      controller.abort();
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }
  });
});

// server/routes/update.ts
import { Hono as Hono5 } from "hono";

// server/lib/version.ts
import { existsSync as existsSync3, readFileSync } from "node:fs";
import { dirname as dirname2, resolve as resolve2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function currentVersion() {
  try {
    let dir = dirname2(fileURLToPath2(import.meta.url));
    for (let i = 0; i < 6; i += 1) {
      const candidate = resolve2(dir, "package.json");
      if (existsSync3(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, "utf8"));
        return pkg.version ?? "0.0.0";
      }
      const up = dirname2(dir);
      if (up === dir) break;
      dir = up;
    }
    return "0.0.0";
  } catch {
    return "0.0.0";
  }
}
function parts(v) {
  return v.replace(/^v/, "").split(".").map((p) => Number.parseInt(p, 10) || 0);
}
function isNewer(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (y[i] ?? 0) - (x[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

// server/routes/update.ts
var REPO = "PietaTony/SillyTavern-Vellum";
var LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
var TTL_MS = 6 * 60 * 60 * 1e3;
function hasBreaking(notes) {
  if (!notes) return false;
  return /破壞性|不相容|breaking\s*change/i.test(notes);
}
function trimNotes(body, max = 1200) {
  const t = (body ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}\u22EF` : t;
}
var cache = null;
async function look() {
  const current = currentVersion();
  const base = {
    current,
    latest: null,
    updateAvailable: false,
    notes: null,
    breaking: false,
    url: `https://github.com/${REPO}/releases/latest`
  };
  try {
    const res = await fetch(LATEST, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "vellum" },
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) return { ...base, error: `GitHub \u56DE ${res.status}` };
    const payload = await res.json();
    const latest = payload.tag_name ?? null;
    if (!latest) return { ...base, error: "\u6700\u65B0\u7248\u6C92\u6709 tag_name" };
    const notes = trimNotes(payload.body);
    return {
      ...base,
      latest,
      updateAvailable: isNewer(current, latest),
      notes,
      breaking: hasBreaking(notes),
      url: payload.html_url ?? base.url
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "\u67E5\u4E0D\u5230\u6700\u65B0\u7248" };
  }
}
var update = new Hono5().get("/", async (c) => {
  const now = Date.now();
  if (!cache || now - cache.at > TTL_MS) cache = { at: now, info: await look() };
  return c.json(cache.info);
});

// server/index.ts
var app = new Hono6().get("/api/version", (c) => c.json({ ok: true, name: "vellum", version: currentVersion() })).route("/api/secrets", secrets).route("/api/characters", characters).route("/api/chats", chats).route("/api/generate", generate).route("/api/update", update);
var isProd = process.env["NODE_ENV"] === "production";
if (isProd && distExists()) mountStatic(app);
var port = Number(process.env["PORT"] ?? 8520);
var hostname = process.env["HOST"] ?? "127.0.0.1";
serve({ fetch: app.fetch, port, hostname }, (info) => {
  const where = isProd && distExists() ? "\u6574\u500B app" : "\u53EA\u6709 API\uFF08\u524D\u7AEF\u8ACB\u958B http://localhost:5173\uFF09";
  console.log(`[vellum] v${currentVersion()}  http://${hostname}:${info.port}  \u2014\u2014 ${where}`);
  void describeData().then((d) => console.log(`[vellum] ${d}`));
  if (hostname === "127.0.0.1")
    console.log("[vellum] \u53EA\u6709\u9019\u53F0\u96FB\u8166\u9023\u5F97\u5230\u3002\u8981\u8B93\u624B\u6A5F\uFF0F\u5E73\u677F\u9023\u9032\u4F86\uFF1AHOST=0.0.0.0 pnpm start");
});
