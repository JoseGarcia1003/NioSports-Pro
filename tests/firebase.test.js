// tests/firebase.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock de Firebase (sin hacer requests reales)
const mockDatabase = {
    _data: {},
    ref(path) {
        return {
            set: async (data) => {
                mockDatabase._data[path] = data;
                return Promise.resolve();
            },
            get: async () => {
                const val = mockDatabase._data[path];
                return Promise.resolve({
                    exists: () => val !== undefined,
                    val: () => val
                });
            },
            update: async (updates) => {
                const current = mockDatabase._data[path] || {};
                mockDatabase._data[path] = { ...current, ...updates };
                return Promise.resolve();
            },
            remove: async () => {
                delete mockDatabase._data[path];
                return Promise.resolve();
            },
            once: async (event) => {
                const val = mockDatabase._data[path];
                return Promise.resolve({
                    exists: () => val !== undefined,
                    val: () => val
                });
            }
        };
    },
    clear() {
        this._data = {};
    }
};

describe('Firebase Integration', () => {
    const userId = 'test-user-123';
    
    beforeEach(() => {
        mockDatabase.clear();
    });
    
    describe('User Data', () => {
        it('guarda profile de usuario correctamente', async () => {
            const profile = {
                email: 'test@example.com',
                displayName: 'Test User',
                createdAt: Date.now()
            };
            
            await mockDatabase.ref(`users/${userId}/profile`).set(profile);
            
            const snapshot = await mockDatabase.ref(`users/${userId}/profile`).get();
            
            expect(snapshot.exists()).toBe(true);
            expect(snapshot.val()).toEqual(profile);
        });
        
        it('actualiza profile existente', async () => {
            await mockDatabase.ref(`users/${userId}/profile`).set({
                email: 'test@example.com',
                displayName: 'Old Name'
            });
            
            await mockDatabase.ref(`users/${userId}/profile`).update({
                displayName: 'New Name'
            });
            
            const snapshot = await mockDatabase.ref(`users/${userId}/profile`).get();
            
            expect(snapshot.val().displayName).toBe('New Name');
            expect(snapshot.val().email).toBe('test@example.com'); // No cambió
        });
    });
    
    describe('Picks', () => {
        it('guarda pick de totals correctamente', async () => {
            const pick = {
                id: 'pick-001',
                type: 'totals',
                localTeam: 'Lakers',
                awayTeam: 'Celtics',
                betType: 'OVER',
                line: 220.5,
                odds: 1.9,
                stake: 100,
                confidence: 75,
                date: Date.now(),
                result: 'pending'
            };
            
            await mockDatabase.ref(`users/${userId}/picks_totales/${pick.id}`).set(pick);
            
            const snapshot = await mockDatabase.ref(`users/${userId}/picks_totales/${pick.id}`).get();
            
            expect(snapshot.exists()).toBe(true);
            expect(snapshot.val()).toEqual(pick);
        });
        
        it('actualiza resultado de pick', async () => {
            const pickId = 'pick-001';
            
            await mockDatabase.ref(`users/${userId}/picks_totales/${pickId}`).set({
                betType: 'OVER',
                line: 220.5,
                result: 'pending'
            });
            
            await mockDatabase.ref(`users/${userId}/picks_totales/${pickId}`).update({
                result: 'win',
                finalScore: 225
            });
            
            const snapshot = await mockDatabase.ref(`users/${userId}/picks_totales/${pickId}`).get();
            
            expect(snapshot.val().result).toBe('win');
            expect(snapshot.val().finalScore).toBe(225);
        });
        
        it('elimina pick', async () => {
            const pickId = 'pick-001';
            
            await mockDatabase.ref(`users/${userId}/picks_totales/${pickId}`).set({
                betType: 'OVER'
            });
            
            await mockDatabase.ref(`users/${userId}/picks_totales/${pickId}`).remove();
            
            const snapshot = await mockDatabase.ref(`users/${userId}/picks_totales/${pickId}`).get();
            
            expect(snapshot.exists()).toBe(false);
        });
    });
    
    describe('Bankroll', () => {
        it('guarda bankroll inicial', async () => {
            const bankroll = {
                initial: 1000,
                current: 1000,
                lastUpdated: Date.now()
            };
            
            await mockDatabase.ref(`users/${userId}/bankroll`).set(bankroll);
            
            const snapshot = await mockDatabase.ref(`users/${userId}/bankroll`).get();
            
            expect(snapshot.val()).toEqual(bankroll);
        });
        
        it('actualiza bankroll después de pick ganador', async () => {
            await mockDatabase.ref(`users/${userId}/bankroll`).set({
                initial: 1000,
                current: 1000
            });
            
            const winProfit = 90; // Stake 100, odds 1.9
            
            await mockDatabase.ref(`users/${userId}/bankroll`).update({
                current: 1090
            });
            
            const snapshot = await mockDatabase.ref(`users/${userId}/bankroll`).get();
            
            expect(snapshot.val().current).toBe(1090);
            expect(snapshot.val().initial).toBe(1000); // No cambia
        });
    });
    
    describe('H2H Cache', () => {
        it('guarda cache de H2H', async () => {
            const key = 'Lakers_Celtics';
            const h2hData = {
                games: [
                    { date: '2024-01-15', homeScore: 115, awayScore: 110 },
                    { date: '2024-01-01', homeScore: 108, awayScore: 112 }
                ],
                lastFetched: Date.now()
            };
            
            await mockDatabase.ref(`h2hCache/${key}`).set(h2hData);
            
            const snapshot = await mockDatabase.ref(`h2hCache/${key}`).get();
            
            expect(snapshot.exists()).toBe(true);
            expect(snapshot.val().games).toHaveLength(2);
        });
    });
});
