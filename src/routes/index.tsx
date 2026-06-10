import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GSolutions — Software sob medida" },
      { name: "description", content: "GSolutions — Software sob medida, do briefing ao deploy em semanas." },
      { property: "og:title", content: "GSolutions — Software sob medida" },
      { property: "og:description", content: "Software sob medida, do briefing ao deploy em semanas." },
    ],
  }),
  component: Index,
});

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const spot = document.getElementById("spotlight");
    if (!spot) return;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let rafId: number | null = null;

    function animate() {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      spot!.style.setProperty("--mx", currentX + "px");
      spot!.style.setProperty("--my", currentY + "px");
      if (Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
        rafId = requestAnimationFrame(animate);
      } else {
        rafId = null;
      }
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      targetX = e.clientX;
      targetY = e.clientY;
      spot.classList.add("is-active");
      if (!rafId) rafId = requestAnimationFrame(animate);
    };
    const onLeave = () => spot.classList.remove("is-active");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <div className="spotlight" id="spotlight" aria-hidden="true"></div>

      <header className="nav">
        <div className="container nav-inner">
          <a href="#" className="brand">
            <span className="brand-mark">✦</span>
            <span className="brand-name">GSolutions</span>
          </a>
          <nav className="nav-links" aria-label="Principal">
            <a href="#produto">Produto</a>
            <a href="#como">Como funciona</a>
            <a href="#cases">Cases</a>
          </nav>
          <div className="nav-actions">
            <a href="#cta" className="btn btn-ghost">Começar →</a>
            <button
              className={"nav-toggle" + (menuOpen ? " is-open" : "")}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
        <div className="nav-mobile" hidden={!menuOpen}>
          <a href="#produto" onClick={closeMenu}>Produto</a>
          <a href="#como" onClick={closeMenu}>Como funciona</a>
          <a href="#cases" onClick={closeMenu}>Cases</a>
          <a href="#cta" className="btn btn-primary" onClick={closeMenu}>Começar →</a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-glow hero-glow-1" aria-hidden="true"></div>
        <div className="hero-glow hero-glow-2" aria-hidden="true"></div>
        <div className="container hero-inner">
          <div className="hero-text">
            <span className="pill">
              <span className="pill-dot"></span>
              software sob medida · em semanas
            </span>
            <h1 className="hero-title">
              Seu problema<br />
              vira <em className="grad-text">software</em><br />
              antes do próximo trimestre.
            </h1>
            <p className="hero-sub">
              Esquece template e SaaS engessado. A gente escuta sua operação,
              monta um squad enxuto, e entrega um software <i>seu</i> — pensado
              pro seu fluxo, conectado às suas ferramentas.
            </p>
            <div className="hero-ctas">
              <a href="#cta" className="btn btn-primary">Pedir um orçamento →</a>
              <a href="#cases" className="btn btn-secondary">▶ Ver demo (2 min)</a>
            </div>
            <div className="hero-social">
              <div className="avatars">
                <span></span><span></span><span></span><span></span>
              </div>
              <span className="hero-social-text">+127 empresas atendidas</span>
              <span className="hero-social-divider"></span>
              <span className="hero-social-text">4.9/5 satisfação</span>
            </div>
          </div>
          <div className="hero-cards" aria-hidden="true">
            <div className="float-card card-sprint">
              <div className="card-row">
                <span className="check-badge">✓</span>
                <strong>Sprint 3 entregue</strong>
              </div>
              <p>Módulo de relatórios + integração Bling prontos pra teste.</p>
              <div className="progress"><div className="progress-bar"></div></div>
              <small>78% do projeto</small>
            </div>
            <div className="float-card card-brief">
              <div className="mono-tag">// briefing.md</div>
              <p className="quote">"Preciso de um portal pros 80 representantes verem comissão em tempo real"</p>
              <span className="status-chip">EM ESCOPO</span>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="como">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="pill"><span className="pill-dot"></span>como a gente trabalha</span>
              <h2>Rápido, claro,<br />seu desde o dia 1.</h2>
            </div>
            <p className="section-lead">
              Sem contratos de 18 meses. Sem agência que some. O processo
              é desenhado pra você sentir progresso toda semana.
            </p>
          </div>
          <div className="feature-grid">
            {[
              ["01", "Briefing relâmpago", "Uma call de 45 min. Você fala, a gente desenha o escopo na tela junto."],
              ["02", "Proposta em 72h", "Preço fechado, prazo fechado, marcos fechados. Sem surpresa no caminho."],
              ["03", "Sprints semanais", "Toda sexta uma versão rodando. Você testa, dá feedback, ajustamos."],
              ["04", "Tudo seu", "Repositório seu. Infra na sua conta. Documentação completa. Nada de lock-in."],
              ["05", "Suporte 30 dias", "A gente fica de plantão pra bugs e ajustes pós-entrega. Sem cobrar extra."],
              ["06", "Evolução contínua", "Quer continuar evoluindo? Pacote mensal opcional. Quer só usar? Beleza também."],
            ].map(([n, t, d]) => (
              <article className="feature-card" key={n}>
                <span className="feature-num">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="case" id="cases">
        <div className="container">
          <div className="case-card">
            <div className="case-glow case-glow-1" aria-hidden="true"></div>
            <div className="case-glow case-glow-2" aria-hidden="true"></div>
            <div className="case-content">
              <span className="pill pill-on-dark">
                <span className="pill-dot pill-dot-pink"></span>
                case · 2026
              </span>
              <h2 className="case-quote">
                "De 14 planilhas pra 1 sistema.<br />
                Em 5 semanas, custo de um SaaS gringo<br className="hide-mobile" />
                de 6 meses."
              </h2>
              <div className="case-author">
                <div className="case-avatar"></div>
                <div>
                  <strong>Marina Tavares</strong>
                  <small>COO, Distribuidora regional · 80 colaboradores</small>
                </div>
              </div>
              <div className="metrics">
                {[
                  ["5 sem", "do briefing ao go-live"],
                  ["−72%", "tempo de fechamento"],
                  ["R$ 0", "mensalidade de SaaS"],
                  ["100%", "do código é deles"],
                ].map(([n, l]) => (
                  <div className="metric" key={l}>
                    <span className="metric-num">{n}</span>
                    <span className="metric-label">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta" id="cta">
        <div className="cta-glow" aria-hidden="true"></div>
        <div className="container cta-inner">
          <span className="pill"><span className="pill-dot"></span>vamos começar?</span>
          <h2 className="cta-title">
            Conta sua dor.<br />
            A gente devolve em <em className="grad-text">código.</em>
          </h2>
          <p className="cta-sub">
            45 minutos de conversa. Zero compromisso.<br className="show-mobile" />
            Você sai da call sabendo se faz sentido.
          </p>
          <Link to="/briefing" className="btn btn-primary btn-large">Agendar minha call →</Link>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <div className="footer-brand">✦ GSolutions</div>
            <p>Seu software do jeito que você sempre pensou.</p>
          </div>
          <div className="footer-links">
            <a href="mailto:contato@gsolutions.com">contato@gsolutions.com</a>
            <span>Brasil</span>
            <span>© 2026</span>
          </div>
        </div>
      </footer>
    </>
  );
}
