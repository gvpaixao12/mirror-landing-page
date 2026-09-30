import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import process from "node:process";

// Coleta de métricas do servidor (Node na VPS). Server-only: o sufixo
// .server.ts garante que nada disso vai pro bundle do navegador.

export type Pm2Proc = {
  name: string;
  status: string;
  cpu: number;
  memory: number;
  restarts: number;
  uptimeMs: number | null;
};

export type ServerStats = {
  at: number;
  host: { hostname: string; platform: string; release: string; uptimeSec: number };
  cpu: { model: string; cores: number; usagePct: number; load: [number, number, number] };
  memory: { total: number; used: number };
  disk: { total: number; used: number } | null;
  node: { version: string; pid: number; uptimeSec: number; rss: number; heapUsed: number };
  pm2: Pm2Proc[] | null;
  services: { name: string; active: boolean | null }[];
};

// Uso de CPU = diferença de tempos entre duas leituras. Guardamos a
// última leitura no módulo; na primeira chamada amostramos 300ms.
type CpuSample = { idle: number; total: number };
let lastSample: CpuSample | null = null;

function sampleCpu(): CpuSample {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    const t = c.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
  }
  return { idle, total };
}

async function cpuUsagePct(): Promise<number> {
  let prev = lastSample;
  if (!prev) {
    prev = sampleCpu();
    await new Promise((r) => setTimeout(r, 300));
  }
  const cur = sampleCpu();
  lastSample = cur;
  const dTotal = cur.total - prev.total;
  if (dTotal <= 0) return 0;
  return Math.round((1 - (cur.idle - prev.idle) / dTotal) * 1000) / 10;
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 4000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
  });
}

async function readPm2(): Promise<Pm2Proc[] | null> {
  try {
    const out = await run("pm2", ["jlist"]);
    // pm2 às vezes imprime avisos antes do JSON.
    const json = out.slice(out.indexOf("["));
    const list = JSON.parse(json) as {
      name: string;
      monit?: { cpu?: number; memory?: number };
      pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number };
    }[];
    return list.map((p) => ({
      name: p.name,
      status: p.pm2_env?.status ?? "unknown",
      cpu: p.monit?.cpu ?? 0,
      memory: p.monit?.memory ?? 0,
      restarts: p.pm2_env?.restart_time ?? 0,
      uptimeMs:
        p.pm2_env?.status === "online" && p.pm2_env.pm_uptime
          ? Date.now() - p.pm2_env.pm_uptime
          : null,
    }));
  } catch {
    return null;
  }
}

async function serviceActive(name: string): Promise<boolean | null> {
  try {
    const out = await run("systemctl", ["is-active", name]);
    return out.trim() === "active";
  } catch (e) {
    // systemctl sai com código != 0 quando o serviço está parado.
    const stdout = (e as { stdout?: string }).stdout;
    return typeof stdout === "string" && stdout.trim() ? false : null;
  }
}

async function readDisk(): Promise<ServerStats["disk"]> {
  try {
    const s = await fs.statfs("/");
    const total = s.blocks * s.bsize;
    return { total, used: total - s.bavail * s.bsize };
  } catch {
    return null;
  }
}

export async function collectServerStats(): Promise<ServerStats> {
  const [usagePct, disk, pm2, nginx] = await Promise.all([
    cpuUsagePct(),
    readDisk(),
    readPm2(),
    serviceActive("nginx"),
  ]);
  const load = os.loadavg();
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();

  return {
    at: Date.now(),
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      uptimeSec: Math.round(os.uptime()),
    },
    cpu: {
      model: os.cpus()[0]?.model?.trim() ?? "—",
      cores: os.cpus().length,
      usagePct,
      load: [load[0], load[1], load[2]],
    },
    memory: { total: totalMem, used: totalMem - os.freemem() },
    disk,
    node: {
      version: process.version,
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      rss: mem.rss,
      heapUsed: mem.heapUsed,
    },
    pm2,
    services: [{ name: "nginx", active: nginx }],
  };
}
