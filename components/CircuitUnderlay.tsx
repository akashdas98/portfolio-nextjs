import { Children, isValidElement, type ReactNode } from "react";

type CircuitUnderlayProps = {
  children: ReactNode;
  className?: string;
  size?: "compact" | "body" | "heading";
};

function getUnderlayText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return getUnderlayText(child.props.children);
      }

      return "";
    })
    .join("");
}

export function CircuitUnderlay({
  children,
  className,
  size = "body",
}: CircuitUnderlayProps) {
  const underlayText = getUnderlayText(children);

  return (
    <span
      className={["circuit-text-underlay", className].filter(Boolean).join(" ")}
      data-circuit-underlay={size}
    >
      <span className="circuit-text-underlay-shadow" aria-hidden="true" inert>
        <span
          className="circuit-text-underlay-shadow-shape"
          data-circuit-shadow={underlayText}
        />
      </span>
      <span className="circuit-text-underlay-content">{children}</span>
    </span>
  );
}
