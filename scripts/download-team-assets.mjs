import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const teamDir = path.join(root, 'src', 'assets', 'teams');
const flagDir = path.join(root, 'src', 'assets', 'flags');
await fs.mkdir(teamDir, { recursive: true });
await fs.mkdir(flagDir, { recursive: true });

const clubs = {
  cap: 'Athletico Paranaense', cam: 'Atletico Mineiro', bah: 'Bahia', bot: 'Botafogo',
  cha: 'Chapecoense', cor: 'Corinthians', cfc: 'Coritiba', cru: 'Cruzeiro', fla: 'Flamengo',
  flu: 'Fluminense', gre: 'Gremio', int: 'Internacional', mir: 'Mirassol', pal: 'Palmeiras',
  rbb: 'Red Bull Bragantino', rem: 'Remo', san: 'Santos', sao: 'Sao Paulo',
  vas: 'Vasco da Gama', vit: 'Vitoria',
};

const flags = {
  arg: 'ar', alg: 'dz', aus: 'au', aut: 'at', bel: 'be', bih: 'ba', bra: 'br', can: 'ca',
  cpv: 'cv', col: 'co', kor: 'kr', civ: 'ci', cro: 'hr', cuw: 'cw', ecu: 'ec', egy: 'eg',
  sco: 'gb-sct', esp: 'es', usa: 'us', fra: 'fr', gha: 'gh', hai: 'ht', ned: 'nl', eng: 'gb-eng',
  irn: 'ir', irq: 'iq', jpn: 'jp', jor: 'jo', mar: 'ma', mex: 'mx', nzl: 'nz', nor: 'no',
  pan: 'pa', par: 'py', por: 'pt', qat: 'qa', cod: 'cd', cze: 'cz', ksa: 'sa', sen: 'sn',
  rsa: 'za', swe: 'se', sui: 'ch', tun: 'tn', tur: 'tr', uru: 'uy', uzb: 'uz', ger: 'de',
};

async function download(url, destination) {
  const response = await fetch(url, { headers: { 'user-agent': 'GoalTask asset builder' } });
  if (!response.ok) throw new Error(`${response.status} em ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 50) throw new Error(`Imagem vazia em ${url}`);
  await fs.writeFile(destination, bytes);
}

async function exists(file) {
  try { return (await fs.stat(file)).size > 0; } catch { return false; }
}

for (const [code, name] of Object.entries(clubs)) {
  const destination = path.join(teamDir, `${code}.png`);
  if (await exists(destination)) continue;
  const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Busca falhou para ${name}: ${response.status}`);
  const teams = (await response.json()).teams || [];
  const team = teams.find((item) => item.strSport === 'Soccer' && item.strCountry === 'Brazil') || teams.find((item) => item.strSport === 'Soccer');
  if (!team?.strBadge) throw new Error(`Escudo não encontrado: ${name}`);
  await download(team.strBadge, destination);
  console.log(`clube ${code}: ${team.strTeam}`);
}

for (const [code, country] of Object.entries(flags)) {
  const destination = path.join(flagDir, `${code}.png`);
  if (await exists(destination)) continue;
  await download(`https://flagcdn.com/w80/${country}.png`, destination);
  console.log(`bandeira ${code}`);
}
