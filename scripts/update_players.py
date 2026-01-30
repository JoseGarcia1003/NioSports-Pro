from nba_api.stats.static import players
from nba_api.stats.endpoints import playercareerstats, playergamelog
import json
import time
from datetime import datetime
import sys

def log(mensaje):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {mensaje}", flush=True)
    sys.stdout.flush()

def extraer_datos_jugador(player_id, nombre):
    """Extrae datos con timeouts más largos y reintentos"""
    for intento in range(3):
        try:
            # Delay entre intentos
            if intento > 0:
                time.sleep(2)
            
            carrera = playercareerstats.PlayerCareerStats(player_id=player_id, timeout=30)
            stats = carrera.get_data_frames()[0]
            
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
            
            time.sleep(0.6)
            
            try:
                gamelog = playergamelog.PlayerGameLog(
                    player_id=player_id,
                    season=temporada,
                    season_type_all_star='Regular Season',
                    timeout=30
                )
                juegos_df = gamelog.get_data_frames()[0]
                juegos = juegos_df.head(5)
            except:
                juegos = []
            
            ultimos_5 = []
            if len(juegos) > 0:
                for _, juego in juegos.iterrows():
                    ultimos_5.append({
                        'fecha': str(juego.get('GAME_DATE', 'N/A')),
                        'oponente': str(juego.get('MATCHUP', 'N/A')).split()[-1] if 'MATCHUP' in juego else 'N/A',
                        'pts': int(juego.get('PTS', 0)) if juego.get('PTS') else 0,
                        'ast': int(juego.get('AST', 0)) if juego.get('AST') else 0,
                        'reb': int(juego.get('REB', 0)) if juego.get('REB') else 0,
                        'min': int(juego.get('MIN', 0)) if juego.get('MIN') else 0
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
            if intento < 2:
                log(f"   ⚠️ Intento {intento + 1} falló para {nombre}: {str(e)[:50]}")
                continue
            return None
    
    return None

def main():
    log("🏀 INICIANDO ACTUALIZACIÓN - VERSIÓN CORREGIDA")
    log("=" * 70)
    
    log("📋 Obteniendo lista de jugadores activos...")
    todos_jugadores = players.get_players()
    jugadores_activos = [j for j in todos_jugadores if j['is_active']]
    
    log(f"✅ {len(jugadores_activos)} jugadores activos encontrados")
    log("⚠️ Procesamiento SECUENCIAL para evitar rate limits")
    
    database = {}
    exitosos = 0
    
    for idx, jugador in enumerate(jugadores_activos, 1):
        nombre = jugador['full_name']
        player_id = jugador['id']
        
        log(f"{idx}/{len(jugadores_activos)} - {nombre}...")
        
        datos = extraer_datos_jugador(player_id, nombre)
        
        if datos:
            database[nombre] = datos
            exitosos += 1
            log(f"   ✅ {datos['temporada_actual']['pts']} PPG")
        else:
            log(f"   ❌ Sin datos")
        
        # Guardar progreso cada 50 jugadores
        if idx % 50 == 0:
            with open('nba_players_database.json', 'w', encoding='utf-8') as f:
                json.dump(database, f, indent=2, ensure_ascii=False)
            log(f"   💾 Progreso guardado: {exitosos} jugadores")
    
    log("\n💾 Guardando base de datos final...")
    with open('nba_players_database.json', 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)
    
    log("\n" + "=" * 70)
    log("✅ ACTUALIZACIÓN COMPLETADA")
    log(f"📊 Jugadores con datos: {exitosos}")
    log(f"💾 Tamaño: {len(json.dumps(database)) / 1024:.1f} KB")
    log("=" * 70)

if __name__ == "__main__":
    main()
