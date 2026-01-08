// NioSports NBA Stats Scraper v1.0
// Extrae datos de TeamRankings.com cada 6 horas via GitHub Actions

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// Mapa de nombres de equipos (ciudad -> nombre corto)
const TEAM_NAME_MAP = {
  'Atlanta': 'Hawks',
  'Boston': 'Celtics', 
  'Brooklyn': 'Nets',
  'Charlotte': 'Hornets',
  'Chicago': 'Bulls',
  'Cleveland': 'Cavaliers',
  'Dallas': 'Mavericks',
  'Denver': 'Nuggets',
  'Detroit': 'Pistons',
  'Golden State': 'Warriors',
  'Houston': 'Rockets',
  'Indiana': 'Pacers',
  'LA Clippers': 'Clippers',
  'LA Lakers': 'Lakers',
  'Memphis': 'Grizzlies',
  'Miami': 'Heat',
  'Milwaukee': 'Bucks',
  'Minnesota': 'Timberwolves',
  'New Orleans': 'Pelicans',
  'New York': 'Knicks',
  'Oklahoma City': 'Thunder',
  'Orlando': 'Magic',
  'Philadelphia': '76ers',
  'Phoenix': 'Suns',
  'Portland': 'Trail Blazers',
  'Sacramento': 'Kings',
  'San Antonio': 'Spurs',
  'Toronto': 'Raptors',
  'Utah': 'Jazz',
  'Washington': 'Wizards',
  // Variaciones adicionales
  'Okla City': 'Thunder',
  'Los Angeles Lakers': 'Lakers',
  'Los Angeles Clippers': 'Clippers'
};

// URLs de TeamRankings
const URLS = {
  // Puntos por juego
  ppg: 'https://www.teamrankings.com/nba/stat/points-per-game',
  ppgHome: 'https://www.teamrankings.com/nba/stat/home-points-per-game',
  ppgAway: 'https://www.teamrankings.com/nba/stat/away-points-per-game',
  
  // Primer cuarto
  q1: 'https://www.teamrankings.com/nba/stat/1st-quarter-points-per-game',
  q1Home: 'https://www.teamrankings.com/nba/stat/1st-quarter-home-points-per-game',
  q1Away: 'https://www.teamrankings.com/nba/stat/1st-quarter-away-points-per-game',
  
  // Primera mitad
  half: 'https://www.teamrankings.com/nba/stat/1st-half-points-per-game',
  halfHome: 'https://www.teamrankings.com/nba/stat/1st-half-home-points-per-game',
  halfAway: 'https://www.teamrankings.com/nba/stat/1st-half-away-points-per-game'
};

// Headers para simular navegador
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// Función para normalizar nombre del equipo
function normalizeTeamName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  return TEAM_NAME_MAP[trimmed] || trimmed;
}

// Función para hacer scraping de una tabla de TeamRankings
async function scrapeTable(url, statName) {
  console.log(`📊 Scraping ${statName} from ${url}...`);
  
  try {
    const response = await axios.get(url, { 
      headers: HEADERS,
      timeout: 30000
    });
    
    const $ = cheerio.load(response.data);
    const data = {};
    
    // La tabla de datos tiene clase "tr-table datatable scrollable"
    // Las filas tienen clase "odd" o "even"
    $('table.tr-table tbody tr').each((index, row) => {
      const cells = $(row).find('td');
      
      if (cells.length >= 3) {
        // Columna 1: Rank
        // Columna 2: Team name (dentro de un <a>)
        // Columna 3: Valor 2024-25 (temporada actual)
        
        const teamCell = $(cells[1]);
        const teamLink = teamCell.find('a');
        const teamName = teamLink.length > 0 ? teamLink.text().trim() : teamCell.text().trim();
        const normalizedName = normalizeTeamName(teamName);
        
        // El valor de la temporada actual está en la columna 3 (índice 2)
        const valueText = $(cells[2]).text().trim();
        const value = parseFloat(valueText);
        
        if (normalizedName && !isNaN(value)) {
          data[normalizedName] = {
            value: value,
            rank: index + 1
          };
        }
      }
    });
    
    const teamCount = Object.keys(data).length;
    console.log(`   ✅ Found ${teamCount} teams for ${statName}`);
    
    if (teamCount < 25) {
      console.log(`   ⚠️ Warning: Expected 30 teams, got ${teamCount}`);
    }
    
    return data;
    
  } catch (error) {
    console.error(`   ❌ Error scraping ${statName}: ${error.message}`);
    return {};
  }
}

