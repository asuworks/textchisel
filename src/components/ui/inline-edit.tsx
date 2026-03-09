import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "./textarea";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

/**
 * Click-to-edit component.
 * - Renders as a <span> in read mode, <Textarea> in edit mode.
 * - Enter = commit (single-line feel), Escape = revert, blur = commit.
 * - Textarea with field-sizing:content auto-sizes without layout shift.
 */
export function InlineEdit({
  value,
  onCommit,
  placeholder = "Click to edit…",
  className,
  inputClassName,
  disabled = false,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when external value changes while not editing
  /* eslint-disable react-hooks/set-state-in-effect -- intentional prop-to-state sync */
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    } else {
      setDraft(value); // revert if empty or unchanged
    }
    setEditing(false);
  }, [draft, value, onCommit]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
    },
    [commit, cancel],
  );

  if (disabled) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {value || placeholder}
      </span>
    );
  }

  // Shared sizing classes for zero layout shift between read/edit modes
  const sharedSizing =
    "rounded px-1 -mx-1 py-0.5 text-sm leading-5 min-h-[1.5rem]";

  if (editing) {
    return (
      <Textarea
        ref={inputRef as React.Ref<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          sharedSizing,
          "block w-full resize-none border-0 bg-muted/30 shadow-none ring-1 ring-ring focus-visible:ring-2 field-sizing-content",
          inputClassName,
        )}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={cn(
        sharedSizing,
        "inline-block cursor-text transition-colors",
        "hover:bg-muted/50",
        "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
        !value && "text-muted-foreground italic",
        className,
      )}
    >
      {value || placeholder}
    </span>
  );
}
