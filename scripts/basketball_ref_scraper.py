"""
BASKETBALL REFERENCE Scraper - Datos históricos profundos
Complementa BALLDONTLIE con stats avanzadas y historial vs equipos
"""

from basketball_reference_scraper.players import get_stats, get_game_logs
from basketball_reference_scraper.teams import get_roster
import json
import time
from datetime import datetime
import pandas as pd

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def get_player_advanced_stats(player_name, season=2025):
    """
    Obtiene stats avanzadas que BALLDONTLIE no tiene:
    - Win Shares, VORP, BPM
    - Splits vs equipos específicos
    - Double-doubles, triple-doubles
    """
    try:
        # Stats avanzadas de temporada
        stats = get_stats(player_name, stat_type='ADVANCED', playoffs=False, career=False)
        
        if stats.empty:
            return None
        
        # Filtrar temporada actual
        current_stats = stats[stats['SEASON'] == f'{season-1}-{str(season)[2:]}']
        
        if current_stats.empty:
            return None
        
        row = current_stats.iloc[0]
        
        return {
            "win_shares": float(row.get('WS', 0)),
            "ws_per_48": float(row.get('WS/48', 0)),
            "vorp": float(row.get('VORP', 0)),
            "bpm": float(row.get('BPM', 0)),
            "obpm": float(row.get('OBPM', 0)),
            "dbpm": float(row.get('DBPM', 0)),
            "ast_pct": float(row.get('AST%', 0)),
            "trb_pct": float(row.get('TRB%', 0)),
            "stl_pct": float(row.get('STL%', 0)),
            "blk_pct": float(row.get('BLK%', 0)),
            "tov_pct": float(row.get('TOV%', 0))
        }
        
    except Exception as e:
        log(f"⚠️ Error con {player_name}: {e}")
        return None

def get_vs_team_splits(player_name, season=2025):
    """
    Obtiene rendimiento histórico vs cada equipo
    CLAVE para predicciones de props
    """
    try:
        # Game logs de la temporada
        game_logs = get_game_logs(player_name, season=season, playoffs=False)
        
        if game_logs.empty:
            return {}
        
        # Agrupar por oponente
        vs_teams = {}
        
        for team in game_logs['OPP'].unique():
            team_games = game_logs[game_logs['OPP'] == team]
            
            vs_teams[team] = {
                "juegos": len(team_games),
                "pts_avg": round(team_games['PTS'].mean(), 1),
                "ast_avg": round(team_games['AST'].mean(), 1),
                "reb_avg": round(team_games['TRB'].mean(), 1),
                "stl_avg": round(team_games['STL'].mean(), 1),
                "blk_avg": round(team_games['BLK'].mean(), 1),
                "fg3m_avg": round(team_games['FG3'].mean(), 1),
                "double_doubles": int(((team_games['PTS'] >= 10).astype(int) + 
                                       (team_games['TRB'] >= 10).astype(int) + 
                                       (team_games['AST'] >= 10).astype(int) >= 2).sum()),
                "mejor_juego_pts": int(team_games['PTS'].max())
            }
        
        return vs_teams
        
    except Exception as e:
        log(f"⚠️ Error splits vs teams: {e}")
        return {}

def get_home_away_splits(player_name, season=2025):
    """Stats en casa vs visitante"""
    try:
        game_logs = get_game_logs(player_name, season=season, playoffs=False)
        
        if game_logs.empty or 'HOME' not in game_logs.columns:
            return {}
        
        home_games = game_logs[game_logs['HOME'] == True]
        away_games = game_logs[game_logs['HOME'] == False]
        
        return {
            "home": {
                "juegos": len(home_games),
                "pts_avg": round(home_games['PTS'].mean(), 1) if len(home_games) > 0 else 0,
                "ast_avg": round(home_games['AST'].mean(), 1) if len(home_games) > 0 else 0,
                "reb_avg": round(home_games['TRB'].mean(), 1) if len(home_games) > 0 else 0
            },
            "away": {
                "juegos": len(away_games),
                "pts_avg": round(away_games['PTS'].mean(), 1) if len(away_games) > 0 else 0,
                "ast_avg": round(away_games['AST'].mean(), 1) if len(away_games) > 0 else 0,
                "reb_avg": round(away_games['TRB'].mean(), 1) if len(away_games) > 0 else 0
            }
        }
        
    except Exception as e:
        log(f"⚠️ Error home/away splits: {e}")
        return {}

