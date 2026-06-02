#!/usr/bin/env node
/**
 * deploy.mjs — guided one-command deploy for the daily-briefing worker.
 *
 *   npm run deploy:briefing
 *
 * Automates everything that can be automated. You only have to do the two things
 * that are inherently yours:
 *   1. authorize Cloudflare in the browser (one click), and
 *   2. paste your Anthropic API key (wrangler hides it; this script never sees it).
 *
 * The script then: deploys the worker, optionally wires a KV cache, captures the
 * deployed URL, writes it into index.html's `briefing-llm-endpoint` meta tag, and
 * offers to commit + push (which makes the live site start using it).
 *
 * Flags:
 *   --ship       commit + push the index.html endpoint change automatically
 *   --no-cache   skip the KV daily-cache step
 *   --yes        accept all prompts (non-interactive where possible)
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import readline from "node:readline";

const HERE = dirname(fileURLToPath(import.meta.url)); // server/
const REPO = join(HERE, "..");
const INDEX_HTML = join(REPO, "index.html");
const WRANGLER_TOML = join(HERE, "wrangler.toml");

const ARGS = new Set(process.argv.slice(2));
const SHIP = ARGS.has("--ship");
const NO_CACHE = ARGS.has("--no-cache");
const ASSUME_YES = ARGS.has("--yes");

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

function log(msg) { console.log(msg); }
function step(n, msg) { console.log(`\n[${n}/7] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ! ${msg}`); }
function die(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

function ask(q) {
  if (ASSUME_YES) return Promise.resolve("y");
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); res(a.trim()); });
  });
}
async function confirm(q) {
  const a = (await ask(`${q} [Y/n] `)).toLowerCase();
  return a === "" || a === "y" || a === "yes";
}

// Run interactively (login, secret put) — inherit the terminal.
function runInteractive(args) {
  const r = spawnSync(NPX, ["--yes", "wrangler", ...args], { stdio: "inherit", cwd: HERE, shell: false });
  return r.status === 0;
}
// Run and capture output (also echo it) — for whoami / deploy / kv create.
function runCapture(args) {
  const r = spawnSync(NPX, ["--yes", "wrangler", ...args], { encoding: "utf8", cwd: HERE, shell: false });
  const out = (r.stdout || "") + (r.stderr || "");
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return { ok: r.status === 0, out };
}
function git(args, opts = {}) {
  return spawnSync("git", args, { stdio: "inherit", cwd: REPO, shell: false, ...opts }).status === 0;
}

async function main() {
  log("\n⚾  MLB Daily Dashboard — briefing worker deploy\n");
  if (!existsSync(WRANGLER_TOML)) die(`wrangler.toml not found in ${HERE}`);

  // 1) wrangler available?
  step(1, "Checking wrangler…");
  if (!runCapture(["--version"]).ok) {
    die("Could not run wrangler via npx. Ensure Node.js is installed; npx will fetch wrangler automatically.");
  }
  ok("wrangler available (via npx)");

  // 2) Cloudflare auth
  step(2, "Cloudflare authentication…");
  const who = runCapture(["whoami"]);
  const authed = who.ok && !/not authenticated|not logged in/i.test(who.out);
  if (!authed) {
    warn("Not logged in. Opening the Cloudflare login in your browser — approve it, then return here.");
    if (!runInteractive(["login"])) die("wrangler login failed or was cancelled.");
  }
  ok("authenticated with Cloudflare");

  // 3) Anthropic API key secret
  step(3, "Anthropic API key (stored as an encrypted Wrangler secret — never committed)…");
  if (await confirm("Set/replace the ANTHROPIC_API_KEY secret now?")) {
    log("  Paste your key at the prompt below (input is hidden):");
    if (!runInteractive(["secret", "put", "ANTHROPIC_API_KEY"])) {
      die("Setting the secret failed. Get a key at https://console.anthropic.com/ and retry.");
    }
    ok("ANTHROPIC_API_KEY stored");
  } else {
    warn("Skipped — assuming the secret already exists.");
  }

  // 4) Optional KV daily cache
  if (!NO_CACHE) {
    step(4, "Daily cache (recommended — collapses cost to ~1 model call/day)…");
    const toml = readFileSync(WRANGLER_TOML, "utf8");
    const alreadyBound = /^\s*\[\[kv_namespaces\]\]/m.test(toml) && /binding\s*=\s*"BRIEFING_CACHE"/.test(toml) && !/#\s*\[\[kv_namespaces\]\]/.test(toml.match(/\[\[kv_namespaces\]\][\s\S]{0,120}/)?.[0] || "");
    if (alreadyBound) {
      ok("KV cache already configured in wrangler.toml");
    } else if (await confirm("Create and bind a KV cache namespace?")) {
      const res = runCapture(["kv", "namespace", "create", "BRIEFING_CACHE"]);
      const id = res.out.match(/id\s*=\s*"([a-f0-9]{16,})"/i)?.[1];
      if (id) {
        const block = `[[kv_namespaces]]\nbinding = "BRIEFING_CACHE"\nid = "${id}"`;
        let next = toml;
        // Replace the commented template block if present, else append.
        const commented = /#\s*\[\[kv_namespaces\]\][\s\S]*?#\s*id\s*=\s*"<your-kv-namespace-id>"/;
        if (commented.test(toml)) next = toml.replace(commented, block);
        else next = toml.trimEnd() + "\n\n" + block + "\n";
        writeFileSync(WRANGLER_TOML, next);
        ok(`KV namespace ${id} created and bound in wrangler.toml`);
      } else {
        warn("Could not parse the KV namespace id from wrangler output — continuing without the cache. You can add it manually later (see server/README.md).");
      }
    } else {
      warn("Skipped the cache. Cost will scale with page loads (still Haiku-priced).");
    }
  }

  // 5) Deploy
  step(5, "Deploying the worker…");
  const dep = runCapture(["deploy"]);
  if (!dep.ok) die("Deploy failed. Scroll up for the wrangler error.");
  const url = (dep.out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i) ||
               dep.out.match(/https:\/\/[a-z0-9-]+\.workers\.dev/i) || [])[0];
  if (!url) {
    warn("Deployed, but couldn't auto-detect the worker URL from the output.");
    warn("Copy it from above and paste it into index.html's briefing-llm-endpoint meta tag yourself.");
    process.exit(0);
  }
  ok(`deployed: ${url}`);

  // 6) Wire the endpoint into the site
  step(6, "Wiring the endpoint into index.html…");
  const html = readFileSync(INDEX_HTML, "utf8");
  const re = /(<meta name="briefing-llm-endpoint" content=")[^"]*(")/;
  if (!re.test(html)) die("Could not find the briefing-llm-endpoint meta tag in index.html.");
  writeFileSync(INDEX_HTML, html.replace(re, `$1${url}$2`));
  ok("index.html updated");

  // 7) Ship
  step(7, "Make it live (commit + push triggers the GitHub Pages rebuild)…");
  const doShip = SHIP || (await confirm("Commit and push the endpoint change now?"));
  if (doShip) {
    git(["add", "index.html", "server/wrangler.toml"]);
    git(["commit", "-m", "chore: enable LLM briefing — wire deployed worker endpoint"]);
    if (git(["push"])) ok("pushed — the live site will use the worker within a minute or two.");
    else warn("Push failed (maybe on a detached/feature branch). Push manually to deploy.");
  } else {
    log("\n  Not shipped. To go live, run:");
    log("    git add index.html server/wrangler.toml");
    log('    git commit -m "chore: enable LLM briefing"');
    log("    git push\n");
  }

  log("\n✅ Done. The deterministic briefing still works regardless; the worker only");
  log("   rephrases it. To turn the LLM off again, blank the meta tag and redeploy Pages.\n");
}

main().catch((e) => die(e?.stack || String(e)));
