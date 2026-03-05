// components/bankroll.js
// Bankroll Module - NioSports Pro
// Isolates bankroll functionality from main.js

let BANKROLL_DATA = {
    picks: [],
    dailyBanks: {},
    settings: { alertThreshold: 20, initialBank: 0 },
    current: 0
};

let bankrollChart = null;

window.loadBankrollFromFirebase = function () {
    if (!window.userId) { window.Logger.warn('⚠️ loadBankroll: sin userId'); return; }
    window.database.ref(`users/${window.userId}/bankroll_data`).on('value', (snapshot) => {
        if (snapshot.exists()) {
            window.BANKROLL_DATA = snapshot.val();
        }
        // Asegurar que picks siempre sea un array
        if (!window.BANKROLL_DATA.picks || !Array.isArray(window.BANKROLL_DATA.picks)) {
            window.BANKROLL_DATA.picks = [];
        }
        if (!window.BANKROLL_DATA.dailyBanks) {
            window.BANKROLL_DATA.dailyBanks = {};
        }
        if (!window.BANKROLL_DATA.settings) {
            window.BANKROLL_DATA.settings = { alertThreshold: 20, initialBank: 0 };
        }
        if (window.currentView === 'bankroll' && typeof window.render === 'function') window.render();
    });
};

window.saveBankrollToFirebase = function () {
    if (!window.firebaseConnected) {
        if (typeof window.toastWarning === 'function') window.toastWarning('No hay conexión con Firebase', { title: 'Conexión' });
        return false;
    }
    if (!window.userId) return false;
    window.database.ref(`users/${window.userId}/bankroll_data`).set(window.BANKROLL_DATA);
    return true;
};

window.getTodayDate = function () {
    return new Date().toISOString().split('T')[0];
};

window.canSetDailyBank = function () {
    return !window.BANKROLL_DATA.dailyBanks[window.getTodayDate()];
};

window.setDailyBank = function (amount) {
    const today = window.getTodayDate();
    if (window.BANKROLL_DATA.dailyBanks[today]) {
        if (typeof window.toastWarning === 'function') window.toastWarning('Ya has registrado el bank de hoy', { title: 'Bankroll' });
        return false;
    }
    window.BANKROLL_DATA.dailyBanks[today] = parseFloat(amount);
    if (window.BANKROLL_DATA.settings.initialBank === 0) {
        window.BANKROLL_DATA.settings.initialBank = parseFloat(amount);
    }
    window.saveBankrollToFirebase();
    if (typeof window.render === 'function') window.render();
    return true;
};

window.getCurrentBank = function () {
    const dates = Object.keys(window.BANKROLL_DATA.dailyBanks).sort();
    if (dates.length === 0) return 0;

    const latestDate = dates[dates.length - 1];
    let bank = window.BANKROLL_DATA.dailyBanks[latestDate];

    const picks = window.BANKROLL_DATA.picks.filter(p => p.date >= latestDate && p.status !== 'pending');
    picks.forEach(pick => {
        if (pick.status === 'won') bank += pick.profit;
        else if (pick.status === 'lost') bank -= pick.stake;
    });

    return bank;
};

window.addPickToBankroll = function (pickData) {
    const pick = {
        id: Date.now(),
        date: window.getTodayDate(),
        time: new Date().toLocaleTimeString('es-ES'),
        type: pickData.type,
        odds: parseFloat(pickData.odds),
        stake: parseFloat(pickData.stake),
        profit: (parseFloat(pickData.stake) * parseFloat(pickData.odds)) - parseFloat(pickData.stake),
        category: pickData.category || 'NBA',
        notes: pickData.notes || '',
        status: 'pending'
    };

    window.BANKROLL_DATA.picks.unshift(pick);
    window.saveBankrollToFirebase();
    if (typeof window.render === 'function') window.render();
};

