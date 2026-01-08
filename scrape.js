// NioSports NBA Stats Scraper v3.0
// URLs CORREGIDAS para Home/Away

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// URLs CORREGIDAS de TeamRankings
const URLS = {
  // General (funcionan)
  ppg: 'https://www.teamrankings.com/nba/stat/points-per-game',
  q1: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game',
  half: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game',
  
  // Home - URLs correctas
  ppgHome: 'https://www.teamrankings.com/nba/stat/points-per-game?date=2025-01-10&home_away=home',
  q1Home: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game?date=2025-01-10&home_away=home',
  halfHome: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game?date=2025-01-10&home_away=home',
  
  // Away - URLs correctas
  ppgAway: 'https://www.teamrankings.com/nba/stat/points-per-game?date=2025-01-10&home_away=away',
  q1Away: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game?date=2025-01-10&home_away=away',
  halfAway: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game?date=2025-01-10&home_away=away'
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

    // Buscar filas en la tabla
    $('table tbody tr').each((index, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) return;
      
      // Columna 2: nombre del equipo
      const teamCell = $(cells[1]);
      let teamName = teamCell.find('a').text().trim() || teamCell.text().trim();
      const normalized = normalizeTeamName(teamName);
      
      if (!normalized) return;
      
      // Columna 3: valor de la temporada actual (2024-25)
      const valueText = $(cells[2]).text().trim();
      const value = parseFloat(valueText);
      
      if (!isNaN(value) && value > 10 && value < 180) {
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
  console.log('🏀 NioSports Scraper v3.0');
  console.log('=========================\n');

  const results = {};
  
  for (const [key, url] of Object.entries(URLS)) {
    results[key] = await scrapeTable(url, key);
    await new Promise(r => setTimeout(r, 1500));
  }

  // Combinar datos
  const allTeams = new Set();
  Object.values(results).forEach(d => Object.keys(d).forEach(t => allTeams.add(t)));

  const teams = {};
  allTeams.forEach(team => {
    teams[team] = {
      full: results.ppg[team]?.value || 0,
      fullRank: results.ppg[team]?.rank || 30,
      fullHome: results.ppgHome[team]?.value || 0,
      fullHomeRank: results.ppgHome[team]?.rank || 30,
      fullAway: results.ppgAway[team]?.value || 0,
      fullAwayRank: results.ppgAway[team]?.rank || 30,
      q1: results.q1[team]?.value || 0,
      q1Rank: results.q1[team]?.rank || 30,
      q1Home: results.q1Home[team]?.value || 0,
      q1HomeRank: results.q1Home[team]?.rank || 30,
      q1Away: results.q1Away[team]?.value || 0,
      q1AwayRank: results.q1Away[team]?.rank || 30,
      half: results.half[team]?.value || 0,
      halfRank: results.half[team]?.rank || 30,
      halfHome: results.halfHome[team]?.value || 0,
      halfHomeRank: results.halfHome[team]?.rank || 30,
      halfAway: results.halfAway[team]?.value || 0,
      halfAwayRank: results.halfAway[team]?.rank || 30
    };
  });

  const output = {
    teams,
    lastUpdated: new Date().toISOString(),
    source: 'TeamRankings.com',
    version: '3.0'
  };

  await fs.mkdir('data', { recursive: true });
  await fs.writeFile('data/nba-stats.json', JSON.stringify(output, null, 2));

  console.log(`\n✅ Guardado! ${Object.keys(teams).length} equipos`);
  
  // Verificar Bulls
  if (teams['Bulls']) {
    console.log('\n📊 Bulls Away:');
    console.log(`   Full: ${teams['Bulls'].fullAway}`);
    console.log(`   Q1: ${teams['Bulls'].q1Away}`);
    console.log(`   1H: ${teams['Bulls'].halfAway}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
