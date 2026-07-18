# GoalTask

Versão atual: **0.9.0**

Protótipo de placares de futebol na área de notificações do Windows. Ao clicar no ícone ao lado do relógio, um painel discreto abre acima da barra de tarefas.

## O que já funciona

- Ícone e menu na bandeja do Windows
- Painel sem botão permanente na barra de tarefas
- Faixa compacta sempre visível, encaixada acima da barra de tarefas
- Placares reais e favoritos persistentes por equipe
- Catálogo com os 20 clubes da Série A 2026 e as 48 seleções da Copa do Mundo 2026
- Escudos e bandeiras disponíveis localmente
- Atualização a cada 15 segundos durante partidas ao vivo e a cada minuto nos demais períodos
- Notícias de futebol via RSS com fonte reserva
- Notificações de gol para equipes favoritas
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

A versão 0.9.0 inclui notícias gerais de futebol via RSS. O Google Notícias é consultado pelo Worker e o Bing Notícias funciona como fonte reserva no servidor e no próprio aplicativo.

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
