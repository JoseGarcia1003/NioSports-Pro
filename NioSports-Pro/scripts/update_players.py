"""
Script de actualización automática de datos NBA
Se ejecuta diariamente via GitHub Actions
"""

from nba_api.stats.static import players
from nba_api.stats.endpoints import playercareerstats, playergamelog
import json
import time
from datetime import datetime
import sys

def log(mensaje):
    """Imprimir con timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {mensaje}")
    sys.stdout.flush()

def extraer_datos_jugador(player_id, nombre):
    """Extrae datos de un jugador específico"""
    try:
        carrera = playercareerstats.PlayerCareerStats(player_id=player_id)
        stats = carrera.get_data_frames()[0]
        
        # Intentar temporada 2025-26
        stats_actual = stats[stats['SEASON_ID'] == '2025-26']
        temporada = '2025-26'
        
        if len(stats_actual) == 0:
            stats_actual = stats[stats['SEASON_ID'] == '2024-25']
            temporada = '2024-25'
            
        if len(stats_actual) == 0:
            return None
        
        s = stats_actual.iloc[0]
        gp = s['GP']
        
        if gp == 0:
            return None
        
        # Obtener últimos 5 juegos
        time.sleep(0.6)
        try:
            gamelog = playergamelog.PlayerGameLog(
                player_id=player_id,
                season=temporada,
                season_type_all_star='Regular Season'
            )
            juegos_df = gamelog.get_data_frames()[0]
            juegos = juegos_df.head(5)
        except:
            juegos = []
        
        ultimos_5 = []
        if len(juegos) > 0:
            for _, juego in juegos.iterrows():
                ultimos_5.append({
                    'fecha': str(juego['GAME_DATE']),
                    'oponente': str(juego['MATCHUP']).split()[-1] if 'MATCHUP' in juego else 'N/A',
                    'pts': int(juego['PTS']) if juego['PTS'] else 0,
                    'ast': int(juego['AST']) if juego['AST'] else 0,
                    'reb': int(juego['REB']) if juego['REB'] else 0,
                    'min': int(juego['MIN']) if juego['MIN'] else 0
                })
        
        datos = {
            'id': player_id,
            'nombre': nombre,
            'temporada': temporada,
            'temporada_actual': {
                'partidos': int(gp),
                'pts': round(s['PTS'] / gp, 1) if gp > 0 else 0,
                'ast': round(s['AST'] / gp, 1) if gp > 0 else 0,
                'reb': round(s['REB'] / gp, 1) if gp > 0 else 0,
                'stl': round(s['STL'] / gp, 1) if gp > 0 else 0,
                'blk': round(s['BLK'] / gp, 1) if gp > 0 else 0,
                'fg3m': round(s['FG3M'] / gp, 1) if gp > 0 else 0,
                'min': round(s['MIN'] / gp, 1) if gp > 0 else 0
            },
            'ultimos_5_juegos': ultimos_5,
            'fecha_ultima_actualizacion': ultimos_5[0]['fecha'] if len(ultimos_5) > 0 else 'N/A'
        }
        
        return datos
        
    except Exception as e:
        return None

def main():
    log("🏀 INICIANDO ACTUALIZACIÓN AUTOMÁTICA DE DATOS NBA")
    log("=" * 70)
    
    # Obtener todos los jugadores activos
    log("📋 Obteniendo lista de jugadores activos...")
    todos_jugadores = players.get_players()
    jugadores_activos = [j for j in todos_jugadores if j['is_active']]
    log(f"✅ {len(jugadores_activos)} jugadores activos encontrados")
    
    # Procesar por batches
    BATCH_SIZE = 100
    database = {}
    exitosos = 0
    sin_datos = 0
    
    total_batches = (len(jugadores_activos) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for batch_num in range(total_batches):
        inicio = batch_num * BATCH_SIZE
        fin = min((batch_num + 1) * BATCH_SIZE, len(jugadores_activos))
        batch = jugadores_activos[inicio:fin]
        
        log(f"\n📦 BATCH {batch_num + 1}/{total_batches} ({inicio + 1}-{fin})")
        
        for jugador in batch:
            nombre = jugador['full_name']
            player_id = jugador['id']
            
            datos = extraer_datos_jugador(player_id, nombre)
            
            if datos:
                database[nombre] = datos
                exitosos += 1
            else:
                sin_datos += 1
        
        progreso = (fin / len(jugadores_activos)) * 100
        log(f"   📊 Progreso: {fin}/{len(jugadores_activos)} ({progreso:.0f}%) - Exitosos: {exitosos}")
    
    # Guardar JSON
    log("\n💾 Guardando base de datos...")
    with open('nba_players_database.json', 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)
    
    # Resumen final
    log("\n" + "=" * 70)
    log("✅ ACTUALIZACIÓN COMPLETADA")
    log(f"📊 Jugadores con datos: {exitosos}")
    log(f"⚠️ Sin datos recientes: {sin_datos}")
    log(f"💾 Tamaño: {len(json.dumps(database)) / 1024:.1f} KB")
    log(f"🕐 Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 70)

if __name__ == "__main__":
    main()