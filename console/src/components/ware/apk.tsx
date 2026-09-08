import { Check, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell } from "./dashboard";
import { useWare } from "@/lib/ware/store";
import { useEffect } from "react";

const STEPS = [
  "Install Shizuku from Play Store and start it (wireless debugging, or root).",
  "Install this WARE APK. Android will warn that it is unsigned — that is expected.",
  "Open WARE. Tap Grant access and approve the Shizuku prompt.",
  "Paste the console address and pairing code from Console, then tap Connect.",
];

export function ApkPage() {
  const hydrate = useWare((s) => s.hydrate);
  const origin = useWare((s) => s.origin);
  const code = useWare((s) => s.code);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs tracking-[0.2em] text-muted">COMPANION</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight md:text-3xl">Device APK</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A normal home screen on the phone. It asks for Shizuku, then the console can administer
          this handset: screen, apps, files, processes, logs, and shell. Disconnect on the phone
          to cut it off.
        </p>

        <div className="mt-8 rounded-xl border border-border bg-surface p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-11 items-center justify-center rounded-md bg-elevated">
              <Smartphone className="size-5 text-fg" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">WARE 1.2</h2>
              <p className="mt-1 font-mono text-xs text-subtle">com.example.shizukumonitor · minSdk 26</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild>
                  <a href="/ware-monitor.apk" download>
                    <Download className="size-4" />
                    Download APK
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-medium text-subtle">Enter these on the phone</p>
          <p className="mt-2 break-all font-mono text-sm">{origin || "Open Console first"}</p>
          <p className="mt-1 font-mono text-xl tracking-[0.2em]">{code || "······"}</p>
        </div>

        <ol className="mt-8 space-y-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-elevated font-mono text-xs text-muted">
                {i + 1}
              </span>
              <p className="text-sm text-fg">{step}</p>
            </li>
          ))}
        </ol>

        <ul className="mt-8 space-y-2 text-sm text-muted">
          {[
            "Screen, apps, files, logs, and shell are sent only to the console address you paste",
            "You grant that on this phone — disconnect anytime",
            "Keep WARE open on the phone while you use the console",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
