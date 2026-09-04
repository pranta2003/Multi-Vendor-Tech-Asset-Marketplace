#!/usr/bin/env python3
"""
Static validation of the Docker / environment configuration.

WHY this exists: none of these mistakes fail loudly at build time. A variable
missing from the `api` service produces a container that starts and then exits on
the Zod check; a `build.target` naming a stage that does not exist fails only on
the machine that runs `docker compose build`; a published Postgres port is not an
error at all, just a security hole. Asserting them here turns a class of silent
deployment failures into a fast, dependency-free check that runs in CI.

Usage:  python3 scripts/validate-infra.py     (exit 0 = all good)
Requires PyYAML:  pip install pyyaml
"""
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is required:  pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
fails, passes = [], []


def ok(m):
    passes.append(m)
    print(f"  PASS  {m}")


def bad(m):
    fails.append(m)
    print(f"  FAIL  {m}")


def read(rel):
    return (ROOT / rel).read_text()


print("=== 1. Compose files parse as YAML ===")
comp = {}
for f in ("docker-compose.yml", "docker-compose.dev.yml"):
    try:
        comp[f] = yaml.safe_load(read(f))
        ok(f"{f} is valid YAML")
    except Exception as e:
        bad(f"{f}: {e}")
if len(comp) != 2:
    sys.exit("cannot continue without both compose files")

PROD, DEV = comp["docker-compose.yml"], comp["docker-compose.dev.yml"]

print("\n=== 2. Zod-required vars are documented in .env.example ===")
env_ts = read("server/src/config/env.ts")
schema = re.findall(r"^\s{2}([A-Z][A-Z0-9_]+):\s*z\.(.*)$", env_ts, re.M)
required = [k for k, d in schema if ".default(" not in d]
example = read(".env.example")
# A commented-out entry still counts as documented: DATABASE_URL is composed by
# compose and only set by hand for an externally managed database.
documented = set(re.findall(r"^#?\s*([A-Z][A-Z0-9_]+)=", example, re.M))
print(f"  info  {len(required)} required, {len(schema) - len(required)} defaulted")
for k in required:
    ok(f"required {k} documented") if k in documented else bad(f"required {k} MISSING from .env.example")

print("\n=== 3. Every ${VAR} in prod compose is documented ===")
raw = read("docker-compose.yml")
for v in sorted(set(re.findall(r"\$\{([A-Z][A-Z0-9_]+)", raw))):
    ok(f"${{{v}}} documented") if v in documented else bad(f"${{{v}}} used but NOT in .env.example")

print("\n=== 4. api service receives every required var ===")
api_env = PROD["services"]["api"]["environment"]
for k in required:
    ok(f"api receives {k}") if k in api_env else bad(f"api MISSING {k} -> exits on Zod validation")

print("\n=== 5. No literal secrets in prod compose ===")
# Strip ${...} first so the text inside a `:?error message` guard is not a hit.
stripped = re.sub(r"\$\{[^}]*\}", "", raw)
for pat in ("sk_test_", "sk_live_", "whsec_", "devpass", "testpass"):
    bad(f"literal '{pat}' hardcoded") if pat in stripped else ok(f"no literal '{pat}'")

print("\n=== 6. Production exposes only the web tier ===")
ok("prod does NOT publish postgres") if "ports" not in PROD["services"]["postgres"] else bad("prod publishes postgres to host")
ok("prod does NOT publish api (nginx only)") if "ports" not in PROD["services"]["api"] else bad("prod publishes api, bypassing nginx")
ok("prod publishes web") if "ports" in PROD["services"]["web"] else bad("web publishes no port - unreachable")
ok("dev publishes postgres (intended)") if "ports" in DEV["services"]["postgres"] else bad("dev postgres not reachable from host")

