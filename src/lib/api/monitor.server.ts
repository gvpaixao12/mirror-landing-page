import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import dgram from "node:dgram";
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
  games: GameRoom[] | null;
  postgres: PgStats | null;
};

export type GameRoom = {
  unit: string;
  port: number;
  active: boolean;
  cpuPct: number | null;
  memory: number | null;
  uptimeSec: number | null;
  restarts: number;
  // Resposta da consulta de status da sala (null se não respondeu).
  info: {
    version_name?: string;
    players: number;
    max: number;
    in_match: boolean;
    locked: boolean;
    names: string[];
  } | null;
};

export type PgStats = {
  version: string;
  uptimeSec: number;
  maxConn: number;
  conns: Record<string, number>;
  tps: number | null;
  cacheHitPct: number | null;
  longestQuerySec: number | null;
  dbs: { name: string; size: number; conns: number; deadlocks: number; cacheHitPct: number | null }[];
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
    execFile(cmd, args, { timeout: 4000, maxBuffer: 8 * 1024 * 1024, cwd: "/" }, (err, stdout) =>
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

// ---------- Salas do Vôlei (Godot headless, units systemd volei@<porta>) ----------

// A sala responde "VOLEI?" (completado até 64 bytes) na porta + 10 com
// um JSON de status. Ver scripts/net/net.gd no jogo.
const QUERY_OFFSET = 10;
const QUERY_MAGIC = "VOLEI?";
const QUERY_SIZE = 64;

function queryRoom(port: number): Promise<GameRoom["info"]> {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    const done = (v: GameRoom["info"]) => {
      clearTimeout(timer);
      sock.close();
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 800);
    sock.on("error", () => done(null));
    sock.on("message", (msg) => {
      try {
        done(JSON.parse(msg.toString("utf8")));
      } catch {
        done(null);
      }
    });
    const packet = Buffer.alloc(QUERY_SIZE);
    packet.write(QUERY_MAGIC, "ascii");
    sock.send(packet, port + QUERY_OFFSET, "127.0.0.1");
  });
}

// Relógio monotônico (µs desde o boot), mesma base do
// ActiveEnterTimestampMonotonic do systemd — usado pro uptime da sala.
async function readMonotonicUsec(): Promise<number | null> {
  try {
    const up = await fs.readFile("/proc/uptime", "utf8");
    return Math.round(parseFloat(up.split(" ")[0]) * 1e6);
  } catch {
    return null;
  }
}

// CPU por sala = delta de CPUUsageNSec do cgroup entre duas leituras.
const lastRoomCpu = new Map<string, { nsec: number; at: number }>();

async function readGames(): Promise<GameRoom[] | null> {
  let out: string;
  try {
    out = await run("systemctl", [
      "show",
      "volei@*",
      "-p",
      "Id,ActiveState,NRestarts,ActiveEnterTimestampMonotonic,MemoryCurrent,CPUUsageNSec",
    ]);
  } catch {
    return null;
  }
  const nowMono = await readMonotonicUsec();
  const units = out
    .trim()
    .split(/\n\s*\n/)
    .map(
      (block) =>
        Object.fromEntries(
          block.split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
        ) as Record<string, string | undefined>,
    )
    .filter((u) => /^volei@\d+\.service$/.test(u.Id ?? ""));
  if (units.length === 0) return null;

  const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);
  const rooms = await Promise.all(
    units.map(async (u): Promise<GameRoom> => {
      const id = u.Id!;
      const port = Number(id.match(/@(\d+)/)![1]);
      const active = u.ActiveState === "active";

      const nsec = num(u.CPUUsageNSec);
      let cpuPct: number | null = null;
      if (nsec != null) {
        const prev = lastRoomCpu.get(id);
        const now = Date.now();
        if (prev && now > prev.at && nsec >= prev.nsec)
          cpuPct = Math.round(((nsec - prev.nsec) / 1e6 / (now - prev.at)) * 1000) / 10;
        lastRoomCpu.set(id, { nsec, at: now });
      }
      const since = num(u.ActiveEnterTimestampMonotonic);
      return {
        unit: id.replace(/\.service$/, ""),
        port,
        active,
        cpuPct,
        memory: num(u.MemoryCurrent),
        uptimeSec: active && since && nowMono ? Math.round((nowMono - since) / 1e6) : null,
        restarts: num(u.NRestarts) ?? 0,
        info: active ? await queryRoom(port) : null,
      };
    }),
  );
  return rooms.sort((a, b) => a.port - b.port);
}

