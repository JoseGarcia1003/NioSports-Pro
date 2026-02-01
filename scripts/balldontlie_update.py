"""
BALLDONTLIE API - Actualización diaria de stats NBA
Fuente principal de datos: rápida, confiable, sin bloqueos
"""

import requests
import json
import time
from datetime import datetime
import os

API_KEY = os.environ.get('BALLDONTLIE_API_KEY')
BASE_URL = "https://api.balldontlie.io"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def get_all_players():
    """Obtiene lista completa de jugadores activos"""
    headers = {"Authorization": API_KEY}
    all_players = []
    cursor = None
    
    log("📋 Obteniendo jugadores activos...")
    
    while True:
        params = {"per_page": 100}
        if cursor:
            params["cursor"] = cursor
        
        response = requests.get(
            f"{BASE_URL}/nba/v1/players",
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            log(f"❌ Error: {response.status_code}")
            break
        
        data = response.json()
        all_players.extend(data.get("data", []))
        
        cursor = data.get("meta", {}).get("next_cursor")
        if not cursor:
            break
        
        time.sleep(0.5)  # Rate limiting
    
    log(f"✅ {len(all_players)} jugadores encontrados")
    return all_players

def get_player_season_stats(player_id, season=2024):
    """Obtiene stats de temporada para un jugador"""
    headers = {"Authorization": API_KEY}
    
    try:
        # Stats generales
        response = requests.get(
            f"{BASE_URL}/nba/v1/season_averages/general",
            headers=headers,
            params={
                "season": season,
                "season_type": "regular",
                "type": "base",
                "player_ids[]": player_id
            }
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json().get("data", [])
        if not data:
            return None
        
        stats = data[0]["stats"]
        
        # Stats avanzadas
        time.sleep(0.3)
        adv_response = requests.get(
            f"{BASE_URL}/nba/v1/season_averages/general",
            headers=headers,
            params={
                "season": season,
                "season_type": "regular",
                "type": "advanced",
                "player_ids[]": player_id
            }
        )
        
        advanced = {}
        if adv_response.status_code == 200:
            adv_data = adv_response.json().get("data", [])
            if adv_data:
                advanced = adv_data[0]["stats"]
        
        return {
            "basic": stats,
            "advanced": advanced
        }
        
    except Exception as e:
        log(f"⚠️ Error obteniendo stats: {e}")
        return None

def get_recent_games(player_id, limit=5):
    """Obtiene últimos N juegos del jugador"""
    headers = {"Authorization": API_KEY}
    
    try:
        response = requests.get(
            f"{BASE_URL}/nba/v1/stats",
            headers=headers,
            params={
                "player_ids[]": player_id,
                "per_page": limit,
                "seasons[]": 2024
            }
        )
        
        if response.status_code != 200:
            return []
        
        games = response.json().get("data", [])
        
        result = []
        for game in games[:limit]:
            result.append({
                "date": game.get("game", {}).get("date"),
                "opponent": game.get("game", {}).get("home_team", {}).get("abbreviation") 
                           if game.get("team", {}).get("id") != game.get("game", {}).get("home_team", {}).get("id")
                           else game.get("game", {}).get("visitor_team", {}).get("abbreviation"),
                "pts": game.get("pts", 0),
                "ast": game.get("ast", 0),
                "reb": game.get("reb", 0),
                "stl": game.get("stl", 0),
                "blk": game.get("blk", 0),
                "fg3m": game.get("fg3m", 0),
                "min": game.get("min", "0")
            })
        
        return result
        
    except Exception as e:
        log(f"⚠️ Error obteniendo juegos: {e}")
        return []

def get_injury_reports():
    """Obtiene reportes de lesiones actuales"""
    headers = {"Authorization": API_KEY}
    
    try:
        response = requests.get(
            f"{BASE_URL}/nba/v1/player_injuries",
            headers=headers
        )
        
        if response.status_code != 200:
            return {}
        
        injuries = response.json().get("data", [])
        
        injury_dict = {}
        for injury in injuries:
            player = injury.get("player", {})
            player_name = f"{player.get('first_name')} {player.get('last_name')}"
            
            injury_dict[player_name] = {
                "status": injury.get("status"),
                "injury_type": injury.get("injury_type"),
                "return_date": injury.get("return_date"),
                "comment": injury.get("comment")
            }
        
        log(f"🏥 {len(injury_dict)} jugadores lesionados")
        return injury_dict
        
    except Exception as e:
        log(f"⚠️ Error obteniendo lesiones: {e}")
        return {}

def main():
    log("=" * 70)
    log("🏀 BALLDONTLIE API - Actualización Diaria")
    log("=" * 70)
    
    if not API_KEY:
        log("❌ ERROR: API Key no configurada")
        return
    
    # Obtener jugadores activos
    players = get_all_players()
    
    # Obtener reportes de lesiones
    injuries = get_injury_reports()
    
    database = {}
    successful = 0
    
    log(f"\n📊 Procesando {len(players)} jugadores...")
    
    for i, player in enumerate(players, 1):
        player_name = f"{player['first_name']} {player['last_name']}"
        
        if i % 50 == 0:
            log(f"   Progreso: {i}/{len(players)} ({(i/len(players)*100):.0f}%)")
        
        # Stats de temporada
        stats = get_player_season_stats(player['id'])
        
        if not stats or not stats['basic']:
            continue
        
        # Últimos 5 juegos
        recent_games = get_recent_games(player['id'])
        
        # Injury status
        injury_info = injuries.get(player_name)
        
        # Construir objeto del jugador
        player_data = {
            "id": player['id'],
            "nombre": player_name,
            "equipo": player.get('team', {}).get('full_name', 'N/A'),
            "posicion": player.get('position'),
            "altura": player.get('height'),
            "peso": player.get('weight'),
            "numero": player.get('jersey_number'),
            
            # Stats básicas
            "temporada_actual": {
                "partidos": stats['basic'].get('games_played', 0),
                "pts": round(stats['basic'].get('pts', 0), 1),
                "ast": round(stats['basic'].get('ast', 0), 1),
                "reb": round(stats['basic'].get('reb', 0), 1),
                "stl": round(stats['basic'].get('stl', 0), 1),
                "blk": round(stats['basic'].get('blk', 0), 1),
                "fg3m": round(stats['basic'].get('fg3m', 0), 1),
                "min": round(stats['basic'].get('min', 0), 1),
                "fg_pct": round(stats['basic'].get('fg_pct', 0) * 100, 1),
                "ft_pct": round(stats['basic'].get('ft_pct', 0) * 100, 1),
                "fg3_pct": round(stats['basic'].get('fg3_pct', 0) * 100, 1)
            },
            
            # Stats avanzadas
            "stats_avanzadas": {
                "per": round(stats['advanced'].get('per', 0), 1) if stats['advanced'] else 0,
                "ts_pct": round(stats['advanced'].get('ts_pct', 0) * 100, 1) if stats['advanced'] else 0,
                "usg_pct": round(stats['advanced'].get('usg_pct', 0) * 100, 1) if stats['advanced'] else 0,
                "ortg": round(stats['advanced'].get('ortg', 0), 1) if stats['advanced'] else 0,
                "drtg": round(stats['advanced'].get('drtg', 0), 1) if stats['advanced'] else 0
            },
            
            # Últimos juegos
            "ultimos_5_juegos": recent_games,
            
            # Injury status
            "injury_status": injury_info,
            
            # Metadata
            "fuente": "balldontlie",
            "ultima_actualizacion": datetime.now().isoformat()
        }
        
        database[player_name] = player_data
        successful += 1
        
        # Save progress cada 100 jugadores
        if successful % 100 == 0:
            with open('nba_balldontlie_data.json', 'w', encoding='utf-8') as f:
                json.dump(database, f, indent=2, ensure_ascii=False)
            log(f"   💾 Guardado: {successful} jugadores")
        
        time.sleep(0.6)  # Rate limiting (100 req/día = ~1 req cada 15 min en práctica)
    
    # Guardar final
    with open('nba_balldontlie_data.json', 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)
    
    log("\n" + "=" * 70)
    log("✅ ACTUALIZACIÓN COMPLETADA")
    log(f"📊 Jugadores procesados: {successful}")
    log(f"💾 Tamaño: {len(json.dumps(database)) / 1024:.1f} KB")
    log("=" * 70)

if __name__ == "__main__":
    main()
