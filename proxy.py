#!/usr/bin/env python3
"""Tiny OpenAI-compatible proxy so agent.py can talk to DeepSeek (or any compatible API)."""

from __future__ import annotations

import os

import requests
from flask import Flask, Response, jsonify, request

UPSTREAM = os.environ.get("WARE_UPSTREAM", "https://api.deepseek.com/v1/chat/completions")
API_KEY = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY", "")

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"ok": True, "upstream": UPSTREAM, "has_key": bool(API_KEY)})


@app.post("/v1/chat/completions")
def chat_completions():
    if not API_KEY:
        return jsonify({"error": "set DEEPSEEK_API_KEY or OPENAI_API_KEY"}), 500
    payload = request.get_json(silent=True) or {}
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        upstream = requests.post(UPSTREAM, json=payload, headers=headers, timeout=120)
    except requests.RequestException as exc:
        return jsonify({"error": str(exc)}), 502
    return Response(upstream.content, status=upstream.status_code, content_type=upstream.headers.get("Content-Type", "application/json"))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)
