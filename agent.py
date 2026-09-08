#!/usr/bin/env python3
"""Local coding agent that talks to an OpenAI-compatible proxy on localhost."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import requests

PROXY_URL = os.environ.get("WARE_PROXY_URL", "http://127.0.0.1:8000/v1/chat/completions")
HEALTH_URL = os.environ.get("WARE_HEALTH_URL", "http://127.0.0.1:8000/health")
WORKSPACE = Path(os.environ.get("WARE_WORKSPACE", os.getcwd())).resolve()

SYSTEM_PROMPT = """You are a local coding agent. Work only inside the given workspace.
Respond with XML commands when you need the host to act:

<read_file path="relative/path"/>
<write_file path="relative/path"><![CDATA[file contents]]></write_file>
<edit_file path="relative/path" old_text="exact old" new_text="exact new"/>
<run_command command="ls -la"/>
<create_dir path="folder"/>
<delete_file path="relative/path"/>
<list_files path="."/>

Prefer CDATA for write_file. Keep paths relative to the workspace. Explain results briefly after commands.
"""


class PathEscapeError(ValueError):
    pass


class CodingAgent:
    def __init__(self, proxy_url: str = PROXY_URL, workspace: Path = WORKSPACE) -> None:
        self.proxy_url = proxy_url
        self.workspace = workspace.resolve()
        self.conversation_history: list[dict[str, str]] = []
        print(f"[ware] workspace: {self.workspace}")
        print(f"[ware] proxy:     {self.proxy_url}")

    def resolve_path(self, filepath: str) -> Path:
        raw = Path(filepath)
        full = (self.workspace / raw).resolve() if not raw.is_absolute() else raw.resolve()
        try:
            full.relative_to(self.workspace)
        except ValueError as exc:
            raise PathEscapeError(f"path escapes workspace: {filepath}") from exc
        return full

    def send_prompt(self, user_message: str) -> str:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(self.conversation_history)
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": os.environ.get("WARE_MODEL", "deepseek-chat"),
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 8192,
            "stream": False,
        }

        try:
            print("[ware] sending prompt...")
            response = requests.post(self.proxy_url, json=payload, timeout=120)
            if response.status_code != 200:
                return f"[ware] http {response.status_code}: {response.text[:300]}"
            assistant_message = response.json()["choices"][0]["message"]["content"]
            self.conversation_history.append({"role": "user", "content": user_message})
            self.conversation_history.append({"role": "assistant", "content": assistant_message})
            if len(self.conversation_history) > 40:
                self.conversation_history = self.conversation_history[-40:]
            return assistant_message
        except Exception as exc:
            return f"[ware] connection error: {exc}"

    def execute_commands(self, response: str) -> str:
        output = ["[ware] parsing commands"]
        ran = False

        for match in re.finditer(r'<read_file\s+path="([^"]*)"\s*/?>', response):
            ran = True
            path = match.group(1)
            output.append(f"\n[READ] {path}\n{self.read_file(path)}")

        for match in re.finditer(
            r"<write_file\s+path=\"([^\"]*)\">\s*<!\[CDATA\[(.*?)\]\]>\s*</write_file>",
            response,
            re.DOTALL,
        ):
            ran = True
            path, content = match.group(1), match.group(2)
            output.append(f"\n[WRITE] {self.write_file(path, content)}")

        for match in re.finditer(r'<write_file\s+path="([^"]*)"\s+content="([^"]*)"\s*/?>', response):
            ran = True
            path = match.group(1)
            content = match.group(2).replace("\\n", "\n").replace("\\t", "\t")
            output.append(f"\n[WRITE] {self.write_file(path, content)}")

        for match in re.finditer(
            r'<edit_file\s+path="([^"]*)"\s+old_text="([^"]*)"\s+new_text="([^"]*)"\s*/?>',
            response,
        ):
            ran = True
            path = match.group(1)
            old_text = match.group(2).replace("\\n", "\n")
            new_text = match.group(3).replace("\\n", "\n")
            output.append(f"\n[EDIT] {self.edit_file(path, old_text, new_text)}")

        for match in re.finditer(r'<run_command\s+command="([^"]*)"\s*/?>', response):
            ran = True
            command = match.group(1)
            output.append(f"\n[RUN] {command}\n{self.run_command(command)}")

        for match in re.finditer(r'<create_dir\s+path="([^"]*)"\s*/?>', response):
            ran = True
            output.append(f"\n[MKDIR] {self.create_dir(match.group(1))}")

        for match in re.finditer(r'<delete_file\s+path="([^"]*)"\s*/?>', response):
            ran = True
            output.append(f"\n[DELETE] {self.delete_file(match.group(1))}")

        for match in re.finditer(r'<list_files\s+path="([^"]*)"\s*/?>', response):
            ran = True
            path = match.group(1)
            output.append(f"\n[LIST] {path}\n{self.list_files(path)}")

        if not ran:
            output.append(f"\n[RESPONSE]\n{response}")
        return "\n".join(output)

    def read_file(self, filepath: str) -> str:
        try:
            full = self.resolve_path(filepath)
            return full.read_text(encoding="utf-8")
        except Exception as exc:
            return f"Error: {exc}"

    def write_file(self, filepath: str, content: str) -> str:
        try:
            full = self.resolve_path(filepath)
            full.parent.mkdir(parents=True, exist_ok=True)
            full.write_text(content, encoding="utf-8")
            return f"Written: {filepath} ({len(content)} bytes)"
        except Exception as exc:
            return f"Error: {exc}"

    def edit_file(self, filepath: str, old_text: str, new_text: str) -> str:
        try:
            full = self.resolve_path(filepath)
            content = full.read_text(encoding="utf-8")
            if old_text not in content:
                return f"Error: old_text not found in {filepath}"
            full.write_text(content.replace(old_text, new_text, 1), encoding="utf-8")
            return f"Edited: {filepath}"
        except Exception as exc:
            return f"Error: {exc}"

    def run_command(self, command: str) -> str:
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                cwd=str(self.workspace),
                timeout=60,
            )
            output = result.stdout
            if result.stderr:
                output += f"\n[STDERR]\n{result.stderr}"
            if result.returncode != 0:
                output += f"\n[exit {result.returncode}]"
            return output or "[No output]"
        except subprocess.TimeoutExpired:
            return "Command timed out"
        except Exception as exc:
            return f"Error: {exc}"

    def create_dir(self, path: str) -> str:
        try:
            self.resolve_path(path).mkdir(parents=True, exist_ok=True)
            return f"Created: {path}"
        except Exception as exc:
            return f"Error: {exc}"

    def delete_file(self, path: str) -> str:
        try:
            full = self.resolve_path(path)
            if full == self.workspace:
                return "Error: refusing to delete workspace root"
            if full.is_dir():
                shutil.rmtree(full)
                return f"Deleted directory: {path}"
            full.unlink()
            return f"Deleted file: {path}"
        except Exception as exc:
            return f"Error: {exc}"

    def list_files(self, path: str = ".") -> str:
        try:
            full = self.resolve_path(path)
            items = []
            for item in sorted(full.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                prefix = "[DIR] " if item.is_dir() else "[FILE]"
                items.append(f"{prefix} {item.name}")
            return "\n".join(items) or "[Empty directory]"
        except Exception as exc:
            return f"Error: {exc}"

    def interactive(self) -> None:
        print("\n" + "=" * 70)
        print("[ware] local coding agent")
        print("[ware] type exit to quit")
        print("[ware] workspace:", self.workspace)
        print("=" * 70 + "\n")

        while True:
            try:
                user_input = input("\n[you] ")
                if user_input.lower() in {"exit", "quit", "q"}:
                    print("[ware] shutting down")
                    break
                if not user_input.strip():
                    continue
                response = self.send_prompt(user_input)
                print("\n[model]")
                print(self.execute_commands(response))
            except KeyboardInterrupt:
                print("\n[ware] shutting down")
                break
            except Exception as exc:
                print(f"[ware] error: {exc}")


def proxy_up() -> bool:
    try:
        return requests.get(HEALTH_URL, timeout=2).status_code == 200
    except requests.RequestException:
        return False


def main() -> None:
    if not proxy_up():
        print("[ware] proxy not running on :8000")
        print("[ware] start it with: python proxy.py")
        if input("[ware] continue anyway? [y/N] ").strip().lower() != "y":
            sys.exit(1)
    CodingAgent().interactive()


if __name__ == "__main__":
    main()
