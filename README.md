# WARE

Owner-operated phone console. Install the companion on a handset you unlock, grant Shizuku, pair with a code, then administer that phone from the web console.

## Companion APK

Source: `ShizukuMonitorAgent/`

On the phone:

1. Install [Shizuku](https://shizuku.rikka.app/) and start it.
2. Install the WARE APK (unsigned debug build; allow unknown sources).
3. Open WARE → Grant access → paste the console address and pairing code → Connect.
4. Keep WARE in the foreground while you use the console.

The phone sends screen, apps, files, processes, logs, and shell to **that pairing code only**. Disconnect on the phone to cut the link.

## Console

Source: `console/`

Pairing-code scoped device admin:

- Overview, live screen, apps, files, processes, logs, shell
- Stop / uninstall / run commands are queued for the next sample from the phone

## Local agent (Python)

`agent.py` + `proxy.py` — original coding-agent helpers. `pip install -r requirements.txt`.

This is not spyware. The app is visible, access is granted on the device, and nothing is hidden.
