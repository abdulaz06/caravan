"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog (save as PDF from there). Hidden on paper. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-paper print:hidden"
    >
      <Printer className="size-4" /> Print or save as PDF
    </button>
  );
}
