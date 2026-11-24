#!/usr/bin/env python3
"""Fail when tracked Git content contains common credential files or tokens.

This is a small project guard, not a replacement for a dedicated secret scanner.
"""

import re
import subprocess
import sys


def git(*args):
    return subprocess.check_output(("git", *args))


def tracked_objects(history):
    if history:
        rows = git("rev-list", "--objects", "HEAD").splitlines()
        for row in rows:
            oid, _, path = row.partition(b" ")
            if path and git("cat-file", "-t", oid.decode()).strip() == b"blob":
                yield oid.decode(), path.decode("utf-8", "replace")
    else:
        rows = git("ls-tree", "-r", "-z", "HEAD").split(b"\0")
        for row in rows:
            if row:
                info, path = row.split(b"\t", 1)
                oid = info.split(b" ")[-1]
                yield oid.decode(), path.decode("utf-8", "replace")


def sensitive_path(path):
    parts = path.split("/")
    name = parts[-1].lower()
    if name == ".env.example":
        return False
    if any(part in {".vercel", "node_modules"} for part in parts):
        return True
    if name == ".env" or name.startswith(".env.") or name.endswith(".env") or ".env." in name or name == ".npmrc":
        return True
    if name == "credentials.json" or re.fullmatch(r"service-account.*\.json", name):
        return True
    return name.endswith((".pem", ".key", ".p12", ".pfx", ".jks"))


SECRET_PATTERNS = {
    "private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "GitHub token": re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"),
    "credential assignment": re.compile(
        rb"(?im)^\s*(?:VERCEL_TOKEN|BLOB_READ_WRITE_TOKEN|GITHUB_TOKEN)\s*=\s*\S+"
    ),
    "CMS access code": re.compile(
        rb"(?im)^\s*CMS_ACCESS_CODE\s*=\s*(?!replace-with|example|your-|<)[^\s#]{8,}"
    ),
}


def main():
    history = "--history" in sys.argv[1:]
    findings = set()
    seen = set()
    for oid, path in tracked_objects(history):
        if sensitive_path(path):
            findings.add((path, "sensitive filename"))
        if oid in seen:
            continue
        seen.add(oid)
        data = git("cat-file", "blob", oid)
        if len(data) > 2_000_000 or b"\0" in data[:1024]:
            continue
        for name, pattern in SECRET_PATTERNS.items():
            if pattern.search(data):
                findings.add((path, name))
    for path, reason in sorted(findings):
        print(f"Potential secret in Git: {path} ({reason})", file=sys.stderr)
    if findings:
        return 1
    print(f"Secret guard passed ({len(seen)} Git objects checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
