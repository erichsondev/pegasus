import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, UserPlus, Wallet } from "lucide-react";
import logo from "@/assets/logo.png";

const Index = () => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        toast({
          title: "Acesso Negado",
          description: "E-mail ou senha incorretos.",
          variant: "destructive",
        });
      } else {
        navigate("/menu"); 
      }
    } else {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: nome } }
      });
      
      if (error) {
        toast({
          title: "Erro no Cadastro",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Conta criada com sucesso!",
          description: "Seu cadastro foi realizado. Você já pode fazer o login.",
        });
        setIsLogin(true); 
        setPassword("");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-4xl grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        
        <div className="flex flex-col justify-center text-white space-y-6 bg-black/40 p-8 rounded-2xl backdrop-blur-sm border border-white/10 h-full">
          <img 
            src={logo} 
            alt="Pegasus Finance" 
            className="h-16 w-16 mb-4 bg-white p-2 rounded-xl self-start object-contain" 
          />
          <h1 className="text-4xl font-bold leading-tight">Pegasus Finance</h1>
          <p className="text-lg text-gray-200">
            Plataforma centralizada para gestão de receitas, despesas, cartões de crédito e planejamento do seu futuro financeiro.
          </p>
          <ul className="space-y-4 mt-4">
            <li className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-primary shrink-0" />
              <span>Controle total do seu fluxo de caixa</span>
            </li>
          </ul>
        </div>

        <Card className="flex flex-col justify-center p-8 glass-card border-t-4 border-t-primary shadow-2xl h-full">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              {isLogin ? <Lock className="h-6 w-6 text-primary" /> : <UserPlus className="h-6 w-6 text-primary" />}
            </div>
            <h2 className="text-2xl font-bold text-slate-800">{isLogin ? "Acesso à Conta" : "Criar sua Conta"}</h2>
            <p className="text-muted-foreground mt-2">
              {isLogin ? "Insira suas credenciais para continuar" : "Preencha os dados para se cadastrar"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                <Input 
                  type="text" 
                  placeholder="Seu nome" 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required={!isLogin}
                  className="bg-white/50"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">E-mail</label>
              <Input 
                type="email" 
                placeholder="seu@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Senha</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/50"
              />
            </div>
            <Button type="submit" className="w-full mt-6" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              {loading ? "Aguarde..." : (isLogin ? "Entrar no Sistema" : "Finalizar Cadastro")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setPassword(""); setNome(""); }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline font-medium"
            >
              {isLogin ? "Não tem uma conta? Cadastre-se" : "Já possui conta? Faça o login"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;