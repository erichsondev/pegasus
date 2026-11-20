import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TrendingUp, Shield, BarChart3, Zap, Sun, Moon, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

const Landing = () => {
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  return (
    <div className="min-h-screen relative">
      {/* Navbar da Landing */}
      <header className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-md border-b z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Pegasus Finance"
              className="w-10 h-10 object-contain bg-white p-1 rounded-lg shadow-sm"
            />
            <span className="text-xl font-bold text-foreground">Pegasus Finance</span>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Alternar tema">
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>Claro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>Escuro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>Sistema</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" onClick={() => navigate("/acesso")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/acesso?modo=cadastro")}>
              Criar Conta
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto pt-28 pb-20 px-6 animate-fade-in">
        {/* Hero Translúcido no Padrão Benefícios 360 */}
        <div className="text-white bg-black/50 dark:bg-black/60 p-10 md:p-14 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl mb-14">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-xs font-semibold uppercase tracking-wider mb-4 border border-primary/30">
              Gestão Financeira Inteligente
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Controle Total das Suas Finanças Pessoais e Domésticas
            </h1>
            <p className="text-lg md:text-xl text-gray-200 mb-8 leading-relaxed">
              Gerencie receitas, despesas, recorrências automáticas, cartões de crédito e projeções de caixa em um único painel rápido e intuitivo.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={() => navigate("/acesso?modo=cadastro")} className="text-base px-8 gap-2">
                Começar Agora <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/acesso")}
                className="text-base px-8 bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
              >
                Já tenho conta
              </Button>
            </div>
          </div>
        </div>

        {/* Cards de Recursos */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="p-6 glass-card hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Fluxo em Tempo Real</h3>
            <p className="text-sm text-muted-foreground">
              Acompanhe o saldo efetivado em conta e a projeção exata até o fechamento do mês.
            </p>
          </Card>

          <Card className="p-6 glass-card hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Recorrências Automáticas</h3>
            <p className="text-sm text-muted-foreground">
              Cadastre salários e contas fixas uma única vez e projete automaticamente os próximos meses.
            </p>
          </Card>

          <Card className="p-6 glass-card hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Inteligência e DRE</h3>
            <p className="text-sm text-muted-foreground">
              Analise evolução patrimonial acumulada, ranking de gastos e DRE gerencial por categoria.
            </p>
          </Card>

          <Card className="p-6 glass-card hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Dados Isolados (RLS)</h3>
            <p className="text-sm text-muted-foreground">
              Segurança em nível de linha no banco de dados garantindo acesso exclusivo à sua conta.
            </p>
          </Card>
        </div>

        {/* CTA Final */}
        <Card className="p-8 md:p-10 glass-card border-t-4 border-t-primary flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Pronto para organizar suas finanças?</h3>
            <p className="text-muted-foreground">
              Acesse sua conta ou crie um cadastro gratuito em segundos.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/acesso?modo=cadastro")} className="px-8 shrink-0">
            Criar Conta Grátis
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Landing;