"use client";

import { useEffect, useState } from "react";

const links = [
  ["Work", "#work"],
  ["Services", "#services"],
  ["About", "#about"],
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="shell header-inner">
        <a href="#top" className="brand" aria-label="Akash Das, back to top">
          <span className="brand-name">Akash Das</span>
          <span className="brand-role">Software Engineer</span>
        </a>

        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span className="menu-icon" aria-hidden="true">
            <span />
            <span />
          </span>
        </button>

        <nav
          id="primary-navigation"
          className={`nav ${open ? "is-open" : ""}`}
          aria-label="Primary navigation"
        >
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <a className="nav-cta" href="#contact" onClick={() => setOpen(false)}>
            Start a Conversation
          </a>
        </nav>
      </div>
    </header>
  );
}
