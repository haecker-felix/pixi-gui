import type * as React from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function Input({
  className,
  type,
  label,
  placeholder,
  required,
  suffix,
  ...props
}: React.ComponentProps<"input"> & { label?: string; suffix?: ReactNode }) {
  if (label) {
    return (
      <div className={cn("relative", className)}>
        <input
          type={type}
          data-slot="input"
          placeholder={placeholder || " "}
          required={required}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          className={cn(
            "peer h-16 w-full rounded-2xl border px-3.5 pt-4 font-body text-pfxl-text transition duration-300 ease-out  dark:text-pfxd-text",
            placeholder
              ? "placeholder:text-pfxgsl-400 dark:placeholder:text-pfxgsl-400"
              : "placeholder:text-transparent",
            "focus:outline-none focus:ring-0",
            "border-pfxl-card-border bg-white hover:border-pfx-primary-alt focus:border-pfx-primary-alt dark:border-pfxd-card-border dark:bg-pfxgsd-700 dark:focus:border-pfx-primary-alt dark:hover:border-pfx-primary-alt",
            suffix && "pr-12",
          )}
          {...props}
        />
        <label
          data-slot="label"
          className={cn(
            "absolute left-4 pointer-events-none text-sm font-medium text-pfxgsl-400 transition-all duration-100",
            placeholder
              ? "top-2 text-xs"
              : "peer-placeholder-shown:top-5 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs  peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs",
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {suffix && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
      </div>
    );
  }
  return (
    <input
      type={type}
      data-slot="input"
      placeholder={placeholder}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck="false"
      className={cn(
        "h-16 w-full rounded-2xl border px-4 font-body text-pfxl-text transition duration-300 ease-out placeholder:text-pfxgsl-400 dark:text-pfxd-text dark:placeholder:text-pfxgsl-400",
        "focus:outline-none focus:ring-0",
        "border-pfxl-card-border bg-white hover:border-pfx-primary-alt focus:border-pfx-primary-alt dark:border-pfxd-card-border dark:bg-pfxgsd-700 dark:focus:border-pfx-primary-alt dark:hover:border-pfx-primary-alt",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
