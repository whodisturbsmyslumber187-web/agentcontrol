#!/usr/bin/env python3
"""
Master n8n workflow importer.

Features:
- Loads workflows from local folders
- Loads workflows from local ZIP archives
- Pulls extra workflow packs from online GitHub repos
- De-duplicates by workflow structure fingerprint
- Imports into n8n via API and writes a JSON report
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import requests


DEFAULT_LOCAL_ROOTS = [
    r"C:\Users\p8tty\Downloads\n8n templates",
]

DEFAULT_LOCAL_ZIPS = [
    r"C:\Users\p8tty\Downloads\n8n-portable.zip",
]

DEFAULT_ONLINE_REPOS = [
    "abhisiroha/n8n-templates",
    "Marvomatic/n8n-templates",
    "workflowsdiy/n8n-workflows",
    "Danitilahun/n8n-workflow-templates",
]

IGNORE_DIR_NAMES = {
    ".git",
    ".github",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
}

ALLOWED_WORKFLOW_KEYS = {"name", "nodes", "connections", "settings"}
ALLOWED_NODE_KEYS = {
    "name",
    "type",
    "typeVersion",
    "position",
    "parameters",
    "credentials",
    "disabled",
    "alwaysOutputData",
    "continueOnFail",
    "retryOnFail",
    "maxTries",
    "waitBetweenTries",
    "executeOnce",
    "onError",
    "notes",
    "notesInFlow",
    "webhookId",
}
ALLOWED_ON_ERROR_VALUES = {"stopWorkflow", "continueRegularOutput", "continueErrorOutput"}
ALLOWED_CALLER_POLICIES = {"any", "none", "workflowsFromAList", "workflowsFromSameOwner"}


@dataclass
class WorkflowCandidate:
    source: str
    workflow: Dict


class N8nApiClient:
    def __init__(self, base_url: str, api_key: str, timeout: int = 45) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "accept": "application/json",
                "content-type": "application/json",
                "X-N8N-API-KEY": api_key,
            }
        )

    def healthcheck(self) -> None:
        urls = [
            f"{self.base_url}/healthz",
            f"{self.base_url}/api/v1/workflows?limit=1",
        ]
        last_error: Optional[Exception] = None
        for url in urls:
            try:
                response = self.session.get(url, timeout=self.timeout)
                if response.status_code < 500:
                    return
            except Exception as exc:  # pragma: no cover - connectivity fallback
                last_error = exc
        if last_error:
            raise RuntimeError(f"n8n healthcheck failed: {last_error}") from last_error
        raise RuntimeError("n8n healthcheck failed")

    def list_workflows(self) -> List[Dict]:
        workflows: List[Dict] = []
        cursor: Optional[str] = None

        for _ in range(300):
            params = {"limit": 250}
            if cursor:
                params["cursor"] = cursor

            response = self.session.get(
                f"{self.base_url}/api/v1/workflows", params=params, timeout=self.timeout
            )
            if response.status_code != 200:
                raise RuntimeError(
                    f"Failed listing workflows ({response.status_code}): {response.text[:250]}"
                )

            payload = response.json()
            data = payload.get("data", [])
            if isinstance(data, list):
                for row in data:
                    if isinstance(row, dict):
                        workflows.append(row)

            cursor = payload.get("nextCursor")
            if not cursor:
                break

        return workflows

    def list_workflow_names(self) -> List[str]:
        names: List[str] = []
        for row in self.list_workflows():
            name = row.get("name")
            if isinstance(name, str) and name.strip():
                names.append(name.strip())
        return names

    def create_workflow(self, workflow: Dict) -> Tuple[bool, str]:
        response = self.session.post(
            f"{self.base_url}/api/v1/workflows",
            data=json.dumps(workflow, ensure_ascii=True),
            timeout=self.timeout,
        )
        if response.status_code in (200, 201):
            payload = response.json()
            workflow_id = payload.get("id") or payload.get("data", {}).get("id")
            if workflow_id:
                return True, str(workflow_id)
            return True, "created"

        return False, f"{response.status_code}: {response.text[:300]}"


def sanitize_name(name: str) -> str:
    cleaned = re.sub(r"\s+", " ", name.strip())
    cleaned = re.sub(r"[^\w\s\-\[\]\(\)\.:/]", "", cleaned)
    return cleaned[:180] if cleaned else "Imported Workflow"


def is_workflow_dict(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    nodes = value.get("nodes")
    connections = value.get("connections")
    return isinstance(nodes, list) and isinstance(connections, (dict, list))


def parse_bool(value: object) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    return None


def parse_number(value: object) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        try:
            return float(text)
        except Exception:
            return None
    return None


def sanitize_node(node: Dict) -> Optional[Dict]:
    cleaned = dict(node)
    cleaned.pop("id", None)
    cleaned = {key: value for key, value in cleaned.items() if key in ALLOWED_NODE_KEYS}

    name = cleaned.get("name")
    node_type = cleaned.get("type")
    if not isinstance(name, str) or not name.strip():
        return None
    if not isinstance(node_type, str) or not node_type.strip():
        return None

    parameters = cleaned.get("parameters")
    cleaned["parameters"] = parameters if isinstance(parameters, dict) else {}

    type_version = parse_number(cleaned.get("typeVersion"))
    cleaned["typeVersion"] = type_version if type_version is not None else 1

    position = cleaned.get("position")
    if isinstance(position, (list, tuple)) and len(position) >= 2:
        x = parse_number(position[0])
        y = parse_number(position[1])
        cleaned["position"] = [x if x is not None else 0, y if y is not None else 0]
    else:
        cleaned["position"] = [0, 0]

    credentials = cleaned.get("credentials")
    if not isinstance(credentials, dict):
        cleaned.pop("credentials", None)

    for key in ("disabled", "alwaysOutputData", "continueOnFail", "retryOnFail", "executeOnce", "notesInFlow"):
        value = parse_bool(cleaned.get(key))
        if value is None:
            cleaned.pop(key, None)
        else:
            cleaned[key] = value

    for key in ("maxTries", "waitBetweenTries"):
        value = parse_number(cleaned.get(key))
        if value is None:
            cleaned.pop(key, None)
        else:
            cleaned[key] = value

    notes = cleaned.get("notes")
    if notes is None:
        cleaned.pop("notes", None)
    elif not isinstance(notes, str):
        cleaned["notes"] = str(notes)

    on_error = cleaned.get("onError")
    if isinstance(on_error, str) and on_error in ALLOWED_ON_ERROR_VALUES:
        cleaned["onError"] = on_error
    else:
        cleaned.pop("onError", None)

    webhook_id = cleaned.get("webhookId")
    if webhook_id is not None and not isinstance(webhook_id, str):
        cleaned["webhookId"] = str(webhook_id)

    return cleaned


def sanitize_settings(settings: object) -> Dict:
    if not isinstance(settings, dict):
        return {}

    cleaned: Dict = {}

    execution_order = settings.get("executionOrder")
    if execution_order in {"v0", "v1"}:
        cleaned["executionOrder"] = execution_order

    timezone = settings.get("timezone")
    if isinstance(timezone, str) and timezone.strip():
        cleaned["timezone"] = timezone.strip()

    error_workflow = settings.get("errorWorkflow")
    if isinstance(error_workflow, str) and error_workflow.strip():
        cleaned["errorWorkflow"] = error_workflow.strip()

    caller_policy = settings.get("callerPolicy")
    if caller_policy in ALLOWED_CALLER_POLICIES:
        cleaned["callerPolicy"] = caller_policy

    save_exec = parse_bool(settings.get("saveExecutionProgress"))
    if save_exec is not None:
        cleaned["saveExecutionProgress"] = save_exec

    return cleaned


def normalize_workflow(raw: Dict, source_name: str) -> Optional[Dict]:
    if not is_workflow_dict(raw):
        return None

    # Deep-copy through JSON to keep only plain JSON-safe values.
    workflow = json.loads(json.dumps(raw))

    name = workflow.get("name")
    if not isinstance(name, str) or not name.strip():
        name = Path(source_name).stem
    clean_name = sanitize_name(str(name))

    raw_nodes = workflow.get("nodes", [])
    if not isinstance(raw_nodes, list) or len(raw_nodes) == 0:
        return None

    nodes: List[Dict] = []
    for node in raw_nodes:
        if isinstance(node, dict):
            sanitized = sanitize_node(node)
            if sanitized:
                nodes.append(sanitized)
    if not nodes:
        return None

    connections = workflow.get("connections", {})
    if not isinstance(connections, dict):
        connections = {}

    settings = sanitize_settings(workflow.get("settings"))

    normalized = {
        "name": clean_name,
        "nodes": nodes,
        "connections": connections,
        "settings": settings,
    }

    # Guardrail in case incoming payload mutated keys unexpectedly.
    return {k: v for k, v in normalized.items() if k in ALLOWED_WORKFLOW_KEYS}


def extract_workflows_from_json(payload: object, source_name: str) -> List[Dict]:
    results: List[Dict] = []

    if isinstance(payload, list):
        for entry in payload:
            if isinstance(entry, dict):
                normalized = normalize_workflow(entry, source_name)
                if normalized:
                    results.append(normalized)
        return results

    if isinstance(payload, dict):
        normalized = normalize_workflow(payload, source_name)
        if normalized:
            results.append(normalized)

        nested_workflows = payload.get("workflows")
        if isinstance(nested_workflows, list):
            for entry in nested_workflows:
                if isinstance(entry, dict):
                    nested = normalize_workflow(entry, source_name)
                    if nested:
                        results.append(nested)

        nested_single = payload.get("workflow")
        if isinstance(nested_single, dict):
            nested = normalize_workflow(nested_single, source_name)
            if nested:
                results.append(nested)

    return results


def json_fingerprint(workflow: Dict) -> str:
    reduced = dict(workflow)
    reduced.pop("name", None)
    reduced.pop("active", None)
    canonical = json.dumps(reduced, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def load_json_file(path: Path) -> Optional[object]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="latin-1")
    except Exception:
        return None

    try:
        return json.loads(text)
    except Exception:
        return None


def discover_local_json_files(roots: Iterable[Path]) -> Iterable[Path]:
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*.json"):
            if any(part in IGNORE_DIR_NAMES for part in path.parts):
                continue
            yield path


def extract_zip_to_folder(zip_path: Path, destination: Path) -> Optional[Path]:
    if not zip_path.exists():
        return None
    target = destination / f"zip_{zip_path.stem}"
    target.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(target)
        return target
    except Exception:
        return None


def discover_workflows_from_large_zip(zip_path: Path) -> List[WorkflowCandidate]:
    candidates: List[WorkflowCandidate] = []
    if not zip_path.exists():
        return candidates

    try:
        with zipfile.ZipFile(zip_path, "r") as archive:
            for entry in archive.infolist():
                name_lower = entry.filename.lower()
                if not name_lower.endswith(".json"):
                    continue
                if "workflow" not in name_lower and "template" not in name_lower and ".n8n" not in name_lower:
                    continue
                if entry.file_size > 10_000_000:
                    continue
                try:
                    raw = archive.read(entry).decode("utf-8", errors="ignore")
                    payload = json.loads(raw)
                except Exception:
                    continue

                for workflow in extract_workflows_from_json(payload, entry.filename):
                    candidates.append(
                        WorkflowCandidate(source=f"{zip_path.name}:{entry.filename}", workflow=workflow)
                    )
    except Exception:
        return candidates

    return candidates


def download_and_extract_repo(repo: str, destination: Path) -> Optional[Path]:
    destination.mkdir(parents=True, exist_ok=True)
    for branch in ("main", "master"):
        url = f"https://codeload.github.com/{repo}/zip/refs/heads/{branch}"
        try:
            response = requests.get(url, timeout=120)
        except Exception:
            continue
        if response.status_code != 200:
            continue

        zip_file = destination / f"{repo.replace('/', '__')}__{branch}.zip"
        zip_file.write_bytes(response.content)

        extract_dir = destination / f"{repo.replace('/', '__')}__{branch}"
        extract_dir.mkdir(parents=True, exist_ok=True)
        try:
            with zipfile.ZipFile(zip_file, "r") as archive:
                archive.extractall(extract_dir)
            return extract_dir
        except Exception:
            continue
    return None


def make_unique_name(base_name: str, used_names: set[str]) -> str:
    name = sanitize_name(base_name)
    if name not in used_names:
        used_names.add(name)
        return name
    suffix = 2
    while True:
        candidate = sanitize_name(f"{name} [{suffix}]")
        if candidate not in used_names:
            used_names.add(candidate)
            return candidate
        suffix += 1


def import_candidates(
    client: N8nApiClient, candidates: List[WorkflowCandidate], report_path: Path
) -> Dict:
    existing_workflows = client.list_workflows()
    existing_names = {
        row.get("name").strip()
        for row in existing_workflows
        if isinstance(row, dict) and isinstance(row.get("name"), str) and row.get("name").strip()
    }
    used_names = set(existing_names)
    seen_hashes: set[str] = set()
    for row in existing_workflows:
        if not isinstance(row, dict):
            continue
        normalized_existing = normalize_workflow(row, source_name="existing")
        if normalized_existing:
            seen_hashes.add(json_fingerprint(normalized_existing))

    imported = 0
    skipped_duplicates = 0
    failed: List[Dict] = []
    imported_rows: List[Dict] = []

    for index, candidate in enumerate(candidates, start=1):
        workflow = dict(candidate.workflow)
        fingerprint = json_fingerprint(workflow)
        if fingerprint in seen_hashes:
            skipped_duplicates += 1
            continue
        seen_hashes.add(fingerprint)

        workflow["name"] = make_unique_name(str(workflow.get("name", "Imported Workflow")), used_names)
        ok, details = client.create_workflow(workflow)
        if ok:
            imported += 1
            imported_rows.append(
                {
                    "index": index,
                    "name": workflow["name"],
                    "source": candidate.source,
                    "workflowId": details,
                }
            )
        else:
            failed.append(
                {
                    "index": index,
                    "name": workflow.get("name", ""),
                    "source": candidate.source,
                    "error": details,
                }
            )

        if index % 100 == 0:
            print(f"[import] processed={index} imported={imported} failed={len(failed)}")

    summary = {
        "timestamp": int(time.time()),
        "totalCandidates": len(candidates),
        "imported": imported,
        "skippedDuplicates": skipped_duplicates,
        "failed": len(failed),
        "failures": failed[:500],
        "imports": imported_rows[:1000],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Bulk import local + online n8n templates.")
    parser.add_argument("--n8n-url", default="http://localhost:5678")
    parser.add_argument("--n8n-api-key", default="")
    parser.add_argument("--report", default="scripts/n8n_import_report.json")
    parser.add_argument(
        "--local-root",
        action="append",
        default=[],
        help="Additional local folder to scan for JSON workflows",
    )
    parser.add_argument(
        "--local-zip",
        action="append",
        default=[],
        help="Additional ZIP archive to extract/scan for workflows",
    )
    parser.add_argument(
        "--repo",
        action="append",
        default=[],
        help="Additional online GitHub repo (owner/name) to pull templates from",
    )
    parser.add_argument("--skip-online", action="store_true")
    args = parser.parse_args()

    api_key = args.n8n_api_key.strip() or Path(
        r"C:\Users\p8tty\Downloads\n8n templates\check_n8n_api.py"
    ).read_text(encoding="utf-8", errors="ignore")
    if not args.n8n_api_key.strip():
        match = re.search(r'API_KEY\s*=\s*"([^"]+)"', api_key)
        api_key = match.group(1).strip() if match else ""
    if not api_key:
        print("Missing n8n API key. Provide --n8n-api-key.", file=sys.stderr)
        return 2

    local_roots = [Path(path) for path in (DEFAULT_LOCAL_ROOTS + args.local_root)]
    local_zips = [Path(path) for path in (DEFAULT_LOCAL_ZIPS + args.local_zip)]
    online_repos = list(dict.fromkeys(DEFAULT_ONLINE_REPOS + args.repo))

    temp_root = Path(tempfile.mkdtemp(prefix="n8n-master-import-"))
    print(f"[setup] temp={temp_root}")

    client = N8nApiClient(args.n8n_url, api_key)
    client.healthcheck()
    print("[setup] n8n reachable")

    extracted_roots: List[Path] = []
    for root in local_roots:
        if root.exists():
            extracted_roots.append(root)

    for zip_path in Path(DEFAULT_LOCAL_ROOTS[0]).rglob("*.zip"):
        extracted = extract_zip_to_folder(zip_path, temp_root / "local_zips")
        if extracted:
            extracted_roots.append(extracted)

    for zip_path in local_zips:
        extracted = extract_zip_to_folder(zip_path, temp_root / "explicit_zips")
        if extracted:
            extracted_roots.append(extracted)

    if not args.skip_online:
        online_root = temp_root / "online_repos"
        for repo in online_repos:
            extracted = download_and_extract_repo(repo, online_root)
            if extracted:
                print(f"[online] fetched {repo}")
                extracted_roots.append(extracted)
            else:
                print(f"[online] skipped {repo} (download failed)")

    candidates: List[WorkflowCandidate] = []

    # Pull workflow-like JSON directly from very large archives, if present.
    for zip_path in local_zips:
        zip_candidates = discover_workflows_from_large_zip(zip_path)
        if zip_candidates:
            print(f"[scan] large-zip workflows from {zip_path.name}: {len(zip_candidates)}")
            candidates.extend(zip_candidates)

    file_count = 0
    for json_file in discover_local_json_files(extracted_roots):
        file_count += 1
        payload = load_json_file(json_file)
        if payload is None:
            continue
        workflows = extract_workflows_from_json(payload, str(json_file))
        if workflows:
            for workflow in workflows:
                candidates.append(
                    WorkflowCandidate(source=str(json_file), workflow=workflow)
                )

    print(f"[scan] files={file_count} candidates={len(candidates)}")
    if not candidates:
        print("[done] no workflow candidates found")
        return 0

    report_path = Path(args.report)
    summary = import_candidates(client, candidates, report_path)
    print(
        "[done] imported={imported} skipped={skippedDuplicates} failed={failed} report={report}".format(
            **summary, report=report_path
        )
    )

    shutil.rmtree(temp_root, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
