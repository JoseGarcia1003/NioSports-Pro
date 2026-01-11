// NioSports NBA Stats Scraper v6.0 - COLUMNA CORRECTA
// FIX CRÍTICO: Lee la columna correcta según el tipo de stat
// - Stats generales: Columna "2025" (índice 2)
// - Stats Home: Columna "Home" (índice 5)
// - Stats Away: Columna "Away" (índice 6)

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

// Obtener fecha actual
function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const TODAY = getCurrentDate();
console.log(`📅 Fecha: ${TODAY}\n`);

// URLs base (sin parámetros de fecha para stats generales)
const STATS_CONFIG = [
  // PPG
  { key: 'ppg', url: 'https://www.teamrankings.com/nba/stat/points-per-game', column: '2025' },
  { key: 'ppgHome', url: 'https://www.teamrankings.com/nba/stat/points-per-game', column: 'Home' },
  { key: 'ppgAway', url: 'https://www.teamrankings.com/nba/stat/points-per-game', column: 'Away' },
  
  // Q1
  { key: 'q1', url: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game', column: '2025' },
  { key: 'q1Home', url: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game', column: 'Home' },
  { key: 'q1Away', url: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game', column: 'Away' },
  
  // 1H
  { key: 'half', url: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game', column: '2025' },
  { key: 'halfHome', url: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game', column: 'Home' },
  { key: 'halfAway', url: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game', column: 'Away' },
  
  // PACE
  { key: 'pace', url: 'https://www.teamrankings.com/nba/stat/possessions-per-game', column: '2025' },
  
  // Opponent PPG (Defensive)
  { key: 'oppPpg', url: 'https://www.teamrankings.com/nba/stat/opponent-points-per-game', column: '2025' },
  { key: 'oppPpgHome', url: 'https://www.teamrankings.com/nba/stat/opponent-points-per-game', column: 'Home' },
  { key: 'oppPpgAway', url: 'https://www.teamrankings.com/nba/stat/opponent-points-per-game', column: 'Away' },
  
  // Opponent Q1
  { key: 'oppQ1', url: 'https://www.teamrankings.com/nba/stat/opponent-1st-quarter-points-per-game', column: '2025' },
  
  // Opponent 1H
  { key: 'oppHalf', url: 'https://www.teamrankings.com/nba/stat/opponent-1st-half-points-per-game', column: '2025' }
];

const TEAM_NAME_MAP = {
  'Atlanta': 'Hawks', 'Boston': 'Celtics', 'Brooklyn': 'Nets', 'Charlotte': 'Hornets',
  'Chicago': 'Bulls', 'Cleveland': 'Cavaliers', 'Dallas': 'Mavericks', 'Denver': 'Nuggets',
  'Detroit': 'Pistons', 'Golden State': 'Warriors', 'Houston': 'Rockets', 'Indiana': 'Pacers',
  'LA Clippers': 'Clippers', 'LA Lakers': 'Lakers', 'Memphis': 'Grizzlies', 'Miami': 'Heat',
  'Milwaukee': 'Bucks', 'Minnesota': 'Timberwolves', 'New Orleans': 'Pelicans', 'New York': 'Knicks',
  'Oklahoma City': 'Thunder', 'Okla City': 'Thunder', 'Orlando': 'Magic', 'Philadelphia': '76ers',
  'Phoenix': 'Suns', 'Portland': 'Trail Blazers', 'Sacramento': 'Kings', 'San Antonio': 'Spurs',
  'Toronto': 'Raptors', 'Utah': 'Jazz', 'Washington': 'Wizards'
};

function normalizeTeamName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  return TEAM_NAME_MAP[trimmed] || trimmed;
}

async function scrapeTable(url, statKey, targetColumn) {
  console.log(`📊 ${statKey} (columna: ${targetColumn})`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    const data = {};
    
    // PASO 1: Encontrar el índice de la columna correcta por su nombre en el header
    let columnIndex = 2; // Default: columna 2 (2025)
    
    $('table thead tr th, table thead tr td').each((idx, th) => {
      const headerText = $(th).text().trim();
      // Buscar coincidencia exacta o parcial con el nombre de la columna objetivo
      if (headerText === targetColumn || headerText.includes(targetColumn)) {
        columnIndex = idx;
        console.log(`   ✓ Columna "${targetColumn}" encontrada en índice ${idx}`);
      }
    });
    
    // PASO 2: Extraer datos de la columna correcta
    $('table tbody tr').each((rowIndex, row) => {
      const cells = $(row).find('td');
      if (cells.length < columnIndex + 1) return;
      
      // Columna 0: Rank
      const rank = parseInt($(cells[0]).text().trim()) || (rowIndex + 1);
      
      // Columna 1: Team name
      const teamCell = $(cells[1]);
      let teamName = teamCell.find('a').text().trim() || teamCell.text().trim();
      const normalized = normalizeTeamName(teamName);
      if (!normalized) return;
      
      // Columna objetivo: Valor
      const valueText = $(cells[columnIndex]).text().trim();
      const value = parseFloat(valueText);
      
      if (!isNaN(value) && value > 0 && value < 200) {
        data[normalized] = { value, rank };
        
        // Debug para Memphis/Grizzlies
        if (normalized === 'Grizzlies') {
          console.log(`   🔍 GRIZZLIES: ${value} (columna ${columnIndex}, rank ${rank})`);
        }
      }
    });

    console.log(`   ✅ ${Object.keys(data).length} equipos\n`);
    return data;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    return {};
  }
}

async function main() {
  console.log('🏀 NioSports Scraper v6.0 - COLUMNA CORRECTA');
  console.log('=============================================\n');

  const results = {};
  
  // Scrape cada estadística
  for (const config of STATS_CONFIG) {
    results[config.key] = await scrapeTable(config.url, config.key, config.column);
    await new Promise(r => setTimeout(r, 2000)); // 2 segundos entre requests
  }

  // Obtener lista de todos los equipos
  const allTeams = new Set();
  Object.values(results).forEach(d => Object.keys(d).forEach(t => allTeams.add(t)));
  console.log(`📋 Total equipos: ${allTeams.size}\n`);

  // Calcular promedios de liga
  let leaguePace = 0, leaguePpg = 0, count = 0;
  Object.keys(results.pace || {}).forEach(team => {
    leaguePace += results.pace[team]?.value || 0;
    leaguePpg += results.ppg[team]?.value || 0;
    count++;
  });
  leaguePace = count > 0 ? leaguePace / count : 100;
  leaguePpg = count > 0 ? leaguePpg / count : 115;

  // Construir objeto de equipos
  const teams = {};
  allTeams.forEach(team => {
    teams[team] = {
      // PPG
      full: results.ppg[team]?.value || 0,
      fullRank: results.ppg[team]?.rank || 30,
      fullHome: results.ppgHome[team]?.value || 0,
      fullHomeRank: results.ppgHome[team]?.rank || 30,
      fullAway: results.ppgAway[team]?.value || 0,
      fullAwayRank: results.ppgAway[team]?.rank || 30,
      
      // Q1
      q1: results.q1[team]?.value || 0,
      q1Rank: results.q1[team]?.rank || 30,
      q1Home: results.q1Home[team]?.value || 0,
      q1HomeRank: results.q1Home[team]?.rank || 30,
      q1Away: results.q1Away[team]?.value || 0,
      q1AwayRank: results.q1Away[team]?.rank || 30,
      
      // 1H
      half: results.half[team]?.value || 0,
      halfRank: results.half[team]?.rank || 30,
      halfHome: results.halfHome[team]?.value || 0,
      halfHomeRank: results.halfHome[team]?.rank || 30,
      halfAway: results.halfAway[team]?.value || 0,
      halfAwayRank: results.halfAway[team]?.rank || 30,
      
      // PACE
      pace: results.pace[team]?.value || 100,
      paceRank: results.pace[team]?.rank || 15,
      
      // Defensive
      oppPpg: results.oppPpg[team]?.value || 115,
      oppPpgRank: results.oppPpg[team]?.rank || 15,
      oppPpgHome: results.oppPpgHome[team]?.value || 0,
      oppPpgHomeRank: results.oppPpgHome[team]?.rank || 30,
      oppPpgAway: results.oppPpgAway[team]?.value || 0,
      oppPpgAwayRank: results.oppPpgAway[team]?.rank || 30,
      oppQ1: results.oppQ1[team]?.value || 29,
      oppQ1Rank: results.oppQ1[team]?.rank || 15,
      oppHalf: results.oppHalf[team]?.value || 57,
      oppHalfRank: results.oppHalf[team]?.rank || 15
    };
  });

  // VERIFICACIÓN CRÍTICA: Grizzlies
  console.log('═══════════════════════════════════════════');
  console.log('📊 VERIFICACIÓN GRIZZLIES (debe coincidir con TeamRankings):');
  console.log('═══════════════════════════════════════════');
  if (teams['Grizzlies']) {
    const g = teams['Grizzlies'];
    console.log(`Q1 General: ${g.q1} (#${g.q1Rank})`);
    console.log(`Q1 HOME:    ${g.q1Home} (#${g.q1HomeRank}) ← DEBE SER ~28.9`);
    console.log(`Q1 AWAY:    ${g.q1Away} (#${g.q1AwayRank})`);
    console.log(`1H HOME:    ${g.halfHome} (#${g.halfHomeRank})`);
    console.log(`Full HOME:  ${g.fullHome} (#${g.fullHomeRank})`);
  }
  console.log('═══════════════════════════════════════════\n');

  const output = {
    teams,
    leagueAverages: {
      pace: parseFloat(leaguePace.toFixed(1)),
      ppg: parseFloat(leaguePpg.toFixed(1))
    },
    lastUpdated: new Date().toISOString(),
    source: 'TeamRankings.com',
    version: '6.0',
    scrapedDate: TODAY,
    features: ['PPG', 'Q1', '1H', 'Home/Away', 'PACE', 'DefRating']
  };

  // Guardar
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile('data/nba-stats.json', JSON.stringify(output, null, 2));

  console.log('✅ Guardado en data/nba-stats.json');
  console.log(`📈 Liga AVG - PACE: ${leaguePace.toFixed(1)}, PPG: ${leaguePpg.toFixed(1)}`);
}

main().catch(e => { 
  console.error('❌ Error:', e); 
  process.exit(1); 
});
