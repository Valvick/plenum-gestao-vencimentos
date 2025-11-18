import React, { useEffect, useMemo, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

// =========================
// Supabase Client (Auth)
// =========================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =========================
/** Tipos de domínio */
// =========================

type TipoRegistro = "Exame" | "Curso";

type StatusRegistro = "Vencido" | "Vence em 30 dias" | "Ok";

export type Colaborador = {
  id: number;
  matricula: string;
  nome: string;
  funcao: string;
  setor: string;
  baseOperacional: string;
  dataAdmissao: string; // ISO
  [key: string]: any;
};

export type Registro = {
  id: number;
  matricula: string;
  colaboradorNome: string;
  funcao: string;
  setor: string;
  baseOperacional: string;
  tipo: TipoRegistro;
  cursoExame: string;
  dataAdmissao: string;
  dataUltimoEvento: string;
  vencimento: string;
  status?: StatusRegistro;
  qtdeDias?: number;
  linkCertificado?: string; // 👈 novo campo
  [key: string]: any;
};


export type ExameCurso = {
  id: number;
  tipo: TipoRegistro;
  nome: string;
  validadeDias: number;
  [key: string]: any;
};

type CustomFilter = {
  id: string;
  nome: string;
  origem: "registros" | "colaboradores";
  usarNoDashboard: boolean;
  usarNosRegistros: boolean;
};

// 👉 Novo tipo
type UsuarioInterno = {
  id: number;
  authUserId: string;
  nome: string | null;
  role: "admin" | "user";
};

type TabKey =
  | "dashboard"
  | "registros"
  | "colaboradores"
  | "exames"
  | "campos"
  | "usuarios"
  | "empresas";

// =========================
// Utilitários
// =========================

function classNames(...classes: (string | boolean | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function daysUntil(dateISO: string): number {
  if (!dateISO) return 0;
  const target = new Date(dateISO);
  const today = new Date();
  const diffMs =
    target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function statusFromDays(diff: number): StatusRegistro {
  if (diff < 0) return "Vencido";
  if (diff <= 30) return "Vence em 30 dias";
  return "Ok";
}

function statusChipClasses(status: StatusRegistro) {
  switch (status) {
    case "Vencido":
      return "bg-rose-50 text-rose-700 border border-rose-300";
    case "Vence em 30 dias":
      return "bg-amber-50 text-amber-800 border border-amber-300";
    case "Ok":
      return "bg-emerald-50 text-emerald-700 border-emerald-300";
  }
}

// soma dias na data (ISO yyyy-mm-dd)
function addDays(dateISO: string, days: number): string {
  if (!dateISO || !days) return dateISO;
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// =========================
// Helpers CSV / XLS
// =========================

type CsvColumn = { key: string; label: string };

function objectsToCsv(columns: CsvColumn[], rows: any[]): string {
  const header = columns
    .map((c) => `"${String(c.label).replace(/"/g, '""')}"`)
    .join(";");

  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = row[c.key] ?? "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(";")
  );

  return [header, ...lines].join("\r\n");
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Excel abre CSV normalmente; mudamos só o mime/ extensão
function downloadCsvFile(filename: string, columns: CsvColumn[], rows: any[]) {
  const csv = objectsToCsv(columns, rows);
  downloadFile(filename, csv, "text/csv;charset=utf-8;");
}

function downloadXlsFile(filename: string, columns: CsvColumn[], rows: any[]) {
  const csv = objectsToCsv(columns, rows);
  downloadFile(filename, csv, "application/vnd.ms-excel");
}

// parser simples de CSV (separa por ; ou ,)
function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  return lines.map((line) => {
    const sep = line.includes(";") ? ";" : ",";
    return line.split(sep).map((cell) => cell.replace(/^"|"$/g, ""));
  });
}

// =========================
// Tipos DB (Supabase) + mapeadores
// =========================

type DbColaborador = {
  id: number;
  empresa_id: string;
  matricula: string | null;
  nome: string | null;
  funcao: string | null;
  setor: string | null;
  base_operacional: string | null;
  data_admissao: string | null;
};

type DbExameCurso = {
  id: number;
  empresa_id: string;
  tipo: "Exame" | "Curso";
  nome: string;
  validade_dias: number;
};

type DbRegistro = {
  id: number;
  empresa_id: string;
  colaborador_id: number | null;
  matricula: string | null;
  colaborador_nome: string | null;
  funcao: string | null;
  setor: string | null;
  base_operacional: string | null;
  tipo: "Exame" | "Curso";
  curso_exame: string;
  data_admissao: string | null;
  data_ultimo_evento: string | null;
  vencimento: string | null;
  qtde_dias: number | null;
  status: string | null;
  link_certificado: string | null; // 👈 novo
};

type DbCustomFilter = {
  id: number;
  empresa_id: string;
  nome: string;
  origem: "registros" | "colaboradores";
  usar_no_dashboard: boolean;
  usar_nos_registros: boolean;
};

type DbUsuario = {
  id: number;
  auth_user_id: string;
  empresa_id: string;
  nome: string | null;
  role: "admin" | "user";
};

function mapColaboradorFromDb(row: DbColaborador): Colaborador {
  return {
    id: row.id,
    matricula: row.matricula ?? "",
    nome: row.nome ?? "",
    funcao: row.funcao ?? "",
    setor: row.setor ?? "",
    baseOperacional: row.base_operacional ?? "",
    dataAdmissao: row.data_admissao ?? "",
  };
}

function mapExameFromDb(row: DbExameCurso): ExameCurso {
  return {
    id: row.id,
    tipo: row.tipo,
    nome: row.nome,
    validadeDias: row.validade_dias,
  };
}

function mapRegistroFromDb(row: DbRegistro): Registro {
  return {
    id: row.id,
    matricula: row.matricula ?? "",
    colaboradorNome: row.colaborador_nome ?? "",
    funcao: row.funcao ?? "",
    setor: row.setor ?? "",
    baseOperacional: row.base_operacional ?? "",
    tipo: row.tipo,
    cursoExame: row.curso_exame,
    dataAdmissao: row.data_admissao ?? "",
    dataUltimoEvento: row.data_ultimo_evento ?? "",
    vencimento: row.vencimento ?? "",
    qtdeDias: row.qtde_dias ?? undefined,
    status: (row.status as StatusRegistro | null) ?? undefined,
    linkCertificado: row.link_certificado ?? "", // 👈 novo
  };
}


function mapCustomFilterFromDb(row: DbCustomFilter): CustomFilter {
  return {
    id: String(row.id),
    nome: row.nome,
    origem: row.origem,
    usarNoDashboard: row.usar_no_dashboard,
    usarNosRegistros: row.usar_nos_registros,
  };
}

function mapUsuarioFromDb(row: DbUsuario): UsuarioInterno {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    nome: row.nome,
    role: row.role,
  };
}

// =========================
// Tela de Login (SegVenc) + cadastro de empresa
// =========================

const AuthScreen: React.FC<{ onAuth: (session: Session | null) => void }> = ({
  onAuth,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Campos extras para cadastro (sign up)
  const [companyName, setCompanyName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");

  /**
   * Garante que exista empresa + linha em public.usuarios
   * para o usuário logado.
   *
   * Usa os dados de user_metadata preenchidos no cadastro:
   *  - company_name
   *  - company_cnpj
   *  - company_email_notificacao
   */
  const ensureEmpresaAndUsuario = async (session: Session) => {
    // 1) Ver se já existe linha para esse auth_user_id
    const { data: usuario, error: usuarioError } = await supabase
      .from("usuarios")
      .select("id, empresa_id")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    if (usuarioError) {
      console.error("Erro ao buscar usuario em public.usuarios:", usuarioError);
      throw new Error("Erro ao verificar vínculo do usuário com empresa.");
    }

    // Metadados vindos do cadastro
    const meta = (session.user.user_metadata || {}) as any;

    const nomeEmpresa =
      meta.company_name ||
      `Empresa de ${session.user.email ?? "usuário"}`;

    const cnpjEmpresa = meta.company_cnpj || null;
    const emailNotif =
      meta.company_email_notificacao || session.user.email || null;

    let empresaId: string | null = (usuario?.empresa_id as string | null) ?? null;

    // 2) Se ainda não tem empresa_id, criamos a empresa
    if (!empresaId) {
      const { data: novaEmpresa, error: empresaError } = await supabase
        .from("empresas")
        .insert({
          nome: nomeEmpresa,
          cnpj: cnpjEmpresa,
          email_notificacao: emailNotif,
        })
        .select("id")
        .single();

      if (empresaError || !novaEmpresa) {
        console.error("Erro ao criar empresa:", empresaError);
        throw new Error("Erro ao criar empresa para o usuário.");
      }

      empresaId = novaEmpresa.id;
    }

    // 3) Garantir linha em public.usuarios com empresa_id preenchido
    if (usuario?.id) {
      // Já existe usuário, só atualiza empresa_id (e nome se quiser)
      const { error: updError } = await supabase
        .from("usuarios")
        .update({
          empresa_id: empresaId,
          nome: session.user.email,
        })
        .eq("id", usuario.id);

      if (updError) {
        console.error("Erro ao atualizar usuario:", updError);
        throw new Error("Erro ao vincular usuário à empresa.");
      }
    } else {
      // Não existe ainda: criar linha em usuarios
      const { error: insertError } = await supabase.from("usuarios").insert({
        auth_user_id: session.user.id,
        empresa_id: empresaId,
        nome: session.user.email,
        role: "admin",
      });

      if (insertError) {
        console.error("Erro ao criar registro em usuarios:", insertError);
        throw new Error("Erro ao vincular usuário à empresa.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (isLogin) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/`
    }
  });

  if (error) throw error;

  setInfo("Enviamos um link de acesso para o seu e-mail. Clique nele para entrar.");
  return;
}
 else {
        // =====================
        // CADASTRO (SIGN UP)
        // =====================
        if (!companyName.trim()) {
          throw new Error("Informe o nome da empresa para continuar.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            // Metadados que vamos usar depois, no primeiro login,
            // para criar empresa + usuarios
            data: {
              company_name: companyName,
              company_cnpj: companyCnpj,
              company_email_notificacao: companyEmail,
            },
          },
        });

        if (error) throw error;

        setInfo(
          "Cadastro realizado. Enviamos um e-mail de confirmação. Após confirmar, volte e faça login."
        );
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ||
          "Erro ao autenticar. Verifique os dados ou tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-[32px] shadow-2xl p-8 space-y-6 border border-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-sky-900 flex items-center justify-center shadow-lg overflow-hidden">
            <img
              src="/plenum_icon_192x192.png"
              alt="SegVenc"
              className="w-14 h-14 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              SegVenc
            </h1>
            <p className="text-[13px] text-slate-500 font-medium">
              Seu Sistema de Gestão de Vencimentos
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 text-rose-700 text-xs p-3 border border-rose-200">
              {error}
            </div>
          )}

          {info && (
            <div className="rounded-xl bg-emerald-50 text-emerald-700 text-xs p-3 border border-emerald-200">
              {info}
            </div>
          )}

          {/* E-mail + senha (sempre) */}
          <div className="space-y-1 text-sm">
            <label
              className="font-semibold text-slate-700 text-xs"
              htmlFor="email"
            >
              E-mail corporativo
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50"
              placeholder="voce@empresa.com.br"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label
              className="font-semibold text-slate-700 text-xs"
              htmlFor="password"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50"
              placeholder="Sua senha"
            />
          </div>

          {/* Campos extra apenas no cadastro */}
          {!isLogin && (
            <div className="space-y-3 pt-3 border-t border-slate-100 mt-1">
              <p className="text-[11px] font-semibold text-slate-600">
                Dados da empresa
              </p>

              <div className="space-y-1 text-sm">
                <label className="font-semibold text-slate-700 text-xs">
                  Nome da empresa
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50"
                  placeholder="Ex.: CGB - Distribuição de Energia"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label className="font-semibold text-slate-700 text-xs">
                  CNPJ (opcional)
                </label>
                <input
                  type="text"
                  value={companyCnpj}
                  onChange={(e) => setCompanyCnpj(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label className="font-semibold text-slate-700 text-xs">
                  E-mail para notificações (opcional)
                </label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50"
                  placeholder="seguranca@empresa.com.br"
                />
                <p className="text-[10px] text-slate-400">
                  Se deixar em branco, usaremos o próprio e-mail de login.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-sky-600 text-white py-2.5 text-sm font-semibold shadow-lg hover:bg-sky-700 transition disabled:opacity-60"
          >
            {loading
              ? "Aguarde..."
              : isLogin
              ? "Entrar no SegVenc"
              : "Criar conta"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          {isLogin ? (
            <>
              Ainda não tem acesso?{" "}
              <button
                type="button"
                className="text-sky-600 font-semibold hover:underline"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setIsLogin(false);
                }}
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já possui conta?{" "}
              <button
                type="button"
                className="text-sky-600 font-semibold hover:underline"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setIsLogin(true);
                }}
              >
                Fazer login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ======================================================
// SISTEMA DE PRIORIDADE / CORES
// ======================================================

function getPrioridadeStatus(dias: number | null | undefined) {
  if (dias === null || dias === undefined || dias === "") {
    return {
      label: "Sem informação",
      bg: "bg-slate-300",
      text: "text-slate-800",
      num: "text-slate-500",
      nivel: 0,
    };
  }

  if (dias < 0) {
    return {
      label: `Vencido há ${Math.abs(dias)} dia(s)`,
      bg: "bg-red-600",
      text: "text-white",
      num: "text-red-600 font-bold",
      nivel: 5,
    };
  }

  if (dias === 0) {
    return {
      label: "Vence hoje",
      bg: "bg-sky-600",
      text: "text-white",
      num: "text-sky-700 font-semibold",
      nivel: 4,
    };
  }

  if (dias <= 7) {
    return {
      label: `Alto risco (${dias} dia(s))`,
      bg: "bg-orange-500",
      text: "text-white",
      num: "text-orange-700 font-semibold",
      nivel: 3,
    };
  }

  if (dias <= 15) {
    return {
      label: `Médio (${dias} dia(s))`,
      bg: "bg-yellow-400",
      text: "text-slate-900",
      num: "text-yellow-700 font-semibold",
      nivel: 2,
    };
  }

  if (dias <= 30) {
    return {
      label: `Baixo (${dias} dia(s))`,
      bg: "bg-emerald-500",
      text: "text-white",
      num: "text-emerald-700 font-semibold",
      nivel: 1,
    };
  }

  return {
    label: `OK (${dias} dia(s))`,
    bg: "bg-emerald-200",
    text: "text-emerald-900",
    num: "text-emerald-700 font-semibold",
    nivel: 0,
  };
}

// =========================
// COMPONENTE: StatCard
// =========================

type StatCardProps = {
  title: string;
  value: number | string;
  subtitle?: string;
  color?: string; // "red" | "orange" | "yellow" | "sky" | "emerald" | "blue"
};

const colorStyles: Record<
  string,
  { bg: string; text: string; ring: string }
> = {
  red: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    ring: "ring-orange-200",
  },
  yellow: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    ring: "ring-yellow-200",
  },
  sky: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-200",
  },
  default: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    ring: "ring-slate-200",
  },
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  color = "default",
}) => {
  const styles = colorStyles[color] || colorStyles.default;

  return (
    <div
      className={classNames(
        "rounded-3xl p-4 shadow-sm border border-slate-200",
        "hover:shadow-md transition-all",
        styles.bg
      )}
    >
      <div className="flex items-baseline justify-between">
        <h3 className={classNames("text-xs font-semibold", styles.text)}>
          {title}
        </h3>

        <span
          className={classNames(
            "text-lg font-bold px-3 py-0.5 rounded-full ring-1",
            styles.text,
            styles.ring
          )}
        >
          {value}
        </span>
      </div>

      {subtitle && (
        <p className="text-[10px] mt-1 text-slate-500">{subtitle}</p>
      )}
    </div>
  );
};

// =========================
// DASHBOARD (OTIMIZADO)
// =========================

type DashboardProps = {
  registros: Registro[];
  colaboradores: Colaborador[];
  filtrosDashboard: {
    setor: string;
    funcao: string;
    tipo: string; // nome do curso/exame
    custom: Record<string, string>;
  };
  onChangeFiltros: (f: DashboardProps["filtrosDashboard"]) => void;
  customFilters: CustomFilter[];
};

const DashboardView: React.FC<DashboardProps> = ({
  registros,
  colaboradores,
  filtrosDashboard,
  onChangeFiltros,
  customFilters,
}) => {
  // 1) Pré-cálculo de dias / prioridade (1x só, quando registros mudar)
  const registrosComCalculos = useMemo(() => {
    return registros.map((reg) => {
      const diff = daysUntil(reg.vencimento);
      const prioridade = getPrioridadeStatus(diff);

      return {
        ...reg,
        qtdeDias: diff,
        prioridadeNivel: prioridade.nivel,
        prioridadeInfo: prioridade,
      };
    });
  }, [registros]);

  // 2) Listas de Setor / Função (memoizadas por colaboradores)
  const { setores, funcoes } = useMemo(() => {
    const setoresSet = new Set<string>();
    const funcoesSet = new Set<string>();

    colaboradores.forEach((c) => {
      if (c.setor) setoresSet.add(c.setor);
      if (c.funcao) funcoesSet.add(c.funcao);
    });

    return {
      setores: Array.from(setoresSet).sort(),
      funcoes: Array.from(funcoesSet).sort(),
    };
  }, [colaboradores]);

  // 3) Lista de cursos/exames (memoizada por registros)
  const cursosExames = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((r) => {
      if (r.cursoExame) set.add(r.cursoExame);
    });
    return Array.from(set).sort();
  }, [registros]);

  // 4) Filtragem + contadores em UMA passada só
  const { filtered, ordered, stats } = useMemo(() => {
    const filtrados: (Registro & {
      qtdeDias?: number;
      prioridadeNivel?: number;
      prioridadeInfo?: ReturnType<typeof getPrioridadeStatus>;
    })[] = [];

    let total = 0;
    let vencidos = 0;
    let venceHoje = 0;
    let riscoAlto = 0;   // 1–7 dias
    let riscoMedio = 0;  // 8–15 dias
    let riscoBaixo = 0;  // 16–30 dias
    let ok = 0;          // >30 dias

    outer: for (const reg of registrosComCalculos) {
      // Filtro Setor
      if (filtrosDashboard.setor && reg.setor !== filtrosDashboard.setor) {
        continue;
      }

      // Filtro Função
      if (filtrosDashboard.funcao && reg.funcao !== filtrosDashboard.funcao) {
        continue;
      }

      // Filtro Curso/Exame
      if (filtrosDashboard.tipo && reg.cursoExame !== filtrosDashboard.tipo) {
        continue;
      }

      // Filtros custom
      for (const cf of customFilters.filter((c) => c.usarNoDashboard)) {
        const valFiltro = filtrosDashboard.custom[cf.id];
        if (!valFiltro) continue;

        const valReg = (reg as any)[cf.nome];
        if (
          valReg === undefined ||
          String(valReg).toLowerCase() !== valFiltro.toLowerCase()
        ) {
          continue outer;
        }
      }

      // Passou em todos os filtros
      filtrados.push(reg);
      total++;

      const dias = reg.qtdeDias ?? 0;

      if (dias < 0) {
        vencidos++;
      } else if (dias === 0) {
        venceHoje++;
      } else if (dias <= 7) {
        riscoAlto++;
      } else if (dias <= 15) {
        riscoMedio++;
      } else if (dias <= 30) {
        riscoBaixo++;
      } else {
        ok++;
      }
    }

    const orderedLocal = [...filtrados].sort(
      (a, b) => (b.prioridadeNivel ?? 0) - (a.prioridadeNivel ?? 0)
    );

    return {
      filtered: filtrados,
      ordered: orderedLocal,
      stats: {
        total,
        vencidos,
        venceHoje,
        riscoAlto,
        riscoMedio,
        riscoBaixo,
        ok,
      },
    };
  }, [registrosComCalculos, filtrosDashboard, customFilters]);

  const {
    total,
    vencidos,
    venceHoje,
    riscoAlto,
    riscoMedio,
    riscoBaixo,
    ok,
  } = stats;

  // 5) Render
  return (
    <div className="space-y-6">
      {/* FILTROS SUPERIORES */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* SETOR */}
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-slate-600">Setor</label>
          <select
            value={filtrosDashboard.setor}
            onChange={(e) =>
              onChangeFiltros({ ...filtrosDashboard, setor: e.target.value })
            }
            className="min-w-[150px] rounded-2xl border border-slate-300 px-3 py-1.5 bg-white text-xs focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todos</option>
            {setores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* FUNÇÃO */}
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-slate-600">Função</label>
          <select
            value={filtrosDashboard.funcao}
            onChange={(e) =>
              onChangeFiltros({ ...filtrosDashboard, funcao: e.target.value })
            }
            className="min-w-[150px] rounded-2xl border border-slate-300 px-3 py-1.5 bg-white text-xs focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todas</option>
            {funcoes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* CURSO/EXAME */}
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-slate-600">
            Curso/Exame
          </label>
          <select
            value={filtrosDashboard.tipo}
            onChange={(e) =>
              onChangeFiltros({ ...filtrosDashboard, tipo: e.target.value })
            }
            className="min-w-[150px] rounded-2xl border border-slate-300 px-3 py-1.5 bg-white text-xs focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todos</option>
            {cursosExames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* CAMPOS CUSTOM */}
        {customFilters
          .filter((c) => c.usarNoDashboard)
          .map((cf) => (
            <div className="space-y-1 text-xs" key={cf.id}>
              <label className="block font-semibold text-slate-600">
                {cf.nome}
              </label>
              <input
                type="text"
                value={filtrosDashboard.custom[cf.id] || ""}
                onChange={(e) =>
                  onChangeFiltros({
                    ...filtrosDashboard,
                    custom: {
                      ...filtrosDashboard.custom,
                      [cf.id]: e.target.value,
                    },
                  })
                }
                className="min-w-[150px] rounded-2xl border border-slate-300 px-3 py-1.5 bg-white text-xs focus:ring-2 focus:ring-sky-500"
                placeholder={`Filtrar por ${cf.nome}`}
              />
            </div>
          ))}
      </div>

      {/* CARDS DE PRIORIDADE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Vencidos"
          value={vencidos}
          subtitle="Ação imediata"
          color="red"
        />

        <StatCard
          title="Vence hoje"
          value={venceHoje}
          subtitle="Prioridade máxima"
          color="sky"
        />

        <StatCard
          title="Risco alto (≤ 7 dias)"
          value={riscoAlto}
          subtitle="Planejar urgente"
          color="orange"
        />

        <StatCard
          title="Risco médio (≤ 15 dias)"
          value={riscoMedio}
          subtitle="Atenção necessária"
          color="yellow"
        />

        <StatCard
          title="Risco baixo (≤ 30 dias)"
          value={riscoBaixo}
          subtitle="Monitorar"
          color="emerald"
        />

        <StatCard
          title="OK (> 30 dias)"
          value={ok}
          subtitle="Sem riscos próximos"
          color="green"
        />

        <StatCard
          title="Total monitorados"
          value={total}
          subtitle="Registros ativos"
          color="blue"
        />
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Resumo por colaborador
        </h3>

        <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">
                  Matrícula
                </th>
                <th className="px-3 py-2 text-left font-semibold">Nome</th>
                <th className="px-3 py-2 text-left font-semibold">Função</th>
                <th className="px-3 py-2 text-left font-semibold">Setor</th>
                <th className="px-3 py-2 text-left font-semibold">
                  Qtde Dias
                </th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>

            <tbody>
              {ordered.map((reg) => {
                const dias = reg.qtdeDias ?? 0;
                const prioridade = reg.prioridadeInfo ?? getPrioridadeStatus(dias);

                return (
                  <tr
                    key={reg.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2">{reg.matricula}</td>
                    <td className="px-3 py-2">{reg.colaboradorNome}</td>
                    <td className="px-3 py-2">{reg.funcao}</td>
                    <td className="px-3 py-2">{reg.setor}</td>

                    {/* QTDE DIAS COM COR */}
                    <td className="px-3 py-2 font-medium">
                      <span className={prioridade.num}>{dias}</span>
                    </td>

                    {/* BADGE STATUS */}
                    <td className="px-3 py-2">
                      <span
                        className={classNames(
                          "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold",
                          prioridade.bg,
                          prioridade.text
                        )}
                      >
                        {prioridade.label}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {ordered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-400 text-xs"
                  >
                    Nenhum registro encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =========================
// TELA REGISTROS
// =========================

type RegistrosViewProps = {
  registros: Registro[];
  setRegistros: (regs: Registro[]) => void;
  colaboradores: Colaborador[];
  customFilters: CustomFilter[];
  exames: ExameCurso[];
};

const RegistrosView: React.FC<RegistrosViewProps> = ({
  registros,
  setRegistros,
  colaboradores,
  customFilters,
  exames,
}) => {
  const [statusFiltro, setStatusFiltro] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("");
  const [filtrosCustom, setFiltrosCustom] = useState<Record<string, string>>(
    {}
  );
  const [extraCols, setExtraCols] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const colunasBase: CsvColumn[] = [
    { key: "matricula", label: "Matrícula" },
    { key: "colaboradorNome", label: "Colaborador" },
    { key: "funcao", label: "Função" },
    { key: "setor", label: "Setor" },
    { key: "baseOperacional", label: "Base Operacional" },
    { key: "cursoExame", label: "Curso/Exame" },
    { key: "tipo", label: "Tipo" },
    { key: "dataAdmissao", label: "Data Admissão" },
    { key: "dataUltimoEvento", label: "Data Último Evento" },
    { key: "vencimento", label: "Vencimento" },
    { key: "linkCertificado", label: "Link certificado" }, // 👈 novo
    { key: "qtdeDias", label: "Qtde Dias" },
    { key: "status", label: "Status" },
  ];

  const colunasExtras: CsvColumn[] = extraCols.map((nome) => ({
    key: nome,
    label: nome,
  }));

  const todasColunas = [...colunasBase, ...colunasExtras];

  const atualizarRegistro = (id: number, field: string, value: any) => {
    setRegistros(
      registros.map((r) => {
        if (r.id !== id) return r;

        let updated: Registro = { ...r, [field]: value };

        if (field === "matricula") {
          const colab = colaboradores.find((c) => c.matricula === value);
          if (colab) {
            updated = {
              ...updated,
              colaboradorNome: colab.nome,
              funcao: colab.funcao,
              setor: colab.setor,
              baseOperacional: colab.baseOperacional,
              dataAdmissao: colab.dataAdmissao,
            };
          }
        }

        if (
          field === "dataUltimoEvento" ||
          field === "cursoExame" ||
          field === "tipo"
        ) {
          const exam = exames.find(
            (e) => e.tipo === updated.tipo && e.nome === updated.cursoExame
          );

          if (exam && updated.dataUltimoEvento) {
            updated.vencimento = addDays(
              updated.dataUltimoEvento,
              exam.validadeDias
            );
            const diff = daysUntil(updated.vencimento);
            updated.qtdeDias = diff;
            updated.status = statusFromDays(diff);
          }
        }

        if (field === "vencimento" && updated.vencimento) {
          const diff = daysUntil(updated.vencimento);
          updated.qtdeDias = diff;
          updated.status = statusFromDays(diff);
        }

        return updated;
      })
    );
  };

  const adicionarLinha = () => {
    const novo: Registro = {
      id: Date.now(),
      matricula: "",
      colaboradorNome: "",
      funcao: "",
      setor: "",
      baseOperacional: "",
      tipo: "Exame",
      cursoExame: "",
      dataAdmissao: "",
      dataUltimoEvento: "",
      vencimento: "",
    };
    setRegistros([...registros, novo]);
  };

  const removerLinha = (id: number) => {
    setRegistros(registros.filter((r) => r.id !== id));
  };

  const adicionarColuna = () => {
    const nome = window.prompt("Nome da nova coluna personalizada:");
    if (!nome) return;
    if (extraCols.includes(nome)) return;
    setExtraCols([...extraCols, nome]);
  };

  const removerColuna = (nome: string) => {
    setExtraCols(extraCols.filter((c) => c !== nome));
    setRegistros(
      registros.map((r) => {
        const novo = { ...r };
        delete (novo as any)[nome];
        return novo;
      })
    );
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result ?? "");
      const matrix = parseCsv(text);
      if (!matrix.length) return;

      const [header, ...rows] = matrix;

      const indexToKey: Record<number, string> = {};
      todasColunas.forEach((col) => {
        const idx = header.findIndex(
          (h) => h.trim().toLowerCase() === col.label.toLowerCase()
        );
        if (idx >= 0) {
          indexToKey[idx] = col.key;
        }
      });

      const imported: Registro[] = rows
        .filter((r) => r.some((cell) => cell.trim() !== ""))
        .map((cells, idx) => {
          const base: any = {
            id: Date.now() + idx,
            tipo: "Exame",
          };

          Object.entries(indexToKey).forEach(([idxStr, key]) => {
            const i = Number(idxStr);
            base[key] = cells[i] ?? "";
          });

          if (base.vencimento) {
            const diff = daysUntil(base.vencimento);
            base.qtdeDias = diff;
            base.status = statusFromDays(diff);
          }

          return base as Registro;
        });

      setRegistros(imported);
      e.target.value = "";
    };

    reader.readAsText(file, "utf-8");
  };

  const exportarCsv = () => {
    downloadCsvFile("registros.csv", todasColunas, registros);
  };

  const exportarXls = () => {
    downloadXlsFile("registros.xls", todasColunas, registros);
  };

  const registrosFiltrados = registros.filter((reg) => {
    const diff = daysUntil(reg.vencimento);
    const status = statusFromDays(diff);

    if (statusFiltro) {
      if (statusFiltro === "Vencidos" && status !== "Vencido") return false;
      if (
        statusFiltro === "Vence em 30 dias ou menos" &&
        status !== "Vence em 30 dias"
      )
        return false;
      if (statusFiltro === "OK" && status !== "Ok") return false;
    }

    if (tipoFiltro && reg.tipo !== tipoFiltro) return false;

    for (const cf of customFilters.filter((c) => c.usarNosRegistros)) {
      const valorFiltro = filtrosCustom[cf.id];
      if (!valorFiltro) continue;
      const valorReg = (reg as any)[cf.nome];
      if (
        valorReg === undefined ||
        String(valorReg).toLowerCase() !== valorFiltro.toLowerCase()
      ) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filtros & Ações */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 text-xs">
          <label className="block text-slate-700 font-semibold">Status</label>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="rounded-2xl border border-slate-300 px-3 py-1.5 text-xs min-w-[180px] focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          >
            <option value="">Todos</option>
            <option value="Vencidos">Vencidos</option>
            <option value="Vence em 30 dias ou menos">
              Vence em 30 dias ou menos
            </option>
            <option value="OK">OK</option>
          </select>
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-700 font-semibold">
            Tipo (Exame/Curso)
          </label>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="rounded-2xl border border-slate-300 px-3 py-1.5 text-xs min-w-[140px] focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          >
            <option value="">Todos</option>
            <option value="Exame">Exame</option>
            <option value="Curso">Curso</option>
          </select>
        </div>

        {customFilters
          .filter((c) => c.usarNosRegistros)
          .map((cf) => (
            <div className="space-y-1 text-xs" key={cf.id}>
              <label className="block text-slate-700 font-semibold">
                {cf.nome}
              </label>
              <input
                type="text"
                value={filtrosCustom[cf.id] || ""}
                onChange={(e) =>
                  setFiltrosCustom({
                    ...filtrosCustom,
                    [cf.id]: e.target.value,
                  })
                }
                className="rounded-2xl border border-slate-300 px-3 py-1.5 text-xs min-w-[160px] focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                placeholder={`Filtrar por ${cf.nome}`}
              />
            </div>
          ))}

        <div className="ml-auto flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={adicionarColuna}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Nova coluna
          </button>
          <button
            type="button"
            onClick={adicionarLinha}
            className="rounded-full bg-sky-600 text-white px-3 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
          >
            + Nova linha
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Importar CSV
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Baixar CSV
          </button>
          <button
            type="button"
            onClick={exportarXls}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Baixar XLS
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[1100px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Matrícula</th>
              <th className="px-3 py-2 text-left font-semibold">
                Colaborador
              </th>
              <th className="px-3 py-2 text-left font-semibold">Função</th>
              <th className="px-3 py-2 text-left font-semibold">Setor</th>
              <th className="px-3 py-2 text-left font-semibold">
                Base Operacional
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Curso/Exame
              </th>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">
                Data Admissão
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Data Último Evento
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Vencimento
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Qtde Dias
              </th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Certificado</th> {/* 👈 novo */}

              {extraCols.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-semibold">
                  <div className="flex items-center gap-1">
                    {col}
                    <button
                      className="text-rose-500 text-[10px]"
                      onClick={() => removerColuna(col)}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}

              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.map((reg) => {
              const diff = daysUntil(reg.vencimento);
              const prioridade = getPrioridadeStatus(diff);

              return (
                <tr
                  key={reg.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.matricula}
                      onChange={(e) =>
                        atualizarRegistro(reg.id, "matricula", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.colaboradorNome}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "colaboradorNome",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.funcao}
                      onChange={(e) =>
                        atualizarRegistro(reg.id, "funcao", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.setor}
                      onChange={(e) =>
                        atualizarRegistro(reg.id, "setor", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.baseOperacional}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "baseOperacional",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
  <select
    className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1 text-xs"
    value={reg.cursoExame}
    onChange={(e) =>
      atualizarRegistro(reg.id, "cursoExame", e.target.value)
    }
  >
    <option value="">Selecione</option>
    {exames
      .filter((ex) => ex.tipo === reg.tipo) // só mostra exames/cursos do tipo escolhido
      .map((ex) => (
        <option key={ex.id} value={ex.nome}>
          {ex.nome}
        </option>
      ))}
  </select>
</td>

                  <td className="px-3 py-1.5">
                    <select
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1 text-xs"
                      value={reg.tipo}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "tipo",
                          e.target.value as TipoRegistro
                        )
                      }
                    >
                      <option value="Exame">Exame</option>
                      <option value="Curso">Curso</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.dataAdmissao}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "dataAdmissao",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.dataUltimoEvento}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "dataUltimoEvento",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                      value={reg.vencimento}
                      onChange={(e) =>
                        atualizarRegistro(
                          reg.id,
                          "vencimento",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  {/* QTDE DIAS COM COR POR PRIORIDADE */}
                  <td className="px-3 py-1.5">
                    <span
                      className={classNames(
                        "inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold",
                        prioridade.num
                      )}
                    >
                      {diff}
                    </span>
                  </td>

                  {/* STATUS / PRIORIDADE VISUAL */}
                  <td className="px-3 py-1.5">
                    <span
                      className={classNames(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold",
                        prioridade.bg,
                        prioridade.text
                      )}
                    >
                      {prioridade.label}
                    </span>
                  </td>

{/* 👇 NOVO CAMPO: LINK DO CERTIFICADO */}
<td className="px-3 py-1.5">
  <div className="flex items-center gap-1">
    <input
      className="flex-1 border border-slate-200 bg-transparent rounded-lg px-2 py-1 text-[11px]"
      value={reg.linkCertificado || ""}
      onChange={(e) =>
        atualizarRegistro(reg.id, "linkCertificado", e.target.value)
      }
      placeholder="https://... (Drive, OneDrive, etc.)"
    />
    {reg.linkCertificado && (
      <button
        type="button"
        className="text-sky-600 text-[11px] font-semibold underline whitespace-nowrap"
        onClick={() => window.open(reg.linkCertificado!, "_blank")}
      >
        Ver
      </button>
    )}
  </div>
</td>

                  {extraCols.map((colName) => (
                    <td key={colName} className="px-3 py-1.5">
                      <input
                        className="w-full border border-slate-200 bg-transparent rounded-lg px-2 py-1"
                        value={(reg as any)[colName] || ""}
                        onChange={(e) =>
                          atualizarRegistro(reg.id, colName, e.target.value)
                        }
                      />
                    </td>
                  ))}

                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => removerLinha(reg.id)}
                      className="text-rose-600 text-xs font-semibold hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}

            {registrosFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={13 + extraCols.length}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =========================
// TELA COLABORADORES
// =========================

type ColaboradoresViewProps = {
  colaboradores: Colaborador[];
  setColaboradores: (rows: Colaborador[]) => void;
  customFilters?: CustomFilter[]; // para compatibilidade com chamada
};

const ColaboradoresView: React.FC<ColaboradoresViewProps> = ({
  colaboradores,
  setColaboradores,
}) => {
  const [extraCols, setExtraCols] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const colunasBase: CsvColumn[] = [
    { key: "matricula", label: "Matrícula" },
    { key: "nome", label: "Colaborador" },
    { key: "funcao", label: "Função" },
    { key: "setor", label: "Setor" },
    { key: "baseOperacional", label: "Base Operacional" },
    { key: "dataAdmissao", label: "Data Admissão" },
  ];

  const colunasExtras: CsvColumn[] = extraCols.map((nome) => ({
    key: nome,
    label: nome,
  }));

  const todasColunas = [...colunasBase, ...colunasExtras];

  const atualizarColaborador = (id: number, field: string, value: any) => {
    setColaboradores(
      colaboradores.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const adicionarLinha = () => {
    const novo: Colaborador = {
      id: Date.now(),
      matricula: "",
      nome: "",
      funcao: "",
      setor: "",
      baseOperacional: "",
      dataAdmissao: "",
    };
    setColaboradores([...colaboradores, novo]);
  };

  const removerLinha = (id: number) => {
    setColaboradores(colaboradores.filter((c) => c.id !== id));
  };

  const adicionarColuna = () => {
    const nome = window.prompt("Nome da nova coluna personalizada:");
    if (!nome) return;
    if (extraCols.includes(nome)) return;
    setExtraCols([...extraCols, nome]);
  };

  const removerColuna = (nome: string) => {
    setExtraCols(extraCols.filter((c) => c !== nome));
    setColaboradores(
      colaboradores.map((c) => {
        const novo = { ...c };
        delete (novo as any)[nome];
        return novo;
      })
    );
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const matrix = parseCsv(text);
      if (!matrix.length) return;

      const [header, ...rows] = matrix;

      const indexToKey: Record<number, string> = {};
      todasColunas.forEach((col) => {
        const idx = header.findIndex(
          (h) => h.trim().toLowerCase() === col.label.toLowerCase()
        );
        if (idx >= 0) indexToKey[idx] = col.key;
      });

      const imported: Colaborador[] = rows
        .filter((r) => r.some((cell) => cell.trim() !== ""))
        .map((cells, idx) => {
          const base: any = {
            id: Date.now() + idx,
          };
          Object.entries(indexToKey).forEach(([idxStr, key]) => {
            const i = Number(idxStr);
            base[key] = cells[i] ?? "";
          });
          return base as Colaborador;
        });

      setColaboradores(imported);
      e.target.value = "";
    };
    reader.readAsText(file, "utf-8");
  };

  const exportarCsv = () => {
    downloadCsvFile("colaboradores.csv", todasColunas, colaboradores);
  };

  const exportarXls = () => {
    downloadXlsFile("colaboradores.xls", todasColunas, colaboradores);
  };

  return (
    <div className="space-y-4">
      {/* Ações */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={adicionarColuna}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Nova coluna
          </button>
          <button
            type="button"
            onClick={adicionarLinha}
            className="rounded-full bg-sky-600 text-white px-3 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
          >
            + Nova linha
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Importar CSV
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Baixar CSV
          </button>
          <button
            type="button"
            onClick={exportarXls}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Baixar XLS
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Tabela */}
      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Matrícula</th>
              <th className="px-3 py-2 text-left font-semibold">Colaborador</th>
              <th className="px-3 py-2 text-left font-semibold">Função</th>
              <th className="px-3 py-2 text-left font-semibold">Setor</th>
              <th className="px-3 py-2 text-left font-semibold">
                Base Operacional
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Data Admissão
              </th>
              {extraCols.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{col}</span>
                    <button
                      type="button"
                      onClick={() => removerColuna(col)}
                      className="text-rose-500 hover:text-rose-700 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c) => (
              <tr
                key={c.id}
                className="border-t border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.matricula}
                    onChange={(e) =>
                      atualizarColaborador(c.id, "matricula", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.nome}
                    onChange={(e) =>
                      atualizarColaborador(c.id, "nome", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.funcao}
                    onChange={(e) =>
                      atualizarColaborador(c.id, "funcao", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.setor}
                    onChange={(e) =>
                      atualizarColaborador(c.id, "setor", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.baseOperacional}
                    onChange={(e) =>
                      atualizarColaborador(
                        c.id,
                        "baseOperacional",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="date"
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={c.dataAdmissao}
                    onChange={(e) =>
                      atualizarColaborador(
                        c.id,
                        "dataAdmissao",
                        e.target.value
                      )
                    }
                  />
                </td>

                {extraCols.map((col) => (
                  <td key={col} className="px-3 py-1.5">
                    <input
                      className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                      value={(c as any)[col] || ""}
                      onChange={(e) =>
                        atualizarColaborador(c.id, col, e.target.value)
                      }
                    />
                  </td>
                ))}

                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => removerLinha(c.id)}
                    className="text-rose-600 text-xs font-semibold hover:underline"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}

            {colaboradores.length === 0 && (
              <tr>
                <td
                  colSpan={6 + extraCols.length}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  Nenhum colaborador cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =========================
// TELA EXAMES/CURSOS
// =========================

type ExamesViewProps = {
  exames: ExameCurso[];
  setExames: (rows: ExameCurso[]) => void;
};

const ExamesView: React.FC<ExamesViewProps> = ({ exames, setExames }) => {
  const adicionarLinha = () => {
    const novo: ExameCurso = {
      id: Date.now(),
      tipo: "Exame",
      nome: "",
      validadeDias: 365,
    };
    setExames([...exames, novo]);
  };

  const removerLinha = (id: number) => {
    setExames(exames.filter((e) => e.id !== id));
  };

  const atualizar = (id: number, field: keyof ExameCurso, value: any) => {
    setExames(
      exames.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500 max-w-xl">
          Cadastre aqui os tipos de Exames e Cursos e defina a validade em dias.
          Esses dados são usados automaticamente na aba Registros para calcular
          o vencimento.
        </p>
        <button
          type="button"
          onClick={adicionarLinha}
          className="rounded-full bg-sky-600 text-white px-3 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
        >
          + Novo exame/curso
        </button>
      </div>

      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">
                Curso/Exame
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Validade (dias)
              </th>
              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {exames.map((e) => (
              <tr
                key={e.id}
                className="border-t border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-3 py-1.5">
                  <select
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={e.tipo}
                    onChange={(ev) =>
                      atualizar(e.id, "tipo", ev.target.value as TipoRegistro)
                    }
                  >
                    <option value="Exame">Exame</option>
                    <option value="Curso">Curso</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={e.nome}
                    onChange={(ev) =>
                      atualizar(e.id, "nome", ev.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={0}
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={e.validadeDias}
                    onChange={(ev) =>
                      atualizar(
                        e.id,
                        "validadeDias",
                        Number(ev.target.value || 0)
                      )
                    }
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => removerLinha(e.id)}
                    className="text-rose-600 text-xs font-semibold hover:underline"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}

            {exames.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  Nenhum exame/curso cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =========================
// TELA CAMPOS & FILTROS
// =========================

type CamposFiltrosViewProps = {
  customFilters: CustomFilter[];
  setCustomFilters: (rows: CustomFilter[]) => void;
};

const CamposFiltrosView: React.FC<CamposFiltrosViewProps> = ({
  customFilters,
  setCustomFilters,
}) => {
  const adicionarCampo = () => {
    const nome = window.prompt(
      "Nome do campo personalizado (sem espaços especiais):"
    );
    if (!nome) return;

    const novo: CustomFilter = {
      id: String(Date.now()),
      nome,
      origem: "registros",
      usarNoDashboard: false,
      usarNosRegistros: true,
    };

    setCustomFilters([...customFilters, novo]);
  };

  const atualizarCampo = (id: string, patch: Partial<CustomFilter>) => {
    setCustomFilters(
      customFilters.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const removerCampo = (id: string) => {
    if (!window.confirm("Remover este campo personalizado?")) return;
    setCustomFilters(customFilters.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <p className="text-xs text-slate-500 max-w-xl">
          Crie campos personalizados para enriquecer seus registros e habilite
          quais deles poderão ser usados como filtros no Dashboard e na tela de
          Registros.
        </p>
        <button
          type="button"
          onClick={adicionarCampo}
          className="rounded-full bg-sky-600 text-white px-3 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
        >
          + Novo campo
        </button>
      </div>

      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">
                Nome do campo (chave)
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Usar no Dashboard
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                Usar nos Registros
              </th>
              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {customFilters.map((cf) => (
              <tr
                key={cf.id}
                className="border-t border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent border border-slate-200 rounded-lg px-2 py-1"
                    value={cf.nome}
                    onChange={(e) =>
                      atualizarCampo(cf.id, { nome: e.target.value })
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={cf.usarNoDashboard}
                    onChange={(e) =>
                      atualizarCampo(cf.id, {
                        usarNoDashboard: e.target.checked,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={cf.usarNosRegistros}
                    onChange={(e) =>
                      atualizarCampo(cf.id, {
                        usarNosRegistros: e.target.checked,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => removerCampo(cf.id)}
                    className="text-rose-600 text-xs font-semibold hover:underline"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}

            {customFilters.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  Nenhum campo personalizado criado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =========================
// TELA DE GESTÃO DE USUÁRIOS INTERNOS
// =========================

type UsuariosViewProps = {
  usuarios: UsuarioInterno[];
  currentUserId: string;
  isAdmin: boolean;
  onChangeRole: (id: number, newRole: "admin" | "user") => void;
  onOpenInvite: () => void;
};


const UsuariosView: React.FC<UsuariosViewProps> = ({
  usuarios,
  currentUserId,
  isAdmin,
  onChangeRole,
  onOpenInvite,
}) => {
  const isEmpty = usuarios.length === 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho + botão de convite */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-800">
            Usuários da empresa
          </h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Aqui você acompanha quem tem acesso ao SegVenc na sua empresa.{" "}
            <span className="font-semibold">
              Somente administradores podem alterar perfis.
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenInvite}
          className="rounded-full bg-sky-600 text-white px-4 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700"
        >
          + Convidar usuário
        </button>
      </div>

      {/* Aviso para não-admin */}
      {!isAdmin && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Seu perfil não é administrador. Você pode apenas visualizar os usuários
          da empresa.
        </div>
      )}

      {/* Tabela de usuários */}
      <div className="border border-slate-200 rounded-3xl overflow-auto bg-white">
        <table className="w-full text-xs min-w-[520px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Nome</th>
              <th className="px-3 py-2 text-left font-semibold">Referência</th>
              <th className="px-3 py-2 text-left font-semibold">
                Tipo de acesso
              </th>
              <th className="px-3 py-2 text-left font-semibold w-24">
                Situação
              </th>
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-center text-[11px] text-slate-400"
                >
                  Nenhum usuário encontrado para esta empresa.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => {
                const isSelf = u.authUserId === currentUserId;

                return (
                  <tr
                    key={u.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2 text-xs">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">
                          {u.nome || "Sem nome cadastrado"}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] text-slate-400">
                            (você)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {u.nome || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <select
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white disabled:bg-slate-50 disabled:text-slate-400"
                        value={u.role}
                        disabled={!isAdmin || isSelf}
                        onChange={(e) =>
                          onChangeRole(
                            u.id,
                            e.target.value as "admin" | "user"
                          )
                        }
                      >
                        <option value="admin">Administrador</option>
                        <option value="user">Usuário</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {u.role === "admin"
                          ? "Gerencia acessos"
                          : "Acesso comum"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// =========================
// TELA EMPRESA / CONFIGURAÇÕES
// =========================

type EmpresaViewProps = {
  empresaId: string | null;
};

const EmpresaView: React.FC<EmpresaViewProps> = ({ empresaId }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [emailNotificacao, setEmailNotificacao] = useState("");

  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega dados da empresa ao entrar na aba
  useEffect(() => {
    if (!empresaId) return;

    const loadEmpresa = async () => {
      setLoading(true);
      setErro(null);
      setMensagem(null);

      try {
        const { data, error } = await supabase
          .from("empresas")
          .select("id, nome, cnpj, email_notificacao")
          .eq("id", empresaId)
          .maybeSingle();

        if (error) {
          console.error("Erro ao carregar empresa:", error);
          setErro("Não foi possível carregar os dados da empresa.");
          return;
        }

        if (data) {
          setNome(data.nome ?? "");
          setCnpj(data.cnpj ?? "");
          setEmailNotificacao(data.email_notificacao ?? "");
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar empresa:", err);
        setErro("Erro inesperado ao carregar os dados da empresa.");
      } finally {
        setLoading(false);
      }
    };

    loadEmpresa();
  }, [empresaId]);

  const handleSave = async () => {
    if (!empresaId) {
      setErro("Empresa não definida. Faça login novamente.");
      return;
    }

    setSaving(true);
    setErro(null);
    setMensagem(null);

    try {
      const { error } = await supabase
        .from("empresas")
        .update({
          nome,
          cnpj,
          email_notificacao: emailNotificacao,
        })
        .eq("id", empresaId);

      if (error) {
        console.error("Erro ao salvar empresa:", error);
        setErro("Não foi possível salvar os dados da empresa.");
        return;
      }

      setMensagem("Dados da empresa atualizados com sucesso.");
    } catch (err) {
      console.error("Erro inesperado ao salvar empresa:", err);
      setErro("Erro inesperado ao salvar os dados da empresa.");
    } finally {
      setSaving(false);
    }
  };

  // Chama Edge Function para enviar e-mail de teste
  const handleSendTestEmail = async () => {
    if (!empresaId) {
      setErro("Empresa não definida. Faça login novamente.");
      return;
    }
    if (!emailNotificacao) {
      setErro("Informe um e-mail de notificações antes de enviar o teste.");
      return;
    }

    setTestLoading(true);
    setErro(null);
    setMensagem(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "segvenc-alertas-email",
        {
          body: {
            empresaId,
            modo: "teste",
          },
        }
      );

      if (error) {
        console.error("Erro ao chamar função de teste:", error);
        setErro("Não foi possível enviar o e-mail de teste.");
        return;
      }

      if (data?.error) {
        console.error("Erro retornado pela função:", data.error);
        setErro(data.error as string);
        return;
      }

      setMensagem(
        "E-mail de teste enviado. Verifique a caixa de entrada ou spam do endereço configurado."
      );
    } catch (err) {
      console.error("Erro inesperado ao enviar e-mail de teste:", err);
      setErro("Erro inesperado ao enviar o e-mail de teste.");
    } finally {
      setTestLoading(false);
    }
  };

  if (!empresaId) {
    return (
      <div className="text-xs text-slate-500">
        Empresa não identificada. Faça login novamente.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Título + descrição */}
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-800">
          Dados da empresa
        </h2>
        <p className="text-xs text-slate-500 max-w-xl">
          Ajuste as informações principais da sua empresa. O nome aparece no
          ambiente SegVenc e será usado em relatórios e notificações futuras.
        </p>
      </div>

      {/* Alertas */}
      {erro && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
          {mensagem}
        </div>
      )}

      {/* Card com formulário */}
      <div className="bg-white border border-slate-200 rounded-3xl px-4 py-4 space-y-4">
        <div className="space-y-1 text-xs">
          <label className="font-semibold text-slate-700">
            Nome da empresa
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-3 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Ex.: CGB - Distribuição de Energia"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-700">
              CNPJ (visual, por enquanto)
            </label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-700">
              E-mail para notificações
            </label>
            <input
              type="email"
              value={emailNotificacao}
              onChange={(e) => setEmailNotificacao(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="seguranca@empresa.com.br"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
          <span className="text-[11px] text-slate-400">
            ID da empresa:{" "}
            <span className="font-mono text-slate-500">{empresaId}</span>
          </span>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={testLoading || loading}
              className="rounded-full bg-sky-600 text-white px-4 py-1.5 text-[11px] font-semibold shadow hover:bg-sky-700 disabled:opacity-60"
            >
              {testLoading ? "Enviando teste..." : "Enviar e-mail de teste"}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-[11px] font-semibold shadow hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar dados da empresa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================
// APP PRINCIPAL
// =========================

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loadingInitialData, setLoadingInitialData] =
    useState<boolean>(false);

  const [currentTab, setCurrentTab] = useState<TabKey>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [exames, setExames] = useState<ExameCurso[]>([]);
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [filtrosDashboard, setFiltrosDashboard] = useState({
    setor: "",
    funcao: "",
    tipo: "",
    custom: {} as Record<string, string>,
  });

  const [usuariosInternos, setUsuariosInternos] = useState<UsuarioInterno[]>(
    []
  );
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  // Estados do modal de convite de usuário
const [showInviteModal, setShowInviteModal] = useState(false);
const [inviteEmail, setInviteEmail] = useState("");
const [inviteLoading, setInviteLoading] = useState(false);
const [inviteError, setInviteError] = useState<string | null>(null);
const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);


  // =========================
  // Salvar dados no Supabase
  // =========================

  const salvarColaboradores = async () => {
    if (!empresaId) {
      alert("Empresa não definida. Faça login novamente.");
      return;
    }

    const payload = colaboradores.map((c) => ({
      id: c.id,
      empresa_id: empresaId,
      matricula: c.matricula || null,
      nome: c.nome || null,
      funcao: c.funcao || null,
      setor: c.setor || null,
      base_operacional: c.baseOperacional || null,
      data_admissao: c.dataAdmissao || null,
    }));

    const { error } = await supabase
      .from("colaboradores")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar colaboradores:", error);
      throw new Error("Erro ao salvar colaboradores.");
    }
  };

  const salvarExames = async () => {
    if (!empresaId) {
      alert("Empresa não definida. Faça login novamente.");
      return;
    }

    const payload = exames.map((e) => ({
      id: e.id,
      empresa_id: empresaId,
      tipo: e.tipo,
      nome: e.nome,
      validade_dias: e.validadeDias,
    }));

    const { error } = await supabase
      .from("exames_cursos")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar exames/cursos:", error);
      throw new Error("Erro ao salvar exames/cursos.");
    }
  };

  const salvarRegistros = async () => {
    if (!empresaId) {
      alert("Empresa não definida. Faça login novamente.");
      return;
    }

    const payload = registros.map((r) => ({
      id: r.id,
      empresa_id: empresaId,
      matricula: r.matricula || null,
      colaborador_nome: r.colaboradorNome || null,
      funcao: r.funcao || null,
      setor: r.setor || null,
      base_operacional: r.baseOperacional || null,
      tipo: r.tipo,
      curso_exame: r.cursoExame,
      data_admissao: r.dataAdmissao || null,
      data_ultimo_evento: r.dataUltimoEvento || null,
      vencimento: r.vencimento || null,
      qtde_dias:
        typeof r.qtdeDias === "number" ? r.qtdeDias : null,
      status: r.status ?? null,
      link_certificado: r.linkCertificado || null, // novo campo
    }));

    const { error } = await supabase
      .from("registros")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar registros:", error);
      throw new Error("Erro ao salvar registros.");
    }
  };


  const salvarCamposFiltros = async () => {
    if (!empresaId) {
      alert("Empresa não definida. Faça login novamente.");
      return;
    }

    const payload = customFilters.map((cf) => ({
      id: Number(cf.id),
      empresa_id: empresaId,
      nome: cf.nome,
      origem: cf.origem,
      usar_no_dashboard: cf.usarNoDashboard,
      usar_nos_registros: cf.usarNosRegistros,
    }));

    const { error } = await supabase
      .from("custom_filters")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar campos/filtros personalizados:", error);
      throw new Error("Erro ao salvar campos/filtros.");
    }
  };

// =========================
// Convite de usuário (Edge Function invite_user)
// =========================

  const salvarTudo = async () => {
    if (!empresaId) {
      alert("Empresa não definida. Faça login novamente.");
      return;
    }

    try {
      setSaving(true);
      await salvarExames();
      await salvarColaboradores();
      await salvarRegistros();
      await salvarCamposFiltros();
      alert("Dados da empresa salvos com sucesso no SegVenc.");
    } catch (err) {
      console.error("Erro ao salvar dados:", err);
      alert(
        "Não foi possível salvar todos os dados. Verifique o console e tente novamente."
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Logout
  // =========================
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setEmpresaId(null);
    setMenuOpen(false);
  };

  // =====================
  // Auth listener
  // =====================

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // =====================
// Carregar dados do Supabase
// =====================

useEffect(() => {
  const loadAllData = async () => {
    if (!session) return;

    setLoadingInitialData(true);

    try {
      // 1) Tentar buscar vínculo do usuário com empresa
      const { data: usuario, error: userError } = await supabase
        .from("usuarios")
        .select("id, empresa_id, role")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      let empId: string | null = null;
      let role: "admin" | "user" = "user";

      if (userError) {
        console.error("Erro ao buscar usuario/empresa:", userError);
      }

      // 1A) Se não existe usuario OU não tem empresa_id -> cria tudo agora
      if (!usuario || !usuario.empresa_id) {
        const nomeEmpresaPadrao =
          "Empresa de " + (session.user.email ?? "usuário");

        // Cria empresa
        const { data: novaEmpresa, error: empresaError } = await supabase
          .from("empresas")
          .insert({ nome: nomeEmpresaPadrao })
          .select("id")
          .single();

        if (empresaError || !novaEmpresa) {
          console.error("Erro ao criar empresa padrão:", empresaError);
          setLoadingInitialData(false);
          return;
        }

        empId = String(novaEmpresa.id);
        role = "admin";

        if (usuario) {
          // Já existia linha em usuarios, só atualiza empresa_id
          const { error: updateUserError } = await supabase
            .from("usuarios")
            .update({ empresa_id: empId })
            .eq("id", usuario.id);

          if (updateUserError) {
            console.error(
              "Erro ao atualizar empresa_id do usuario existente:",
              updateUserError
            );
          }
        } else {
          // Não tinha linha em usuarios -> cria agora
          const { error: insertUserError } = await supabase
            .from("usuarios")
            .insert({
              auth_user_id: session.user.id,
              empresa_id: empId,
              nome: session.user.email,
              role: "admin",
            });

          if (insertUserError) {
            console.error(
              "Erro ao criar registro em usuarios:",
              insertUserError
            );
          }
        }
      } else {
        // 1B) Já existe tudo certinho
        empId = String(usuario.empresa_id);
        role = usuario.role;
      }

      if (!empId) {
        console.error("Não foi possível determinar empresa_id para o usuário.");
        setLoadingInitialData(false);
        return;
      }

      // Define no estado do app
      setEmpresaId(empId);
      setIsAdmin(role === "admin");

      // 2) colaboradores
      const { data: colabs, error: colabError } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empId)
        .order("nome", { ascending: true });

      if (colabError) {
        console.error("Erro ao carregar colaboradores:", colabError);
      } else if (colabs) {
        setColaboradores(colabs.map(mapColaboradorFromDb));
      }

      // 3) exames/cursos
      const { data: exams, error: examError } = await supabase
        .from("exames_cursos")
        .select("*")
        .eq("empresa_id", empId)
        .order("nome", { ascending: true });

      if (examError) {
        console.error("Erro ao carregar exames/cursos:", examError);
      } else if (exams) {
        setExames(exams.map(mapExameFromDb));
      }

      // 4) registros
      const { data: regs, error: regsError } = await supabase
        .from("registros")
        .select("*")
        .eq("empresa_id", empId);

      if (regsError) {
        console.error("Erro ao carregar registros:", regsError);
      } else if (regs) {
        setRegistros(regs.map(mapRegistroFromDb));
      }

      // 5) custom_filters
      const { data: filters, error: filtError } = await supabase
        .from("custom_filters")
        .select("*")
        .eq("empresa_id", empId);

      if (filtError) {
        console.error("Erro ao carregar custom_filters:", filtError);
      } else if (filters) {
        setCustomFilters(filters.map(mapCustomFilterFromDb));
      }

      // 6) usuarios da empresa
      const { data: usersData, error: usersError } = await supabase
        .from("usuarios")
        .select("id, auth_user_id, empresa_id, nome, role")
        .eq("empresa_id", empId);

      if (usersError) {
        console.error("Erro ao carregar usuarios:", usersError);
      } else if (usersData) {
        setUsuariosInternos(usersData.map(mapUsuarioFromDb));
      }
    } catch (err) {
      console.error("Erro inesperado ao carregar dados:", err);
    } finally {
      setLoadingInitialData(false);
    }
  };

  loadAllData();
}, [session]);



  const handleChangeUserRole = async (
    id: number,
    newRole: "admin" | "user"
  ) => {
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ role: newRole })
        .eq("id", id);

      if (error) {
        console.error("Erro ao atualizar role do usuário:", error);
        alert(
          "Não foi possível atualizar o tipo de acesso. Verifique se você é administrador."
        );
        return;
      }

      setUsuariosInternos((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      console.error("Erro inesperado ao atualizar usuário:", err);
      alert("Erro inesperado ao atualizar o usuário.");
    }
  };

  // ⬇️ COLE AQUI A FUNÇÃO NOVA

  const handleInviteUser = async () => {
    if (!empresaId) {
      setInviteError("Empresa não definida. Faça login novamente.");
      return;
    }

    if (!inviteEmail.trim()) {
      setInviteError("Informe o e-mail corporativo do usuário.");
      return;
    }

    setInviteError(null);
    setInviteSuccess(null);
    setInviteLoading(true);

    try {
      // chama a Edge Function invite_user pelo client do Supabase
      const { data, error } = await supabase.functions.invoke("invite_user", {
        body: {
          empresa_id: empresaId,
          email: inviteEmail.trim(),
        },
      });

      if (error) {
        console.error("Erro ao convidar usuário:", error);
        setInviteError(
          "Não foi possível enviar o convite. Verifique os dados e tente novamente."
        );
        return;
      }

      if (data?.error) {
        console.error("Erro retornado pela função:", data.error);
        setInviteError(data.error as string);
        return;
      }

      setInviteSuccess(
        "Convite enviado com sucesso. O usuário deve verificar o e-mail."
      );
    } catch (err) {
      console.error("Erro inesperado ao convidar usuário:", err);
      setInviteError("Erro inesperado ao enviar o convite.");
    } finally {
      setInviteLoading(false);
    }
  };

  if (!session) {
    return <AuthScreen onAuth={setSession} />;
  }

  if (loadingInitialData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white rounded-3xl shadow px-6 py-4 text-sm text-slate-600">
          Carregando dados da sua empresa...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-sky-900 flex items-center justify-center shadow-md overflow-hidden">
              <img
                src="/plenum_icon_192x192.png"
                alt="SegVenc"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-slate-900">
                SegVenc
              </span>
              <span className="text-[11px] text-slate-500">
                Gestão de vencimentos de exames, cursos e ASO
              </span>
            </div>
          </div>

          {/* Usuário / menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-slate-50"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white">
                {session.user.email?.[0]?.toUpperCase() ?? "U"}
              </span>
              <span className="hidden sm:inline text-slate-700 max-w-[140px] truncate">
                {session.user.email}
              </span>
              <span className="text-slate-400 text-[10px]">▼</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-2xl shadow-lg text-xs z-10">
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-100"
                  onClick={() => alert("Perfil em desenvolvimento")}
                >
                  Perfil
                </button>

                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-100"
                  onClick={() =>
                    alert("Função de alterar senha em desenvolvimento")
                  }
                >
                  Alterar senha
                </button>

                <button
                  className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50"
                  onClick={handleSignOut}
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-6xl mx-auto px-4 py-4 w-full flex-1">
        {/* Abas */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(
            [
              ["dashboard", "Dashboard"],
              ["registros", "Registros"],
              ["colaboradores", "Colaboradores"],
              ["exames", "Exames/Cursos"],
              ["campos", "Campos & Filtros"],
              ["usuarios", "Usuários"],
              ["empresa", "Empresa"], // 👈 nova aba
            ] as [TabKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCurrentTab(key)}
              className={classNames(
                "px-3 py-1.5 rounded-full text-xs font-semibold border",
                currentTab === key
                  ? "bg-sky-600 text-white border-sky-600 shadow"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Botão salvar dados (colaboradores/registros/exames/campos) */}
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={salvarTudo}
            disabled={saving || !empresaId}
            className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-[11px] font-semibold shadow hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Salvando dados..." : "Salvar dados da empresa"}
          </button>
        </div>

        {/* Views */}
        {currentTab === "dashboard" && (
          <DashboardView
            registros={registros}
            colaboradores={colaboradores}
            filtrosDashboard={filtrosDashboard}
            onChangeFiltros={setFiltrosDashboard}
            customFilters={customFilters}
          />
        )}

        {currentTab === "registros" && (
          <RegistrosView
            registros={registros}
            setRegistros={setRegistros}
            colaboradores={colaboradores}
            customFilters={customFilters}
            exames={exames}
          />
        )}

        {currentTab === "colaboradores" && (
          <ColaboradoresView
            colaboradores={colaboradores}
            setColaboradores={setColaboradores}
            customFilters={customFilters}
          />
        )}

        {currentTab === "exames" && (
          <ExamesView exames={exames} setExames={setExames} />
        )}

        {currentTab === "campos" && (
          <CamposFiltrosView
            customFilters={customFilters}
            setCustomFilters={setCustomFilters}
          />
        )}

               {currentTab === "usuarios" && (
          <UsuariosView
            usuarios={usuariosInternos}
            currentUserId={session.user.id}
            isAdmin={isAdmin}
            onChangeRole={handleChangeUserRole}
            onOpenInvite={() => {
              setInviteError(null);
              setInviteSuccess(null);
              setInviteEmail("");
              setShowInviteModal(true);
            }}
          />
        )}


        {currentTab === "empresa" && <EmpresaView empresaId={empresaId} />}
      {/* Modal de convite de usuário */}
        {showInviteModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
            <div className="bg-white rounded-3xl shadow-xl px-6 py-5 max-w-sm w-full text-xs">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Convidar novo usuário
              </h2>

              <label className="block text-slate-700 font-semibold mb-1">
                E-mail corporativo
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-3 text-xs"
                placeholder="usuario@empresa.com"
              />

              {inviteError && (
                <div className="text-rose-600 text-xs mb-2">{inviteError}</div>
              )}
              {inviteSuccess && (
                <div className="text-emerald-600 text-xs mb-2">
                  {inviteSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-4 py-1.5 rounded-full border border-slate-300 text-[11px]"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setInviteError(null);
                    setInviteSuccess(null);
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="px-4 py-1.5 rounded-full bg-sky-600 text-white text-[11px]"
                  disabled={inviteLoading}
                  onClick={handleInviteUser}
                >
                  {inviteLoading ? "Enviando..." : "Enviar convite"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;