window.updateBankrollPickStatus = function (pickId, status) {
    const pick = window.BANKROLL_DATA.picks.find(p => p.id === pickId);
    if (!pick) return;

    const prevStatus = pick.status;
    pick.status = status;

    // Recalculate bankroll
    if (status === 'won' && prevStatus === 'pending') {
        window.BANKROLL_DATA.current = (window.BANKROLL_DATA.current || 0) + pick.profit;
    } else if (status === 'lost' && prevStatus === 'pending') {
        window.BANKROLL_DATA.current = (window.BANKROLL_DATA.current || 0) - pick.stake;
    }

    window.saveBankrollToFirebase();
    if (typeof window.showNotification === 'function') {
        window.showNotification('success',
            status === 'won' ? '✅ Pick GANADO' : '❌ Pick PERDIDO',
            `Stake: $${pick.stake.toFixed(2)} | ${status === 'won' ? 'Ganancia: $' + pick.profit.toFixed(2) : 'Pérdida: -$' + pick.stake.toFixed(2)}`
        );
    }
    if (typeof window.render === 'function') window.render();
};

window.deletePickFromBankroll = function (pickId) {
    window.BANKROLL_DATA.picks = window.BANKROLL_DATA.picks.filter(p => p.id !== pickId);
    window.saveBankrollToFirebase();
    if (typeof window.render === 'function') window.render();
};

window.getFilteredPicks = function () {
    if (!window.BANKROLL_DATA || !window.BANKROLL_DATA.picks || !Array.isArray(window.BANKROLL_DATA.picks)) {
        return [];
    }
    let picks = window.BANKROLL_DATA.picks.filter(p => p.status !== 'pending');

    if (window.filterPeriod !== 'all') {
        const today = new Date();
        const startDate = new Date();

        if (window.filterPeriod === 'today') startDate.setHours(0, 0, 0, 0);
        else if (window.filterPeriod === 'week') startDate.setDate(today.getDate() - 7);
        else if (window.filterPeriod === 'month') startDate.setMonth(today.getMonth() - 1);

        picks = picks.filter(p => new Date(p.date) >= startDate);
    }

    if (window.filterType !== 'all') picks = picks.filter(p => p.type === window.filterType);

    return picks;
};

window.calculateStats = function () {
    const picks = window.getFilteredPicks();
    const totalPicks = picks.length;
    const wonPicks = picks.filter(p => p.status === 'won').length;
    const lostPicks = picks.filter(p => p.status === 'lost').length;

    const totalStaked = picks.reduce((sum, p) => sum + p.stake, 0);
    const totalProfit = picks.reduce((sum, p) => {
        return sum + (p.status === 'won' ? p.profit : -p.stake);
    }, 0);

    const strikeRate = totalPicks > 0 ? (wonPicks / totalPicks) * 100 : 0;
    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
    const yield_ = totalPicks > 0 ? (totalProfit / totalStaked) * 100 : 0;
    const avgOdds = totalPicks > 0 ? picks.reduce((sum, p) => sum + p.odds, 0) / totalPicks : 0;

    let currentStreak = 0, streakType = 'none';
    for (let i = 0; i < picks.length; i++) {
        if (i === 0) {
            currentStreak = 1;
            streakType = picks[i].status;
        } else if (picks[i].status === streakType) {
            currentStreak++;
        } else break;
    }

    const singlePicks = picks.filter(p => p.type === 'single');
    const comboPicks = picks.filter(p => p.type === 'combo');

    return {
        totalPicks, wonPicks, lostPicks, strikeRate, roi,
        yield: yield_, avgOdds, totalProfit, totalStaked,
        currentStreak, streakType,
        singlePicks, comboPicks,
        currentBank: window.getCurrentBank(),
        initialBank: window.BANKROLL_DATA.settings.initialBank
    };
};

