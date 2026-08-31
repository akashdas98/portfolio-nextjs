import type { Metadata } from "next";

import { CircuitUnderlay } from "@/components/CircuitUnderlay";
import { ContactForm } from "@/components/ContactForm";
import { Header } from "@/components/Header";
import { ProjectCard } from "@/components/ProjectCard";
import { PublicCircuitBackground } from "@/components/PublicCircuitBackground";
import { getPublicProjects } from "@/lib/admin/data";
import { services } from "@/lib/content";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const principles = [
  "Clarity before development",
  "Design for real users",
  "Keep systems maintainable",
  "Communicate clearly",
  "Deliver incrementally",
  "Support what ships",
];

const capabilities = [
  ["Backend", "Node.js, TypeScript, NestJS, REST, GraphQL, microservices"],
  ["Data & integrations", "MongoDB, PostgreSQL, Redis, RabbitMQ, Firebase, Shopify"],
  ["Cloud & delivery", "AWS EKS, Kubernetes, Docker, Jenkins, CI/CD, SigNoz, GCP"],
  ["Frontend", "React, Next.js, React Native, Capacitor, Material UI"],
];

export default async function Home() {
  const projects = await getPublicProjects();

  return (
    <>
      <Header />
      <main
        id="top"
        className="public-circuit-page"
        data-public-animations
        data-public-circuit
      >
        <PublicCircuitBackground
          imageUrl="/pcb-backgrounds/home.svg"
          lensImageUrl="/pcb-backgrounds/home-lens.svg"
          sourceWidth={2400}
          sourceHeight={12082.5}
        />
        <section className="hero shell circuit-exposed-section">
          <p className="eyebrow reveal">
            <CircuitUnderlay size="compact">
              Senior Software Engineer · Full-Stack Web Development
            </CircuitUnderlay>
          </p>
          <h1 className="reveal">
            <CircuitUnderlay size="heading">
              Clean, reliable web products built end to end.
            </CircuitUnderlay>
          </h1>
          <div className="hero-lower reveal">
            <p className="hero-copy">
              <CircuitUnderlay>
                Websites and applications shaped around real business needs, clear
                user experiences, and dependable technical foundations.
              </CircuitUnderlay>
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contact">
                Discuss Your Project
              </a>
              <a className="button button-secondary" href="#work">
                View Selected Work
              </a>
            </div>
          </div>
          <div
            className="proof-strip reveal"
            aria-label="Professional overview"
          >
            <span>
              <CircuitUnderlay size="compact">
                <strong>6 years</strong> professional experience
              </CircuitUnderlay>
            </span>
            <span>
              <CircuitUnderlay size="compact">
                <strong>Full-stack</strong> product delivery
              </CircuitUnderlay>
            </span>
            <span>
              <CircuitUnderlay size="compact">
                <strong>Millions</strong> of production requests
              </CircuitUnderlay>
            </span>
            <span>
              <CircuitUnderlay size="compact">
                <strong>Kolkata</strong> India
              </CircuitUnderlay>
            </span>
          </div>
        </section>

        <section id="work" className="section selected-work-section">
          <div className="shell">
            <div className="section-heading reveal">
              <p className="eyebrow">
                <CircuitUnderlay size="compact">Selected work</CircuitUnderlay>
              </p>
              <h2>
                <CircuitUnderlay size="heading">
                  Systems built around outcomes, not theatre.
                </CircuitUnderlay>
              </h2>
            </div>
            <div className="project-list">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>

        <section id="services" className="section shell circuit-exposed-section">
          <div className="section-heading split-heading reveal">
            <div>
              <p className="eyebrow">
                <CircuitUnderlay size="compact">Services</CircuitUnderlay>
              </p>
              <h2>
                <CircuitUnderlay size="heading">
                  Clear on the surface. Dependable underneath.
                </CircuitUnderlay>
              </h2>
            </div>
            <p>
              <CircuitUnderlay>
                One technical partner across planning, interface design,
                development, deployment, and continued support.
              </CircuitUnderlay>
            </p>
          </div>
          <div className="service-list">
            {services.map((service) => (
              <article className="service-row reveal" key={service.number}>
                <span className="service-number">
                  <CircuitUnderlay size="compact">{service.number}</CircuitUnderlay>
                </span>
                <div>
                  <h3><CircuitUnderlay size="heading">{service.title}</CircuitUnderlay></h3>
                  <p className="service-headline"><CircuitUnderlay>{service.headline}</CircuitUnderlay></p>
                </div>
                <div>
                  <p><CircuitUnderlay>{service.copy}</CircuitUnderlay></p>
                  <ul>
                    {service.items.map((item) => (
                      <li key={item}><CircuitUnderlay>{item}</CircuitUnderlay></li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="section about-section">
          <div className="shell about-grid reveal">
            <div className="about-heading">
              <p className="eyebrow"><CircuitUnderlay size="compact">About</CircuitUnderlay></p>
              <h2><CircuitUnderlay size="heading">Engineering depth. Product-level ownership.</CircuitUnderlay></h2>
            </div>
            <div className="about-copy">
              <p>
                <CircuitUnderlay>
                  Six years of experience across ecommerce, healthcare, mobile
                  applications, distributed systems, and integration-heavy
                  platforms.
                </CircuitUnderlay>
              </p>
              <p>
                <CircuitUnderlay>
                  The work spans interface implementation, backend architecture,
                  databases, cloud infrastructure, deployment, and production
                  maintenance.
                </CircuitUnderlay>
              </p>
              <p>
                <CircuitUnderlay>
                  That breadth creates fewer hand-offs, stronger technical
                  continuity, and decisions made with the whole product in view.
                </CircuitUnderlay>
              </p>
            </div>
          </div>
          <div className="shell principles reveal">
            {principles.map((principle, index) => (
              <div key={principle}>
                <span><CircuitUnderlay size="compact">0{index + 1}</CircuitUnderlay></span>
                <p><CircuitUnderlay>{principle}</CircuitUnderlay></p>
              </div>
            ))}
          </div>
        </section>

        <section className="section shell capabilities-section circuit-exposed-section">
          <div className="section-heading reveal">
            <p className="eyebrow"><CircuitUnderlay size="compact">Technical foundation</CircuitUnderlay></p>
            <h2><CircuitUnderlay size="heading">Tools in service of the product.</CircuitUnderlay></h2>
          </div>
          <div className="capability-list reveal">
            {capabilities.map(([title, text]) => (
              <div key={title}>
                <h3><CircuitUnderlay size="heading">{title}</CircuitUnderlay></h3>
                <p><CircuitUnderlay>{text}</CircuitUnderlay></p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="section contact-section">
          <div className="shell contact-grid">
            <div className="contact-intro reveal">
              <p className="eyebrow"><CircuitUnderlay size="compact">Contact</CircuitUnderlay></p>
              <h2><CircuitUnderlay size="heading">Bring the project into focus.</CircuitUnderlay></h2>
              <p>
                <CircuitUnderlay>
                  New product, existing system, or long-term technical support—the
                  starting point is a clear understanding of what needs to move
                  forward.
                </CircuitUnderlay>
              </p>
              <div className="direct-links">
                <a href="mailto:akash42662012@gmail.com">
                  <CircuitUnderlay size="compact">akash42662012@gmail.com</CircuitUnderlay>
                </a>
                <a
                  href="https://linkedin.com/in/akash291298"
                  target="_blank"
                  rel="noreferrer"
                >
                  <CircuitUnderlay size="compact">LinkedIn ↗</CircuitUnderlay>
                </a>
              </div>
            </div>
            <div className="reveal">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <p>Akash Das · Senior Software Engineer</p>
          <p>Built with Next.js. Designed with restraint.</p>
        </div>
      </footer>
    </>
  );
}
