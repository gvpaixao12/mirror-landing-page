// =====================================================
// Dados da proposta comercial
// -----------------------------------------------------
// Estrutura tipada de uma proposta (escopo, fases, investimento) +
// um exemplo preenchido. A rota /proposta renderiza esse objeto como
// documento A4 pronto pra "Salvar como PDF". Quando integrar ao CRM,
// gere um Proposal a partir do Lead e passe pra mesma view.
// =====================================================

import { formatBRL } from "./crm-data";
import { DEFAULT_PAYMENT_METHODS, DEFAULT_PAYMENT_CONDITION } from "./pricing-config";

export interface InvestmentItem {
  id?: string; // id do catálogo (src/lib/pricing-config.ts) — presente só em itens adicionais (addons)
  label: string;
  price: number; // R$
  observation?: string;
}

export interface InvestmentOption {
  name: string;
  description: string;
  price: number; // R$ total
  recommended?: boolean;
  items?: InvestmentItem[]; // detalhamento: 1º item é o valor base, os demais são addons marcados
}

// Seleção de um item do catálogo de precificação dentro do formulário da proposta.
export interface PricingSelection {
  id: string; // id do catálogo
  label: string;
  price: number; // pode ter sido ajustado pelo vendedor em relação ao defaultPrice
  observation?: string;
}

export interface ScopePhase {
  title: string;
  deliverables: string[];
  duration: string; // ex: "2 semanas"
}

export interface Proposal {
  number: string; // ex: "2026-014"
  date: string; // ISO
  validUntil: string; // ISO — validade da proposta
  client: {
    name: string; // contato
    company: string;
    location?: string;
  };
  vendor: {
    name: string;
    tagline: string;
    email: string;
    phone: string;
    site: string;
  };
  title: string; // título do projeto

  // 2. Entendimento do problema (mostra que ouviu o cliente)
  understanding: { intro: string; bullets: string[] };

  // 3. Solução proposta (foco em resultado, não em tecnologia)
  solution: { intro: string; capabilities: string[] };

  // 4. Escopo detalhado (o que inclui / o que NÃO inclui)
  scope: { included: string[]; excluded: string[] };

  // 5. Etapas e prazo
  phases: ScopePhase[];

  // 6. Investimento (ancoragem com opções)
  investment: {
    options: InvestmentOption[];
    paymentTerms: string;
    paymentCondition?: string; // condição/parcelamento escolhido (preserva seleção ao editar)
    paymentMethods?: string[]; // formas de pagamento marcadas (preserva seleção ao editar)
    durationMonths?: number; // duração do projeto em meses (preserva seleção ao editar)
    monthlyRate?: number; // valor mensal aplicado durante a duração (R$)
    note?: string;
  };

  // 7. Por que a ProductLab
  why: string[];

  // 8. Próximo passo (UMA ação clara)
  nextStep: string;
}

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export { formatBRL };

// Extrai, de uma proposta já montada, os bullets de escopo gerados pelos
// itens adicionais marcados (addons) — usado pra exibir no PDF sem duplicar
// dados (o texto manual do escopo fica só com o que o vendedor digitou).
export function getAddonScopeBullets(p: Proposal): string[] {
  const items =
    p.investment.options.find((o) => o.recommended)?.items ?? p.investment.options[0]?.items ?? [];
  return items
    .filter((it) => it.id)
    .map((it) => (it.observation ? `${it.label} — ${it.observation}` : it.label));
}

// ===================== Builder =====================
// Monta um Proposal completo a partir dos campos do formulário do CRM,
// preenchendo o resto com os padrões da ProductLab.

export const PRODUCTLAB_VENDOR: Proposal["vendor"] = {
  name: "ProductLab",
  tagline: "Software sob medida pra empresas que cresceram além das planilhas.",
  email: "productlab.software@gmail.com",
  phone: "(11) 99999-9999",
  site: "productlabsoftware.com.br",
};

export const DEFAULT_WHY = [
  "Foco em software sob medida B2B — feito pra como a sua empresa trabalha, não um template genérico.",
  "Entrega por fases: você vê valor antes de pagar tudo.",
  "Suporte incluído e código que fica com você.",
  "Comunicação direta com quem desenvolve, sem atravessador.",
];

