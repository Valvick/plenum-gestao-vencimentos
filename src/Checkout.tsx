import React from "react";

const plans = [
  {
    name: "Start",
    price: "R$ 97/mês",
    description: "Ideal para pequenas equipes.",
    features: [
      "Até 30 colaboradores",
      "Painel de vencimentos",
      "Alertas por e-mail",
      "Exportação em CSV",
      "Suporte por WhatsApp"
    ],
    link: "https://pay.kiwify.com.br/hcgQEaX",
    highlight: false,
  },
  {
    name: "Profissional",
    price: "R$ 197/mês",
    description: "Mais completo — ideal para operações de médio porte.",
    features: [
      "Até 80 colaboradores",
      "Painel de vencimentos",
      "Alertas avançados",
      "Exportação + históricos",
      "Relatórios completos",
      "Suporte prioritário"
    ],
    link: "https://pay.kiwify.com.br/YCNZ2Ap", // ← NOVO LINK AQUI
    highlight: true, // MAIS VENDIDO
  },
  {
    name: "Empresa",
    price: "R$ 297/mês",
    description: "Para empresas estruturadas de energia e serviços elétricos.",
    features: [
      "Até 150 colaboradores",
      "Todos os recursos Pro",
      "Múltiplos supervisores",
      "Controle multiunidades",
      "Gestão documental",
      "Suporte dedicado"
    ],
    link: "https://pay.kiwify.com.br/ADNkj0u",
    highlight: false,
  },
  {
    name: "Operacional",
    price: "R$ 397/mês",
    description: "Para grandes operações, várias equipes e alta demanda.",
    features: [
      "Colaboradores ilimitados",
      "Painel avançado",
      "Alertas + Auditoria",
      "Múltiplas empresas",
      "Gestão completa",
      "Suporte premium"
    ],
    link: "https://pay.kiwify.com.br/NYZyOD4",
    highlight: false,
  },
];

export default function Checkout() {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-white px-6 py-16">

      {/* HERO */}
      <div className="max-w-4xl mx-auto text-center mb-20">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
          Escolha o plano ideal para sua equipe  
        </h1>
        <p className="text-slate-300 mt-4 text-lg">
          Comece hoje a controlar exames, cursos e certificações sem planilhas,
          sem erros e sem risco de equipes paradas.
        </p>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-3xl p-6 border backdrop-blur
              ${plan.highlight
                ? "border-sky-500/60 bg-sky-900/20 shadow-xl shadow-sky-700/20"
                : "border-slate-700 bg-slate-900/40"}
            `}
          >
            {plan.highlight && (
              <div className="mb-3 inline-block bg-sky-600 text-xs font-bold px-3 py-1 rounded-full">
                MAIS CONTRATADO
              </div>
            )}
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="text-sky-400 text-3xl font-extrabold mt-2">{plan.price}</p>
            <p className="text-sm text-slate-400 mt-1">{plan.description}</p>

            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-sky-400">✓</span> {f}
                </li>
              ))}
            </ul>

            <a
              href={plan.link}
              target="_blank"
              rel="noreferrer"
              className="mt-6 block w-full text-center bg-sky-600 hover:bg-sky-700 transition rounded-2xl py-3 font-semibold"
            >
              Assinar {plan.name}
            </a>
          </div>
        ))}
      </div>

      {/* WHATSAPP */}
      <div className="text-center mt-20">
        <p className="text-slate-400 mb-4">Precisa falar com um especialista?</p>
        <a
          href="https://wa.me/5587991448171"
          target="_blank"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 transition px-6 py-3 rounded-2xl font-semibold"
        >
          Falar no WhatsApp
        </a>
      </div>

      {/* GARANTIA */}
      <div className="max-w-3xl mx-auto text-center mt-20 text-slate-300">
        <h3 className="text-2xl font-bold mb-4">Comece com 7 dias grátis</h3>
        <p>
          Use todos os recursos do SegVenc sem risco.  
          Se não fizer sentido para sua operação, cancele a qualquer momento.
        </p>
      </div>

    </div>
  );
}
