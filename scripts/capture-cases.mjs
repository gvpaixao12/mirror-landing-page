// Gera prévias dos sites/sistemas para a página de cases.
// Para cada item em scripts/cases.config.json captura:
//   - video.webm  -> vídeo com scroll automático (boot/login cortados via ffmpeg)
//   - poster.png  -> 1º quadro limpo do vídeo (usado como poster do <video>)
//   - desktop.png -> screenshot full-page (1440x900)
//   - mobile.png  -> screenshot full-page (iPhone-like)
// Faz login na MESMA página da captura (sessão em sessionStorage não passa entre
// abas) e o corte dinâmico remove o login do vídeo. Esconde o selo do Lovable.
// Saída: public/cases/<id>/
//
// Uso:  node scripts/capture-cases.mjs [idDoCase]   (sem id = todos)
import { chromium, devices } from "playwright";
import { readFileSync, mkdirSync, existsSync, renameSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const CONFIG_PATH = join(__dirname, "cases.config.json");
if (!existsSync(CONFIG_PATH)) {
  console.error(
    "\n❌ Não encontrei scripts/cases.config.json.\n" +
      "   Copie scripts/cases.config.example.json para scripts/cases.config.json e preencha.\n",
  );
  process.exit(1);
}

const { cases } = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
if (!Array.isArray(cases) || cases.length === 0) {
  console.error("❌ Nenhum case encontrado na config.");
  process.exit(1);
}

// Filtro opcional por id: `node scripts/capture-cases.mjs rental-dental`
const onlyId = process.argv[2];
const selected = onlyId ? cases.filter((c) => c.id === onlyId) : cases;
if (onlyId && selected.length === 0) {
  console.error(`❌ Nenhum case com id "${onlyId}".`);
  process.exit(1);
}

const DESKTOP = { width: 1440, height: 900 };
const iPhone = devices["iPhone 13"];

// Executa um passo de login declarado na config.
async function runStep(page, step) {
  if (step.goto) await page.goto(step.goto, { waitUntil: "domcontentloaded" });
  if (step.fill) await page.fill(step.fill, step.value ?? "");
  if (step.click) await page.click(step.click);
  if (step.press) await page.press(step.selector ?? "body", step.press);
  if (step.waitForSelector) await page.waitForSelector(step.waitForSelector);
  if (step.waitForLoadState) await page.waitForLoadState(step.waitForLoadState);
  if (step.waitMs) await page.waitForTimeout(step.waitMs);
}

// Faz scroll suave do topo ao fim da página durante `durationMs`.
async function smoothScroll(page, durationMs) {
  await page.evaluate(async (duration) => {
    const total = Math.max(
      document.body.scrollHeight - window.innerHeight,
      0,
    );
    if (total === 0) {
      await new Promise((r) => setTimeout(r, duration));
      return;
    }
    const start = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        // easeInOutSine para um movimento mais natural
        const eased = -(Math.cos(Math.PI * t) - 1) / 2;
        window.scrollTo(0, total * eased);
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }, durationMs);
}

// renameSync com retry — no Windows o .webm pode ficar travado por um instante.
async function moveWithRetry(src, dest, tries = 10) {
  for (let i = 0; i < tries; i++) {
    try {
      renameSync(src, dest);
      return;
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

// Localiza o ffmpeg que vem com o Playwright (para cortar o boot e gerar poster).
function findFfmpeg() {
  const base = join(process.env.LOCALAPPDATA || "", "ms-playwright");
  try {
    for (const d of readdirSync(base)) {
      if (d.startsWith("ffmpeg-")) {
        const exe = join(base, d, "ffmpeg-win64.exe");
        if (existsSync(exe)) return exe;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
const FFMPEG = findFfmpeg();

// Abre o alvo e deixa pronto para captura — TUDO na mesma página, porque alguns
// apps (ex.: Rental Dental) guardam a sessão em sessionStorage, que é isolado por
// aba e não passa para outra página/contexto. Faz login (se houver) e espera o
// conteúdo real renderizar. Retorna { page, t0 } (t0 = ~início da gravação).
async function openReady(context, c) {
  const page = await context.newPage();
  const t0 = Date.now();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);
  await page.goto(c.login?.url || c.url, { waitUntil: "load" });
  if (c.login) {
    for (const step of c.login.steps ?? []) await runStep(page, step);
  }
  await waitForContent(page, c);
  return { page, t0 };
}

// Espera o SPA sair do boot/login/spinner: rede ociosa + conteúdo de verdade
// (heurística por volume de texto, robusta a qualquer estilo de spinner).
async function waitForContent(page, c) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(
      () => (document.body?.innerText || "").replace(/\s+/g, " ").trim().length > 600,
      null,
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForSelector(".animate-spin", { state: "hidden", timeout: 6000 }).catch(() => {});
  // esconde selos de preview (ex.: badge "Edit with Lovable") para não aparecer no case
  await page
    .addStyleTag({
      content:
        "#lovable-badge,[id^='lovable-badge'],[class*='lovable-badge']{display:none!important;}",
    })
    .catch(() => {});
  await page.waitForTimeout(c.settleMs ?? 1500);
}

// Corta os primeiros `trimMs` do vídeo bruto (tela branca de boot) e gera poster.
function postProcessVideo(rawPath, outDir, trimMs) {
  const finalVideo = join(outDir, "video.webm");
  const poster = join(outDir, "poster.png");
  if (!FFMPEG) {
    renameSync(rawPath, finalVideo);
    return;
  }
  const ss = (trimMs / 1000).toFixed(2);
  const trim = spawnSync(
    FFMPEG,
    ["-y", "-ss", ss, "-i", rawPath, "-c:v", "libvpx", "-b:v", "1800k", "-an", finalVideo],
    { stdio: "ignore" },
  );
  if (trim.status !== 0) {
    // fallback: usa o bruto sem corte
    renameSync(rawPath, finalVideo);
  } else {
    rmSync(rawPath);
  }
  // poster a partir do 1º segundo do vídeo final (já sem tela branca)
  spawnSync(FFMPEG, ["-y", "-ss", "1", "-i", finalVideo, "-frames:v", "1", poster], {
    stdio: "ignore",
  });
}

async function captureVideo(browser, c, outDir) {
  const context = await browser.newContext({
    viewport: DESKTOP,
    recordVideo: { dir: outDir, size: DESKTOP },
  });
  try {
    const { page, t0 } = await openReady(context, c);
    await page.waitForTimeout(600); // respira no topo (já com conteúdo)
    // tudo antes do scroll (boot/branco/login/spinner/estático) será cortado
    const trimMs = Math.max(Date.now() - t0 - 400, 0);
    await smoothScroll(page, c.scrollDurationMs ?? 8000);
    await page.waitForTimeout(800);
    const video = page.video();
    await context.close(); // o vídeo só é gravado ao fechar o contexto
    if (video) {
      const raw = join(outDir, "_raw.webm");
      await moveWithRetry(await video.path(), raw);
      postProcessVideo(raw, outDir, trimMs);
    }
  } finally {
    // limpa .webm temporários (sobras)
    for (const f of readdirSync(outDir)) {
      if (f.endsWith(".webm") && f !== "video.webm") rmSync(join(outDir, f));
    }
  }
}

async function captureShots(browser, c, outDir) {
  // Desktop
  const dctx = await browser.newContext({ viewport: DESKTOP });
  const { page: dpage } = await openReady(dctx, c);
  await dpage.screenshot({ path: join(outDir, "desktop.png"), fullPage: true });
  await dctx.close();

  // Mobile (pulável para apps desktop-only via "mobile": false na config)
  if (c.mobile === false) return;
  const mctx = await browser.newContext({ ...iPhone });
  const { page: mpage } = await openReady(mctx, c);
  await mpage.screenshot({ path: join(outDir, "mobile.png"), fullPage: true });
  await mctx.close();
}

const browser = await chromium.launch();
const manifest = [];
for (const c of selected) {
  const outDir = join(ROOT, "public", "cases", c.id);
  mkdirSync(outDir, { recursive: true });
  console.log(`\n▶ ${c.name} (${c.url})`);
  try {
    await captureVideo(browser, c, outDir);
    console.log("  ✓ vídeo" + (FFMPEG ? " (boot cortado + poster)" : ""));
    await captureShots(browser, c, outDir);
    console.log("  ✓ screenshots desktop + mobile");
    manifest.push({
      id: c.id,
      name: c.name,
      video: `/cases/${c.id}/video.webm`,
      poster: `/cases/${c.id}/poster.png`,
      desktop: `/cases/${c.id}/desktop.png`,
      mobile: `/cases/${c.id}/mobile.png`,
    });
  } catch (err) {
    console.error(`  ✗ falhou: ${err.message}`);
  }
}
await browser.close();

console.log(`\n✅ Concluído. ${manifest.length}/${selected.length} cases capturados em public/cases/`);
console.log("Manifest:\n" + JSON.stringify(manifest, null, 2));