export interface BuildProposalArgs {
  number: string;
  clientName: string;
  company: string;
  title: string;
  baseValue: number; // valor base (plataforma/escopo principal)
  addons?: PricingSelection[]; // itens adicionais marcados (Integração, banco de dados, infra...)
  durationMonths?: number; // duração do projeto em meses
  monthlyRate?: number; // valor mensal aplicado durante a duração (R$)
  paymentCondition?: string; // condição/parcelamento escolhido
  paymentMethods?: string[]; // formas de pagamento marcadas
  understanding?: string; // problema do cliente
  solution?: string; // o que será entregue
  scope?: string[]; // bullets do escopo (manual)
  nextStep?: string;
  date?: string; // ISO — preserva o original ao editar
  validUntil?: string; // ISO
}

const DAY = 24 * 60 * 60 * 1000;

// Monta a frase de condições de pagamento a partir da condição/parcelamento
// escolhido e das formas de pagamento marcadas no formulário.
function buildPaymentTerms(condition: string, methods: string[]): string {
  const split = condition.trim() || DEFAULT_PAYMENT_CONDITION;
  if (methods.length === 0) return `${split}.`;
  if (methods.length === 1) return `${split}. ${methods[0]}.`;
  return `${split}. ${methods.slice(0, -1).join(", ")} ou ${methods[methods.length - 1]}.`;
}

export function buildProposal(a: BuildProposalArgs): Proposal {
  const date = a.date ?? new Date().toISOString();
  const validUntil = a.validUntil ?? new Date(Date.now() + 14 * DAY).toISOString();
  const addons = a.addons ?? [];
  const durationMonths = a.durationMonths ?? 0;
  const monthlyRate = a.monthlyRate ?? 300;
  const paymentCondition = a.paymentCondition ?? DEFAULT_PAYMENT_CONDITION;
  const paymentMethods = a.paymentMethods ?? [...DEFAULT_PAYMENT_METHODS];
  const items: InvestmentItem[] = [
    { label: "Plataforma (escopo base)", price: a.baseValue },
    ...addons.map((ad) => ({
      id: ad.id,
      label: ad.label,
      price: ad.price,
      observation: ad.observation,
    })),
  ];
  if (durationMonths > 0) {
    items.push({
      label: "Suporte e manutenção mensal",
      price: durationMonths * monthlyRate,
      observation: `${durationMonths} ${durationMonths === 1 ? "mês" : "meses"} × ${formatBRL(monthlyRate)}/mês`,
    });
  }
  const total = items.reduce((sum, it) => sum + it.price, 0);
  return {
    number: a.number,
    date,
    validUntil,
    client: { name: a.clientName, company: a.company },
    vendor: PRODUCTLAB_VENDOR,
    title: a.title,
    understanding: { intro: a.understanding?.trim() ?? "", bullets: [] },
    solution: { intro: a.solution?.trim() ?? "", capabilities: [] },
    scope: { included: (a.scope ?? []).filter((s) => s.trim() !== ""), excluded: [] },
    phases: [],
    investment: {
      options: [{ name: "Investimento", description: "", price: total, recommended: true, items }],
      paymentTerms: buildPaymentTerms(paymentCondition, paymentMethods),
      paymentCondition,
      paymentMethods,
      durationMonths,
      monthlyRate,
    },
    why: DEFAULT_WHY,
    nextStep:
      a.nextStep?.trim() ||
      "Para seguirmos, basta responder aprovando a proposta até a data de validade. Em seguida agendamos o kickoff.",
  };
}

// ===================== Exemplo =====================
// ProductLab → Distribuidora XYZ (lead "Marina Tavares" do CRM).
// Reflete o pedido recebido no formulário: portal de representantes
// pra ver comissão em tempo real + integração Bling/planilhas.

