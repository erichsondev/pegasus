import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fazerCadastro } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const Cadastro = () => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sucesso = await fazerCadastro(nome, email, senha);
    
    if (sucesso) {
      toast({
        title: "Conta criada com sucesso!",
        description: "Faça login para começar a usar o Pegasus Finance",
      });
      navigate("/login");
    } else {
      toast({
        title: "Erro no cadastro",
        description: "Este e-mail já está cadastrado",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-md glass-card border-slate-200 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-white/50 p-3 rounded-full w-fit mb-2">
            <img src={logo} alt="Pegasus Finance" className="w-16 h-16 object-contain" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-800">Criar Conta</CardTitle>
          <CardDescription>Junte-se ao Pegasus Finance</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="bg-white/50"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/50"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
                className="bg-white/50"
              />
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-blue-700 text-lg font-medium h-11 mt-2">
              Cadastrar
            </Button>
          </form>

          <div className="mt-8 text-center flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-primary hover:text-blue-700 font-semibold hover:underline"
              >
                Fazer login
              </button>
            </p>
            
            {/* Link Nativo Restaurado */}
            <a
              href="https://pegasus-finance.onrender.com/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-block"
            >
              ← Voltar para o início
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Cadastro;