// ---------- PostgreSQL (local, lido como usuário postgres via psql) ----------

const PG_SQL = `
select json_build_object(
  'version', current_setting('server_version'),
  'uptimeSec', extract(epoch from now() - pg_postmaster_start_time())::int,
  'maxConn', current_setting('max_connections')::int,
  'conns', coalesce((select json_object_agg(st, n) from (
      select coalesce(state, 'outro') st, count(*) n from pg_stat_activity
      where backend_type = 'client backend' and pid <> pg_backend_pid() group by 1) c), '{}'::json),
  'longest', (select extract(epoch from max(now() - query_start))::int from pg_stat_activity
      where state = 'active' and backend_type = 'client backend' and pid <> pg_backend_pid()),
  'dbs', (select json_agg(json_build_object(
      'name', datname, 'size', pg_database_size(datname), 'conns', numbackends,
      'xacts', xact_commit + xact_rollback, 'hit', blks_hit, 'read', blks_read,
      'deadlocks', deadlocks) order by pg_database_size(datname) desc)
    from pg_stat_database where datname is not null and datname not like 'template%')
)`;

let lastPgXacts: { total: number; at: number } | null = null;

const hitPct = (hit: number, read: number) =>
  hit + read > 0 ? Math.round((hit / (hit + read)) * 1000) / 10 : null;

async function readPostgres(): Promise<PgStats | null> {
  try {
    const out = await run("runuser", ["-u", "postgres", "--", "psql", "-AtX", "-c", PG_SQL]);
    const raw = JSON.parse(out) as {
      version: string;
      uptimeSec: number;
      maxConn: number;
      conns: Record<string, number>;
      longest: number | null;
      dbs: {
        name: string;
        size: number;
        conns: number;
        xacts: number;
        hit: number;
        read: number;
        deadlocks: number;
      }[];
    };
    // O próprio psql desta leitura conta no numbackends do banco "postgres".
    const dbs = (raw.dbs ?? []).map((d) => ({
      ...d,
      conns: d.name === "postgres" ? Math.max(0, d.conns - 1) : d.conns,
    }));

    const total = dbs.reduce((a, d) => a + d.xacts, 0);
    const now = Date.now();
    const prev = lastPgXacts;
    lastPgXacts = { total, at: now };
    const tps =
      prev && now > prev.at && total >= prev.total
        ? Math.round(((total - prev.total) / (now - prev.at)) * 10000) / 10
        : null;

    return {
      version: raw.version,
      uptimeSec: raw.uptimeSec,
      maxConn: raw.maxConn,
      conns: raw.conns,
      tps,
      cacheHitPct: hitPct(
        dbs.reduce((a, d) => a + d.hit, 0),
        dbs.reduce((a, d) => a + d.read, 0),
      ),
      longestQuerySec: raw.longest,
      dbs: dbs.map((d) => ({
        name: d.name,
        size: d.size,
        conns: d.conns,
        deadlocks: d.deadlocks,
        cacheHitPct: hitPct(d.hit, d.read),
      })),
    };
  } catch {
    return null;
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
  const [usagePct, disk, pm2, nginx, games, postgres] = await Promise.all([
    cpuUsagePct(),
    readDisk(),
    readPm2(),
    serviceActive("nginx"),
    readGames(),
    readPostgres(),
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
    games,
    postgres,
  };
}
