import { ContactForm } from "@/components/ContactForm";
import { Header } from "@/components/Header";
import { ProjectCard } from "@/components/ProjectCard";
import { projects, services } from "@/lib/content";

const principles = [
  "Understand before building",
  "Design for real users",
  "Keep systems maintainable",
  "Communicate clearly",
  "Deliver incrementally",
  "Support what ships",
];

const capabilities = [
  ["Frontend", "React, Next.js, React Native, Capacitor, Material UI"],
  ["Backend", "Node.js, TypeScript, NestJS, REST, GraphQL, microservices"],
  ["Data & integrations", "MongoDB, PostgreSQL, Redis, RabbitMQ, Firebase, Shopify"],
  ["Cloud & delivery", "AWS EKS, Kubernetes, Docker, Jenkins, CI/CD, SigNoz, GCP"],
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="top">
        <section className="hero shell">
          <p className="eyebrow reveal">Senior Software Engineer · Full-Stack Web Development</p>
          <h1 className="reveal">Clean, reliable web products built end to end.</h1>
          <div className="hero-lower reveal">
            <p className="hero-copy">
              Websites and applications shaped around real business needs, clear user experiences, and dependable technical foundations.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contact">Discuss your project</a>
              <a className="button button-secondary" href="#work">View selected work</a>
            </div>
          </div>
          <div className="proof-strip reveal" aria-label="Professional overview">
            <span><strong>6 years</strong> professional experience</span>
            <span><strong>Full-stack</strong> product delivery</span>
            <span><strong>Millions</strong> of production requests</span>
            <span><strong>Kolkata</strong> India</span>
          </div>
        </section>

        <section id="work" className="section shell">
          <div className="section-heading reveal">
            <p className="eyebrow">Selected work</p>
            <h2>Systems built around outcomes, not theatre.</h2>
          </div>
          <div className="project-list">
            {projects.map((project) => <ProjectCard key={project.index} project={project} />)}
          </div>
        </section>

        <section className="impact section">
          <div className="shell impact-grid reveal">
            <div>
              <p className="eyebrow">Additional impact</p>
              <h2>Customer communication rebuilt around the full order journey.</h2>
            </div>
            <div className="impact-copy">
              <p>A reusable scheduling foundation supported notifications across placement, processing, dispatch, delivery, cancellation, and return workflows.</p>
              <dl className="impact-metrics">
                <div><dt>35%</dt><dd>reduction in support calls</dd></div>
                <div><dt>₹3 crore</dt><dd>annual support-cost savings</dd></div>
                <div><dt>30+</dt><dd>new notifications introduced</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section id="services" className="section shell">
          <div className="section-heading split-heading reveal">
            <div>
              <p className="eyebrow">Services</p>
              <h2>Clear on the surface. Dependable underneath.</h2>
            </div>
            <p>One technical partner across planning, interface design, development, deployment, and continued support.</p>
          </div>
          <div className="service-list">
            {services.map((service) => (
              <article className="service-row reveal" key={service.number}>
                <span className="service-number">{service.number}</span>
                <div>
                  <h3>{service.title}</h3>
                  <p className="service-headline">{service.headline}</p>
                </div>
                <div>
                  <p>{service.copy}</p>
                  <ul>{service.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="section about-section">
          <div className="shell about-grid reveal">
            <div>
              <p className="eyebrow">About</p>
              <h2>Engineering depth. Product-level ownership.</h2>
            </div>
            <div className="about-copy">
              <p>Six years of experience across ecommerce, healthcare, mobile applications, distributed systems, and integration-heavy platforms.</p>
              <p>The work spans interface implementation, backend architecture, databases, cloud infrastructure, deployment, and production maintenance.</p>
              <p>That breadth creates fewer hand-offs, stronger technical continuity, and decisions made with the whole product in view.</p>
            </div>
          </div>
          <div className="shell principles reveal">
            {principles.map((principle, index) => (
              <div key={principle}><span>0{index + 1}</span><p>{principle}</p></div>
            ))}
          </div>
        </section>

        <section className="section shell capabilities-section">
          <div className="section-heading reveal">
            <p className="eyebrow">Technical foundation</p>
            <h2>Tools in service of the product.</h2>
          </div>
          <div className="capability-list reveal">
            {capabilities.map(([title, text]) => (
              <div key={title}><h3>{title}</h3><p>{text}</p></div>
            ))}
          </div>
        </section>

        <section id="contact" className="section contact-section">
          <div className="shell contact-grid">
            <div className="contact-intro reveal">
              <p className="eyebrow">Contact</p>
              <h2>Bring the project into focus.</h2>
              <p>New product, existing system, or long-term technical support—the starting point is a clear understanding of what needs to move forward.</p>
              <div className="direct-links">
                <a href="mailto:akash42662012@gmail.com">akash42662012@gmail.com</a>
                <a href="https://linkedin.com/in/akash291298" target="_blank" rel="noreferrer">LinkedIn ↗</a>
              </div>
            </div>
            <div className="reveal"><ContactForm /></div>
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
