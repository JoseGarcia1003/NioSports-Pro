// NioSports NBA Stats Scraper v4.0 - MODELO AVANZADO
// Incluye: PPG, Q1, 1H, Home/Away, PACE, Defensive Rating (OppPPG)

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// URLs de TeamRankings - TODAS LAS ESTADÍSTICAS NECESARIAS
const URLS = {
  // Puntos por juego (Ofensivo)
  ppg: 'https://www.teamrankings.com/nba/stat/points-per-game',
  ppgHome: 'https://www.teamrankings.com/nba/stat/points-per-game?date=2025-01-10&home_away=home',
  ppgAway: 'https://www.teamrankings.com/nba/stat/points-per-game?date=2025-01-10&home_away=away',
  
  // Primer cuarto
  q1: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game',
  q1Home: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game?date=2025-01-10&home_away=home',
  q1Away: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game?date=2025-01-10&home_away=away',
  
  // Primera mitad
  half: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game',
  halfHome: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game?date=2025-01-10&home_away=home',
  halfAway: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game?date=2025-01-10&home_away=away',
  
  // PACE (Posesiones por juego) - NUEVO
  pace: 'https://www.teamrankings.com/nba/stat/possessions-per-game',
  
  // Defensive Rating - Puntos permitidos (OppPPG) - NUEVO
  oppPpg: 'https://www.teamrankings.com/nba/stat/opponent-points-per-game',
  oppPpgHome: 'https://www.teamrankings.com/nba/stat/opponent-points-per-game?date=2025-01-10&home_away=home',
  oppPpgAway: 'https://www.teamrankings.com/nba/stat/opponent-points-per-game?date=2025-01-10&home_away=away',
  
  // Defensive Q1 - NUEVO
  oppQ1: 'https://www.teamrankings.com/nba/stat/opponent-1st-quarter-points-per-game',
  
  // Defensive 1H - NUEVO
  oppHalf: 'https://www.teamrankings.com/nba/stat/opponent-1st-half-points-per-game'
};

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
  return TEAM_NAME_MAP[name.trim()] || name.trim();
}

async function scrapeTable(url, statName) {
  console.log(`📊 Scraping ${statName}...`);
  
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
    let rank = 0;

    $('table tbody tr').each((index, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) return;
      
      const teamCell = $(cells[1]);
      let teamName = teamCell.find('a').text().trim() || teamCell.text().trim();
      const normalized = normalizeTeamName(teamName);
      
      if (!normalized) return;
      
      const valueText = $(cells[2]).text().trim();
      const value = parseFloat(valueText);
      
      if (!isNaN(value) && value > 0 && value < 200) {
        rank++;
        data[normalized] = { value, rank };
      }
    });

    console.log(`   ✅ ${statName}: ${Object.keys(data).length} equipos`);
    return data;
  } catch (error) {
    console.error(`   ❌ ${statName}: ${error.message}`);
    return {};
  }
}

async function main() {
  console.log('🏀 NioSports Scraper v4.0 - MODELO AVANZADO');
  console.log('============================================\n');

  const results = {};
  
  for (const [key, url] of Object.entries(URLS)) {
    results[key] = await scrapeTable(url, key);
    await new Promise(r => setTimeout(r, 1500));
  }

  // Combinar datos
  const allTeams = new Set();
  Object.values(results).forEach(d => Object.keys(d).forEach(t => allTeams.add(t)));

  // Calcular promedios de liga para normalización
  let leaguePace = 0, leaguePpg = 0, count = 0;
  Object.keys(results.pace || {}).forEach(team => {
    leaguePace += results.pace[team]?.value || 0;
    leaguePpg += results.ppg[team]?.value || 0;
    count++;
  });
  leaguePace = count > 0 ? leaguePace / count : 100;
  leaguePpg = count > 0 ? leaguePpg / count : 115;

  const teams = {};
  allTeams.forEach(team => {
    teams[team] = {
      // Ofensivo - PPG
      full: results.ppg[team]?.value || 0,
      fullRank: results.ppg[team]?.rank || 30,
      fullHome: results.ppgHome[team]?.value || 0,
      fullHomeRank: results.ppgHome[team]?.rank || 30,
      fullAway: results.ppgAway[team]?.value || 0,
      fullAwayRank: results.ppgAway[team]?.rank || 30,
      
      // Ofensivo - Q1
      q1: results.q1[team]?.value || 0,
      q1Rank: results.q1[team]?.rank || 30,
      q1Home: results.q1Home[team]?.value || 0,
      q1HomeRank: results.q1Home[team]?.rank || 30,
      q1Away: results.q1Away[team]?.value || 0,
      q1AwayRank: results.q1Away[team]?.rank || 30,
      
      // Ofensivo - 1H
      half: results.half[team]?.value || 0,
      halfRank: results.half[team]?.rank || 30,
      halfHome: results.halfHome[team]?.value || 0,
      halfHomeRank: results.halfHome[team]?.rank || 30,
      halfAway: results.halfAway[team]?.value || 0,
      halfAwayRank: results.halfAway[team]?.rank || 30,
      
      // PACE - NUEVO
      pace: results.pace[team]?.value || 100,
      paceRank: results.pace[team]?.rank || 15,
      
      // Defensivo - OppPPG (puntos permitidos) - NUEVO
      oppPpg: results.oppPpg[team]?.value || 115,
      oppPpgRank: results.oppPpg[team]?.rank || 15,
      oppPpgHome: results.oppPpgHome[team]?.value || 0,
      oppPpgHomeRank: results.oppPpgHome[team]?.rank || 30,
      oppPpgAway: results.oppPpgAway[team]?.value || 0,
      oppPpgAwayRank: results.oppPpgAway[team]?.rank || 30,
      
      // Defensivo Q1 y 1H - NUEVO
      oppQ1: results.oppQ1[team]?.value || 29,
      oppQ1Rank: results.oppQ1[team]?.rank || 15,
      oppHalf: results.oppHalf[team]?.value || 57,
      oppHalfRank: results.oppHalf[team]?.rank || 15
    };
  });

  const output = {
    teams,
    leagueAverages: {
      pace: parseFloat(leaguePace.toFixed(1)),
      ppg: parseFloat(leaguePpg.toFixed(1))
    },
    lastUpdated: new Date().toISOString(),
    source: 'TeamRankings.com',
    version: '4.0',
    features: ['PPG', 'Q1', '1H', 'Home/Away', 'PACE', 'DefRating', 'OppPPG']
  };

  await fs.mkdir('data', { recursive: true });
  await fs.writeFile('data/nba-stats.json', JSON.stringify(output, null, 2));

  console.log(`\n✅ Guardado! ${Object.keys(teams).length} equipos`);
  console.log(`📈 Liga AVG - PACE: ${leaguePace.toFixed(1)}, PPG: ${leaguePpg.toFixed(1)}`);
  
  // Verificar Bulls
  if (teams['Bulls']) {
    console.log('\n📊 Bulls (verificación):');
    console.log(`   Full Away: ${teams['Bulls'].fullAway}`);
    console.log(`   Q1 Away: ${teams['Bulls'].q1Away}`);
    console.log(`   1H Away: ${teams['Bulls'].halfAway}`);
    console.log(`   PACE: ${teams['Bulls'].pace}`);
    console.log(`   Def Rating (OppPPG): ${teams['Bulls'].oppPpg}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
