import { Show } from "solid-js";
import { DialogBackdrop, DialogContent } from "../ui/Dialog";
import { Button } from "../ui/Button";

export default function AboutDialog(props: { open: boolean; onClose: () => void }) {
  return (
    <Show when={props.open}>
      <DialogBackdrop role="presentation" onClick={props.onClose}>
        <DialogContent
          class="w-[min(380px,calc(100vw-32px))] gap-4 p-[18px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="grid place-items-center w-5 h-5 rounded bg-[#adc6ff] text-[#002e6a] text-[11px] font-extrabold leading-none">
              V
            </span>
            <div>
              <h2 id="about-title" class="m-0 text-lg leading-6" style={{ color: "var(--text)" }}>
                Velofire
              </h2>
              <p class="m-0 text-xs leading-[18px]" style={{ color: "var(--text-muted)" }}>
                Desktop API client
              </p>
            </div>
          </div>
          <dl class="grid gap-2 m-0">
            <div class="flex justify-between gap-4 pb-2" style={{ "border-bottom": "1px solid color-mix(in srgb, var(--outline-soft) 55%, transparent)" }}>
              <dt style={{ color: "var(--text-muted)" }}>Runtime</dt>
              <dd class="m-0" style={{ color: "var(--text)", "font-family": "'JetBrains Mono', monospace" }}>
                Tauri WebView
              </dd>
            </div>
            <div class="flex justify-between gap-4 pb-2" style={{ "border-bottom": "1px solid color-mix(in srgb, var(--outline-soft) 55%, transparent)" }}>
              <dt style={{ color: "var(--text-muted)" }}>Frontend</dt>
              <dd class="m-0" style={{ color: "var(--text)", "font-family": "'JetBrains Mono', monospace" }}>
                SolidJS
              </dd>
            </div>
            <div class="flex justify-between gap-4 pb-2" style={{ "border-bottom": "1px solid color-mix(in srgb, var(--outline-soft) 55%, transparent)" }}>
              <dt style={{ color: "var(--text-muted)" }}>Storage</dt>
              <dd class="m-0" style={{ color: "var(--text)", "font-family": "'JetBrains Mono', monospace" }}>
                Local workspace
              </dd>
            </div>
          </dl>
          <div class="flex justify-end">
            <Button type="button" onClick={props.onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </DialogBackdrop>
    </Show>
  );
}
