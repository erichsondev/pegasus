# Pegasus Finance

Sistema de gestão financeira pessoal desenvolvido com React + TypeScript + Vite.

## 🚀 Tecnologias

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Shadcn/ui, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL (Render)
- **Autenticação**: JWT
- **Gráficos**: Recharts

## 📋 Pré-requisitos

- Node.js 20.x ou superior
- npm ou yarn

## 🔧 Configuração

1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd pegasus-finance
```

2. Instale as dependências do frontend
```bash
npm install
```

3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_API_URL=https://seu-backend.onrender.com
```

Para desenvolvimento local, use:
```env
VITE_API_URL=http://localhost:3000
```

4. Inicie o servidor de desenvolvimento
```bash
npm run dev
```

## 🗄️ Backend

O backend está separado e roda no Render com PostgreSQL. Os arquivos do backend estão em `backend/`.

### Configurar Backend Localmente

1. Entre na pasta do backend
```bash
cd backend
```

2. Instale as dependências
```bash
npm install
```

3. Configure as variáveis de ambiente

Crie um arquivo `.env` na pasta backend:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/database
JWT_SECRET=sua-chave-secreta-super-segura
PORT=3000
```

4. Inicie o servidor backend
```bash
npm start
```

## 📦 Deploy

### Frontend (Lovable)

O frontend é automaticamente deployado através do Lovable ao fazer push para o GitHub.

### Backend (Render)

O backend está configurado para deploy automático no Render:
1. Conecte seu repositório GitHub no Render
2. Configure as variáveis de ambiente no Render
3. O deploy acontece automaticamente ao fazer push

## 🎯 Funcionalidades

- ✅ Autenticação de usuários (JWT)
- ✅ Gestão de receitas, despesas e investimentos
- ✅ Lançamentos fixos recorrentes
- ✅ Categorização de gastos
- ✅ Gestão de cartões de crédito
- ✅ Resumo financeiro mensal
- ✅ Gráficos e análises
- ✅ Cálculo de saldo atual e projetado
- ✅ Confirmação para limpar dados do mês

## 📱 Páginas

- `/` - Landing page
- `/login` - Login
- `/cadastro` - Cadastro
- `/menu` - Menu principal
- `/acompanhamento` - Gestão de transações
- `/matriz` - Configurações (categorias, cartões, lançamentos fixos)
- `/graficos` - Análise gráfica

## 🎨 Design

O sistema utiliza o design system do Pegasus Finance com:
- Cor primária: #007bff (azul)
- Fonte: Poppins
- Componentes Shadcn/ui customizados
- Responsivo (mobile-first)

## 📄 Licença

ISC

## 👨‍💻 Autor

Erichson Reis
