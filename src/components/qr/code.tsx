"use client";
import { useId, useMemo } from "react";
import { qrSymbol } from "@/lib/qr/symbol";
export function QrCode({ value, label }: { value: string; label: string }) {
  const id = useId();
  const symbol = useMemo(() => qrSymbol(value), [value]);
  return (
    <figure className="qr-code">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby={id}
        viewBox={`0 0 ${symbol.size} ${symbol.size}`}
        width="240"
        height="240"
        shapeRendering="crispEdges"
      >
        <title id={id}>{label}</title>
        <rect width={symbol.size} height={symbol.size} fill="#fff" />
        <path d={symbol.path} fill="#000" />
      </svg>
      <figcaption className="fine">{label}</figcaption>
    </figure>
  );
}
