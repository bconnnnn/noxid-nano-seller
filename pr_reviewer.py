#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from typing import Dict, List, Optional

import requests

API = "https://api.github.com"
FUNC_RE = re.compile(r"^(?P<indent>\s*)(?:async\s+)?def\s+(?P<name>[A-Za-z_]\w*)\s*\(")
CRED_RE = re.compile(
    r"(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\b\s*[:=]\s*[\"'][^\"'\n]{4,}[\"']"
)

def added_lines(patch: str) -> List[str]:
    return [line[1:] for line in (patch or "").splitlines()
            if line.startswith("+") and not line.startswith("+++")]

def function_length(lines: List[str], start: int, indent: int) -> int:
    count = 1
    for line in lines[start + 1:]:
        if not line.strip():
            count += 1
            continue
        current = len(line) - len(line.lstrip())
        if current <= indent and not line.lstrip().startswith(("#", "@")):
            break
        count += 1
    return count

def analyze_file(filename: str, patch: str) -> List[str]:
    lines = added_lines(patch)
    findings: List[str] = []
    for idx, line in enumerate(lines):
        line_no = idx + 1
        stripped = line.strip()
        match = FUNC_RE.match(line)
        if match:
            name = match.group("name")
            indent = len(match.group("indent"))
            length = function_length(lines, idx, indent)
            if length > 50:
                findings.append(f"{filename}: added function `{name}` is {length} lines (>50)")
            if not name.startswith("_"):
                following = lines[idx + 1: idx + 4]
                first = next((x.strip() for x in following if x.strip()), "")
                if not first.startswith(('"""', "'''")):
                    findings.append(f"{filename}: public function `{name}` appears to be missing a docstring")
        if re.search(r"\bexcept\s*:\s*(?:#.*)?$", stripped):
            findings.append(f"{filename}: line +{line_no} uses bare `except:`")
        if CRED_RE.search(line):
            findings.append(f"{filename}: line +{line_no} contains a hardcoded credential-like string")
        if re.search(r"\b(?:TODO|FIXME)\b", line, re.IGNORECASE):
            findings.append(f"{filename}: line +{line_no} contains TODO/FIXME")
    return findings

def github_headers(token: Optional[str], accept: str = "application/vnd.github+json") -> Dict[str, str]:
    headers = {"Accept": accept, "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def fetch_files(repo: str, pr: int, token: Optional[str]) -> List[dict]:
    url = f"{API}/repos/{repo}/pulls/{pr}/files"
    files: List[dict] = []
    page = 1
    while True:
        resp = requests.get(url, headers=github_headers(token), params={"per_page": 100, "page": page}, timeout=20)
        resp.raise_for_status()
        batch = resp.json()
        files.extend(batch)
        if len(batch) < 100:
            return files
        page += 1

def build_review(findings: List[str], files_reviewed: int) -> str:
    if not findings:
        return f"Automated code-quality review: checked {files_reviewed} changed file(s); no configured issues found."
    bullets = "\n".join(f"- {item}" for item in findings[:100])
    return f"Automated code-quality review: {len(findings)} issue(s) across {files_reviewed} changed file(s).\n\n{bullets}"

def post_review(repo: str, pr: int, token: str, body: str) -> int:
    url = f"{API}/repos/{repo}/pulls/{pr}/reviews"
    resp = requests.post(url, headers=github_headers(token), json={"body": body, "event": "COMMENT"}, timeout=20)
    resp.raise_for_status()
    return int(resp.json()["id"])

def main() -> int:
    parser = argparse.ArgumentParser(description="Review a GitHub PR for simple code-quality issues.")
    parser.add_argument("--repo", required=True, help="owner/repo")
    parser.add_argument("--pr", required=True, type=int, help="pull request number")
    parser.add_argument("--token", help="GitHub token; defaults to GITHUB_TOKEN")
    args = parser.parse_args()
    token = args.token or os.getenv("GITHUB_TOKEN")
    if not token:
        parser.error("GitHub token required via --token or GITHUB_TOKEN")
    try:
        files = fetch_files(args.repo, args.pr, token)
        findings: List[str] = []
        for item in files:
            findings.extend(analyze_file(item.get("filename", "<unknown>"), item.get("patch") or ""))
        comment_id = post_review(args.repo, args.pr, token, build_review(findings, len(files)))
        print(json.dumps({"pr": args.pr, "files_reviewed": len(files), "issues_found": len(findings), "comment_id": comment_id}))
        return 0
    except requests.RequestException as exc:
        print(f"GitHub API error: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
