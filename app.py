from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify, request

WORKSPACE = Path(os.environ.get("WARE_WORKSPACE", os.getcwd())).resolve()

app = Flask(__name__)


def resolve_path(path: str | None) -> Path:
    if not path:
        raise ValueError("path required")
    raw = Path(path)
    full = (WORKSPACE / raw).resolve() if not raw.is_absolute() else raw.resolve()
    full.relative_to(WORKSPACE)
    return full


@app.get("/")
def index():
    return {
        "name": "Ware local file API",
        "workspace": str(WORKSPACE),
        "bind": "127.0.0.1:5000",
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/list")
def list_files():
    path = request.args.get("path", ".")
    try:
        target = resolve_path(path)
        items = []
        for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            items.append({"name": item.name, "dir": item.is_dir()})
        return jsonify({"success": True, "items": items, "path": str(target.relative_to(WORKSPACE))})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.get("/api/read")
def read_file():
    try:
        target = resolve_path(request.args.get("path"))
        if not target.is_file():
            return jsonify({"success": False, "error": "not a file"}), 400
        return jsonify({"success": True, "content": target.read_text(encoding="utf-8")})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.post("/api/write")
def write_file():
    data = request.get_json(silent=True) or {}
    try:
        target = resolve_path(data.get("path"))
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data.get("content", ""), encoding="utf-8")
        return jsonify({"success": True})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.post("/api/edit")
def edit_file():
    data = request.get_json(silent=True) or {}
    old_text = data.get("old_text")
    new_text = data.get("new_text")
    if old_text is None or new_text is None:
        return jsonify({"success": False, "error": "old_text and new_text required"}), 400
    try:
        target = resolve_path(data.get("path"))
        content = target.read_text(encoding="utf-8")
        if old_text not in content:
            return jsonify({"success": False, "error": "old_text not found"}), 400
        target.write_text(content.replace(old_text, new_text, 1), encoding="utf-8")
        return jsonify({"success": True})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.delete("/api/delete")
def delete_file():
    try:
        target = resolve_path(request.args.get("path"))
        if target == WORKSPACE:
            return jsonify({"success": False, "error": "refusing to delete workspace root"}), 400
        if target.is_dir():
            import shutil

            shutil.rmtree(target)
        else:
            target.unlink()
        return jsonify({"success": True})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
