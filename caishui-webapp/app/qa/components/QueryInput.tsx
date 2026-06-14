"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { textareaClassName } from "@/components/ui/FormField";
import { cn } from "@/lib/utils/cn";

export function QueryInput({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (question: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const q = value.trim();
    if (!q || disabled) return;
    onSend(q);
    setValue("");
  };

  return (
    <form
      className="flex flex-col gap-3 border-t border-[color:var(--cs-divider)] bg-white/[0.72] p-4 md:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        className={cn(textareaClassName, "min-h-20 flex-1 resize-none leading-6")}
        rows={2}
        placeholder="输入财税问题，例如：小规模纳税人增值税起征点是多少？"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button
        type="submit"
        variant="primary"
        className="min-h-11 px-5 md:self-end"
        disabled={disabled}
      >
        发送
      </Button>
    </form>
  );
}
