import { ImageResponse } from "next/og";

export const alt =
  "Akash Das — Senior Software Engineer. Clean, reliable web products built end to end.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function BrandMark() {
  return (
    <svg width="132" height="132" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#0a0d10" />
      <path d="M3 3h58v58H3z" fill="none" stroke="#28343d" strokeWidth="2" />
      <path
        d="M11 49 24 15l13 34M16 37h16"
        fill="none"
        stroke="#9ed8f2"
        strokeWidth="6"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M38 16h6c8 0 11 6 11 16s-3 16-11 16h-6V16Z"
        fill="none"
        stroke="#eef3f6"
        strokeWidth="6"
        strokeLinejoin="miter"
      />
      <path d="M52 49h6v6h-6z" fill="#f37fbf" />
    </svg>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#0a0d10",
        color: "#eef3f6",
        fontFamily: "Segoe UI, Arial, sans-serif",
        border: "2px solid #28343d",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <BrandMark />
        <div
          style={{
            display: "flex",
            color: "#9ed8f2",
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Senior Software Engineer
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            maxWidth: 940,
            fontSize: 78,
            lineHeight: 0.98,
            letterSpacing: "-0.055em",
            fontWeight: 600,
          }}
        >
          Clean, reliable web products built end to end.
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 38,
            paddingTop: 24,
            borderTop: "2px solid #28343d",
            color: "#9aa8b2",
            fontSize: 24,
          }}
        >
          <span>Akash Das</span>
          <span style={{ color: "#eef3f6" }}>Full-stack delivery · Kolkata, India</span>
        </div>
      </div>
    </div>,
    size,
  );
}