print("\n=== 7. Startup ordering ===")
dep = PROD["services"]["api"]["depends_on"]
ok("api waits for migrate to exit 0") if dep.get("migrate", {}).get("condition") == "service_completed_successfully" else bad("api does not gate on migration completion")
ok("api waits for postgres healthy") if dep.get("postgres", {}).get("condition") == "service_healthy" else bad("api does not wait for postgres health")
ok("web waits for api healthy") if PROD["services"]["web"]["depends_on"].get("api", {}).get("condition") == "service_healthy" else bad("web does not wait for api health")
ok("migrate does not auto-restart") if PROD["services"]["migrate"].get("restart") == "no" else bad("migrate should be restart: 'no' - it is a job")

print("\n=== 8. Named volumes are declared ===")
for f, c in comp.items():
    declared = set((c.get("volumes") or {}).keys())
    used = {v.split(":")[0] for s in c["services"].values() for v in (s.get("volumes") or [])
            if isinstance(v, str) and not v.startswith((".", "/"))}
    miss = used - declared
    bad(f"{f}: undeclared volumes {miss}") if miss else ok(f"{f}: volumes declared ({', '.join(sorted(declared)) or 'none'})")

print("\n=== 9. Networks are declared ===")
for f, c in comp.items():
    declared = set((c.get("networks") or {}).keys())
    used = {n for s in c["services"].values() for n in (s.get("networks") or [])}
    miss = used - declared
    bad(f"{f}: undeclared networks {miss}") if miss else ok(f"{f}: networks declared")

print("\n=== 10. build.target stages exist ===")
stages = set(re.findall(r"^FROM\s+\S+\s+AS\s+(\S+)", read("server/Dockerfile"), re.M | re.I))
print(f"  info  server stages: {', '.join(sorted(stages))}")
for svc, exp in (("migrate", "migrator"), ("api", "runner")):
    t = PROD["services"][svc]["build"]["target"]
    ok(f"{svc} target '{t}' exists") if t in stages else bad(f"{svc} target '{t}' is not a stage")

print("\n=== 11. Required infra files exist ===")
for p in (".gitignore", ".env.example", "package.json", "README.md",
          "docker/postgres/init.sql", "server/Dockerfile", "server/.dockerignore",
          "client/Dockerfile", "client/.dockerignore", "client/nginx.conf",
          "client/security-headers.conf", "scripts/validate-infra.py"):
    ok(f"{p} present") if (ROOT / p).exists() else bad(f"{p} MISSING")

print("\n=== 12. nginx include is wired end-to-end ===")
# Regression guard for a bug found by testing: add_header does not inherit into a
# location that sets its own add_header, so the security headers were absent from
# every real response. They now live in an included snippet - which only works if
# EVERY location includes it AND the Dockerfile copies it to the exact path.
ngx = read("client/nginx.conf")
SNIP = "/etc/nginx/snippets/security-headers.conf"
n_loc = len(re.findall(r"^\s*location\s", ngx, re.M))
n_inc = ngx.count(f"include {SNIP}")
# /api/ proxies to Express, which sets its own headers via Helmet, so it is the
# one location that legitimately does not need the snippet.
ok(f"snippet included {n_inc}x for {n_loc} locations") if n_inc >= n_loc - 1 else bad(f"only {n_inc} of {n_loc} locations include the snippet")
ok("Dockerfile copies snippet to the include path") if SNIP in read("client/Dockerfile") else bad(f"Dockerfile does not COPY the snippet to {SNIP} - nginx will refuse to start")
dup = re.search(r"expires\s+\S+;[^}]*add_header\s+Cache-Control", ngx)
bad("a location sets both `expires` and add_header Cache-Control -> two conflicting headers") if dup else ok("no duplicate Cache-Control source")

print("\n=== 13. .gitignore protects secrets ===")
gi = read(".gitignore")
for pat in (".env", "node_modules"):
    ok(f".gitignore ignores {pat}") if re.search(rf"^{re.escape(pat)}", gi, re.M) else bad(f".gitignore does not ignore {pat}")
ok(".gitignore re-includes .env.example") if "!.env.example" in gi else bad(".env.example would be ignored")

print(f"\nPASSED={len(passes)}  FAILED={len(fails)}")
sys.exit(1 if fails else 0)
