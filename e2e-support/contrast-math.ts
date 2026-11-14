export type RGB = readonly [number, number, number];

// WCAG 2.2 sRGB relative luminance and contrast ratio. Compare before rounding.
// https://www.w3.org/WAI/WCAG22/Understanding/relative-luminance.html
export function contrastRatio(foreground: RGB, background: RGB): number {
  function luminance(channels: RGB) {
    if (
      channels.length !== 3 ||
      channels.some(
        (value) => !Number.isFinite(value) || value < 0 || value > 255,
      )
    )
      throw new Error(
        "Three finite sRGB channels between 0 and 255 are required.",
      );
    const linear = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
