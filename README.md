# GoalTask

Versão atual: **0.8.0**

Protótipo de placares de futebol na área de notificações do Windows. Ao clicar no ícone ao lado do relógio, um painel discreto abre acima da barra de tarefas.

## O que já funciona

- Ícone e menu na bandeja do Windows
- Painel sem botão permanente na barra de tarefas
- Faixa compacta sempre visível, encaixada acima da barra de tarefas
- Jogos demonstrativos, filtro e favoritos persistentes
- Atualização automática a cada minuto
- Notificação do Windows por meio do botão **Simular gol**
- Empacotamento para Windows com Electron Forge

## Executar

1. Instale o Node.js LTS.
2. Abra um PowerShell nesta pasta.
3. Execute:

```powershell
npm install
npm start
```

Se o terminal já estava aberto quando o Node.js foi instalado, feche-o e abra um novo para que o comando `npm` seja reconhecido.

O Windows pode esconder o novo ícone na seta `^` ao lado do relógio.

## Criar instalador

```powershell
npm run make
```

O resultado será criado em `out/make`.

## Notícias

A versão 0.8.0 inclui notícias gerais de futebol e um filtro baseado nos times favoritos. A rota `/news` é fornecida pelo Worker do Cloudflare e mantém cache por 15 minutos.

## Atualizações automáticas

A versão instalada verifica atualizações publicadas em `mellgamers122/GoalTask` ao iniciar e depois a cada hora. Para lançar uma versão, aumente o campo `version`, gere os artefatos Squirrel e publique uma GitHub Release com tag SemVer, por exemplo `v0.6.1`.

## Próxima etapa: dados reais

O app usa a football-data.org para buscar as competições disponíveis no plano da conta, incluindo Copa do Mundo e grandes ligas no plano gratuito. Os placares do plano grátis podem ter atraso.

Por padrão, o aplicativo usa o servidor compartilhado `https://goaltask-api.guinardo298.workers.dev`, que mantém o token fora do aplicativo. Usuários comuns não precisam criar conta nem configurar token.

1. Crie uma conta em <https://www.football-data.org/client/register> e copie seu token.
2. Abra o GoalTask, clique na engrenagem, cole o token e clique em **Conectar**. O token será validado antes de ser salvo.

Alternativamente, duplique `.env.example` com o nome `.env` e preencha:

```text
FOOTBALL_DATA_TOKEN=seu_token_aqui
```

4. Feche e abra o GoalTask novamente com `npm start`.

A chave é lida somente pelo processo principal do Electron. Os favoritos recebem notificações quando o placar aumenta após uma atualização.
