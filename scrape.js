// NioSports NBA Stats Scraper v2.0
// Extrae datos REALES de TeamRankings.com

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// URLs de TeamRankings
const URLS = {
  ppg: 'https://www.teamrankings.com/nba/stat/points-per-game',
  ppgHome: 'https://www.teamrankings.com/nba/stat/home-points-per-game',
  ppgAway: 'https://www.teamrankings.com/nba/stat/away-points-per-game',
  q1: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game',
  q1Home: 'https://www.teamrankings.com/nba/stat/1st-quarter-home-points-per-game',
  q1Away: 'https://www.teamrankings.com/nba/stat/1st-quarter-away-points-per-game',
  half: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game',
  halfHome: 'https://www.teamrankings.com/nba/stat/1st-half-home-points-per-game',
  halfAway: 'https://www.teamrankings.com/nba/stat/1st-half-away-points-per-game'
};

// Mapa de nombres de equipos
const TEAM_NAME_MAP = {
  'Atlanta': 'Hawks', 'Boston': 'Celtics', 'Brooklyn': 'Nets', 'Charlotte': 'Hornets',
  'Chicago': 'Bulls', 'Cleveland': 'Cavaliers', 'Dallas': 'Mavericks', 'Denver': 'Nuggets',
  'Detroit': 'Pistons', 'Golden State': 'Warriors', 'Houston': 'Rockets', 'Indiana': 'Pacers',
  'LA Clippers': 'Clippers', 'LA Lakers': 'Lakers', 'Memphis': 'Grizzlies', 'Miami': 'Heat',
  'Milwaukee': 'Bucks', 'Minnesota': 'Timberwolves', 'New Orleans': 'Pelicans', 'New York': 'Knicks',
  'Oklahoma City': 'Thunder', 'Orlando': 'Magic', 'Philadelphia': '76ers', 'Phoenix': 'Suns',
  'Portland': 'Trail Blazers', 'Sacramento': 'Kings', 'San Antonio': 'Spurs', 'Toronto': 'Raptors',
  'Utah': 'Jazz', 'Washington': 'Wizards', 'Okla City': 'Thunder'
};

function normalizeTeamName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  return TEAM_NAME_MAP[trimmed] || trimmed;
}

async function scrapeTable(url, statName) {
  console.log(`📊 Scraping ${statName}...`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    const data = {};

    // Buscar todas las filas de la tabla principal
    $('table.tr-table tbody tr, table.datatable tbody tr, table tbody tr').each((index, row) => {
      const cells = $(row).find('td');
      
      if (cells.length >= 3) {
        // Obtener nombre del equipo (segunda columna, puede tener un link)
        const teamCell = $(cells[1]);
        let teamName = teamCell.find('a').text().trim();
        if (!teamName) {
          teamName = teamCell.text().trim();
        }
        
        const normalizedName = normalizeTeamName(teamName);
        if (!normalizedName) return;
        
        // Obtener el valor de la temporada actual (tercera columna - "2024-25" o similar)
        const valueText = $(cells[2]).text().trim();
        const value = parseFloat(valueText);
        
        if (!isNaN(value) && value > 0 && value < 200) {
          data[normalizedName] = {
            value: value,
            rank: index + 1
          };
        }
      }
    });

    const count = Object.keys(data).length;
    console.log(`   ✅ ${statName}: ${count} equipos encontrados`);
    
    return data;
  } catch (error) {
    console.error(`   ❌ Error en ${statName}: ${error.message}`);
    return {};
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🏀 NioSports NBA Stats Scraper v2.0');
  console.log('=====================================');
  console.log(`📅 ${new Date().toISOString()}\n`);

  // Scrape todas las URLs
  const results = {};
  for (const [key, url] of Object.entries(URLS)) {
    results[key] = await scrapeTable(url, key);
    await delay(2000); // Esperar 2 segundos entre requests
  }

  // Obtener lista de todos los equipos
  const allTeams = new Set();
  Object.values(results).forEach(data => {
    Object.keys(data).forEach(team => allTeams.add(team));
  });

  console.log(`\n📋 Total equipos encontrados: ${allTeams.size}`);

  // Crear objeto de equipos con todos los datos
  const teams = {};
  
  allTeams.forEach(teamName => {
    teams[teamName] = {
      // Full game stats
      full: results.ppg[teamName]?.value || 0,
      fullRank: results.ppg[teamName]?.rank || 30,
      fullHome: results.ppgHome[teamName]?.value || 0,
      fullHomeRank: results.ppgHome[teamName]?.rank || 30,
      fullAway: results.ppgAway[teamName]?.value || 0,
      fullAwayRank: results.ppgAway[teamName]?.rank || 30,
      
      // Q1 stats
      q1: results.q1[teamName]?.value || 0,
      q1Rank: results.q1[teamName]?.rank || 30,
      q1Home: results.q1Home[teamName]?.value || 0,
      q1HomeRank: results.q1Home[teamName]?.rank || 30,
      q1Away: results.q1Away[teamName]?.value || 0,
      q1AwayRank: results.q1Away[teamName]?.rank || 30,
      
      // Half stats
      half: results.half[teamName]?.value || 0,
      halfRank: results.half[teamName]?.rank || 30,
      halfHome: results.halfHome[teamName]?.value || 0,
      halfHomeRank: results.halfHome[teamName]?.rank || 30,
      halfAway: results.halfAway[teamName]?.value || 0,
      halfAwayRank: results.halfAway[teamName]?.rank || 30
    };
  });

  // Crear output JSON
  const output = {
    teams: teams,
    lastUpdated: new Date().toISOString(),
    source: 'TeamRankings.com',
    version: '2.0',
    stats: {
      teamsCount: Object.keys(teams).length,
      scrapedAt: new Date().toISOString()
    }
  };

  // Guardar archivo
  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });
  
  const outputPath = path.join(dataDir, 'nba-stats.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

  console.log('\n=====================================');
  console.log(`✅ Scraping completado!`);
  console.log(`📁 Guardado en: ${outputPath}`);
  console.log(`🏀 Equipos: ${output.stats.teamsCount}`);

  // Mostrar ejemplo de Bulls para verificar
  if (teams['Bulls']) {
    console.log('\n📊 Verificación - Chicago Bulls:');
    console.log(`   Full Away: ${teams['Bulls'].fullAway}`);
    console.log(`   Q1 Away: ${teams['Bulls'].q1Away}`);
    console.log(`   1H Away: ${teams['Bulls'].halfAway}`);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