export const sampleProposal: Proposal = {
  number: "2026-014",
  date: "2026-06-11T00:00:00Z",
  validUntil: "2026-06-25T00:00:00Z",
  client: {
    name: "Marina Tavares",
    company: "Distribuidora XYZ",
    location: "São Paulo / SP",
  },
  vendor: PRODUCTLAB_VENDOR,
  title: "Portal de Representantes com Comissão em Tempo Real",

  understanding: {
    intro:
      "Hoje os representantes da Distribuidora XYZ dependem de planilhas e do time interno pra saber quanto venderam e quanto vão receber. Isso gera retrabalho, atraso na informação e dúvidas recorrentes sobre comissão — energia que poderia estar virando venda.",
    bullets: [
      "Comissão calculada à mão, em planilhas espalhadas e sujeitas a erro.",
      "Representantes sem visão do próprio desempenho em tempo real.",
      'Time interno parando pra responder "quanto eu vendi?" toda semana.',
      "Dados de venda desconectados do Bling, exigindo digitação dupla.",
    ],
  },

  solution: {
    intro:
      "Um portal próprio, com a marca da Distribuidora XYZ, onde cada representante acessa o que importa pra ele — e a comissão se atualiza sozinha, puxando os dados direto do Bling.",
    capabilities: [
      "Cada representante vê vendas e comissão em tempo real, 24/7.",
      "Cálculo de comissão automático, com as regras da XYZ embutidas.",
      "Ranking e metas pra estimular o time comercial.",
      "Integração com o Bling — sem digitar venda duas vezes.",
      "Painel do gestor com visão consolidada de todos os representantes.",
    ],
  },

  scope: {
    included: [
      "Login individual por representante (área protegida).",
      "Dashboard de vendas e comissão em tempo real.",
      "Motor de cálculo de comissão configurável (faixas, metas, bônus).",
      "Integração com a API do Bling para importar vendas.",
      "Painel administrativo pro gestor (visão consolidada + exportar relatório).",
      "Layout responsivo (funciona no celular do representante).",
      "Publicação em ambiente próprio + 30 dias de suporte pós-entrega.",
    ],
    excluded: [
      "App nativo de loja (iOS/Android) — o portal é web responsivo.",
      "Emissão fiscal / nota — segue no Bling.",
      "Integrações além do Bling (podem ser orçadas à parte).",
    ],
  },

  phases: [
    {
      title: "Fase 1 — Descoberta e regras de comissão",
      deliverables: [
        "Mapeamento das regras de comissão atuais",
        "Protótipo navegável das telas principais",
      ],
      duration: "1 semana",
    },
    {
      title: "Fase 2 — Portal do representante",
      deliverables: [
        "Login e área individual",
        "Dashboard de vendas e comissão",
        "Motor de cálculo de comissão",
      ],
      duration: "3 semanas",
    },
    {
      title: "Fase 3 — Integração Bling + painel do gestor",
      deliverables: [
        "Importação automática de vendas do Bling",
        "Painel consolidado do gestor + exportação",
      ],
      duration: "2 semanas",
    },
    {
      title: "Fase 4 — Publicação e ajustes",
      deliverables: ["Publicação no ambiente da XYZ", "Treinamento rápido + 30 dias de suporte"],
      duration: "1 semana",
    },
  ],

  investment: {
    options: [
      {
        name: "Essencial",
        description:
          "Portal do representante com comissão em tempo real e cálculo automático. Sem integração Bling (importação por planilha).",
        price: 14900,
      },
      {
        name: "Completo",
        description:
          "Tudo do Essencial + integração automática com o Bling e painel consolidado do gestor. A opção que elimina a digitação dupla de vez.",
        price: 22900,
        recommended: true,
      },
      {
        name: "Completo + Evolução",
        description:
          "Tudo do Completo + 3 meses de evolução contínua (novas regras, relatórios e ajustes sob demanda).",
        price: 29900,
      },
    ],
    paymentTerms:
      "40% na aprovação, 30% na entrega da Fase 2 e 30% na publicação. Pix, boleto ou cartão (até 12x).",
    note: "Valores válidos até a data de validade desta proposta.",
  },

  why: [
    "Foco em software sob medida B2B — não é template genérico, é feito pra como a XYZ trabalha.",
    "Entrega por fases: você vê valor antes de pagar tudo.",
    "30 dias de suporte incluídos e código que fica com você.",
    "Comunicação direta com quem desenvolve, sem camada de atravessador.",
  ],

  nextStep:
    "Para começarmos a Fase 1 ainda em junho, basta responder este e-mail aprovando a opção escolhida até a data de validade. Em seguida agendamos a reunião de descoberta.",
};
