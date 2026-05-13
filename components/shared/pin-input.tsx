"use client";

import { useRef, type KeyboardEvent, type ClipboardEvent, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PinInput({
  value,
  onChange,
  length = 4,
  disabled = false,
  error = false,
  className,
}: PinInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // ── Focus helpers ─────────────────────────────────────────────────────────

  function focusAt(index: number) {
    inputsRef.current[index]?.focus();
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e: ChangeEvent<HTMLInputElement>, index: number) {
    const raw = e.target.value.replace(/\D/g, ""); // only digits
    if (!raw) return;

    const digit = raw[raw.length - 1]; // take last char if multiple typed
    const chars = value.split("");
    chars[index] = digit;
    const next = chars.join("").slice(0, length);
    onChange(next);

    // Move focus forward
    if (index < length - 1) {
      focusAt(index + 1);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const chars = value.split("");

      if (chars[index]) {
        // Clear current slot
        chars[index] = "";
        onChange(chars.join(""));
      } else if (index > 0) {
        // Go back and clear previous slot
        chars[index - 1] = "";
        onChange(chars.join(""));
        focusAt(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      focusAt(index - 1);
    } else if (e.key === "ArrowRight" && index < length - 1) {
      focusAt(index + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted.padEnd(length, "").slice(0, length).replace(/\s/g, ""));
    // Trim to actual pasted length
    onChange(pasted.slice(0, length));
    // Focus last filled slot or last slot
    const focusIdx = Math.min(pasted.length, length - 1);
    focusAt(focusIdx);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  return (
    <div className={cn("flex items-center gap-3 justify-center", className)}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={i === 0}
          autoComplete="off"
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            // Base
            "flex h-14 w-12 items-center justify-center rounded-xl border-2 bg-secondary text-center text-xl font-bold tracking-widest text-foreground outline-none transition-all duration-150",
            // Focus ring
            "focus:border-primary focus:bg-primary/5 focus:ring-2 focus:ring-primary/20",
            // Touch target: already 56px height
            // Filled state
            digit && "border-primary/50",
            // Error state
            error && "border-destructive focus:border-destructive focus:ring-destructive/20",
            // Disabled
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      ))}
    </div>
  );
}
