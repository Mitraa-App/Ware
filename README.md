# Ware

Local coding agent + incomplete Android Shizuku process viewer.

This dump was not buildable. `fix/buildable` restores the missing Gradle module files, wires the Python agent to a real localhost proxy, and jails file APIs to the workspace.

## Python agent

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DEEPSEEK_API_KEY=sk-...
python proxy.py          # :8000 health + chat completions
# other terminal
python agent.py          # REPL
python app.py            # optional file API on 127.0.0.1:5000
```

File read/write/delete stays inside `WARE_WORKSPACE` (defaults to cwd). The Flask API binds localhost only.

## Android (`ShizukuMonitorAgent`)

Open the folder in Android Studio. Requires [Shizuku](https://shizuku.rikka.app/) running on the device. The app lists processes via a Shizuku user service after you grant permission. Local viewer only — no network exfil.

Missing from the original upload: `settings.gradle`, `app/build.gradle`, manifest, activities, layouts, themes, and non-empty launcher resources.
