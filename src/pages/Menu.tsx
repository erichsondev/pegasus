import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, FileText, Settings, TrendingUp } from "lucide-react";

const Menu = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: "Acompanhamento",
      description: "Gerencie suas receitas e despesas",
      icon: TrendingUp,
      path: "/acompanhamento",
      color: "text-primary"
    },
    {
      title: "Análise Gráfica",
      description: "Visualize seus dados em gráficos",
      icon: BarChart3,
      path: "/graficos",
      color: "text-info"
    },
    {
      title: "Configurações",
      description: "Categorias, cartões e lançamentos fixos",
      icon: Settings,
      path: "/matriz",
      color: "text-warning"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-8 text-center">Menu Principal</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {menuItems.map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-l-4 border-l-primary"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <item.icon className={`w-8 h-8 ${item.color}`} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Menu;
