import type { Page } from "@playwright/test";

// Fixed synthetic-review scopes only. Return numeric colors/structure, never
// DOM text, HTML, identifiers, URLs, entered values or request credentials.
export async function collectSolidTextSamples(
  page: Page,
  scope: "growth" | "reviewer-queue",
) {
  return await page
    .locator(
      scope === "growth"
        ? "svg.growth-chart text, .table-scroll th, .table-scroll td, .table-scroll a"
        : ".table-scroll th, .table-scroll td, .table-scroll strong, .table-scroll a",
    )
    .evaluateAll((elements) => {
      const rgba = (value: string): [number, number, number, number] | null => {
        const match = value.match(
          /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
        );
        if (!match) return null;
        const result = [
          Number(match[1]),
          Number(match[2]),
          Number(match[3]),
          match[4] === undefined ? 1 : Number(match[4]),
        ] as [number, number, number, number];
        return result.every(Number.isFinite) &&
          result
            .slice(0, 3)
            .every((channel) => channel >= 0 && channel <= 255) &&
          result[3] >= 0 &&
          result[3] <= 1
          ? result
          : null;
      };
      return elements.map((element) => {
        const style = getComputedStyle(element);
        const svg = element.tagName.toLowerCase() === "text";
        const foreground = rgba(svg ? style.fill : style.color);
        let background: [number, number, number, number] | null = null;
        let unsupported =
          !foreground ||
          foreground[3] !== 1 ||
          (svg && Number(style.fillOpacity) !== 1);
        for (
          let ancestor: Element | null = element;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const current = getComputedStyle(ancestor);
          if (
            Number(current.opacity) !== 1 ||
            current.filter !== "none" ||
            current.mixBlendMode !== "normal" ||
            current.textShadow !== "none"
          )
            unsupported = true;
          if (!background) {
            if (current.backgroundImage !== "none") unsupported = true;
            const color = rgba(current.backgroundColor);
            if (!color || (color[3] !== 0 && color[3] !== 1))
              unsupported = true;
            if (color?.[3] === 1) background = color;
          }
        }
        if (!background) unsupported = true;
        const bounds = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          foreground: foreground?.slice(0, 3) ?? null,
          background: background?.slice(0, 3) ?? null,
          has_box: bounds.width > 0 && bounds.height > 0,
          unsupported,
        };
      });
    });
}
