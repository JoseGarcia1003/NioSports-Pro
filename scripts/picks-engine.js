// scripts/picks-engine.js
// Motor de predicción NioSports Pro v2.1
// TOTALES NBA: Q1 | Primera Mitad | Tiempo Completo
// Datos reales: nba-stats.json (TeamRankings.com)
// ════════════════════════════════════════════════════════════════

console.log('🤖 Picks Engine v2.1 cargando...');

class PicksEngine {
  constructor() {
    this.apiClient     = null; // Se asigna lazy para evitar race condition
    this.currentSeason = 2024;
    this.teamStats     = null;
    this.leagueAverages = null;
    this.statsLoaded   = false;

    // Pesos del modelo — mercados de totales
    this.weights = {
      q1Offense:    0.30,
      q1Defense:    0.30,
      pace:         0.15,
      homeAwayAdj:  0.10,
      formAdj:      0.10,
      restAdj:      0.05
    };

    // BallDontLie full_name → nba-stats.json key
    this.teamNameMap = {
      'Atlanta Hawks':          'Hawks',
      'Boston Celtics':         'Celtics',
      'Brooklyn Nets':          'Nets',
      'Charlotte Hornets':      'Hornets',
      'Chicago Bulls':          'Bulls',
      'Cleveland Cavaliers':    'Cavaliers',
      'Dallas Mavericks':       'Mavericks',
      'Denver Nuggets':         'Nuggets',
      'Detroit Pistons':        'Pistons',
      'Golden State Warriors':  'Warriors',
      'Houston Rockets':        'Rockets',
      'Indiana Pacers':         'Pacers',
      'Los Angeles Clippers':   'Clippers',
      'Los Angeles Lakers':     'Lakers',
      'Memphis Grizzlies':      'Grizzlies',
      'Miami Heat':             'Heat',
      'Milwaukee Bucks':        'Bucks',
      'Minnesota Timberwolves': 'Timberwolves',
      'New Orleans Pelicans':   'Pelicans',
      'New York Knicks':        'Knicks',
      'Oklahoma City Thunder':  'Thunder',
      'Orlando Magic':          'Magic',
      'Philadelphia 76ers':     '76ers',
      'Phoenix Suns':           'Suns',
      'Portland Trail Blazers': 'Trail Blazers',
      'Sacramento Kings':       'Kings',
      'San Antonio Spurs':      'Spurs',
      'Toronto Raptors':        'Raptors',
      'Utah Jazz':              'Jazz',
      'Washington Wizards':     'Wizards'
    };

    // Datos de demostración (cuando API o JSON no disponibles)
    this.demoStats = this._buildDemoStats();
  }

