import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fazerLogin } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sucesso = await fazerLogin(email, senha);
    
    if (sucesso) {
      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo de volta ao Pegasus Finance",
      });
      navigate("/menu");
    } else {
      toast({
        title: "Erro no login",
        description: "E-mail ou senha incorretos",
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
          <CardTitle className="text-3xl font-bold text-slate-800">Pegasus Finance</CardTitle>
          <CardDescription>Entre para gerenciar suas finanças</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="bg-white/50"
              />
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-blue-700 text-lg font-medium h-11 mt-2">
              Entrar
            </Button>
          </form>

          <div className="mt-8 text-center flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Ainda não tem uma conta?{" "}
              <button
                onClick={() => navigate("/cadastro")}
                className="text-primary hover:text-blue-700 font-semibold hover:underline"
              >
                Criar conta gratuitamente
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

export default Login;