import type { CSSProperties, ReactNode } from "react";

type ProjectVisitButtonProps = {
  href: string;
  children: ReactNode;
  borderWidth?: number;
  className?: string;
};

type ProjectVisitButtonStyle = CSSProperties & {
  "--visit-border-width": string;
  "--visit-inner-edge": string;
  "--visit-inner-notch": string;
  "--visit-inner-tip": string;
  "--visit-inner-point": string;
};

const OUTER_NOTCH = 12;
const OUTER_TIP = 15;
const OUTER_LEFT_SLOPE = OUTER_NOTCH / 20;
const OUTER_RIGHT_SLOPE = OUTER_TIP / 20;

function projectVisitButtonStyle(borderWidth: number): ProjectVisitButtonStyle {
  const width = Math.max(1, borderWidth);
  const offset = width * 1.25;

  return {
    "--visit-border-width": `${width}px`,
    "--visit-inner-edge": `${offset + width * OUTER_LEFT_SLOPE}px`,
    "--visit-inner-notch": `${OUTER_NOTCH + offset}px`,
    "--visit-inner-tip": `${OUTER_TIP + offset - width * OUTER_RIGHT_SLOPE}px`,
    "--visit-inner-point": `${offset}px`,
  };
}

export function ProjectVisitButton({
  href,
  children,
  borderWidth = 4,
  className = "",
}: ProjectVisitButtonProps) {
  return (
    <a
      className={["project-visit", className].filter(Boolean).join(" ")}
      href={href}
      target="_blank"
      rel="noreferrer"
      style={projectVisitButtonStyle(borderWidth)}
    >
      <span>{children}</span>
    </a>
  );
}