  // ── DEMO STATS (fallback cuando no hay JSON) ──────────────────
  _buildDemoStats() {
    const teams = {
      Hawks:          { q1:29.2, q1Home:30.1, q1Away:28.3, half:57.8, halfHome:59.2, halfAway:56.4, full:116.8, fullHome:119.1, fullAway:114.5, pace:101.2, oppQ1:29.5, oppHalf:58.1, oppPpg:117.2, oppPpgHome:115.8, oppPpgAway:118.6, q1Rank:14, q1HomeRank:12, q1AwayRank:16, halfRank:14, halfHomeRank:12, halfAwayRank:16, fullRank:14, fullHomeRank:12, fullAwayRank:16, paceRank:18, oppQ1Rank:18, oppHalfRank:16, oppPpgRank:16 },
      Celtics:        { q1:30.8, q1Home:31.9, q1Away:29.7, half:61.2, halfHome:63.1, halfAway:59.3, full:120.6, fullHome:123.4, fullAway:117.8, pace:99.8, oppQ1:27.1, oppHalf:54.3, oppPpg:109.2, oppPpgHome:107.4, oppPpgAway:111.0, q1Rank:3, q1HomeRank:2, q1AwayRank:4, halfRank:2, halfHomeRank:1, halfAwayRank:3, fullRank:2, fullHomeRank:1, fullAwayRank:3, paceRank:24, oppQ1Rank:2, oppHalfRank:1, oppPpgRank:1 },
      Nets:           { q1:27.4, q1Home:28.1, q1Away:26.7, half:54.8, halfHome:56.0, halfAway:53.6, full:109.6, fullHome:111.8, fullAway:107.4, pace:98.6, oppQ1:30.2, oppHalf:59.4, oppPpg:119.8, oppPpgHome:118.2, oppPpgAway:121.4, q1Rank:26, q1HomeRank:24, q1AwayRank:27, halfRank:28, halfHomeRank:26, halfAwayRank:28, fullRank:27, fullHomeRank:25, fullAwayRank:28, paceRank:26, oppQ1Rank:27, oppHalfRank:28, oppPpgRank:28 },
      Hornets:        { q1:28.4, q1Home:29.0, q1Away:27.8, half:56.8, halfHome:58.2, halfAway:55.4, full:113.8, fullHome:116.0, fullAway:111.6, pace:100.4, oppQ1:29.8, oppHalf:58.6, oppPpg:118.0, oppPpgHome:116.4, oppPpgAway:119.6, q1Rank:21, q1HomeRank:20, q1AwayRank:22, halfRank:20, halfHomeRank:18, halfAwayRank:21, fullRank:21, fullHomeRank:19, fullAwayRank:22, paceRank:22, oppQ1Rank:22, oppHalfRank:21, oppPpgRank:22 },
      Bulls:          { q1:28.9, q1Home:29.7, q1Away:28.1, half:57.4, halfHome:59.0, halfAway:55.8, full:115.0, fullHome:117.4, fullAway:112.6, pace:99.2, oppQ1:29.1, oppHalf:57.8, oppPpg:116.4, oppPpgHome:114.8, oppPpgAway:118.0, q1Rank:17, q1HomeRank:16, q1AwayRank:18, halfRank:17, halfHomeRank:15, halfAwayRank:18, fullRank:17, fullHomeRank:15, fullAwayRank:18, paceRank:25, oppQ1Rank:15, oppHalfRank:14, oppPpgRank:14 },
      Cavaliers:      { q1:29.6, q1Home:30.5, q1Away:28.7, half:59.4, halfHome:61.2, halfAway:57.6, full:118.4, fullHome:121.0, fullAway:115.8, pace:97.8, oppQ1:27.6, oppHalf:55.2, oppPpg:110.8, oppPpgHome:108.6, oppPpgAway:113.0, q1Rank:10, q1HomeRank:8, q1AwayRank:11, halfRank:8, halfHomeRank:6, halfAwayRank:9, fullRank:7, fullHomeRank:5, fullAwayRank:8, paceRank:28, oppQ1Rank:4, oppHalfRank:3, oppPpgRank:3 },
      Mavericks:      { q1:29.4, q1Home:30.3, q1Away:28.5, half:58.8, halfHome:60.6, halfAway:57.0, full:117.6, fullHome:120.2, fullAway:115.0, pace:100.6, oppQ1:28.4, oppHalf:56.8, oppPpg:114.0, oppPpgHome:112.2, oppPpgAway:115.8, q1Rank:11, q1HomeRank:9, q1AwayRank:12, halfRank:10, halfHomeRank:8, halfAwayRank:11, fullRank:10, fullHomeRank:8, fullAwayRank:11, paceRank:20, oppQ1Rank:9, oppHalfRank:8, oppPpgRank:8 },
      Nuggets:        { q1:30.2, q1Home:31.4, q1Away:29.0, half:60.4, halfHome:62.4, halfAway:58.4, full:119.8, fullHome:122.8, fullAway:116.8, pace:102.4, oppQ1:28.0, oppHalf:56.0, oppPpg:112.4, oppPpgHome:110.2, oppPpgAway:114.6, q1Rank:6, q1HomeRank:4, q1AwayRank:7, halfRank:5, halfHomeRank:3, halfAwayRank:6, fullRank:5, fullHomeRank:3, fullAwayRank:6, paceRank:14, oppQ1Rank:6, oppHalfRank:5, oppPpgRank:5 },
      Pistons:        { q1:26.8, q1Home:27.4, q1Away:26.2, half:53.4, halfHome:54.8, halfAway:52.0, full:107.0, fullHome:109.2, fullAway:104.8, pace:97.2, oppQ1:31.0, oppHalf:60.8, oppPpg:121.6, oppPpgHome:119.8, oppPpgAway:123.4, q1Rank:29, q1HomeRank:28, q1AwayRank:29, halfRank:30, halfHomeRank:29, halfAwayRank:30, fullRank:30, fullHomeRank:29, fullAwayRank:30, paceRank:29, oppQ1Rank:30, oppHalfRank:30, oppPpgRank:30 },
      Warriors:       { q1:29.8, q1Home:30.8, q1Away:28.8, half:59.6, halfHome:61.4, halfAway:57.8, full:118.8, fullHome:121.4, fullAway:116.2, pace:103.8, oppQ1:28.6, oppHalf:57.2, oppPpg:115.2, oppPpgHome:113.0, oppPpgAway:117.4, q1Rank:8, q1HomeRank:6, q1AwayRank:9, halfRank:7, halfHomeRank:5, halfAwayRank:8, fullRank:8, fullHomeRank:6, fullAwayRank:9, paceRank:8, oppQ1Rank:11, oppHalfRank:10, oppPpgRank:10 },
      Rockets:        { q1:29.0, q1Home:29.8, q1Away:28.2, half:58.0, halfHome:59.6, halfAway:56.4, full:116.2, fullHome:118.6, fullAway:113.8, pace:101.8, oppQ1:28.8, oppHalf:57.6, oppPpg:115.8, oppPpgHome:114.0, oppPpgAway:117.6, q1Rank:16, q1HomeRank:14, q1AwayRank:17, halfRank:16, halfHomeRank:14, halfAwayRank:17, fullRank:16, fullHomeRank:14, fullAwayRank:17, paceRank:16, oppQ1Rank:13, oppHalfRank:12, oppPpgRank:12 },
      Pacers:         { q1:31.2, q1Home:32.3, q1Away:30.1, half:62.0, halfHome:64.2, halfAway:59.8, full:123.4, fullHome:126.6, fullAway:120.2, pace:106.8, oppQ1:30.6, oppHalf:60.2, oppPpg:121.0, oppPpgHome:119.2, oppPpgAway:122.8, q1Rank:2, q1HomeRank:1, q1AwayRank:2, halfRank:1, halfHomeRank:1, halfAwayRank:1, fullRank:1, fullHomeRank:1, fullAwayRank:1, paceRank:1, oppQ1Rank:25, oppHalfRank:24, oppPpgRank:24 },
      Clippers:       { q1:29.3, q1Home:30.2, q1Away:28.4, half:58.6, halfHome:60.4, halfAway:56.8, full:117.2, fullHome:119.8, fullAway:114.6, pace:100.0, oppQ1:28.2, oppHalf:56.4, oppPpg:113.2, oppPpgHome:111.0, oppPpgAway:115.4, q1Rank:12, q1HomeRank:10, q1AwayRank:13, halfRank:11, halfHomeRank:9, halfAwayRank:12, fullRank:12, fullHomeRank:10, fullAwayRank:13, paceRank:21, oppQ1Rank:8, oppHalfRank:7, oppPpgRank:7 },
      Lakers:         { q1:29.7, q1Home:30.7, q1Away:28.7, half:59.2, halfHome:61.0, halfAway:57.4, full:118.2, fullHome:120.8, fullAway:115.6, pace:101.6, oppQ1:28.8, oppHalf:57.4, oppPpg:115.6, oppPpgHome:113.4, oppPpgAway:117.8, q1Rank:9, q1HomeRank:7, q1AwayRank:10, halfRank:9, halfHomeRank:7, halfAwayRank:10, fullRank:9, fullHomeRank:7, fullAwayRank:10, paceRank:17, oppQ1Rank:12, oppHalfRank:11, oppPpgRank:11 },
      Grizzlies:      { q1:28.6, q1Home:29.4, q1Away:27.8, half:57.2, halfHome:58.8, halfAway:55.6, full:114.4, fullHome:116.8, fullAway:112.0, pace:102.0, oppQ1:29.0, oppHalf:57.6, oppPpg:115.4, oppPpgHome:113.6, oppPpgAway:117.2, q1Rank:19, q1HomeRank:17, q1AwayRank:20, halfRank:19, halfHomeRank:17, halfAwayRank:20, fullRank:19, fullHomeRank:17, fullAwayRank:20, paceRank:15, oppQ1Rank:14, oppHalfRank:13, oppPpgRank:13 },
      Heat:           { q1:28.1, q1Home:28.9, q1Away:27.3, half:56.2, halfHome:57.8, halfAway:54.6, full:112.6, fullHome:115.0, fullAway:110.2, pace:99.0, oppQ1:27.8, oppHalf:55.6, oppPpg:111.4, oppPpgHome:109.2, oppPpgAway:113.6, q1Rank:24, q1HomeRank:22, q1AwayRank:25, halfRank:23, halfHomeRank:21, halfAwayRank:24, fullRank:23, fullHomeRank:21, fullAwayRank:24, paceRank:27, oppQ1Rank:5, oppHalfRank:4, oppPpgRank:4 },
      Bucks:          { q1:30.0, q1Home:31.0, q1Away:29.0, half:60.0, halfHome:62.0, halfAway:58.0, full:119.4, fullHome:122.0, fullAway:116.8, pace:100.8, oppQ1:28.4, oppHalf:56.8, oppPpg:113.8, oppPpgHome:111.6, oppPpgAway:116.0, q1Rank:7, q1HomeRank:5, q1AwayRank:8, halfRank:6, halfHomeRank:4, halfAwayRank:7, fullRank:6, fullHomeRank:4, fullAwayRank:7, paceRank:19, oppQ1Rank:10, oppHalfRank:9, oppPpgRank:9 },
      Timberwolves:   { q1:29.5, q1Home:30.4, q1Away:28.6, half:59.0, halfHome:60.8, halfAway:57.2, full:117.8, fullHome:120.4, fullAway:115.2, pace:102.6, oppQ1:27.4, oppHalf:54.8, oppPpg:110.0, oppPpgHome:107.8, oppPpgAway:112.2, q1Rank:10, q1HomeRank:8, q1AwayRank:11, halfRank:9, halfHomeRank:7, halfAwayRank:10, fullRank:9, fullHomeRank:7, fullAwayRank:10, paceRank:12, oppQ1Rank:3, oppHalfRank:2, oppPpgRank:2 },
      Pelicans:       { q1:28.7, q1Home:29.5, q1Away:27.9, half:57.4, halfHome:59.0, halfAway:55.8, full:114.8, fullHome:117.2, fullAway:112.4, pace:101.4, oppQ1:29.2, oppHalf:58.0, oppPpg:116.2, oppPpgHome:114.4, oppPpgAway:118.0, q1Rank:18, q1HomeRank:16, q1AwayRank:19, halfRank:18, halfHomeRank:16, halfAwayRank:19, fullRank:18, fullHomeRank:16, fullAwayRank:19, paceRank:18, oppQ1Rank:16, oppHalfRank:15, oppPpgRank:15 },
      Knicks:         { q1:29.1, q1Home:30.0, q1Away:28.2, half:58.2, halfHome:60.0, halfAway:56.4, full:116.4, fullHome:118.8, fullAway:114.0, pace:98.4, oppQ1:28.0, oppHalf:56.0, oppPpg:112.0, oppPpgHome:109.8, oppPpgAway:114.2, q1Rank:15, q1HomeRank:13, q1AwayRank:16, halfRank:15, halfHomeRank:13, halfAwayRank:16, fullRank:15, fullHomeRank:13, fullAwayRank:16, paceRank:30, oppQ1Rank:7, oppHalfRank:6, oppPpgRank:6 },
      Thunder:        { q1:30.4, q1Home:31.5, q1Away:29.3, half:60.8, halfHome:62.8, halfAway:58.8, full:121.0, fullHome:124.0, fullAway:118.0, pace:103.4, oppQ1:27.2, oppHalf:54.4, oppPpg:109.8, oppPpgHome:107.6, oppPpgAway:112.0, q1Rank:5, q1HomeRank:3, q1AwayRank:6, halfRank:4, halfHomeRank:2, halfAwayRank:5, fullRank:4, fullHomeRank:2, fullAwayRank:5, paceRank:9, oppQ1Rank:1, oppHalfRank:1, oppPpgRank:1 },
      Magic:          { q1:28.3, q1Home:29.1, q1Away:27.5, half:56.6, halfHome:58.2, halfAway:55.0, full:113.4, fullHome:115.8, fullAway:111.0, pace:99.6, oppQ1:28.6, oppHalf:57.2, oppPpg:114.4, oppPpgHome:112.2, oppPpgAway:116.6, q1Rank:22, q1HomeRank:20, q1AwayRank:23, halfRank:22, halfHomeRank:20, halfAwayRank:23, fullRank:22, fullHomeRank:20, fullAwayRank:23, paceRank:23, oppQ1Rank:12, oppHalfRank:11, oppPpgRank:11 },
      '76ers':        { q1:29.2, q1Home:30.1, q1Away:28.3, half:58.4, halfHome:60.2, halfAway:56.6, full:116.6, fullHome:119.2, fullAway:114.0, pace:99.4, oppQ1:28.9, oppHalf:57.8, oppPpg:115.8, oppPpgHome:113.6, oppPpgAway:118.0, q1Rank:13, q1HomeRank:11, q1AwayRank:14, halfRank:13, halfHomeRank:11, halfAwayRank:14, fullRank:13, fullHomeRank:11, fullAwayRank:14, paceRank:26, oppQ1Rank:14, oppHalfRank:13, oppPpgRank:13 },
      Suns:           { q1:28.5, q1Home:29.3, q1Away:27.7, half:57.0, halfHome:58.6, halfAway:55.4, full:114.2, fullHome:116.6, fullAway:111.8, pace:102.2, oppQ1:29.4, oppHalf:58.2, oppPpg:117.0, oppPpgHome:115.2, oppPpgAway:118.8, q1Rank:20, q1HomeRank:18, q1AwayRank:21, halfRank:21, halfHomeRank:19, halfAwayRank:22, fullRank:21, fullHomeRank:19, fullAwayRank:22, paceRank:13, oppQ1Rank:19, oppHalfRank:18, oppPpgRank:18 },
      'Trail Blazers':{ q1:27.8, q1Home:28.5, q1Away:27.1, half:55.6, halfHome:57.0, halfAway:54.2, full:111.4, fullHome:113.8, fullAway:109.0, pace:100.2, oppQ1:30.4, oppHalf:59.8, oppPpg:120.6, oppPpgHome:118.8, oppPpgAway:122.4, q1Rank:25, q1HomeRank:23, q1AwayRank:26, halfRank:26, halfHomeRank:24, halfAwayRank:27, fullRank:26, fullHomeRank:24, fullAwayRank:27, paceRank:21, oppQ1Rank:26, oppHalfRank:26, oppPpgRank:26 },
      Kings:          { q1:29.3, q1Home:30.1, q1Away:28.5, half:58.6, halfHome:60.4, halfAway:56.8, full:117.0, fullHome:119.6, fullAway:114.4, pace:104.2, oppQ1:29.6, oppHalf:58.4, oppPpg:117.8, oppPpgHome:116.0, oppPpgAway:119.6, q1Rank:12, q1HomeRank:10, q1AwayRank:13, halfRank:12, halfHomeRank:10, halfAwayRank:13, fullRank:11, fullHomeRank:9, fullAwayRank:12, paceRank:6, oppQ1Rank:21, oppHalfRank:20, oppPpgRank:20 },
      Spurs:          { q1:27.6, q1Home:28.3, q1Away:26.9, half:55.2, halfHome:56.6, halfAway:53.8, full:110.6, fullHome:112.8, fullAway:108.4, pace:103.0, oppQ1:30.8, oppHalf:60.4, oppPpg:121.4, oppPpgHome:119.6, oppPpgAway:123.2, q1Rank:27, q1HomeRank:26, q1AwayRank:28, halfRank:27, halfHomeRank:25, halfAwayRank:28, fullRank:28, fullHomeRank:26, fullAwayRank:29, paceRank:10, oppQ1Rank:29, oppHalfRank:29, oppPpgRank:29 },
      Raptors:        { q1:28.2, q1Home:29.0, q1Away:27.4, half:56.4, halfHome:58.0, halfAway:54.8, full:113.0, fullHome:115.4, fullAway:110.6, pace:100.8, oppQ1:29.6, oppHalf:58.4, oppPpg:118.2, oppPpgHome:116.4, oppPpgAway:120.0, q1Rank:23, q1HomeRank:21, q1AwayRank:24, halfRank:24, halfHomeRank:22, halfAwayRank:25, fullRank:24, fullHomeRank:22, fullAwayRank:25, paceRank:20, oppQ1Rank:20, oppHalfRank:19, oppPpgRank:19 },
      Jazz:           { q1:28.0, q1Home:28.8, q1Away:27.2, half:56.0, halfHome:57.6, halfAway:54.4, full:112.0, fullHome:114.4, fullAway:109.6, pace:101.0, oppQ1:30.0, oppHalf:59.0, oppPpg:119.4, oppPpgHome:117.6, oppPpgAway:121.2, q1Rank:25, q1HomeRank:23, q1AwayRank:26, halfRank:25, halfHomeRank:23, halfAwayRank:26, fullRank:25, fullHomeRank:23, fullAwayRank:26, paceRank:19, oppQ1Rank:23, oppHalfRank:22, oppPpgRank:22 },
      Wizards:        { q1:26.2, q1Home:26.8, q1Away:25.6, half:52.6, halfHome:53.8, halfAway:51.4, full:105.4, fullHome:107.6, fullAway:103.2, pace:97.6, oppQ1:31.4, oppHalf:61.4, oppPpg:122.8, oppPpgHome:121.0, oppPpgAway:124.6, q1Rank:30, q1HomeRank:29, q1AwayRank:30, halfRank:29, halfHomeRank:28, halfAwayRank:29, fullRank:29, fullHomeRank:27, fullAwayRank:29, paceRank:30, oppQ1Rank:28, oppHalfRank:27, oppPpgRank:27 },
    };
    return { teams, leagueAverages: { pace: 101.4, ppg: 115.7 } };
  }

