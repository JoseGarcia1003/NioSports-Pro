const cheerio = require('cheerio');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.teamrankings.com/nba/stat';

const STATS = [
  { key: 'full', url: '/points-per-game', home: false, away: false },
  { key: 'fullHome', url: '/points-per-game', home: true, away: false },
  { key: 'fullAway', url: '/points-per-game', home: false, away: true },
  { key: 'q1', url: '/1st-quarter-points-per-game', home: false, away: false },
  { key: 'q1Home', url: '/1st-quarter-points-per-game', home: true, away: false },
  { key: 'q1Away', url: '/1st-quarter-points-per-game', home: false, away: true },
  { key: 'half', url: '/1st-half-points-per-game', home: false, away: false },
  { key: 'halfHome', url: '/1st-half-points-per-game', home: true, away: false },
  { key: 'halfAway', url: '/1st-half-points-per-game', home: false, away: true }
];

async function scrapeStat(stat) {
  let url = BASE_URL + stat.url;
  if (stat.home) url += '?venue=home';
  if (stat.away) url += '?venue=away';
  
  console.log(`📊 Scraping: ${stat.key} from ${url}`);
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const data = {};
  
  $('table.tr-table tbody tr').each((i, row) => {
    const team = $(row).find('td:nth-child(2) a').text().trim();
    const value = parseFloat($(row).find('td:nth-child(3)').text().trim());
    const rank = i + 1;
    
    if (team && value) {
      if (!data[team]) data[team] = {};
      data[team][stat.key] = value;
      data[team][`${stat.key}Rank`] = rank;
    }
  });
  
  return data;
}

async function scrapeAll() {
  console.log('🏀 Starting NBA stats scraping...');
  
  const allData = {};
  
  for (const stat of STATS) {
    const statData = await scrapeStat(stat);
    
    Object.keys(statData).forEach(team => {
      if (!allData[team]) allData[team] = { team };
      Object.assign(allData[team], statData[team]);
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const result = {
    lastUpdated: new Date().toISOString(),
    source: 'TeamRankings.com',
    teams: Object.values(allData)
  };
  
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  
  fs.writeFileSync(
    path.join(dataDir, 'nba-stats.json'),
    JSON.stringify(result, null, 2)
  );
  
  console.log(`✅ Scraping complete! ${result.teams.length} teams saved.`);
}

scrapeAll().catch(console.error);
