import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { fetchPropostaById } from "../lib/crm-data";
import {
  sampleProposal,
  formatBRL,
  formatLongDate,
  getAddonScopeBullets,
  PRODUCTLAB_VENDOR,
  type Proposal,
} from "../lib/proposal-data";

export const Route = createFileRoute("/proposta")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Proposta comercial — ProductLab" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: "/proposta.css" }],
  }),
  component: PropostaPage,
});

type LoadState = "loading" | "ok" | "notfound" | "error";

function PropostaPage() {
  const { id } = Route.useSearch();
  // Sem id: mostra o exemplo (preview). Com id: carrega do Supabase.
  const [proposal, setProposal] = useState<Proposal | null>(id ? null : sampleProposal);
  const [state, setState] = useState<LoadState>(id ? "loading" : "ok");

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchPropostaById(id)
      .then((p) => {
        if (!active) return;
        if (p) {
          setProposal(p.content);
          setState("ok");
        } else {
          setState("notfound");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="proposta-screen">
      <div className="proposta-toolbar">
        <span className="pt-hint">
          Confira a proposta e clique em <strong>Baixar PDF</strong> → escolha “Salvar como PDF”.
        </span>
        <button className="pt-btn" onClick={() => window.print()} disabled={state !== "ok"}>
          Baixar PDF
        </button>
      </div>

      {state === "loading" && <div className="proposta-msg">Carregando proposta...</div>}
      {state === "notfound" && <div className="proposta-msg">Proposta não encontrada.</div>}
      {state === "error" && (
        <div className="proposta-msg">
          Erro ao carregar a proposta. Faça login no painel e tente de novo.
        </div>
      )}
      {state === "ok" && proposal && <ProposalDocument proposal={proposal} />}
    </div>
  );
}

function ProposalDocument({ proposal: p }: { proposal: Proposal }) {
  // Contato sempre com os dados atuais da ProductLab — propostas antigas
  // guardaram o e-mail/site antigos no JSON, então sobrescrevemos na hora de
  // exibir (nome/tagline seguem o que está salvo).
  const contact = {
    ...p.vendor,
    email: PRODUCTLAB_VENDOR.email,
    site: PRODUCTLAB_VENDOR.site,
    phone: PRODUCTLAB_VENDOR.phone,
  };
  const durationMonths = p.investment.durationMonths ?? 0;

  // Monta só as seções que têm conteúdo, numerando em sequência.
  const blocks: { title: string; body: ReactNode }[] = [];

  if (p.understanding.intro || p.understanding.bullets.length > 0) {
    blocks.push({
      title: "O que entendemos",
      body: (
        <>
          {p.understanding.intro && <p>{p.understanding.intro}</p>}
          {p.understanding.bullets.length > 0 && (
            <ul className="crosslist">
              {p.understanding.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </>
      ),
    });
  }

  if (p.solution.intro || p.solution.capabilities.length > 0) {
    blocks.push({
      title: "Nossa solução",
      body: (
        <>
          {p.solution.intro && <p>{p.solution.intro}</p>}
          {p.solution.capabilities.length > 0 && (
            <ul className="checklist">
              {p.solution.capabilities.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </>
      ),
    });
  }

  const includedScope = [...p.scope.included, ...getAddonScopeBullets(p)];

  if (includedScope.length > 0 || p.scope.excluded.length > 0) {
    blocks.push({
      title: "Escopo do projeto",
      body: (
        <>
          {includedScope.length > 0 && (
            <ul className="checklist">
              {includedScope.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {p.scope.excluded.length > 0 && (
            <>
              <p style={{ marginTop: 14, fontWeight: 700 }}>Não incluído:</p>
              <ul className="crosslist">
                {p.scope.excluded.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
        </>
      ),
    });
  }

  if (p.phases.length > 0) {
    blocks.push({
      title: "Etapas e prazo",
      body: (
        <>
          {p.phases.map((ph, i) => (
            <div className="phase" key={i}>
              <div className="phase-top">
                <span className="phase-title">{ph.title}</span>
                <span className="phase-dur">{ph.duration}</span>
              </div>
              <ul>
                {ph.deliverables.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ),
    });
  }

  if (p.investment.options.length > 0) {
    blocks.push({
      title: "Investimento",
      body: (
        <>
          <div className={`options${p.investment.options.length === 1 ? " options--single" : ""}`}>
            {p.investment.options.map((o, i) => (
              <div className={`opt${o.recommended ? " opt--rec" : ""}`} key={i}>
                {o.recommended && p.investment.options.length > 1 && (
                  <span className="opt-badge">Recomendado</span>
                )}
                <span className="opt-name">{o.name}</span>
                <span className="opt-price">{formatBRL(o.price)}</span>
                {o.description && <span className="opt-desc">{o.description}</span>}
                {o.items && o.items.length > 1 && (
                  <ul className="opt-items">
                    {o.items.map((it, j) => (
                      <li key={j}>
                        <span className="opt-item-label">
                          {it.label}
                          {it.observation && (
                            <span className="opt-item-obs"> — {it.observation}</span>
                          )}
                        </span>
                        <span className="opt-item-price">{formatBRL(it.price)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <div className="pay-terms">
            <strong>Condições:</strong> {p.investment.paymentTerms}
            {durationMonths > 0 && (
              <div className="pay-duration">
                <strong>Prazo de execução:</strong> {durationMonths}{" "}
                {durationMonths === 1 ? "mês" : "meses"}
              </div>
            )}
            {p.investment.note && <div className="pay-note">{p.investment.note}</div>}
          </div>
        </>
      ),
    });
  }

  if (p.why.length > 0) {
    blocks.push({
      title: `Por que a ${p.vendor.name}`,
      body: (
        <ul className="checklist">
          {p.why.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ),
    });
  }

  return (
    <>
      {/* ---------- Capa ---------- */}
      <article className="proposta-page proposta-cover">
        <div className="cover-band">
          <div className="cover-brand">
            <svg
              className="cover-logo"
              viewBox="0 0 64 64"
              width="22"
              height="22"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="coverLogoGrad"
                  x1="6"
                  y1="6"
                  x2="58"
                  y2="58"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <circle
                cx="32"
                cy="32"
                r="17"
                fill="none"
                stroke="url(#coverLogoGrad)"
                strokeWidth="5"
                opacity="0.6"
              />
              <circle cx="32" cy="32" r="7" fill="url(#coverLogoGrad)" />
              <circle cx="32" cy="14" r="6" fill="url(#coverLogoGrad)" />
            </svg>
            <span>{p.vendor.name}</span>
          </div>
          <div className="cover-tag">{p.vendor.tagline}</div>
          <div className="cover-title">{p.title}</div>
          <div className="cover-label" style={{ marginTop: 24 }}>
            Proposta comercial nº {p.number}
          </div>
        </div>

        <dl className="cover-meta">
          <div>
            <dt>Preparada para</dt>
            <dd>{p.client.company || p.client.name}</dd>
          </div>
          <div>
            <dt>Contato</dt>
            <dd>{p.client.name}</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>{formatLongDate(p.date)}</dd>
          </div>
          <div>
            <dt>Validade</dt>
            <dd>{formatLongDate(p.validUntil)}</dd>
          </div>
          {durationMonths > 0 && (
            <div>
              <dt>Duração estimada</dt>
              <dd>
                {durationMonths} {durationMonths === 1 ? "mês" : "meses"}
              </dd>
            </div>
          )}
        </dl>

        <div className="cover-foot">
          {contact.email} · {contact.site}
        </div>
      </article>

      {/* ---------- Conteúdo ---------- */}
      <article className="proposta-page">
        {blocks.map((b, i) => (
          <Section key={i} num={String(i + 1).padStart(2, "0")} title={b.title}>
            {b.body}
          </Section>
        ))}

        <div className="next-step">
          <h3>Próximo passo</h3>
          <p>{p.nextStep}</p>
        </div>

        <div className="doc-foot">
          <span>
            {p.vendor.name} · Proposta nº {p.number}
          </span>
          <span>Válida até {formatLongDate(p.validUntil)}</span>
        </div>
      </article>
    </>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: ReactNode }) {
  return (
    <section className="sec">
      <div className="sec-head">
        <span className="sec-num">{num}</span>
        <h2 className="sec-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}