  // ── CARGA STATS ───────────────────────────────────────────────
  async loadTeamStats() {
    if (this.statsLoaded) return;
    try {
      console.log('[Picks] 📊 Cargando nba-stats.json...');
      const res = await fetch('/data/nba-stats.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.teamStats     = data.teams;
      this.leagueAverages = data.leagueAverages;
      this.statsLoaded   = true;
      console.log(`[Picks] ✅ Stats cargadas: ${Object.keys(this.teamStats).length} equipos`);
    } catch (err) {
      console.warn('[Picks] ⚠️ nba-stats.json no disponible, usando datos integrados:', err.message);
      this.teamStats     = this.demoStats.teams;
      this.leagueAverages = this.demoStats.leagueAverages;
      this.statsLoaded   = true;
    }
  }

  getTeamStats(fullName) {
    if (!fullName) return null;
    const key = this.teamNameMap[fullName] || fullName;
    return this.teamStats?.[key] || null;
  }

  // ── GENERACIÓN PICKS DEL DÍA ──────────────────────────────────
  async generateTodayPicks() {
    await this.loadTeamStats();

    // Obtener apiClient lazy
    if (!this.apiClient) this.apiClient = window.apiClient;

    let games = [];

    // Intentar API real
    if (this.apiClient) {
      try {
        const data = await this.apiClient.getTodayGames();
        games = data?.data || [];
        console.log(`[Picks] 📡 API: ${games.length} juego(s) hoy`);
      } catch (err) {
        console.warn('[Picks] ⚠️ API no disponible:', err.message);
      }
    }

    // Fallback: juegos de demostración realistas
    if (!games.length) {
      console.log('[Picks] 🎭 Usando juegos de demostración');
      games = this._buildDemoGames();
    }

    const analyses = await Promise.all(
      games.map(g => this.analyzeGame(g).catch(err => {
        console.error(`[Picks] Error juego ${g.id}:`, err.message);
        return null;
      }))
    );

    const picks = analyses
      .filter(a => a && a.bestPick && a.bestPick.confidence >= 55)
      .sort((a, b) => b.bestPick.confidence - a.bestPick.confidence);

    console.log(`[Picks] ✅ ${picks.length} picks generados`);
    return picks;
  }

  // ── JUEGOS DEMO ───────────────────────────────────────────────
  _buildDemoGames() {
    const pairs = [
      ['Boston Celtics',         'Denver Nuggets'],
      ['Los Angeles Lakers',     'Oklahoma City Thunder'],
      ['Milwaukee Bucks',        'Indiana Pacers'],
      ['New York Knicks',        'Minnesota Timberwolves'],
      ['Golden State Warriors',  'Dallas Mavericks'],
    ];
    return pairs.map((p, i) => ({
      id: `demo-${i}`,
      home_team:    { id: i*2,   full_name: p[0] },
      visitor_team: { id: i*2+1, full_name: p[1] },
      date: new Date().toISOString(),
      status: 'scheduled',
      isDemo: true
    }));
  }

  // ── ANÁLISIS DE JUEGO ─────────────────────────────────────────
  async analyzeGame(game) {
    const homeName = game.home_team?.full_name;
    const awayName = game.visitor_team?.full_name;
    if (!homeName || !awayName) return null;

    const homeData = this.getTeamStats(homeName);
    const awayData = this.getTeamStats(awayName);

    // Ajustes dinámicos de la API (opcional, no bloquea)
    let formAdj = 0, restAdj = 0;
    if (this.apiClient && !game.isDemo) {
      try {
        const end   = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
        const [hR, aR] = await Promise.all([
          this.apiClient.getTeamGames(game.home_team.id, start, end),
          this.apiClient.getTeamGames(game.visitor_team.id, start, end)
        ]);
        formAdj = this.calcFormAdjustment(hR?.data || [], aR?.data || []);
        restAdj = this.calcRestAdjustment(game, hR?.data || [], aR?.data || []);
      } catch { /* silencioso */ }
    }

    const q1   = this.predictQ1Total(homeData, awayData, formAdj, restAdj);
    const half = this.predictHalfTotal(homeData, awayData, formAdj, restAdj);
    const full = this.predictFullTotal(homeData, awayData, formAdj, restAdj);

    const allMkts = [q1, half, full].filter(m => m.confidence > 0);
    const best    = allMkts.reduce((b, m) => m.confidence > b.confidence ? m : b, allMkts[0] || q1);

    return {
      gameId:      String(game.id),
      game,
      homeTeam:    homeName,
      awayTeam:    awayName,
      hasRealData: !!(homeData && awayData),
      isDemo:      !!game.isDemo,
      markets:     { q1, half, full },
      bestPick:    best,
      homeStats:   homeData,
      awayStats:   awayData,
      formAdj, restAdj,
      timestamp:   Date.now(),
      date:        game.date,
      status:      game.status
    };
  }

  // ── PREDICCIÓN Q1 ─────────────────────────────────────────────
  predictQ1Total(homeData, awayData, formAdj = 0, restAdj = 0) {
    if (!homeData || !awayData) return this.fallbackPick('Q1', '1er Cuarto', 'Sin datos');

    const homeQ1Scored  = homeData.q1Home  || homeData.q1   || 29;
    const homeQ1Allowed = homeData.oppQ1   || 29;
    const awayQ1Scored  = awayData.q1Away  || awayData.q1   || 28;
    const awayQ1Allowed = awayData.oppQ1   || 29;

    const homeExp = (homeQ1Scored + awayQ1Allowed) / 2;
    const awayExp = (awayQ1Scored + homeQ1Allowed) / 2;
    let proj      = homeExp + awayExp;

    const pace    = ((homeData.pace || 103) + (awayData.pace || 103)) / 2;
    const lPace   = this.leagueAverages?.pace || 103.7;
    proj *= 1 + (pace - lPace) / lPace * 0.5;
    proj *= 1 + formAdj * 0.03 + restAdj * 0.02;

    const line      = Math.round(proj * 2) / 2;
    const leagueRef = 57.0;
    const direction = proj > leagueRef ? 'OVER' : 'UNDER';
    const confidence = this.calcQ1Confidence(homeData, awayData, proj);

    return {
      market: 'Q1', marketLabel: '1er Cuarto',
      projectedTotal: parseFloat(proj.toFixed(1)),
      line, direction,
      confidence: Math.min(85, Math.max(50, Math.round(confidence))),
      homeExpected: parseFloat(homeExp.toFixed(1)),
      awayExpected: parseFloat(awayExp.toFixed(1)),
      factors: { homeQ1Scored, homeQ1Allowed, awayQ1Scored, awayQ1Allowed,
                 combinedPace: parseFloat(pace.toFixed(1)),
                 paceVsLeague: parseFloat((pace - lPace).toFixed(1)) },
      reasoning: this.buildQ1Reasoning(homeData, awayData, direction, proj)
    };
  }

  // ── PREDICCIÓN 1H ─────────────────────────────────────────────
  predictHalfTotal(homeData, awayData, formAdj = 0, restAdj = 0) {
    if (!homeData || !awayData) return this.fallbackPick('1H', 'Primera Mitad', 'Sin datos');

    const homeHS  = homeData.halfHome  || homeData.half  || 59;
    const homeHA  = homeData.oppHalf   || 58;
    const awayHS  = awayData.halfAway  || awayData.half  || 57;
    const awayHA  = awayData.oppHalf   || 58;

    const homeExp = (homeHS + awayHA) / 2;
    const awayExp = (awayHS + homeHA) / 2;
    let proj      = homeExp + awayExp;

    const pace  = ((homeData.pace || 103) + (awayData.pace || 103)) / 2;
    const lPace = this.leagueAverages?.pace || 103.7;
    proj *= 1 + (pace - lPace) / lPace * 0.4;
    proj *= 1 + formAdj * 0.03 + restAdj * 0.02;

    const line      = Math.round(proj * 2) / 2;
    const leagueRef = 115.0;
    const direction = proj > leagueRef ? 'OVER' : 'UNDER';
    const confidence = this.calcHalfConfidence(homeData, awayData, proj);

    return {
      market: '1H', marketLabel: 'Primera Mitad',
      projectedTotal: parseFloat(proj.toFixed(1)),
      line, direction,
      confidence: Math.min(85, Math.max(50, Math.round(confidence))),
      homeExpected: parseFloat(homeExp.toFixed(1)),
      awayExpected: parseFloat(awayExp.toFixed(1)),
      factors: { homeHalfScored: homeHS, homeHalfAllowed: homeHA,
                 awayHalfScored: awayHS, awayHalfAllowed: awayHA,
                 combinedPace: parseFloat(pace.toFixed(1)) },
      reasoning: this.buildHalfReasoning(homeData, awayData, direction, proj)
    };
  }

  // ── PREDICCIÓN FULL ───────────────────────────────────────────
  predictFullTotal(homeData, awayData, formAdj = 0, restAdj = 0) {
    if (!homeData || !awayData) return this.fallbackPick('Full', 'Tiempo Completo', 'Sin datos');

    const homeFS  = homeData.fullHome   || homeData.full   || 116;
    const homeFA  = homeData.oppPpgHome || homeData.oppPpg || 115;
    const awayFS  = awayData.fullAway   || awayData.full   || 113;
    const awayFA  = awayData.oppPpgAway || awayData.oppPpg || 115;

    const homeExp = (homeFS + awayFA) / 2;
    const awayExp = (awayFS + homeFA) / 2;
    let proj      = homeExp + awayExp;

    const pace  = ((homeData.pace || 103) + (awayData.pace || 103)) / 2;
    const lPace = this.leagueAverages?.pace || 103.7;
    proj *= 1 + (pace - lPace) / lPace * 0.35;
    proj *= 1 + formAdj * 0.04 + restAdj * 0.03;

    const line      = Math.round(proj * 2) / 2;
    const leagueRef = (this.leagueAverages?.ppg || 115.7) * 2;
    const direction = proj > leagueRef ? 'OVER' : 'UNDER';
    const confidence = this.calcFullConfidence(homeData, awayData, proj);

    return {
      market: 'Full', marketLabel: 'Tiempo Completo',
      projectedTotal: parseFloat(proj.toFixed(1)),
      line, direction,
      confidence: Math.min(85, Math.max(50, Math.round(confidence))),
      homeExpected: parseFloat(homeExp.toFixed(1)),
      awayExpected: parseFloat(awayExp.toFixed(1)),
      factors: { homeFullScored: homeFS, homeFullAllowed: homeFA,
                 awayFullScored: awayFS, awayFullAllowed: awayFA,
                 combinedPace: parseFloat(pace.toFixed(1)) },
      reasoning: this.buildFullReasoning(homeData, awayData, direction, proj)
    };
  }

  // ── CONFIANZA ─────────────────────────────────────────────────
  calcQ1Confidence(h, a, proj) {
    let c = 60;
    c += Math.min(10, Math.abs((h.q1Home||29) - (a.q1Away||28)) * 1.5);
    c += Math.min(8,  Math.abs((h.oppQ1||29)  - (a.oppQ1||29))  * 1.2);
    const pace = ((h.pace||103) + (a.pace||103)) / 2;
    if (pace > 106 || pace < 101) c += 5;
    const rD = Math.abs((h.q1HomeRank||15) - (a.q1AwayRank||15));
    if (rD > 15) c += 5;
    if (rD < 5)  c -= 3;
    return c;
  }

  calcHalfConfidence(h, a, proj) {
    let c = 60;
    c += Math.min(10, Math.abs((h.halfHome||59) - (a.halfAway||57)) * 0.8);
    c += Math.min(8,  Math.abs((h.oppHalf||58)  - (a.oppHalf||58))  * 1.0);
    const pace = ((h.pace||103) + (a.pace||103)) / 2;
    if (pace > 106 || pace < 101) c += 4;
    return c;
  }

  calcFullConfidence(h, a, proj) {
    let c = 60;
    c += Math.min(10, Math.abs((h.fullHome||116) - (a.fullAway||113)) * 0.5);
    c += Math.min(8,  Math.abs((h.oppPpgHome||115) - (a.oppPpgAway||115)) * 0.7);
    const pace = ((h.pace||103) + (a.pace||103)) / 2;
    if (pace > 106 || pace < 101) c += 4;
    if (Math.abs((h.fullRank||15) - (a.fullRank||15)) > 15) c += 4;
    return c;
  }

  // ── ADJUSTMENTS ───────────────────────────────────────────────
  calcFormAdjustment(hg, ag) {
    if (!hg.length && !ag.length) return 0;
    const hw = hg.slice(-5).filter(g => this.isWin(g, true)).length;
    const aw = ag.slice(-5).filter(g => this.isWin(g, false)).length;
    const hr = hg.length ? hw / Math.min(5, hg.length) : 0.5;
    const ar = ag.length ? aw / Math.min(5, ag.length) : 0.5;
    return hr - ar;
  }

  calcRestAdjustment(game, hg, ag) {
    const hl = hg.slice(-1)[0], al = ag.slice(-1)[0];
    if (!hl || !al) return 0;
    const gd = new Date(game.date);
    const hR = Math.floor((gd - new Date(hl.date)) / 86400000);
    const aR = Math.floor((gd - new Date(al.date)) / 86400000);
    const hS = hR >= 2 ? 1 : hR === 1 ? 0 : -1;
    const aS = aR >= 2 ? 1 : aR === 1 ? 0 : -1;
    return (hS - aS) / 2;
  }

  isWin(g, isHome) {
    if (!g.home_team_score || !g.visitor_team_score) return false;
    return isHome ? g.home_team_score > g.visitor_team_score
                  : g.visitor_team_score > g.home_team_score;
  }

  // ── REASONING ─────────────────────────────────────────────────
  buildQ1Reasoning(h, a, dir, proj) {
    const reasons = [];
    const hN = this._shortName(h), aN = this._shortName(a);
    const hQ = h.q1Home||29, aQ = a.q1Away||28, hD = h.oppQ1||29, aD = a.oppQ1||29;
    const pace = ((h.pace||103) + (a.pace||103)) / 2;

    if (dir === 'OVER') {
      if (hQ > 30.5) reasons.push(`${hN} anota ${hQ} pts/Q1 de local — top ofensivo`);
      if (aQ > 29.5) reasons.push(`${aN} anota ${aQ} pts/Q1 de visitante — ataque sólido`);
      if (hD > 29.5) reasons.push(`${hN} permite ${hD} pts/Q1 — defensa permeable`);
      if (aD > 29.5) reasons.push(`${aN} permite ${aD} pts/Q1 — sin freno defensivo`);
    } else {
      if (hQ < 28.5) reasons.push(`${hN} anota solo ${hQ} pts/Q1 de local — ofensiva lenta`);
      if (aQ < 27.5) reasons.push(`${aN} anota ${aQ} pts/Q1 de visitante — producción baja`);
      if (hD < 27.5) reasons.push(`${hN} élite defensivo en Q1 — permite solo ${hD}`);
      if (aD < 27.5) reasons.push(`${aN} fuerte defensa en Q1 — solo ${aD} permitidos`);
    }
    if (pace > 106) reasons.push(`Ritmo elevado (${pace.toFixed(1)} pos/g) — favorece más posesiones`);
    if (pace < 101) reasons.push(`Juego lento (${pace.toFixed(1)} pos/g) — presiona el Under`);
    return reasons.slice(0, 3);
  }

  buildHalfReasoning(h, a, dir, proj) {
    const reasons = [];
    const hN = this._shortName(h), aN = this._shortName(a);
    if (dir === 'OVER') {
      if ((h.halfHome||59) > 61) reasons.push(`${hN} promedia ${h.halfHome} pts/1H de local`);
      if ((a.halfAway||57) > 59) reasons.push(`${aN} anota ${a.halfAway} pts/1H de visitante`);
      if ((h.oppHalf||58)  > 59) reasons.push(`${hN} permite ${h.oppHalf} pts/1H — defensa blanda`);
    } else {
      if ((h.halfHome||59) < 57) reasons.push(`${hN} solo ${h.halfHome} pts/1H de local`);
      if ((h.oppHalf||58)  < 55) reasons.push(`${hN} élite defensivo en 1H — permite ${h.oppHalf}`);
      if ((a.halfAway||57) < 56) reasons.push(`${aN} ofensiva limitada fuera de casa`);
    }
    return reasons.slice(0, 3);
  }

  buildFullReasoning(h, a, dir, proj) {
    const reasons = [];
    const hN = this._shortName(h), aN = this._shortName(a);
    if (dir === 'OVER') {
      if ((h.fullHome||116) > 120) reasons.push(`${hN} ofensiva explosiva de local (${h.fullHome} PPG)`);
      if ((a.fullAway||113) > 117) reasons.push(`${aN} se mantiene productivo de visitante`);
      if ((h.oppPpgHome||115) > 118) reasons.push(`${hN} defensa permeable (permite ${h.oppPpgHome} PPG)`);
    } else {
      if ((h.oppPpgHome||115) < 110) reasons.push(`${hN} defensa élite (permite ${h.oppPpgHome} PPG de local)`);
      if ((a.fullAway||113)   < 112) reasons.push(`${aN} ofensiva limitada fuera de casa`);
      const pace = ((h.pace||103) + (a.pace||103)) / 2;
      if (pace < 101) reasons.push(`Ambos equipos juegan a ritmo lento (${pace.toFixed(1)} pos/g)`);
    }
    return reasons.slice(0, 3);
  }

  _shortName(teamData) {
    if (!teamData || !this.teamStats) return 'Equipo';
    const entry = Object.entries(this.teamStats).find(([, v]) => v === teamData);
    return entry ? entry[0] : 'Equipo';
  }

  // ── FALLBACK ──────────────────────────────────────────────────
  fallbackPick(market, label, reason) {
    return { market, marketLabel: label, projectedTotal: null, line: null,
             direction: null, confidence: 0, homeExpected: null, awayExpected: null,
             factors: {}, reasoning: [reason] };
  }

  // ── ANÁLISIS MANUAL ───────────────────────────────────────────
  async analyzeMatchup(homeName, awayName) {
    await this.loadTeamStats();
    const hKey = this.teamNameMap[homeName] || homeName;
    const aKey = this.teamNameMap[awayName] || awayName;
    const h    = this.teamStats?.[hKey];
    const a    = this.teamStats?.[aKey];
    if (!h || !a) { console.warn(`[Picks] Sin stats: ${hKey} vs ${aKey}`); return null; }

    return {
      homeTeam: hKey, awayTeam: aKey,
      homeStats: h,   awayStats: a,
      markets: {
        q1:   this.predictQ1Total(h, a, 0, 0),
        half: this.predictHalfTotal(h, a, 0, 0),
        full: this.predictFullTotal(h, a, 0, 0),
      },
      hasRealData: true,
      timestamp:   Date.now()
    };
  }

  // ── UTILIDADES ─────────────────────────────────────────────────
  getAvailableTeams() { return Object.keys(this.teamStats || {}).sort(); }

  getTeamProfile(name) {
    const d = this.teamStats?.[name];
    if (!d) return null;
    return {
      name,
      offense: { full: d.full, q1: d.q1, half: d.half },
      defense: { full: d.oppPpg, q1: d.oppQ1, half: d.oppHalf },
      pace:    d.pace,
      homeAdvantage: (d.q1Home||0) - (d.q1Away||0),
      ranks:   { fullRank: d.fullRank, q1Rank: d.q1Rank, defRank: d.oppPpgRank, paceRank: d.paceRank }
    };
  }

  getRecommendation(conf) {
    if (conf >= 75) return { type: 'strong', text: 'PICK FUERTE', units: 3 };
    if (conf >= 65) return { type: 'medium', text: 'PICK SÓLIDO', units: 2 };
    return               { type: 'value',  text: 'PICK VALUE',  units: 1 };
  }
}

// ── INSTANCIA GLOBAL ──────────────────────────────────────────
window.picksEngine = new PicksEngine();

// Pre-cargar stats
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.picksEngine.loadTeamStats();
    console.log('[Picks] ✅ Motor listo');
  } catch (e) {
    console.warn('[Picks] ⚠️ Stats se cargarán bajo demanda');
  }
});

console.log('✅ Picks Engine v2.1 cargado');
