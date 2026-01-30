"""
Script de actualización automática de datos NBA
Versión conservadora con rate limiting seguro
"""

from nba_api.stats.static import players
from nba_api.stats.endpoints import playercareerstats, playergamelog
import json
import time
from datetime import datetime
import sys

def log(mensaje):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {mensaje}")
    sys.stdout.flush()

def extraer_datos_jugador(player_id, nombre):
    """Versión simplificada y más robusta"""
    try:
        # Obtener datos básicos con timeout
        carrera = playercareerstats.PlayerCareerStats(
            player_id=player_id,
            timeout=15  # Timeout más corto
        )
        stats = carrera.get_data_frames()[0]
        
        # Buscar temporada actual
        temporadas_validas = ['2025-26', '2024-25']
        for temporada in temporadas_validas:
            stats_temporada = stats[stats['SEASON_ID'] == temporada]
            if len(stats_temporada) > 0:
                s = stats_temporada.iloc[0]
                gp = s['GP']
                
                if gp > 0:  # Solo jugadores con partidos jugados
                    datos = {
                        'id': player_id,
                        'nombre': nombre,
                        'temporada': temporada,
                        'partidos': int(gp),
                        'ppg': round(s['PTS'] / gp, 1),
                        'apg': round(s['AST'] / gp, 1),
                        'rpg': round(s['REB'] / gp, 1),
                        'ultima_actualizacion': datetime.now().strftime("%Y-%m-%d")
                    }
                    return datos
        return None
        
    except Exception as e:
        log(f"⚠️ Error con {nombre}: {str(e)[:100]}")
        return None

def main():
    log("🏀 INICIANDO ACTUALIZACIÓN AUTOMÁTICA DE DATOS NBA (Modo seguro)")
    log("=" * 70)
    
    # Obtener jugadores activos
    log("📋 Obteniendo lista de jugadores...")
    todos_jugadores = players.get_players()
    jugadores_activos = [j for j in todos_jugadores if j['is_active']]
    log(f"✅ {len(jugadores_activos)} jugadores activos encontrados")
    
    # Procesar en batches pequeños con delays generosos
    BATCH_SIZE = 25
    database = {}
    exitosos = 0
    
    total_batches = (len(jugadores_activos) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for batch_num in range(total_batches):
        inicio = batch_num * BATCH_SIZE
        fin = min((batch_num + 1) * BATCH_SIZE, len(jugadores_activos))
        batch = jugadores_activos[inicio:fin]
        
        log(f"\n📦 Batch {batch_num + 1}/{total_batches} ({inicio + 1}-{fin})")
        
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
                log(f"   ✓ {nombre}: {datos['ppg']} PPG")
            else:
                log(f"   ✗ {nombre}: Sin datos")
        
        # Delay de 5 segundos entre batches
        if batch_num < total_batches - 1:
            time.sleep(5)
    
    # Guardar JSON
    log(f"\n💾 Guardando {exitosos} jugadores...")
    with open('nba_players_database.json', 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)
    
    # Resumen
    log("\n" + "=" * 70)
    log(f"✅ COMPLETADO: {exitosos}/{len(jugadores_activos)} jugadores")
    log(f"📊 Tasa de éxito: {(exitosos/len(jugadores_activos)*100):.1f}%")
    log(f"⏱️  Hora final: {datetime.now().strftime('%H:%M:%S')}")
    log("=" * 70)

if __name__ == "__main__":
    main()
