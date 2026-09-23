"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "./input";

type NumberInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "defaultValue" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
};

// Keep the text being edited separate from the numeric value used by the form.
// In particular, Number("") is 0, but the input should stay empty while editing.
export function NumberInput({ value, onValueChange, onBlur, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      {...props}
      type="number"
      value={draft ?? value}
      onChange={event => {
        const text = event.target.value;
        setDraft(text);
        onValueChange(Number(text));
      }}
      onBlur={event => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}