window.exportBankrollToCSV = function () {
    if (!window.BANKROLL_DATA.picks || window.BANKROLL_DATA.picks.length === 0) {
        if (typeof window.showNotification === 'function') window.showNotification('warning', 'Sin datos', 'No hay picks registrados para exportar');
        return;
    }
    const picks = window.BANKROLL_DATA.picks;
    let csv = 'Fecha,Hora,Tipo,Cuota,Importe,Ganancia,Categoría,Estado,Notas\n';
    picks.forEach(pick => {
        const notes = (pick.notes || '').replace(/"/g, '""');
        csv += `${pick.date},${pick.time || ''},${pick.type},${pick.odds},${pick.stake},${pick.profit.toFixed(2)},${pick.category},${pick.status},"${notes}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bankroll_export_${window.getTodayDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    if (typeof window.showNotification === 'function') window.showNotification('success', 'Exportado', 'CSV de bankroll descargado');
};

window.createBankrollChart = function () {
    const canvas = document.getElementById('bankrollChart');
    if (!canvas) return;

    if (window.bankrollChart) window.bankrollChart.destroy();

    const sortedDates = Object.keys(window.BANKROLL_DATA.dailyBanks).sort();
    const labels = [];
    const data = [];

    sortedDates.forEach(date => {
        let bank = window.BANKROLL_DATA.dailyBanks[date];
        const dayPicks = window.BANKROLL_DATA.picks.filter(p => p.date === date && p.status !== 'pending');
        dayPicks.forEach(pick => {
            if (pick.status === 'won') bank += pick.profit;
            else if (pick.status === 'lost') bank -= pick.stake;
        });
        labels.push(date);
        data.push(bank);
    });

    if (typeof Chart !== 'undefined') {
        window.bankrollChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Bank',
                    data: data,
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: false, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#fff' } },
                    x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#fff' } }
                }
            }
        });
    }
};

window.showSetBankModal = function () {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="glass-card rounded-xl p-8 max-w-md w-full mx-4">
            <h3 class="text-2xl font-bold text-white mb-4">Registrar Bank de Hoy</h3>
            <input type="number" id="bankInput" step="0.01" placeholder="$0.00"
                   class="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white font-bold text-center text-2xl mb-4 focus:border-yellow-500 focus:outline-none">
            <div class="flex gap-4">
                <button onclick="this.closest('.fixed').remove()"
                        class="flex-1 py-3 bg-gray-600 rounded-lg text-white font-bold hover:bg-gray-700">
                    Cancelar
                </button>
                <button onclick="window.setDailyBank(document.getElementById('bankInput').value);this.closest('.fixed').remove()"
                        class="flex-1 py-3 bg-green-600 rounded-lg text-white font-bold hover:bg-green-700">
                    Guardar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.showAddPickModal = function () {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto';
    modal.innerHTML = `
        <div class="glass-card rounded-xl p-8 max-w-2xl w-full mx-4 my-8">
            <h3 class="text-2xl font-bold text-white mb-4">Agregar Nuevo Pick</h3>

            <div class="space-y-4 mb-6">
                <div>
                    <label class="text-gray-400 text-sm block mb-2">Tipo de Apuesta</label>
                    <select id="pickType" class="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white">
                        <option value="single">🎯 Sencilla</option>
                        <option value="combo">🎲 Combinada</option>
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-gray-400 text-sm block mb-2">Cuota</label>
                        <input type="number" id="pickOdds" step="0.01" placeholder="2.00"
                               class="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white font-bold focus:border-yellow-500 focus:outline-none">
                    </div>
                    <div>
                        <label class="text-gray-400 text-sm block mb-2">Importe ($)</label>
                        <input type="number" id="pickStake" step="0.01" placeholder="100.00"
                               class="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white font-bold focus:border-yellow-500 focus:outline-none">
                    </div>
                </div>

                <div>
                    <label class="text-gray-400 text-sm block mb-2">Categoría</label>
                    <select id="pickCategory" class="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white">
                        <option value="NBA">🏀 NBA</option>
                        <option value="NFL">🏈 NFL</option>
                        <option value="Fútbol">⚽ Fútbol</option>
                        <option value="MLB">⚾ MLB</option>
                        <option value="NHL">🏒 NHL</option>
                        <option value="Otro">🎲 Otro</option>
                    </select>
                </div>

                <div>
                    <label class="text-gray-400 text-sm block mb-2">Notas (opcional)</label>
                    <textarea id="pickNotes" rows="3" placeholder="Análisis, razón del pick, etc."
                              class="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white focus:border-yellow-500 focus:outline-none"></textarea>
                </div>
            </div>

            <div class="flex gap-4">
                <button onclick="this.closest('.fixed').remove()"
                        class="flex-1 py-3 bg-gray-600 rounded-lg text-white font-bold hover:bg-gray-700">
                    Cancelar
                </button>
                <button onclick="window.submitPickToBankroll();this.closest('.fixed').remove()"
                        class="flex-1 py-3 bg-purple-600 rounded-lg text-white font-bold hover:bg-purple-700">
                    Agregar Pick
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.submitPickToBankroll = function () {
    const type = document.getElementById('pickType').value;
    const odds = document.getElementById('pickOdds').value;
    const stake = document.getElementById('pickStake').value;
    const category = document.getElementById('pickCategory').value;
    const notes = document.getElementById('pickNotes').value;

    if (!odds || !stake || parseFloat(odds) <= 0 || parseFloat(stake) <= 0) {
        if (typeof window.toastWarning === 'function') window.toastWarning('Completa todos los campos correctamente', { title: 'Validación' });
        return;
    }

    window.addPickToBankroll({ type, odds, stake, category, notes });
};

window.renderBankrollView = function () {
    const stats = window.calculateStats();
    const canSetBank = window.canSetDailyBank();
    const container = document.getElementById('bankrollContainer');

    // Si mainApp no delega en bankrollContainer (si estamos ruteando completo), usamos el div wrapper
    if (!container) {
        return _buildBankrollHTML(stats, canSetBank);
    } else {
        container.innerHTML = _buildBankrollHTMLInner(stats, canSetBank);
        setTimeout(() => window.createBankrollChart(), 100);
    }
};

function _buildBankrollHTMLInner(stats, canSetBank) {
    return `
        <!-- Contenedor Principal Centralizado -->
        <div style="max-width: 1400px; margin: 0 auto; padding: 0 20px;">

            <!-- Botón Volver -->
            <button onclick="window.navigateTo('home')" aria-label="Ir al inicio" class="mb-4 px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all flex items-center gap-2" style="background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 215, 0, 0.3); color: white;">
                ← Volver al Inicio
            </button>

            <!-- Hero Section Compacta -->
            <div class="rounded-3xl p-6 mb-6 shadow-2xl border border-yellow-500/30" style="background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #0d1b2a 100%);">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div class="flex items-center gap-4">
                        <div class="text-6xl">💰</div>
                        <div>
                            <h2 class="text-3xl font-display gradient-text-animated mb-1">BANKROLL</h2>
                            <p class="text-gray-400 text-sm">Bank Actual</p>
                            <p class="text-3xl md:text-5xl font-display gradient-text-animated mt-2">$${stats.currentBank.toFixed(2)}</p>
                            <div class="flex items-center gap-3 mt-2">
                                <div class="px-3 py-1 rounded-lg" style="background: ${stats.totalProfit >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'};">
                                    <p class="text-${stats.totalProfit >= 0 ? 'green' : 'red'}-400 font-bold">
                                        ${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}
                                    </p>
                                </div>
                                <div class="text-gray-400 text-sm">
                                    <p>Bank Inicial: <span class="text-white font-bold">$${stats.initialBank.toFixed(2)}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2">
                        ${canSetBank ? `
                            <button onclick="window.showSetBankModal()" class="px-6 py-3 rounded-xl font-bold shadow-xl hover:scale-105 transition-all" style="background: linear-gradient(135deg, #FFD700 0%, #F59E0B 100%); color: #0d1b2a;">
                                📝 Registrar Bank
                            </button>
                        ` : `
                            <div class="px-4 py-2 rounded-xl border-2 border-green-500/50" style="background: rgba(34, 197, 94, 0.1);">
                                <p class="text-green-400 font-bold text-sm">✅ Bank registrado</p>
                            </div>
                        `}
                        <button onclick="window.showAddPickModal()" class="px-6 py-3 rounded-xl font-bold shadow-xl hover:scale-105 transition-all" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white;">
                            ➕ Agregar Pick
                        </button>
                    </div>
                </div>
            </div>

            <!-- Filtros Compactos -->
            <div class="bankroll-filters rounded-xl p-3 mb-6 border border-white/10 flex items-center gap-3 flex-wrap" style="background: rgba(27, 38, 59, 0.6);">
                <select onchange="window.filterPeriod=this.value;window.renderBankrollView()" class="px-3 py-2 rounded-lg text-white text-sm font-semibold" style="background: rgba(13, 27, 42, 0.8); border: 2px solid rgba(255, 215, 0, 0.2);">
                    <option value="all">📅 Todo</option>
                    <option value="today">📅 Hoy</option>
                    <option value="week">📅 Semana</option>
                    <option value="month">📅 Mes</option>
                </select>
                <select onchange="window.filterType=this.value;window.renderBankrollView()" class="px-3 py-2 rounded-lg text-white text-sm font-semibold" style="background: rgba(13, 27, 42, 0.8); border: 2px solid rgba(255, 215, 0, 0.2);">
                    <option value="all">🎲 Todos</option>
                    <option value="single">🎯 Sencillas</option>
                    <option value="combo">🎲 Combinadas</option>
                </select>
                <button onclick="window.exportBankrollToCSV()" aria-label="Exportar bankroll a CSV" class="ml-auto px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-all" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white;">
                    📥 Exportar CSV
                </button>
            </div>

            <!-- Grid de Métricas -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                ${[
            { label: 'ROI', value: stats.roi.toFixed(1) + '%', color: stats.roi >= 0 ? 'green' : 'red' },
            { label: 'Yield', value: stats.yield.toFixed(1) + '%', color: 'cyan' },
            { label: 'Strike Rate', value: stats.strikeRate.toFixed(1) + '%', color: 'purple' },
            { label: 'Cuota Avg', value: stats.avgOdds.toFixed(2), color: 'yellow' },
            { label: 'Racha', value: stats.currentStreak + (stats.streakType === 'won' ? 'W' : stats.streakType === 'lost' ? 'L' : '-'), color: stats.streakType === 'won' ? 'green' : 'red' },
            { label: 'Picks', value: stats.totalPicks, color: 'white' }
        ].map(m => `
                    <div class="rounded-xl p-4 shadow-lg hover:scale-105 transition-all border border-white/10" style="background: linear-gradient(135deg, rgba(13, 27, 42, 0.8) 0%, rgba(27, 38, 59, 0.8) 100%);">
                        <p class="text-gray-400 text-xs mb-1 uppercase tracking-wider">${m.label}</p>
                        <p class="text-2xl font-display text-${m.color}-400 font-bold">${m.value}</p>
                    </div>
                `).join('')}
            </div>

            <!-- Grid de Gráfica y Stats -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

                <!-- Gráfica (2 columnas) -->
                <div class="lg:col-span-2 rounded-2xl p-5 shadow-xl border border-yellow-500/30" style="background: linear-gradient(135deg, rgba(13, 27, 42, 0.9) 0%, rgba(27, 38, 59, 0.9) 100%);">
                    <h3 class="text-xl font-display gradient-text-animated mb-3 flex items-center gap-2">
                        <span class="text-2xl">📈</span> EVOLUCIÓN DEL BANK
                    </h3>
                    <div style="height: 250px;">
                        <canvas id="bankrollChart"></canvas>
                    </div>
                </div>

                <!-- Stats Compactas (1 columna) -->
                <div class="space-y-3">
                    <!-- Por Tipo -->
                    <div class="rounded-xl p-4 shadow-xl border border-white/10" style="background: linear-gradient(135deg, rgba(13, 27, 42, 0.8) 0%, rgba(27, 38, 59, 0.8) 100%);">
                        <h3 class="text-sm font-display text-white mb-3 flex items-center gap-2">
                            <span>📊</span> POR TIPO
                        </h3>
                        <div class="space-y-2">
                            <div class="flex justify-between items-center p-2 rounded-lg" style="background: rgba(255,255,255,0.05);">
                                <span class="text-gray-300 text-sm">🎯 Sencillas</span>
                                <div class="text-right">
                                    <p class="text-white font-bold text-sm">${stats.singlePicks.length}</p>
                                    <p class="text-xs ${stats.singlePicks.filter(p => p.status === 'won').length > stats.singlePicks.filter(p => p.status === 'lost').length ? 'text-green-400' : 'text-red-400'}">
                                        ${stats.singlePicks.filter(p => p.status === 'won').length}W - ${stats.singlePicks.filter(p => p.status === 'lost').length}L
                                    </p>
                                </div>
                            </div>
                            <div class="flex justify-between items-center p-2 rounded-lg" style="background: rgba(255,255,255,0.05);">
                                <span class="text-gray-300 text-sm">🎲 Combinadas</span>
                                <div class="text-right">
                                    <p class="text-white font-bold text-sm">${stats.comboPicks.length}</p>
                                    <p class="text-xs ${stats.comboPicks.filter(p => p.status === 'won').length > stats.comboPicks.filter(p => p.status === 'lost').length ? 'text-green-400' : 'text-red-400'}">
                                        ${stats.comboPicks.filter(p => p.status === 'won').length}W - ${stats.comboPicks.filter(p => p.status === 'lost').length}L
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Resumen -->
                    <div class="rounded-xl p-4 shadow-xl border border-white/10" style="background: linear-gradient(135deg, rgba(13, 27, 42, 0.8) 0%, rgba(27, 38, 59, 0.8) 100%);">
                        <h3 class="text-sm font-display text-white mb-3 flex items-center gap-2">
                            <span>💡</span> RESUMEN
                        </h3>
                        <div class="space-y-2">
                            <div class="flex justify-between items-center p-2 rounded-lg" style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3);">
                                <span class="text-green-300 text-sm">✅ Ganados</span>
                                <span class="text-green-400 font-bold text-lg">${stats.wonPicks}</span>
                            </div>
                            <div class="flex justify-between items-center p-2 rounded-lg" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);">
                                <span class="text-red-300 text-sm">❌ Perdidos</span>
                                <span class="text-red-400 font-bold text-lg">${stats.lostPicks}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Picks Recientes -->
            <div class="rounded-2xl p-5 shadow-xl border border-white/10 mb-6" style="background: linear-gradient(135deg, rgba(13, 27, 42, 0.9) 0%, rgba(27, 38, 59, 0.9) 100%);">
                <h3 class="text-xl font-display gradient-text-animated mb-4 flex items-center gap-2">
                    <span class="text-2xl">📋</span> PICKS RECIENTES
                </h3>
                <div class="space-y-3">
                    ${(!window.BANKROLL_DATA.picks || window.BANKROLL_DATA.picks.length === 0) ? `
                        <div class="empty-state">
                            <div class="empty-state-icon">📊</div>
                            <div class="empty-state-title">No hay picks registrados</div>
                            <div class="empty-state-desc">Comienza agregando tu primer pick usando el botón "➕ Agregar Pick" de arriba</div>
                            <button onclick="window.showAddPickModal()" class="mt-4 px-6 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-all" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white;">
                                ➕ Agregar mi primer pick
                            </button>
                        </div>
                    ` : window.BANKROLL_DATA.picks.slice(0, 10).map(pick => `
                        <div class="rounded-xl p-3 hover:scale-[1.01] transition-all" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                            <div class="flex items-center justify-between flex-wrap gap-3">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                                        <span class="${pick.status === 'won' ? 'win-badge' : pick.status === 'lost' ? 'loss-badge' : 'pending-badge'} px-2 py-1 rounded-full text-xs font-bold">
                                            ${pick.status === 'won' ? '✅ WIN' : pick.status === 'lost' ? '❌ LOSS' : '⏳ PEND'}
                                        </span>
                                        <span class="text-cyan-400 font-bold text-sm">${pick.type === 'single' ? '🎯' : '🎲'}</span>
                                        <span class="px-2 py-1 rounded-full text-xs font-bold" style="background: rgba(139, 92, 246, 0.2); color: #a78bfa;">${pick.category}</span>
                                    </div>
                                    <div class="grid grid-cols-4 gap-2 text-xs">
                                        <div>
                                            <p class="text-gray-400">Fecha</p>
                                            <p class="text-white font-semibold">${pick.date}</p>
                                        </div>
                                        <div>
                                            <p class="text-gray-400">Cuota</p>
                                            <p class="gradient-text-animated font-bold">${pick.odds.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p class="text-gray-400">Stake</p>
                                            <p class="text-white font-bold">$${pick.stake.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p class="text-gray-400">Ganancia</p>
                                            <p class="text-green-400 font-bold">$${pick.profit.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function _buildBankrollHTML(stats, canSetBank) {
    return _buildBankrollHTMLInner(stats, canSetBank);
}

// Variables globales para filtros que usa renderBankrollView()
window.filterPeriod = window.filterPeriod || 'all';
window.filterType = window.filterType || 'all';

// Referencia a BANKROLL_DATA como global para retrocompatibilidad
window.BANKROLL_DATA = BANKROLL_DATA;
window.bankrollChart = bankrollChart;

// Exportar un booleano para validar que este módulo cargó bien
window.__BANKROLL_IA_READY__ = true;
