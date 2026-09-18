"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavItem } from "@/lib/navigation";

/**
 * Keyboard-first navigation, opened with Cmd/Ctrl+K.
 *
 * Entries are built from the same nav definition the sidebar uses, so a new
 * section appears here without anyone remembering to add it. Matching is a
 * plain substring test over label and hint - a lead finder has a handful of
 * destinations, and fuzzy ranking on that many items mostly produces
 * surprising results rather than helpful ones.
 */

interface Command extends NavItem {
  group: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(
    () =>
      NAV_GROUPS.flatMap((group) =>
        group.items.map((item) => ({ ...item, group: group.label }))
      ),
    []
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(q) ||
        command.hint?.toLowerCase().includes(q) ||
        command.group.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // A stale highlight after filtering would run the wrong command on Enter.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const run = useCallback(
    (command: Command) => {
      setOpen(false);
      router.push(command.href);
    },
    [router]
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[activeIndex];
      if (command) run(command);
    }
  }

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  let renderedGroup = "";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className="animate-scale-in fixed left-1/2 top-[18%] z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl surface-elevated"
          aria-label="Command palette"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search for a section and press Enter to open it.
          </Dialog.Description>

          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog exists to receive typing */}
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search sections, leads, campaigns..."
              aria-label="Search commands"
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
            />
          </div>

          <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2" role="listbox">
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nothing matches &ldquo;{query}&rdquo;.
              </p>
            )}

            {results.map((command, index) => {
              const showGroup = command.group !== renderedGroup;
              renderedGroup = command.group;
              const Icon = command.icon;
              const active = index === activeIndex;
              return (
                <div key={command.href}>
                  {showGroup && <p className="label-caps px-3 pb-1 pt-3">{command.group}</p>}
                  <button
                    type="button"
                    data-index={index}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => run(command)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                      active ? "bg-primary/12 text-foreground" : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Icon
                      className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-subtle-foreground")}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {command.label}
                      </span>
                      {command.hint && (
                        <span className="block truncate text-2xs text-subtle-foreground">
                          {command.hint}
                        </span>
                      )}
                    </span>
                    {active && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-subtle-foreground" aria-hidden="true" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-2xs text-subtle-foreground">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" aria-hidden="true" />
              <ArrowDown className="h-3 w-3" aria-hidden="true" />
              navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
              open
            </span>
            <span className="ml-auto">esc to close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
