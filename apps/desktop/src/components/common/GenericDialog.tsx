import { Show } from "solid-js";
import { DialogBackdrop, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogActions } from "../ui/Dialog";
import { Button } from "../ui/Button";

type DialogState =
  | { type: "input"; title: string; label: string; value: string; confirmLabel: string; resolve: (value: string | null) => void }
  | { type: "confirm"; title: string; description: string; confirmLabel: string; danger?: boolean; resolve: (value: boolean) => void };

interface GenericDialogProps {
  state: DialogState | null;
  onClose: (value: string | boolean | null) => void;
}

export default function GenericDialog(props: GenericDialogProps) {
  return (
    <Show when={props.state}>
      {(state) => (
        <DialogBackdrop
          role="presentation"
          onClick={() => props.onClose(state().type === "input" ? null : false)}
        >
          <DialogContent
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle id="dialog-title">{state().title}</DialogTitle>
              <Button
                variant="secondary"
                size="icon"
                type="button"
                aria-label="Close dialog"
                onClick={() => props.onClose(state().type === "input" ? null : false)}
              >
                x
              </Button>
            </DialogHeader>
            <Show
              when={state().type === "input"}
              fallback={
                <DialogDescription>
                  {state().type === "confirm" ? state().description : ""}
                </DialogDescription>
              }
            >
              <label class="grid gap-1 min-w-0">
                <span>{state().type === "input" ? state().label : ""}</span>
                <input
                  class="w-full h-[34px] rounded-[5px]"
                  value={state().type === "input" ? state().value : ""}
                  autofocus
                  onInput={(event) => {
                    const current = state();
                    if (current.type === "input") {
                      current.value = event.currentTarget.value;
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      props.onClose(state().type === "input" ? state().value : true);
                    }
                  }}
                />
              </label>
            </Show>
            <DialogActions>
              <Button
                variant="secondary"
                type="button"
                onClick={() => props.onClose(state().type === "input" ? null : false)}
              >
                Cancel
              </Button>
              <Button
                variant={state().type === "confirm" && state().danger ? "destructive" : "default"}
                type="button"
                onClick={() => props.onClose(state().type === "input" ? state().value : true)}
              >
                {state().confirmLabel}
              </Button>
            </DialogActions>
          </DialogContent>
        </DialogBackdrop>
      )}
    </Show>
  );
}
