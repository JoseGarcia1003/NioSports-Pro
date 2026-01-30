from nba_api.stats.static import players
from nba_api.stats.endpoints import playercareerstats, playergamelog
import json
import time
from datetime import datetime
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
import signal

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException()

signal.signal(signal.SIGALRM, timeout_handler)

def log(mensaje):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {mensaje}", flush=True)
    sys.stdout.flush()

def extraer_datos_jugador(player_id, nombre, max_retries=2):
    """Extrae datos de un jugador con retry y timeout"""
    for intento in range(max_retries):
        try:
            signal.alarm(30)
            
            carrera = playercareerstats.PlayerCareerStats(player_id=player_id, timeout=10)
            stats = carrera.get_data_frames()[0]
            
            stats_actual = stats[stats['SEASON_ID'] == '2025-26']
            temporada = '2025-26'
            
            if len(stats_actual) == 0:
                stats_actual = stats[stats['SEASON_ID'] == '2024-25']
                temporada = '2024-25'
                
            if len(stats_actual) == 0:
                signal.alarm(0)
                return None
            
            s = stats_actual.iloc[0]
            gp = s['GP']
            
            if gp == 0:
                signal.alarm(0)
                return None
            
            time.sleep(0.3)
            
            try:
                gamelog = playergamelog.PlayerGameLog(
                    player_id=player_id,
                    season=temporada,
                    season_type_all_star='Regular Season',
                    timeout=10
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
            
            signal.alarm(0)
            return datos
            
        except TimeoutException:
            log(f"   ⏱️ Timeout en {nombre}, intento {intento + 1}/{max_retries}")
            if intento < max_retries - 1:
                time.sleep(1)
                continue
            return None
        except Exception as e:
            if intento < max_retries - 1:
                time.sleep(1)
                continue
            return None
    
    return None

def procesar_batch_paralelo(batch, max_workers=5):
    """Procesa un batch de jugadores en paralelo"""
    resultados = {}
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(extraer_datos_jugador, j['id'], j['full_name']): j['full_name'] 
            for j in batch
        }
        
        for future in as_completed(futures):
            nombre = futures[future]
            try:
                datos = future.result(timeout=45)
                if datos:
                    resultados[nombre] = datos
            except Exception:
                pass
    
    return resultados

def main():
    log("🏀 INICIANDO ACTUALIZACIÓN COMPLETA DE DATOS NBA")
    log("=" * 70)
    
    log("📋 Obteniendo lista de jugadores activos...")
    todos_jugadores = players.get_players()
    jugadores_activos = [j for j in todos_jugadores if j['is_active']]
    
    # PROCESAR TODOS LOS JUGADORES (sin límite)
    log(f"✅ Procesando TODOS los jugadores activos: {len(jugadores_activos)}")
    
    BATCH_SIZE = 50
    database = {}
    exitosos = 0
    
    total_batches = (len(jugadores_activos) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for batch_num in range(total_batches):
        inicio = batch_num * BATCH_SIZE
        fin = min((batch_num + 1) * BATCH_SIZE, len(jugadores_activos))
        batch = jugadores_activos[inicio:fin]
        
        log(f"\n📦 BATCH {batch_num + 1}/{total_batches} ({inicio + 1}-{fin})")
        log(f"   ⚡ Procesando {len(batch)} jugadores en paralelo...")
        
        resultados = procesar_batch_paralelo(batch, max_workers=10)
        database.update(resultados)
        exitosos = len(database)
        
        progreso = (fin / len(jugadores_activos)) * 100
        log(f"   📊 Progreso: {fin}/{len(jugadores_activos)} ({progreso:.0f}%) - Exitosos: {exitosos}")
        
        if batch_num % 2 == 0:
            with open('nba_players_database.json', 'w', encoding='utf-8') as f:
                json.dump(database, f, indent=2, ensure_ascii=False)
            log(f"   💾 Progreso guardado")
    
    log("\n💾 Guardando base de datos final...")
    with open('nba_players_database.json', 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)
    
    log("\n" + "=" * 70)
    log("✅ ACTUALIZACIÓN COMPLETADA")
    log(f"📊 Jugadores con datos: {exitosos}")
    log(f"💾 Tamaño: {len(json.dumps(database)) / 1024:.1f} KB")
    log(f"🕐 Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 70)

if __name__ == "__main__":
    main()
