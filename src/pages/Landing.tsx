import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Shield, BarChart3, Zap } from "lucide-react";
import logo from "@/assets/logo.png";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Pegasus Finance" className="w-10 h-10 md:w-12 md:h-12" />
            <h1 className="text-2xl md:text-3xl font-bold text-primary">Pegasus Finance</h1>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/cadastro")}>
              Criar Conta
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Controle Total das Suas Finanças
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Gerencie receitas, despesas, investimentos e cartões de crédito em um só lugar.
            Simples, intuitivo e totalmente gratuito.
          </p>
          <Button size="lg" onClick={() => navigate("/cadastro")} className="text-lg px-8">
            Começar Agora
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Acompanhamento em Tempo Real</h3>
            <p className="text-sm text-muted-foreground">
              Veja seu saldo atual e projeções futuras instantaneamente
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-success" />
            </div>
            <h3 className="font-semibold mb-2">Seguro e Privado</h3>
            <p className="text-sm text-muted-foreground">
              Seus dados ficam no seu navegador, 100% privado
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-info/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6 text-info" />
            </div>
            <h3 className="font-semibold mb-2">Análise Gráfica</h3>
            <p className="text-sm text-muted-foreground">
              Visualize seus gastos por categoria e evolução mensal
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-warning" />
            </div>
            <h3 className="font-semibold mb-2">Lançamentos Automáticos</h3>
            <p className="text-sm text-muted-foreground">
              Configure contas fixas e economize tempo todos os meses
            </p>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="inline-block p-8 bg-primary text-primary-foreground">
            <h3 className="text-2xl font-bold mb-4">Pronto para organizar suas finanças?</h3>
            <p className="mb-6 opacity-90">
              Crie sua conta gratuitamente e comece agora mesmo
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => navigate("/cadastro")}
            >
              Criar Conta Grátis
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Landing;
