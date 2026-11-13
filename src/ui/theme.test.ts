import { describe, expect, it } from "vitest";
import { CONTRAST_PAIRS, THEMES, THEME_NAMES, contrastRatio } from "./theme";

describe("contraste AA dos temas", () => {
  for (const theme of THEME_NAMES) {
    it.each(CONTRAST_PAIRS)(`${theme}: %s sobre %s ≥ 4,5:1`, (fg, bg) => {
      expect(contrastRatio(THEMES[theme][fg], THEMES[theme][bg])).toBeGreaterThanOrEqual(4.5);
    });
  }
});
