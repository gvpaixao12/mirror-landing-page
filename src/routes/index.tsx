import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProductLab — Software sob medida" },
      {
        name: "description",
        content: "ProductLab — Software sob medida, do briefing ao deploy em semanas.",
      },
      { property: "og:title", content: "ProductLab — Software sob medida" },
      {
        property: "og:description",
        content: "Software sob medida, do briefing ao deploy em semanas.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const playVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play();
    setVideoPlaying(true);
  };

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
            <span className="brand-mark" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient
                    id="plOrbitGrad"
                    x1="6"
                    y1="6"
                    x2="58"
                    y2="58"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0" stopColor="#A855F7" />
                    <stop offset="0.5" stopColor="#D14FBF" />
                    <stop offset="1" stopColor="#EC4899" />
                  </linearGradient>
                </defs>
                <circle
                  cx="32"
                  cy="32"
                  r="19"
                  fill="none"
                  stroke="url(#plOrbitGrad)"
                  strokeWidth="4.5"
                  opacity="0.45"
                />
                <circle cx="32" cy="32" r="6.5" fill="url(#plOrbitGrad)" />
                <g>
                  <circle cx="32" cy="13" r="5.5" fill="url(#plOrbitGrad)" />
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 32 32"
                    to="360 32 32"
                    dur="7s"
                    repeatCount="indefinite"
                  />
                </g>
              </svg>
            </span>
            <span className="brand-name">ProductLab</span>
          </a>
          <nav className="nav-links" aria-label="Principal">
            <a href="#produto">Produto</a>
            <a href="#como">Como funciona</a>
            <a href="#cases">Cases</a>
          </nav>
          <div className="nav-actions">
            <button
              className={"nav-toggle" + (menuOpen ? " is-open" : "")}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
        <div className="nav-mobile" hidden={!menuOpen}>
          <a href="#produto" onClick={closeMenu}>
            Produto
          </a>
          <a href="#como" onClick={closeMenu}>
            Como funciona
          </a>
          <a href="#cases" onClick={closeMenu}>
            Cases
          </a>
          <a href="#cta" className="btn btn-primary" onClick={closeMenu}>
            Começar →
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-glow hero-glow-1" aria-hidden="true"></div>
        <div className="hero-glow hero-glow-2" aria-hidden="true"></div>
        <div className="container hero-inner">
          <div className="hero-text">
            <span className="pill">
              <span className="pill-dot"></span>
              PRODUTO · SOFTWARE SOB MEDIDA
            </span>
            <h1 className="hero-title">
              Seu problema
              <br />
              vira <em className="grad-text">software</em>
              <br />
              antes do próximo trimestre.
            </h1>
            <p className="hero-sub">
              Esquece template e SaaS engessado. A gente escuta sua operação, monta um squad enxuto,
              e entrega um software <i>seu</i> — pensado pro seu fluxo, conectado às suas
              ferramentas.
            </p>
            <div className="hero-video-wrap">
              <div className="hero-video-frame">
                <video
                  ref={videoRef}
                  className="hero-video"
                  src="/site-video.mp4"
                  playsInline
                  preload="metadata"
                  controls={videoPlaying}
                  onEnded={() => setVideoPlaying(false)}
                />
                {!videoPlaying && (
                  <button
                    type="button"
                    className="hero-video-cover"
                    onClick={playVideo}
                    aria-label="Reproduzir vídeo"
                  >
                    <span className="hero-video-logo" aria-hidden="true">
                      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                        <defs>
                          <linearGradient
                            id="plVideoGrad"
                            x1="6"
                            y1="6"
                            x2="58"
                            y2="58"
                            gradientUnits="userSpaceOnUse"
                          >
                            <stop offset="0" stopColor="#A855F7" />
                            <stop offset="0.5" stopColor="#D14FBF" />
                            <stop offset="1" stopColor="#EC4899" />
                          </linearGradient>
                        </defs>
                        <circle
                          cx="32"
                          cy="32"
                          r="19"
                          fill="none"
                          stroke="url(#plVideoGrad)"
                          strokeWidth="4.5"
                          opacity="0.45"
                        />
                        <circle cx="32" cy="32" r="6.5" fill="url(#plVideoGrad)" />
                        <circle cx="32" cy="13" r="5.5" fill="url(#plVideoGrad)" />
                      </svg>
                    </span>
                    <span className="hero-video-brand grad-text">ProductLab</span>
                    <span className="hero-video-play" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M8 5.5v13l11-6.5L8 5.5z" fill="#fff" />
                      </svg>
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="hero-cards" aria-hidden="true">
            <div className="float-card card-sprint">
              <div className="card-row">
                <span className="check-badge">✓</span>
                <strong>Sprint 3 entregue</strong>
              </div>
              <p>Módulo de relatórios + integração Bling prontos pra teste.</p>
              <div className="progress">
                <div className="progress-bar"></div>
              </div>
              <small>78% do projeto</small>
            </div>
            <div className="float-card card-brief">
              <div className="mono-tag">// briefing.md</div>
              <p className="quote">
                "Preciso de um portal pros 80 representantes verem comissão em tempo real"
              </p>
              <span className="status-chip">EM ESCOPO</span>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="como">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="pill">
                <span className="pill-dot"></span>COMO FUNCIONA
              </span>
              <h2>
                Rápido, claro,
                <br />
                seu desde o dia 1.
              </h2>
            </div>
            <p className="section-lead">
              Sem contratos periódicos. O processo é desenhado pra você sentir progresso rápido.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                "01",
                "Briefing relâmpago",
                "Preencha sua ideia em nosso formulário. Fale com um agente e desenhamos o escopo na tela junto.",
              ],
              [
                "02",
                "Proposta em 72h",
                "Preço fechado, prazo fechado, marcos fechados. Sem surpresa no caminho.",
              ],
              [
                "03",
                "Sprints semanais",
                "Toda sexta uma versão rodando. Você testa, dá feedback, ajustamos.",
              ],
              [
                "04",
                "Tudo seu",
                "Repositório seu. Infra na sua conta. Documentação completa. Nada de lock-in.",
              ],
              ["05", "Suporte", "A gente fica à disposição para atender bugs e realizar ajustes."],
              [
                "06",
                "Evolução contínua",
                "Quer continuar evoluindo? Pacote mensal opcional. Quer só usar? Beleza também.",
              ],
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
          <CaseCarousel />
        </div>
      </section>

      <section className="cta" id="cta">
        <div className="cta-glow" aria-hidden="true"></div>
        <div className="container cta-inner">
          <span className="pill">
            <span className="pill-dot"></span>vamos começar?
          </span>
          <h2 className="cta-title">
            Conta sua dor.
            <br />A gente devolve em <em className="grad-text">código.</em>
          </h2>
          <p className="cta-sub">
            45 minutos de conversa. Zero compromisso.
            <br className="show-mobile" />
            Você sai da call sabendo se faz sentido.
          </p>
          <Link to="/briefing" className="btn btn-primary btn-large">
            Criar um orçamento →
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <div className="footer-brand">
              <svg
                width="18"
                height="18"
                viewBox="0 0 64 64"
                fill="none"
                style={{ verticalAlign: "middle", marginRight: 6 }}
              >
                <defs>
                  <linearGradient
                    id="plOrbitGradFooter"
                    x1="6"
                    y1="6"
                    x2="58"
                    y2="58"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0" stopColor="#A855F7" />
                    <stop offset="0.5" stopColor="#D14FBF" />
                    <stop offset="1" stopColor="#EC4899" />
                  </linearGradient>
                </defs>
                <circle
                  cx="32"
                  cy="32"
                  r="19"
                  fill="none"
                  stroke="url(#plOrbitGradFooter)"
                  strokeWidth="4.5"
                  opacity="0.45"
                />
                <circle cx="32" cy="32" r="6.5" fill="url(#plOrbitGradFooter)" />
                <circle cx="32" cy="13" r="5.5" fill="url(#plOrbitGradFooter)" />
              </svg>
              ProductLab
            </div>
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

const CASES = [
  {
    quote:
      '"Com a organização do meu estoque no sistema, ficou muito mais fácil! Consegui inclusive aumentar meu faturamento."',
    name: "Giovanna G.",
    role: "Logista na Mundo Pet",
  },
  {
    quote:
      '"Minha apresentação comercial ficou mais dinâmica e interativa. Está mais visual para o cliente, muito mais fácil de gerar valor."',
    name: "Rafael M.",
    role: "Technik",
  },
];

function CaseCarousel() {
  const [i, setI] = useState(0);
  const c = CASES[i];
  const next = () => setI((v) => (v + 1) % CASES.length);
  return (
    <div className="case-card">
      <div className="case-glow case-glow-1" aria-hidden="true"></div>
      <div className="case-glow case-glow-2" aria-hidden="true"></div>
      <button type="button" className="case-next" aria-label="Próximo case" onClick={next}>
        →
      </button>
      <div className="case-content">
        <span className="pill pill-on-dark">
          <span className="pill-dot pill-dot-pink"></span>
          case · 2026
        </span>
        <h2 className="case-quote">{c.quote}</h2>
        <div className="case-author">
          <div className="case-avatar"></div>
          <div>
            <strong>{c.name}</strong>
            <small>{c.role}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
