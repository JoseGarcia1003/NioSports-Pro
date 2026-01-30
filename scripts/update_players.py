"""
Script de actualización automática de datos NBA
Versión con temporadas desde 2023-24 hasta actual
"""

from nba_api.stats.static import players
from nba_api.stats.endpoints import playercareerstats
import json
import time
from datetime import datetime
import sys

def log(mensaje):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {mensaje}")
    sys.stdout.flush()

def extraer_datos_jugador(player_id, nombre):
    """Extrae datos del jugador buscando desde temporada actual hacia atrás"""
    try:
        # Obtener datos de carrera del jugador
        carrera = playercareerstats.PlayerCareerStats(
            player_id=player_id,
            timeout=15
        )
        stats = carrera.get_data_frames()[0]
        
        # Definir temporadas a buscar (de más reciente a más antigua)
        temporadas_ordenadas = ['2025-26', '2024-25', '2023-24']
        
        for temporada in temporadas_ordenadas:
            stats_temporada = stats[stats['SEASON_ID'] == temporada]
            
            if len(stats_temporada) > 0:
                s = stats_temporada.iloc[0]
                gp = s['GP']
                
                if gp > 0:  # Solo jugadores que han jugado
                    # Calcular promedios
                    datos = {
                        'id': player_id,
                        'nombre': nombre,
                        'temporada': temporada,
                        'partidos': int(gp),
                        'ppg': round(s['PTS'] / gp, 1) if gp > 0 else 0.0,
                        'apg': round(s['AST'] / gp, 1) if gp > 0 else 0.0,
                        'rpg': round(s['REB'] / gp, 1) if gp > 0 else 0.0,
                        'spg': round(s['STL'] / gp, 1) if gp > 0 else 0.0,
                        'bpg': round(s['BLK'] / gp, 1) if gp > 0 else 0.0,
                        'minutos_promedio': round(s['MIN'] / gp, 1) if gp > 0 else 0.0,
                        'ultima_actualizacion': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    return datos
        
        # Si llegó aquí, no encontró datos en ninguna temporada
        return None
        
    except Exception as e:
        log(f"⚠️ Error con {nombre}: {str(e)[:100]}")
        return None

def main():
    log("🏀 INICIANDO ACTUALIZACIÓN AUTOMÁTICA DE DATOS NBA")
    log("📊 Temporadas buscadas: 2023-24, 2024-25, 2025-26")
    log("=" * 70)
    
    # Obtener jugadores activos
    log("📋 Obteniendo lista de jugadores...")
    todos_jugadores = players.get_players()
    jugadores_activos = [j for j in todos_jugadores if j['is_active']]
    log(f"✅ {len(jugadores_activos)} jugadores activos encontrados")
    log(f"📅 Fecha de actualización: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Procesar en batches con delays seguros
    BATCH_SIZE = 25
    database = {}
    exitosos = 0
    errores = 0
    sin_datos = 0
    
    total_batches = (len(jugadores_activos) + BATCH_SIZE - 1) // BATCH_SIZE
    
    log(f"\n⚙️  Configuración:")
    log(f"   • Batch size: {BATCH_SIZE}")
    log(f"   • Total batches: {total_batches}")
    log(f"   • Delay entre jugadores: 1.0s")
    log(f"   • Delay entre batches: 5.0s")
    
    for batch_num in range(total_batches):
        inicio = batch_num * BATCH_SIZE
        fin = min((batch_num + 1) * BATCH_SIZE, len(jugadores_activos))
        batch = jugadores_activos[inicio:fin]
        
        log(f"\n📦 Procesando Batch {batch_num + 1}/{total_batches} ({inicio + 1}-{fin})")
        
        for i, jugador in enumerate(batch):
            nombre = jugador['full_name']
            player_id = jugador['id']
            
            # Delay de 1 segundo entre jugadores (rate limiting seguro)
            if i > 0:
                time.sleep(1.0)
            
            datos = extraer_datos_jugador(player_id, nombre)
            
            if datos:
                database[nombre] = datos
                exitosos += 1
                log(f"   ✓ {nombre}: {datos['ppg']} PPG ({datos['temporada']})")
            else:
                sin_datos += 1
                log(f"   ✗ {nombre}: Sin datos en temporadas recientes")
        
        # Delay de 5 segundos entre batches
        if batch_num < total_batches - 1:
            time.sleep(5.0)
            
        # Mostrar progreso actual
        progreso_porcentaje = (fin / len(jugadores_activos)) * 100
        log(f"   📈 Progreso: {fin}/{len(jugadores_activos)} ({progreso_porcentaje:.1f}%)")
    
    # Guardar JSON
    nombre_archivo = 'nba_players_database.json'
    log(f"\n💾 Guardando base de datos con {exitosos} jugadores...")
    
    with open(nombre_archivo, 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)
    
    # Calcular estadísticas
    total_procesados = exitosos + sin_datos + errores
    tasa_exito = (exitosos / total_procesados) * 100 if total_procesados > 0 else 0
    
    # Resumen detallado
    log("\n" + "=" * 70)
    log("📊 RESUMEN FINAL DE ACTUALIZACIÓN")
    log("-" * 70)
    log(f"✅ Jugadores con datos: {exitosos}")
    log(f"⚠️  Sin datos recientes: {sin_datos}")
    log(f"❌ Errores de API: {errores}")
    log(f"📈 Tasa de éxito: {tasa_exito:.1f}%")
    log(f"🗂️  Temporadas encontradas:")
    
    # Analizar distribución de temporadas
    temporadas_dist = {}
    for jugador in database.values():
        temp = jugador['temporada']
        temporadas_dist[temp] = temporadas_dist.get(temp, 0) + 1
    
    for temp in sorted(temporadas_dist.keys(), reverse=True):
        log(f"   • {temp}: {temporadas_dist[temp]} jugadores")
    
    log("-" * 70)
    log(f"💾 Archivo: {nombre_archivo}")
    log(f"📏 Tamaño: {len(json.dumps(database)) / 1024:.1f} KB")
    log(f"🕐 Inicio: {datetime.now().strftime('%H:%M:%S')}")
    log("=" * 70)

if __name__ == "__main__":
    main()
