// tests/core.test.js — NioSports Pro Unit Tests
// Run with: npx vitest run tests/core.test.js
// Install: npm install -D vitest jsdom

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════
// Extract and test pure functions from the app
// These mirror the functions in index.html
// ═══════════════════════════════════════════════════════════

// ── Validate Object (copied from app) ──
const Validate = {
    odds: (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 1.01 && n <= 100; },
    stake: (v) => { const n = parseFloat(v); return !isNaN(n) && n > 0 && n <= 1000000; },
    line: (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 500; },
    score: (v) => { const n = parseInt(v); return !isNaN(n) && n >= 0 && n <= 200; },
    teamName: (v) => typeof v === 'string' && v.length >= 2 && v.length <= 50,
    text: (v, max = 500) => typeof v === 'string' && v.length <= max,
    required: (v) => v !== null && v !== undefined && String(v).trim() !== '',
    pick: (p) => {
        const errors = [];
        if (!Validate.required(p.betType)) errors.push('Tipo de apuesta requerido');
        if (!Validate.line(p.line)) errors.push('Línea inválida (0-500)');
        if (p.odds && !Validate.odds(p.odds)) errors.push('Cuota inválida (1.01-100)');
        if (p.stake && !Validate.stake(p.stake)) errors.push('Importe inválido');
        return { valid: errors.length === 0, errors };
    },
    bankroll: (b) => {
        const errors = [];
        if (!Validate.stake(b.initial)) errors.push('Bank inicial inválido');
        if (!Validate.stake(b.current)) errors.push('Bank actual inválido');
        return { valid: errors.length === 0, errors };
    }
};

// ── sanitizeHTML (copied from app) ──
function sanitizeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ── H2H Key Generator (copied from app) ──
function getH2HKey(t1, t2) { return [t1, t2].sort().join('_'); }

// ── Rate Limiter (copied from app) ──
const RateLimit = {
    _counters: {},
    check(key, maxPerMinute = 30) {
        const now = Date.now();
        if (!this._counters[key]) this._counters[key] = [];
        this._counters[key] = this._counters[key].filter(t => now - t < 60000);
        if (this._counters[key].length >= maxPerMinute) return false;
        this._counters[key].push(now);
        return true;
    }
};


// ═══════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════

describe('Validate', () => {
    describe('odds', () => {
        it('accepts valid odds', () => {
            expect(Validate.odds(1.5)).toBe(true);
            expect(Validate.odds(2.0)).toBe(true);
            expect(Validate.odds(100)).toBe(true);
            expect(Validate.odds('1.85')).toBe(true);
        });
        it('rejects invalid odds', () => {
            expect(Validate.odds(0)).toBe(false);
            expect(Validate.odds(1.0)).toBe(false);
            expect(Validate.odds(101)).toBe(false);
            expect(Validate.odds('abc')).toBe(false);
            expect(Validate.odds(null)).toBe(false);
            expect(Validate.odds(-1.5)).toBe(false);
        });
    });

    describe('stake', () => {
        it('accepts valid stakes', () => {
            expect(Validate.stake(10)).toBe(true);
            expect(Validate.stake(0.01)).toBe(true);
            expect(Validate.stake(1000000)).toBe(true);
        });
        it('rejects invalid stakes', () => {
            expect(Validate.stake(0)).toBe(false);
            expect(Validate.stake(-5)).toBe(false);
            expect(Validate.stake(1000001)).toBe(false);
            expect(Validate.stake('nope')).toBe(false);
        });
    });

    describe('line', () => {
        it('accepts valid lines', () => {
            expect(Validate.line(210.5)).toBe(true);
            expect(Validate.line(0)).toBe(true);
            expect(Validate.line(500)).toBe(true);
            expect(Validate.line('52.5')).toBe(true);
        });
        it('rejects invalid lines', () => {
            expect(Validate.line(-1)).toBe(false);
            expect(Validate.line(501)).toBe(false);
            expect(Validate.line('xyz')).toBe(false);
        });
    });

    describe('score', () => {
        it('accepts valid scores', () => {
            expect(Validate.score(0)).toBe(true);
            expect(Validate.score(110)).toBe(true);
            expect(Validate.score(200)).toBe(true);
        });
        it('rejects invalid scores', () => {
            expect(Validate.score(-1)).toBe(false);
            expect(Validate.score(201)).toBe(false);
            expect(Validate.score('abc')).toBe(false);
        });
    });

    describe('teamName', () => {
        it('accepts valid names', () => {
            expect(Validate.teamName('Lakers')).toBe(true);
            expect(Validate.teamName('LA')).toBe(true);
        });
        it('rejects invalid names', () => {
            expect(Validate.teamName('')).toBe(false);
            expect(Validate.teamName('A')).toBe(false);
            expect(Validate.teamName('A'.repeat(51))).toBe(false);
            expect(Validate.teamName(123)).toBe(false);
        });
    });

    describe('pick', () => {
        it('validates a complete pick', () => {
            const result = Validate.pick({ betType: 'OVER', line: 210.5, odds: 1.9, stake: 50 });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('rejects pick with missing betType', () => {
            const result = Validate.pick({ betType: '', line: 210, odds: 1.9 });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Tipo de apuesta requerido');
        });
        it('rejects pick with invalid line', () => {
            const result = Validate.pick({ betType: 'OVER', line: -5 });
            expect(result.valid).toBe(false);
        });
        it('rejects pick with invalid odds', () => {
            const result = Validate.pick({ betType: 'OVER', line: 210, odds: 0.5 });
            expect(result.valid).toBe(false);
        });
    });

    describe('bankroll', () => {
        it('validates valid bankroll', () => {
            expect(Validate.bankroll({ initial: 1000, current: 1200 }).valid).toBe(true);
        });
        it('rejects zero initial', () => {
            expect(Validate.bankroll({ initial: 0, current: 100 }).valid).toBe(false);
        });
    });
});

describe('sanitizeHTML', () => {
    it('escapes HTML tags', () => {
        expect(sanitizeHTML('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
    it('escapes ampersands', () => {
        expect(sanitizeHTML('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });
    it('escapes single quotes', () => {
        expect(sanitizeHTML("it's")).toBe("it&#x27;s");
    });
    it('handles empty/null input', () => {
        expect(sanitizeHTML('')).toBe('');
        expect(sanitizeHTML(null)).toBe('');
        expect(sanitizeHTML(undefined)).toBe('');
    });
    it('handles numbers', () => {
        expect(sanitizeHTML(42)).toBe('42');
    });
});

describe('getH2HKey', () => {
    it('generates consistent keys regardless of order', () => {
        expect(getH2HKey('Lakers', 'Celtics')).toBe(getH2HKey('Celtics', 'Lakers'));
    });
    it('sorts alphabetically', () => {
        expect(getH2HKey('Warriors', 'Bulls')).toBe('Bulls_Warriors');
    });
    it('handles same team', () => {
        expect(getH2HKey('Lakers', 'Lakers')).toBe('Lakers_Lakers');
    });
});

describe('RateLimit', () => {
    beforeEach(() => {
        RateLimit._counters = {};
    });

    it('allows requests under limit', () => {
        for (let i = 0; i < 29; i++) {
            expect(RateLimit.check('test', 30)).toBe(true);
        }
    });
    it('blocks at limit', () => {
        for (let i = 0; i < 30; i++) RateLimit.check('test', 30);
        expect(RateLimit.check('test', 30)).toBe(false);
    });
    it('tracks keys independently', () => {
        for (let i = 0; i < 30; i++) RateLimit.check('key1', 30);
        expect(RateLimit.check('key2', 30)).toBe(true);
    });
});
