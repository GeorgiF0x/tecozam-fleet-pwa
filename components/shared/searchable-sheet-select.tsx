"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SearchableSheetSelectProps<T> {
  value: T | null;
  onChange: (item: T) => void;
  items: T[];
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  /** Render the trigger button (closed state) */
  renderTrigger: (selected: T | null) => ReactNode;
  /** Render each list item */
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  /** Extract searchable text from an item */
  getSearchText: (item: T) => string;
  /** Stable key for each item */
  getKey: (item: T) => string | number;
  /** Items to show in "Recientes" section (max 3 recommended) */
  recentItems?: T[];
  recentLabel?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  /** Title shown in the sheet header */
  title?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchableSheetSelect<T>({
  value,
  onChange,
  items,
  emptyMessage = "Sin resultados",
  searchPlaceholder = "Buscar...",
  renderTrigger,
  renderItem,
  getSearchText,
  getKey,
  recentItems = [],
  recentLabel = "Usados recientemente",
  disabled = false,
  label,
  required = false,
  title,
}: SearchableSheetSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // ── Filtered items ─────────────────────────────────────────────────────────

  const filtered =
    query.trim() === ""
      ? items
      : items.filter((item) =>
          getSearchText(item).toLowerCase().includes(query.toLowerCase()),
        );

  // ── Body overflow guard ────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // Focus search after animation settles
      const t = setTimeout(() => searchRef.current?.focus(), 60);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  // ── Keyboard ESC ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function handleOpen() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setQuery("");
  }

  function handleSelect(item: T) {
    onChange(item);
    handleClose();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const showRecents = query.trim() === "" && recentItems.length > 0;

  return (
    <>
      {/* Trigger */}
      <div className="flex flex-col gap-1.5">
        {label && (
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
            {required && <span className="ml-0.5 text-destructive">*</span>}
          </p>
        )}
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex min-h-[56px] w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors",
            "hover:bg-muted/50 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
            open && "border-primary ring-2 ring-primary/20",
          )}
        >
          <div className="min-w-0 flex-1">{renderTrigger(value)}</div>
          <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {/* Portal-like overlay — rendered in-tree but fixed positioned */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col justify-end"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            ref={sheetRef}
            className={cn(
              "relative flex max-h-[85vh] flex-col rounded-t-2xl bg-card shadow-2xl",
              "animate-in slide-in-from-bottom duration-250 ease-out",
            )}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-4 pb-3">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-input px-3 py-2.5">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="flex size-5 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground transition-colors hover:bg-muted-foreground/30"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="size-5 text-foreground" />
              </button>
            </div>

            {/* Title (optional) */}
            {title && query.trim() === "" && (
              <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
              </p>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-safe">
              {/* Recents section */}
              {showRecents && (
                <div className="px-4 pt-3 pb-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {recentLabel}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {recentItems.map((item) => {
                      const isSelected =
                        value !== null && getKey(item) === getKey(value);
                      return (
                        <button
                          key={getKey(item)}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "flex min-h-[56px] w-full items-center rounded-xl border border-border px-4 py-3 text-left transition-colors",
                            isSelected
                              ? "border-primary/50 bg-primary/10"
                              : "bg-muted/40 hover:bg-muted/70",
                          )}
                        >
                          {renderItem(item, isSelected)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All items section */}
              <div className="px-4 pt-3 pb-4">
                {showRecents && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Todos
                  </p>
                )}
                {filtered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {filtered.map((item) => {
                      const isSelected =
                        value !== null && getKey(item) === getKey(value);
                      return (
                        <button
                          key={getKey(item)}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "flex min-h-[56px] w-full items-center px-4 py-3 text-left transition-colors",
                            isSelected
                              ? "bg-primary/10"
                              : "bg-card hover:bg-muted/50",
                          )}
                        >
                          {renderItem(item, isSelected)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
