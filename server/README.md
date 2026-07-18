# GoalTask API

Servidor intermediário em Cloudflare Workers. Ele mantém o token da football-data.org fora do aplicativo e compartilha uma resposta em cache por 60 segundos.

## Publicar

```powershell
cd server
npm.cmd install
npx.cmd wrangler login
npm.cmd run secret
npm.cmd run deploy
```

Ao executar `npm.cmd run secret`, cole o token da football-data.org no prompt. Nunca coloque o token no código.

Depois do deploy, teste `https://SEU-WORKER.workers.dev/health` e copie a URL para a configuração do GoalTask.
