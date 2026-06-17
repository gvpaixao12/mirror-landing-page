// =====================================================
// Catálogo de itens de precificação adicionais.
// -----------------------------------------------------
// Usado pelo formulário de proposta (PropostaModal, em admin.tsx) pra
// montar o "menu" de opções que podem ser marcadas (flags) e que somam
// ao valor base do projeto. O preço aqui é só o padrão sugerido — o
// vendedor pode ajustar por proposta na hora de montar.
// =====================================================

export const PRICING_CATEGORIES = [
  "Integração",
  "Banco de dados",
  "Infraestrutura e servidor",
  "Suporte e evolução",
] as const;

export type PricingCategory = (typeof PRICING_CATEGORIES)[number];

export interface PricingItem {
  id: string;
  label: string;
  category: PricingCategory;
  defaultPrice: number; // R$
}

export const PRICING_CATALOG: PricingItem[] = [
  // ---------- Integração ----------
  {
    id: "integracao-bling",
    label: "Integração com Bling",
    category: "Integração",
    defaultPrice: 3500,
  },
  {
    id: "integracao-erp",
    label: "Integração com ERP / sistema externo",
    category: "Integração",
    defaultPrice: 4500,
  },
  {
    id: "integracao-pagamento",
    label: "Integração com gateway de pagamento",
    category: "Integração",
    defaultPrice: 3000,
  },
  {
    id: "integracao-planilha",
    label: "Importação/exportação via planilha (Excel/CSV)",
    category: "Integração",
    defaultPrice: 1500,
  },
  // ---------- Banco de dados ----------
  {
    id: "banco-gerenciado",
    label: "Banco de dados gerenciado (backup automático + alta disponibilidade)",
    category: "Banco de dados",
    defaultPrice: 1800,
  },
  {
    id: "migracao-dados",
    label: "Migração de dados existentes (planilhas/sistema antigo)",
    category: "Banco de dados",
    defaultPrice: 2500,
  },
  {
    id: "modelagem-avancada",
    label: "Modelagem de dados avançada (multi-tenant, relatórios pesados)",
    category: "Banco de dados",
    defaultPrice: 3000,
  },
  // ---------- Infraestrutura e servidor ----------
  {
    id: "servidor-dedicado",
    label: "Estrutura de servidor dedicada (VPS própria)",
    category: "Infraestrutura e servidor",
    defaultPrice: 2200,
  },
  {
    id: "dominio-ssl",
    label: "Configuração de domínio, SSL e ambiente de produção",
    category: "Infraestrutura e servidor",
    defaultPrice: 900,
  },
  {
    id: "monitoramento",
    label: "Monitoramento, alertas e logs",
    category: "Infraestrutura e servidor",
    defaultPrice: 1200,
  },
  {
    id: "cicd",
    label: "Pipeline de deploy automático (CI/CD)",
    category: "Infraestrutura e servidor",
    defaultPrice: 1500,
  },
  // ---------- Suporte e evolução ----------
  {
    id: "suporte-mensal",
    label: "Suporte e evolução contínua (mês adicional)",
    category: "Suporte e evolução",
    defaultPrice: 2500,
  },
  {
    id: "treinamento",
    label: "Treinamento da equipe do cliente",
    category: "Suporte e evolução",
    defaultPrice: 800,
  },
];