// Función para agregar delay entre requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Función principal
async function main() {
  console.log('🏀 NioSports NBA Stats Scraper');
  console.log('================================');
  console.log(`📅 ${new Date().toISOString()}\n`);
  
  const startTime = Date.now();
  
  // Scrape todas las URLs con delay entre cada una
  const results = {};
  
  for (const [key, url] of Object.entries(URLS)) {
    results[key] = await scrapeTable(url, key);
    await delay(2000); // 2 segundos entre requests para ser respetuoso
  }
  
  // Combinar datos por equipo
  const teams = {};
  const allTeamNames = new Set();
  
  // Recopilar todos los nombres de equipos
  Object.values(results).forEach(data => {
    Object.keys(data).forEach(team => allTeamNames.add(team));
  });
  
  // Crear objeto combinado para cada equipo
  allTeamNames.forEach(teamName => {
    teams[teamName] = {
      // Full game
      full: results.ppg[teamName]?.value || 0,
      fullRank: results.ppg[teamName]?.rank || 30,
      fullHome: results.ppgHome[teamName]?.value || 0,
      fullHomeRank: results.ppgHome[teamName]?.rank || 30,
      fullAway: results.ppgAway[teamName]?.value || 0,
      fullAwayRank: results.ppgAway[teamName]?.rank || 30,
      
      // Q1
      q1: results.q1[teamName]?.value || 0,
      q1Rank: results.q1[teamName]?.rank || 30,
      q1Home: results.q1Home[teamName]?.value || 0,
      q1HomeRank: results.q1Home[teamName]?.rank || 30,
      q1Away: results.q1Away[teamName]?.value || 0,
      q1AwayRank: results.q1Away[teamName]?.rank || 30,
      
      // Half
      half: results.half[teamName]?.value || 0,
      halfRank: results.half[teamName]?.rank || 30,
      halfHome: results.halfHome[teamName]?.value || 0,
      halfHomeRank: results.halfHome[teamName]?.rank || 30,
      halfAway: results.halfAway[teamName]?.value || 0,
      halfAwayRank: results.halfAway[teamName]?.rank || 30
    };
  });
  
  // Crear objeto final
  const output = {
    teams: teams,
    lastUpdated: new Date().toISOString(),
    source: 'TeamRankings.com',
    version: '1.0',
    stats: {
      teamsCount: Object.keys(teams).length,
      scrapedUrls: Object.keys(URLS).length,
      scrapeDurationMs: Date.now() - startTime
    }
  };
  
  // Crear directorio data si no existe
  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });
  
  // Guardar JSON
  const outputPath = path.join(dataDir, 'nba-stats.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log('\n================================');
  console.log(`✅ Scraping complete!`);
  console.log(`📁 Saved to: ${outputPath}`);
  console.log(`🏀 Teams: ${output.stats.teamsCount}`);
  console.log(`⏱️ Duration: ${output.stats.scrapeDurationMs}ms`);
  console.log(`📅 Last updated: ${output.lastUpdated}`);
  
  // Mostrar algunos datos de ejemplo
  console.log('\n📊 Sample data (Bulls):');
  if (teams['Bulls']) {
    console.log(`   Full: ${teams['Bulls'].full} (#${teams['Bulls'].fullRank})`);
    console.log(`   Full Away: ${teams['Bulls'].fullAway} (#${teams['Bulls'].fullAwayRank})`);
    console.log(`   Q1 Away: ${teams['Bulls'].q1Away} (#${teams['Bulls'].q1AwayRank})`);
    console.log(`   1H Away: ${teams['Bulls'].halfAway} (#${teams['Bulls'].halfAwayRank})`);
  }
}

// Ejecutar
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
