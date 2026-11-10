export type ToneRange = {
  bottom: number;
  top: number;
};

export const MUTED_SECTION_SELECTOR = ".case-section-muted, .selected-work-section, .about-section, .contact-section";
export const IMPACT_SECTION_SELECTOR = ".case-impact-section";
export const SPECIAL_IMPACT_SECTION_SELECTOR = '[data-circuit-impact-palette="dark-blue-pink"]';

export function sectionRanges(
  page: HTMLElement,
  pageDocumentTop: number,
  selector: string,
) {
  return Array.from(page.querySelectorAll<HTMLElement>(":scope > section"))
    .filter((section) => section.matches(selector))
    .map((section) => {
      const rect = section.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY - pageDocumentTop,
        bottom: rect.bottom + window.scrollY - pageDocumentTop,
      };
    });
}
