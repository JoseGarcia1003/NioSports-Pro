"""
CONSOLIDADOR - Combina datos de ambas fuentes
Crea el JSON final unificado para el frontend
"""

import json
from datetime import datetime

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def consolidate_player_data(ball_data, br_data):
    """
    Combina datos de un jugador de ambas fuentes
    BALLDONTLIE = base
    Basketball Reference = complemento
    """
    consolidated = {
        # Info básica (de BALLDONTLIE)
        "id": ball_data.get("id"),
        "nombre": ball_data.get("nombre"),
        "equipo": ball_data.get("equipo"),
        "posicion": ball_data.get("posicion"),
        "altura": ball_data.get("altura"),
        "peso": ball_data.get("peso"),
        "numero": ball_data.get("numero"),
        
        # Stats de temporada (BALLDONTLIE)
        "temporada_actual": ball_data.get("temporada_actual", {}),
        
        # Stats avanzadas (COMBINADO)
        "stats_avanzadas": {
            **(ball_data.get("stats_avanzadas", {})),  # PER, TS%, USG% de BALLDONTLIE
            **(br_data.get("basketball_reference", {}).get("stats_avanzadas", {}) if br_data else {})  # WS, VORP de BR
        },
        
        # Últimos juegos (BALLDONTLIE)
        "ultimos_5_juegos": ball_data.get("ultimos_5_juegos", []),
        
        # Injury status (BALLDONTLIE - tiempo real)
        "injury_status": ball_data.get("injury_status"),
        
        # Datos históricos profundos (Basketball Reference)
        "historial_vs_equipos": br_data.get("basketball_reference", {}).get("vs_equipos", {}) if br_data else {},
        "home_away_splits": br_data.get("basketball_reference", {}).get("home_away", {}) if br_data else {},
        "consistency": br_data.get("basketball_reference", {}).get("consistency", {}) if br_data else {},
        
        # Metadata
        "fuentes": {
            "balldontlie": True,
            "basketball_reference": bool(br_data),
            "ultima_actualizacion": datetime.now().isoformat()
        }
    }
    
    return consolidated

def main():
    log("=" * 70)
    log("🔗 CONSOLIDACIÓN DE DATOS - Sistema Híbrido")
    log("=" * 70)
    
    # Cargar BALLDONTLIE (principal)
    try:
        with open('nba_balldontlie_data.json', 'r', encoding='utf-8') as f:
            balldontlie_data = json.load(f)
        log(f"✅ BALLDONTLIE: {len(balldontlie_data)} jugadores")
    except FileNotFoundError:
        log("❌ ERROR: nba_balldontlie_data.json no encontrado")
        return
    
    # Cargar Basketball Reference (complemento)
    try:
        with open('nba_basketball_ref_data.json', 'r', encoding='utf-8') as f:
            br_data = json.load(f)
        log(f"✅ Basketball Reference: {len(br_data)} jugadores")
    except FileNotFoundError:
        log("⚠️ Basketball Reference no encontrado - solo usando BALLDONTLIE")
        br_data = {}
    
    # Consolidar
    log("\n🔗 Consolidando datos...")
    
    consolidated_database = {}
    complete_profiles = 0
    partial_profiles = 0
    
    for player_name, ball_player in balldontlie_data.items():
        br_player = br_data.get(player_name)
        
        consolidated_player = consolidate_player_data(ball_player, br_player)
        consolidated_database[player_name] = consolidated_player
        
        if br_player:
            complete_profiles += 1
        else:
            partial_profiles += 1
    
    # Guardar consolidado
    with open('nba_players_database.json', 'w', encoding='utf-8') as f:
        json.dump(consolidated_database, f, indent=2, ensure_ascii=False)
    
    log("\n" + "=" * 70)
    log("✅ CONSOLIDACIÓN COMPLETADA")
    log(f"📊 Total jugadores: {len(consolidated_database)}")
    log(f"🌟 Perfiles completos (ambas fuentes): {complete_profiles}")
    log(f"📝 Perfiles básicos (solo BALLDONTLIE): {partial_profiles}")
    log(f"💾 Tamaño: {len(json.dumps(consolidated_database)) / 1024:.1f} KB")
    log(f"📁 Archivo final: nba_players_database.json")
    log("=" * 70)

if __name__ == "__main__":
    main()