def calculate_consistency(player_name, season=2025):
    """
    Calcula consistency score para props
    ¿Qué tan confiable es el jugador para OVER/UNDER?
    """
    try:
        game_logs = get_game_logs(player_name, season=season, playoffs=False)
        
        if game_logs.empty or len(game_logs) < 5:
            return {}
        
        # Calcular desviación estándar (menor = más consistente)
        return {
            "pts_std": round(game_logs['PTS'].std(), 1),
            "ast_std": round(game_logs['AST'].std(), 1),
            "reb_std": round(game_logs['TRB'].std(), 1),
            "consistency_score": round(100 - (game_logs['PTS'].std() / game_logs['PTS'].mean() * 100), 1) if game_logs['PTS'].mean() > 0 else 0
        }
        
    except Exception as e:
        return {}

def process_player(player_name, season=2025):
    """Procesa un jugador completo con todos los datos de Basketball Reference"""
    log(f"📊 Procesando: {player_name}")
    
    data = {
        "nombre": player_name,
        "basketball_reference": {
            "stats_avanzadas": get_player_advanced_stats(player_name, season),
            "vs_equipos": get_vs_team_splits(player_name, season),
            "home_away": get_home_away_splits(player_name, season),
            "consistency": calculate_consistency(player_name, season),
            "fuente": "basketball_reference",
            "ultima_actualizacion": datetime.now().isoformat()
        }
    }
    
    # Rate limiting importante (20 req/min = 1 cada 3 segundos)
    time.sleep(3)
    
    return data

def main():
    log("=" * 70)
    log("🏀 BASKETBALL REFERENCE - Datos Históricos Profundos")
    log("=" * 70)
    
    # Cargar datos de BALLDONTLIE (si existen)
    try:
        with open('nba_balldontlie_data.json', 'r', encoding='utf-8') as f:
            balldontlie_data = json.load(f)
        log(f"✅ Cargados {len(balldontlie_data)} jugadores de BALLDONTLIE")
    except:
        log("⚠️ No se encontró data de BALLDONTLIE")
        balldontlie_data = {}
    
    # Procesar top jugadores (por ahora los primeros 50)
    # Nota: Basketball Reference es lento, hacer todos 530 tomaría 45+ min
    players_to_process = list(balldontlie_data.keys())[:50]
    
    log(f"\n📋 Procesando {len(players_to_process)} jugadores top...")
    log("⏱️ Tiempo estimado: ~3 minutos (20 req/min limit)\n")
    
    br_database = {}
    successful = 0
    
    for i, player_name in enumerate(players_to_process, 1):
        try:
            player_data = process_player(player_name)
            
            if player_data['basketball_reference']['stats_avanzadas']:
                br_database[player_name] = player_data
                successful += 1
                log(f"   ✅ {player_name} ({i}/{len(players_to_process)})")
            else:
                log(f"   ⚠️ {player_name} - Sin datos")
            
        except Exception as e:
            log(f"   ❌ {player_name} - Error: {e}")
    
    # Guardar
    with open('nba_basketball_ref_data.json', 'w', encoding='utf-8') as f:
        json.dump(br_database, f, indent=2, ensure_ascii=False)
    
    log("\n" + "=" * 70)
    log("✅ PROCESAMIENTO COMPLETADO")
    log(f"📊 Jugadores exitosos: {successful}")
    log(f"💾 Archivo: nba_basketball_ref_data.json")
    log("=" * 70)

if __name__ == "__main__":
    main()
