import { createFileRoute } from "@tanstack/react-router";
import { sampleProposal, formatBRL, formatLongDate, type Proposal } from "../lib/proposal-data";

export const Route = createFileRoute("/proposta")({
  head: () => ({
    meta: [
      { title: "Proposta comercial — ProductLab" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: "/proposta.css" }],
  }),
  component: PropostaPage,
});

function PropostaPage() {
  // Por enquanto usa o exemplo. Quando integrar ao CRM, carregue o
  // Proposal a partir do lead (ex: via search param ?id=) e passe aqui.
  const p = sampleProposal;

  return (
    <div className="proposta-screen">
      <div className="proposta-toolbar">
        <span className="pt-hint">
          Confira a proposta e clique em <strong>Baixar PDF</strong> → escolha “Salvar como PDF”.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="pt-btn" onClick={() => window.print()}>
            Baixar PDF
          </button>
        </div>
      </div>

      <ProposalDocument proposal={p} />
    </div>
  );
}

function ProposalDocument({ proposal: p }: { proposal: Proposal }) {
  return (
    <>
      {/* ---------- Página 1: Capa ---------- */}
      <article className="proposta-page proposta-cover">
        <div className="cover-band">
          <div className="cover-brand">{p.vendor.name}</div>
          <div className="cover-tag">{p.vendor.tagline}</div>
          <div className="cover-title">{p.title}</div>
          <div className="cover-label" style={{ marginTop: 24 }}>
            Proposta comercial nº {p.number}
          </div>
        </div>

        <dl className="cover-meta">
          <div>
            <dt>Preparada para</dt>
            <dd>{p.client.company}</dd>
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
        </dl>

        <div className="cover-foot">
          {p.vendor.email} · {p.vendor.phone} · {p.vendor.site}
        </div>
      </article>

      {/* ---------- Página 2: Entendimento + Solução + Escopo ---------- */}
      <article className="proposta-page">
        <Section num="01" title="O que entendemos">
          <p>{p.understanding.intro}</p>
          <ul className="crosslist">
            {p.understanding.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Section>

        <Section num="02" title="Nossa solução">
          <p>{p.solution.intro}</p>
          <ul className="checklist">
            {p.solution.capabilities.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>

        <Section num="03" title="Escopo do projeto">
          <ul className="checklist">
            {p.scope.included.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p style={{ marginTop: 14, fontWeight: 700 }}>Não incluído:</p>
          <ul className="crosslist">
            {p.scope.excluded.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      </article>

      {/* ---------- Página 3: Fases + Investimento + Próximo passo ---------- */}
      <article className="proposta-page">
        <Section num="04" title="Etapas e prazo">
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
        </Section>

        <Section num="05" title="Investimento">
          <div className="options">
            {p.investment.options.map((o, i) => (
              <div className={`opt${o.recommended ? " opt--rec" : ""}`} key={i}>
                {o.recommended && <span className="opt-badge">Recomendado</span>}
                <span className="opt-name">{o.name}</span>
                <span className="opt-price">{formatBRL(o.price)}</span>
                <span className="opt-desc">{o.description}</span>
              </div>
            ))}
          </div>
          <div className="pay-terms">
            <strong>Condições:</strong> {p.investment.paymentTerms}
            {p.investment.note && <div className="pay-note">{p.investment.note}</div>}
          </div>
        </Section>

        <Section num="06" title="Por que a ProductLab">
          <ul className="checklist">
            {p.why.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Section>

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

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
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
