/**
 * Auto-DJ — Unified Standalone Extension
 *
 * Intelligent queue sequencer that fills and sequences your queue
 * based on mood, energy, BPM compatibility, and key harmony.
 *
 * Works with any Spicetify theme (or no theme).
 * Detects Understory theme for themed accent colors.
 */

(function AutoDJ() {
    'use strict';

    // Fix 4: Add retry counter and max retries
    let initRetries = 0;
    const MAX_INIT_RETRIES = 100;

    if (!Spicetify?.Player || !Spicetify?.Platform) {
        if (initRetries < MAX_INIT_RETRIES) {
            initRetries++;
            setTimeout(AutoDJ, 100);
        } else {
            console.warn('[Auto-DJ] Spicetify not available after max retries');
        }
        return;
    }
    initRetries = 0;

    const { React, PopupModal, Player, CosmosAsync, LocalStorage, showNotification, Topbar } = Spicetify;
    const { useState, useEffect, useCallback, useRef, createElement: h } = React;

    // ── Theme Detection ──────────────────────────────────────────

    function isUnderstory() {
        try {
            const bg = getComputedStyle(document.documentElement).getPropertyValue('--dyn-bg').trim();
            return bg === '#11140f' || bg === '#1a1d16';
        } catch { return false; }
    }

    function themed() {
        return isUnderstory();
    }

    // ── CSS Injection ────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('autodj-styles')) return;

        const t = themed();
        const c = {
            accent:     t ? '#3fd0c9' : 'var(--spice-button, #1db954)',
            highlight:  t ? '#e8a23d' : 'var(--spice-highlight, #1db954)',
            energy:     t ? '#ef6aaf' : 'var(--spice-button, #1db954)',
            success:    t ? '#9fe84a' : 'var(--spice-button, #1db954)',
            text:       t ? '#e9ede4' : 'var(--spice-text, #fff)',
            subtext:    t ? '#96a38c' : 'var(--spice-subtext, #b3b3b3)',
            bg:         t ? '#1a1d16' : 'var(--spice-main, #121212)',
            surface:    t ? '#242b1f' : 'var(--spice-card, #282828)',
            border:     t ? '#33402c' : 'var(--spice-card-highlight, #333)',
            overlay:    t ? 'rgba(17,20,15,0.82)' : 'rgba(0,0,0,0.7)',
        };

        const style = document.createElement('style');
        style.id = 'autodj-styles';
        style.textContent = `
/* ─── Modal Overlay ─── */
.autodj-overlay {
    position: fixed !important;
    inset: 0 !important;
    background: ${c.overlay} !important;
    backdrop-filter: blur(6px) !important;
    -webkit-backdrop-filter: blur(6px) !important;
    z-index: 99999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    animation: autodj-fadeIn 0.18s ease-out !important;
}

@keyframes autodj-fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}

/* ─── Modal Container ─── */
.autodj-modal {
    background: ${c.surface} !important;
    border: 1px solid ${c.border} !important;
    border-radius: 12px !important;
    width: 420px !important;
    max-height: 80vh !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6) !important;
    animation: autodj-slideUp 0.2s ease-out !important;
    font-family: 'Inter', 'Manrope', system-ui, -apple-system, sans-serif !important;
    color: ${c.text} !important;
}

@keyframes autodj-slideUp {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ─── Modal Header ─── */
.autodj-header {
    display: flex !important;
    align-items: center !important;
    padding: 16px 20px 12px !important;
    border-bottom: 1px solid ${c.border} !important;
    gap: 10px !important;
}

.autodj-header-icon {
    color: ${c.accent} !important;
    flex-shrink: 0 !important;
}

.autodj-header-title {
    flex: 1 !important;
    font-size: 16px !important;
    font-weight: 700 !important;
    color: ${c.text} !important;
    letter-spacing: -0.01em !important;
}

.autodj-header-status {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    font-size: 12px !important;
    font-weight: 500 !important;
}

.autodj-header-status.on  { color: ${c.success} !important; }
.autodj-header-status.off { color: ${c.subtext} !important; }

.autodj-status-dot {
    width: 7px !important;
    height: 7px !important;
    border-radius: 50% !important;
    display: inline-block !important;
}

.autodj-header-status.on .autodj-status-dot  { background: ${c.success} !important; box-shadow: 0 0 6px ${c.success} !important; }
.autodj-header-status.off .autodj-status-dot { background: ${c.subtext} !important; }

/* ─── Modal Body ─── */
.autodj-body {
    padding: 16px 20px !important;
    overflow-y: auto !important;
    flex: 1 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 18px !important;
}

/* ─── Enable Toggle ─── */
.autodj-enable-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 10px 14px !important;
    background: ${c.bg} !important;
    border-radius: 8px !important;
    border: 1px solid ${c.border} !important;
}

.autodj-enable-label {
    font-size: 13px !important;
    font-weight: 600 !important;
    color: ${c.text} !important;
}

.autodj-switch {
    width: 40px !important;
    height: 22px !important;
    border-radius: 11px !important;
    border: none !important;
    cursor: pointer !important;
    position: relative !important;
    transition: background 0.15s ease !important;
    padding: 0 !important;
    background: ${t ? '#33402c' : '#535353'} !important;
}

.autodj-switch.on { background: ${c.accent} !important; }

.autodj-switch-knob {
    width: 16px !important;
    height: 16px !important;
    border-radius: 50% !important;
    background: #fff !important;
    position: absolute !important;
    top: 3px !important;
    transition: left 0.15s ease !important;
}

.autodj-switch.off .autodj-switch-knob { left: 3px !important; }
.autodj-switch.on .autodj-switch-knob  { left: 21px !important; }

/* ─── Section Label ─── */
.autodj-section-label {
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
    color: ${c.subtext} !important;
    margin-bottom: 6px !important;
}

/* ─── Mood Presets ─── */
.autodj-mood-grid {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
}

.autodj-mood-btn {
    padding: 6px 14px !important;
    border-radius: 20px !important;
    border: 1.5px solid ${c.border} !important;
    background: transparent !important;
    color: ${c.subtext} !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all 0.12s ease !important;
}

.autodj-mood-btn:hover {
    border-color: ${c.accent} !important;
    color: ${c.accent} !important;
}

.autodj-mood-btn.active {
    background: ${c.accent} !important;
    border-color: ${c.accent} !important;
    color: ${c.bg} !important;
    font-weight: 600 !important;
}

/* ─── Energy Slider ─── */
.autodj-energy-row {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
}

.autodj-energy-slider {
    flex: 1 !important;
    -webkit-appearance: none !important;
    appearance: none !important;
    height: 6px !important;
    border-radius: 3px !important;
    background: ${c.border} !important;
    outline: none !important;
    cursor: pointer !important;
}

.autodj-energy-slider::-webkit-slider-thumb {
    -webkit-appearance: none !important;
    width: 16px !important;
    height: 16px !important;
    border-radius: 50% !important;
    background: ${c.energy} !important;
    cursor: pointer !important;
    box-shadow: 0 0 6px ${c.energy}40 !important;
    transition: transform 0.1s ease !important;
}

.autodj-energy-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2) !important;
}

.autodj-energy-slider::-moz-range-thumb {
    width: 16px !important;
    height: 16px !important;
    border-radius: 50% !important;
    background: ${c.energy} !important;
    border: none !important;
    cursor: pointer !important;
}

.autodj-energy-val {
    font-size: 12px !important;
    font-weight: 600 !important;
    color: ${c.energy} !important;
    min-width: 32px !important;
    text-align: right !important;
    font-variant-numeric: tabular-nums !important;
}

/* ─── Inline Toggle Row ─── */
.autodj-inline-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
}

.autodj-inline-label {
    font-size: 13px !important;
    font-weight: 500 !important;
    color: ${c.text} !important;
}

.autodj-select {
    padding: 5px 10px !important;
    border-radius: 6px !important;
    border: 1px solid ${c.border} !important;
    background: ${c.bg} !important;
    color: ${c.text} !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    outline: none !important;
}

.autodj-select:focus {
    border-color: ${c.accent} !important;
}

/* ─── Divider ─── */
.autodj-divider {
    height: 1px !important;
    background: ${c.border} !important;
    margin: 2px 0 !important;
}

/* ─── Track Preview ─── */
.autodj-preview {
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    max-height: 140px !important;
    overflow-y: auto !important;
}

.autodj-preview-empty {
    font-size: 12px !important;
    color: ${c.subtext} !important;
    font-style: italic !important;
    padding: 4px 0 !important;
}

.autodj-preview-track {
    display: flex !important;
    align-items: center !important;
    padding: 6px 10px !important;
    background: ${c.bg} !important;
    border-radius: 6px !important;
    gap: 8px !important;
    font-size: 12px !important;
}

.autodj-preview-art {
    width: 32px !important;
    height: 32px !important;
    border-radius: 4px !important;
    object-fit: cover !important;
    flex-shrink: 0 !important;
}

.autodj-preview-name {
    flex: 1 !important;
    color: ${c.text} !important;
    font-weight: 500 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
}

.autodj-preview-bpm {
    color: ${c.subtext} !important;
    font-variant-numeric: tabular-nums !important;
    font-size: 11px !important;
}

.autodj-preview-key {
    color: ${c.accent} !important;
    font-weight: 600 !important;
    font-size: 11px !important;
    min-width: 20px !important;
    text-align: right !important;
}

/* ─── Loading Indicator ─── */
.autodj-loading {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    padding: 12px 0 !important;
    font-size: 12px !important;
    color: ${c.subtext} !important;
}

.autodj-spinner {
    width: 14px !important;
    height: 14px !important;
    border: 2px solid ${c.border} !important;
    border-top-color: ${c.accent} !important;
    border-radius: 50% !important;
    animation: autodj-spin 0.6s linear infinite !important;
}

@keyframes autodj-spin {
    to { transform: rotate(360deg); }
}

/* ─── Modal Footer ─── */
.autodj-footer {
    display: flex !important;
    justify-content: flex-end !important;
    padding: 12px 20px !important;
    border-top: 1px solid ${c.border} !important;
}

.autodj-close-btn {
    padding: 7px 18px !important;
    border-radius: 20px !important;
    border: 1px solid ${c.border} !important;
    background: transparent !important;
    color: ${c.text} !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    transition: background 0.12s ease !important;
}

.autodj-close-btn:hover {
    background: ${c.bg} !important;
}

/* ─── Focus / A11y ─── */
.autodj-modal *:focus-visible {
    outline: 2px solid ${c.accent} !important;
    outline-offset: 2px !important;
}

@media (forced-colors: active) {
    .autodj-modal { border: 2px solid CanvasText !important; }
    .autodj-switch { forced-color-adjust: none !important; }
}

@media (prefers-reduced-motion: reduce) {
    .autodj-overlay, .autodj-modal { animation: none !important; }
}
`;
        document.head.appendChild(style);
    }

    // ── Config & State ──────────────────────────────────────────

    const CONFIG = {
        enabled: false,
        mood: 'mix',
        energy: 0.5,
        keyMatch: true,
        bpmRange: 10,
        source: 'hybrid',
        threshold: 2,
        maxQueueAdd: 5,
    };

    const STATE = {
        isRunning: false,
        lastTrackUri: null,
        analyzedTracks: new Map(),
        candidates: [],
        monitorInitialized: false,
    };

    const MAX_CACHE_SIZE = 200;

    function evictCache() {
        if (STATE.analyzedTracks.size > MAX_CACHE_SIZE) {
            const n = Math.floor(MAX_CACHE_SIZE * 0.2);
            let i = 0;
            for (const k of STATE.analyzedTracks.keys()) {
                if (i >= n) break;
                STATE.analyzedTracks.delete(k);
                i++;
            }
        }
    }

    function debounce(fn, ms) {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    }

    // ── Mood Presets ────────────────────────────────────────────

    const MOODS = {
        chill:    { energy: [0.2, 0.4], danceability: [0.3, 0.5], valence: [0.3, 0.6] },
        focus:    { energy: [0.3, 0.5], instrumentalness: [0.5, 1.0], valence: [0.3, 0.6] },
        party:    { energy: [0.7, 1.0], danceability: [0.7, 1.0], valence: [0.6, 1.0] },
        workout:  { energy: [0.8, 1.0], tempo: [120, 160], danceability: [0.5, 1.0] },
        sleep:    { energy: [0.0, 0.2], acousticness: [0.5, 1.0], valence: [0.1, 0.4] },
        mix:      { energy: [0.3, 0.7], danceability: [0.4, 0.8], valence: [0.4, 0.7] },
    };

    // ── Camelot Wheel ───────────────────────────────────────────

    const CAMELOT = {
        '0,0': '5A',  '0,1': '8B',
        '1,0': '12A', '1,1': '3B',
        '2,0': '7A',  '2,1': '10B',
        '3,0': '2A',  '3,1': '5B',
        '4,0': '9A',  '4,1': '12B',
        '5,0': '4A',  '5,1': '7B',
        '6,0': '11A', '6,1': '2B',
        '7,0': '6A',  '7,1': '9B',
        '8,0': '1A',  '8,1': '4B',
        '9,0': '8A',  '9,1': '11B',
        '10,0': '3A', '10,1': '6B',
        '11,0': '10A','11,1': '1B',
    };

    function getCamelot(key, mode) { return CAMELOT[`${key},${mode}`] || null; }

    // Fix 2: Camelot letter-suffix bug
    function camelotCompat(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        const letterA = a.slice(-1);
        const letterB = b.slice(-1);
        const na = parseInt(a);
        const nb = parseInt(b);
        if (na === nb) return letterA === letterB;
        if (Math.abs(na - nb) === 1 || Math.abs(na - nb) === 11) {
            return letterA === letterB;
        }
        return false;
    }

    // ── Audio Analysis ──────────────────────────────────────────

    // Fix 3: Try spclient first, fall back to getAudioData
    async function getAudioFeatures(uri) {
        if (STATE.analyzedTracks.has(uri)) return STATE.analyzedTracks.get(uri);

        // Try spclient endpoint first (more reliable)
        try {
            const id = uri.split(':').pop();
            const r = await CosmosAsync.get(`https://spclient.wg.spotify.com/audio-attributes/v1/audio-features/${id}?format=json`);
            if (r) {
                const f = {
                    tempo: r.tempo || 0, key: r.key || -1, mode: r.mode || 0,
                    energy: r.energy || 0.5, danceability: r.danceability || 0.5,
                    valence: r.valence || 0.5, acousticness: r.acousticness || 0.5,
                    instrumentalness: r.instrumentalness || 0, speechiness: r.speechiness || 0,
                    liveness: r.liveness || 0, loudness: r.loudness || -10,
                };
                f.camelot = getCamelot(f.key, f.mode);
                STATE.analyzedTracks.set(uri, f);
                return f;
            }
        } catch (e) { console.warn('[Auto-DJ]', e); }

        // Fallback to getAudioData (deprecated but may still work)
        try {
            const d = await Spicetify.getAudioData(uri);
            if (d?.track) {
                const f = {
                    tempo: d.track.tempo || 0, key: d.track.key || -1, mode: d.track.mode || 0,
                    energy: d.track.energy || 0.5, danceability: d.track.danceability || 0.5,
                    valence: d.track.valence || 0.5, acousticness: d.track.acousticness || 0.5,
                    instrumentalness: d.track.instrumentalness || 0, speechiness: d.track.speechiness || 0,
                    liveness: d.track.liveness || 0, loudness: d.track.loudness || -10,
                };
                f.camelot = getCamelot(f.key, f.mode);
                STATE.analyzedTracks.set(uri, f);
                return f;
            }
        } catch (e) { console.warn('[Auto-DJ]', e); }

        return null;
    }

    async function getBulkAudioFeatures(uris) {
        const results = new Map();
        const toFetch = uris.filter(u => !STATE.analyzedTracks.has(u));
        for (const u of uris) {
            if (STATE.analyzedTracks.has(u)) results.set(u, STATE.analyzedTracks.get(u));
        }
        const BATCH = 50;
        for (let i = 0; i < toFetch.length; i += BATCH) {
            const batch = toFetch.slice(i, i + BATCH);
            const ids = batch.map(u => u.split(':').pop()).join(',');
            try {
                const r = await CosmosAsync.get(`https://spclient.wg.spotify.com/audio-attributes/v1/audio-features?ids=${ids}`);
                if (r?.audio_features) {
                    for (let j = 0; j < batch.length; j++) {
                        const f = r.audio_features[j];
                        if (f) {
                            const parsed = {
                                tempo: f.tempo || 0, key: f.key || -1, mode: f.mode || 0,
                                energy: f.energy || 0.5, danceability: f.danceability || 0.5,
                                valence: f.valence || 0.5, acousticness: f.acousticness || 0.5,
                                instrumentalness: f.instrumentalness || 0, speechiness: f.speechiness || 0,
                                liveness: f.liveness || 0, loudness: f.loudness || -10,
                            };
                            parsed.camelot = getCamelot(parsed.key, parsed.mode);
                            STATE.analyzedTracks.set(batch[j], parsed);
                            results.set(batch[j], parsed);
                        }
                    }
                }
            } catch (e) { console.warn('[Auto-DJ]', e); }
        }
        evictCache();
        return results;
    }

    // ── Track Scoring ───────────────────────────────────────────

    function scoreTrack(candidate, currentFeatures, mood) {
        let score = 0;
        const moodCfg = MOODS[mood] || MOODS.mix;

        if (currentFeatures?.tempo && candidate.tempo) {
            const diff = Math.abs(candidate.tempo - currentFeatures.tempo);
            score += Math.max(0, 1 - (diff / CONFIG.bpmRange)) * 0.3;
        }

        if (CONFIG.keyMatch && currentFeatures?.camelot && candidate.camelot) {
            score += (camelotCompat(currentFeatures.camelot, candidate.camelot) ? 1 : 0.3) * 0.3;
        }

        const [minE, maxE] = moodCfg.energy;
        const tgt = CONFIG.energy;
        const eMin = Math.max(minE, tgt - 0.15);
        const eMax = Math.min(maxE, tgt + 0.15);
        if (candidate.energy >= eMin && candidate.energy <= eMax) {
            score += 0.25;
        } else {
            const dist = candidate.energy < eMin ? eMin - candidate.energy : candidate.energy - eMax;
            score += Math.max(0, 0.25 - dist * 0.5);
        }

        let moodMatches = 0, moodChecks = 0;
        for (const [feat, range] of Object.entries(moodCfg)) {
            if (feat === 'tempo') continue;
            if (candidate[feat] !== undefined) {
                moodChecks++;
                if (candidate[feat] >= range[0] && candidate[feat] <= range[1]) moodMatches++;
            }
        }
        if (moodChecks > 0) score += (moodMatches / moodChecks) * 0.15;

        return score;
    }

    // ── Queue Management ────────────────────────────────────────

    function getQueueLength() {
        try { return Player?.Queue?.nextTracks?.length || 0; } catch { return 0; }
    }

    function getCurrentTrack() {
        const d = Player.data;
        if (!d?.item) return null;
        return { uri: d.item.uri, name: d.item.name, artist: d.item.metadata?.artist_name };
    }

    // Fix 10: Queue deduplication
    async function addTracksToQueue(tracks) {
        const existingUris = new Set();
        try {
            const nextTracks = Player?.Queue?.nextTracks || [];
            nextTracks.forEach(t => existingUris.add(t.uri));
        } catch { /* skip */ }

        for (const t of tracks) {
            if (existingUris.has(t.uri)) continue;
            try { await Spicetify.addToQueue([{ uri: t.uri }]); } catch (e) { console.warn('[Auto-DJ]', e); }
        }
    }

    // ── Track Sources ───────────────────────────────────────────

    // Fix 6: Library cache with TTL
    let libraryCache = null;
    let libraryCacheTime = 0;
    const LIBRARY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    async function getLibraryTracks() {
        if (libraryCache && Date.now() - libraryCacheTime < LIBRARY_CACHE_TTL) {
            return libraryCache;
        }
        try {
            const r = await CosmosAsync.get("sp://core-collection/unstable/@/list/tracks/all?responseFormat=protobufJson");
            const tracks = r?.item?.filter(t => t.trackMetadata?.playable).map(t => ({
                uri: t.trackMetadata.link, name: t.trackMetadata.title, artist: t.trackMetadata.artistName,
            })) || [];
            libraryCache = tracks;
            libraryCacheTime = Date.now();
            return tracks;
        } catch (e) { console.warn('[Auto-DJ]', e); return []; }
    }

    async function getRecommendations(seedUri) {
        try {
            const id = seedUri.split(':').pop();
            const r = await CosmosAsync.get(`https://api.spotify.com/v1/recommendations?seed_tracks=${id}&limit=20`);
            return r?.tracks || [];
        } catch (e) { console.warn('[Auto-DJ]', e); return []; }
    }

    async function getCandidateTracks(currentUri) {
        let candidates = [];
        if (CONFIG.source === 'library' || CONFIG.source === 'hybrid') {
            candidates = [...candidates, ...await getLibraryTracks()];
        }
        if (CONFIG.source === 'recommendations' || CONFIG.source === 'hybrid') {
            candidates = [...candidates, ...await getRecommendations(currentUri)];
        }
        const seen = new Set([currentUri]);
        return candidates.filter(t => {
            if (!t.uri || seen.has(t.uri)) return false;
            seen.add(t.uri);
            return true;
        });
    }

    // ── Smart Sequencer ─────────────────────────────────────────

    // Fix 9: Loading state - external setter
    let setLoadingState = null;

    async function selectAndQueueTracks() {
        if (STATE.isRunning) return;
        STATE.isRunning = true;
        if (setLoadingState) setLoadingState(true);

        try {
            const current = getCurrentTrack();
            if (!current) return;

            const currentFeatures = await getAudioFeatures(current.uri);
            const candidates = await getCandidateTracks(current.uri);
            if (candidates.length === 0) return;

            const candidateUris = candidates.slice(0, 50).map(c => c.uri);
            await getBulkAudioFeatures(candidateUris);

            const scored = [];
            for (const c of candidates.slice(0, 50)) {
                const f = STATE.analyzedTracks.get(c.uri);
                if (f) scored.push({ ...c, features: f, score: scoreTrack(f, currentFeatures, CONFIG.mood) });
            }

            scored.sort((a, b) => b.score - a.score);
            const selected = scored.slice(0, CONFIG.maxQueueAdd);

            if (selected.length > 0) {
                await addTracksToQueue(selected);
                updatePreviewTracks(selected);
                showNotification(`Auto-DJ: added ${selected.length} track${selected.length > 1 ? 's' : ''}`);
            }
        } catch (e) {
            console.error('Auto-DJ:', e);
            showNotification('Auto-DJ error — check console');
        } finally {
            STATE.isRunning = false;
            if (setLoadingState) setLoadingState(false);
        }
    }

    // ── Queue Monitor ───────────────────────────────────────────

    function initQueueMonitor() {
        if (STATE.monitorInitialized) return;
        STATE.monitorInitialized = true;

        Player.addEventListener('songchange', async () => {
            if (!CONFIG.enabled) return;
            const cur = getCurrentTrack();
            if (!cur || cur.uri === STATE.lastTrackUri) return;
            STATE.lastTrackUri = cur.uri;

            if (getQueueLength() <= CONFIG.threshold) {
                await selectAndQueueTracks();
            }
        });
    }

    // ── Settings Persistence ────────────────────────────────────

    function loadSettings() {
        try {
            const s = LocalStorage.get('autodj:settings');
            if (s) Object.assign(CONFIG, JSON.parse(s));
        } catch { /* skip */ }
    }

    function saveSettings() {
        try { LocalStorage.set('autodj:settings', JSON.stringify(CONFIG)); } catch { /* skip */ }
    }

    // ── React Modal Content ─────────────────────────────────────

    function ModalContent() {
        const [enabled, setEnabled] = useState(CONFIG.enabled);
        const [mood, setMood] = useState(CONFIG.mood);
        const [energy, setEnergy] = useState(CONFIG.energy);
        const [keyMatch, setKeyMatch] = useState(CONFIG.keyMatch);
        const [bpmRange, setBpmRange] = useState(CONFIG.bpmRange);
        const [source, setSource] = useState(CONFIG.source);
        const [previewTracks, setPreviewTracks] = useState([]);
        const [isLoading, setIsLoading] = useState(false);
        const energyRef = useRef(energy);

        useEffect(() => {
            energyRef.current = energy;
        }, [energy]);

        // Fix 9: Connect loading state
        useEffect(() => {
            setLoadingState = setIsLoading;
            return () => { setLoadingState = null; };
        }, []);

        // Fix 12: Move global assignment to useEffect
        useEffect(() => {
            window.__autodjUpdatePreview = setPreviewTracks;
            return () => { delete window.__autodjUpdatePreview; };
        }, []);

        // Fix 7: Escape key handler
        useEffect(() => {
            const handler = (e) => { if (e.key === 'Escape') PopupModal.hide(); };
            document.addEventListener('keydown', handler);
            return () => document.removeEventListener('keydown', handler);
        }, []);

        // Fix 8: Focus trapping
        useEffect(() => {
            const modal = document.querySelector('.autodj-modal');
            if (!modal) return;
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            function trap(e) {
                if (e.key !== 'Tab') return;
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
            document.addEventListener('keydown', trap);
            first.focus();
            return () => document.removeEventListener('keydown', trap);
        }, []);

        const updatePreviewTracks = useCallback((tracks) => {
            setPreviewTracks(tracks.slice(0, 5));
        }, []);

        const handleToggle = () => {
            const next = !enabled;
            setEnabled(next);
            CONFIG.enabled = next;
            saveSettings();
            showNotification(next ? 'Auto-DJ enabled' : 'Auto-DJ disabled');
        };

        const handleMood = (m) => {
            setMood(m);
            CONFIG.mood = m;
            saveSettings();
        };

        const handleEnergy = (e) => {
            const val = parseInt(e.target.value) / 100;
            setEnergy(val);
            CONFIG.energy = val;
        };

        const debouncedEnergySave = useCallback(debounce(() => saveSettings(), 200), []);

        const handleEnergyChange = (e) => {
            handleEnergy(e);
            debouncedEnergySave();
        };

        const handleKeyMatch = () => {
            const next = !keyMatch;
            setKeyMatch(next);
            CONFIG.keyMatch = next;
            saveSettings();
        };

        const handleBpmRange = (e) => {
            const val = parseInt(e.target.value);
            setBpmRange(val);
            CONFIG.bpmRange = val;
            saveSettings();
        };

        const handleSource = (e) => {
            const val = e.target.value;
            setSource(val);
            CONFIG.source = val;
            saveSettings();
        };

        const handleClose = () => {
            PopupModal.hide();
        };

        const moodList = ['chill', 'focus', 'party', 'workout', 'sleep', 'mix'];

        return h('div', { className: 'autodj-overlay', onClick: (e) => { if (e.target === e.currentTarget) handleClose(); } },
            h('div', { className: 'autodj-modal', onClick: (e) => e.stopPropagation() },

                // Header
                h('div', { className: 'autodj-header' },
                    h('span', { className: 'autodj-header-icon',
                        dangerouslySetInnerHTML: { __html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>` }
                    }),
                    h('span', { className: 'autodj-header-title' }, 'Auto-DJ'),
                    h('span', { className: `autodj-header-status ${enabled ? 'on' : 'off'}` },
                        h('span', { className: 'autodj-status-dot' }),
                        enabled ? 'Active' : 'Off'
                    )
                ),

                // Body
                h('div', { className: 'autodj-body' },

                    // Enable toggle
                    h('div', { className: 'autodj-enable-row' },
                        h('span', { className: 'autodj-enable-label' }, 'Enable Auto-DJ'),
                        h('button', {
                            className: `autodj-switch ${enabled ? 'on' : 'off'}`,
                            onClick: handleToggle,
                            role: 'switch',
                            'aria-checked': enabled,
                        },
                            h('span', { className: 'autodj-switch-knob' })
                        )
                    ),

                    // Mood
                    h('div', null,
                        h('div', { className: 'autodj-section-label' }, 'Mood'),
                        h('div', { className: 'autodj-mood-grid' },
                            ...moodList.map(m =>
                                h('button', {
                                    key: m,
                                    className: `autodj-mood-btn ${mood === m ? 'active' : ''}`,
                                    onClick: () => handleMood(m),
                                }, m.charAt(0).toUpperCase() + m.slice(1))
                            )
                        )
                    ),

                    // Energy
                    h('div', null,
                        h('div', { className: 'autodj-section-label' }, 'Energy'),
                        h('div', { className: 'autodj-energy-row' },
                            h('input', {
                                type: 'range', min: '0', max: '100',
                                value: Math.round(energy * 100),
                                className: 'autodj-energy-slider',
                                onChange: handleEnergyChange,
                                'aria-label': 'Energy level',
                            }),
                            h('span', { className: 'autodj-energy-val' }, `${Math.round(energy * 100)}%`)
                        )
                    ),

                    h('div', { className: 'autodj-divider' }),

                    // Key Match
                    h('div', { className: 'autodj-inline-row' },
                        h('span', { className: 'autodj-inline-label' }, 'Key Match'),
                        h('button', {
                            className: `autodj-switch ${keyMatch ? 'on' : 'off'}`,
                            onClick: handleKeyMatch,
                            role: 'switch',
                            'aria-checked': keyMatch,
                        },
                            h('span', { className: 'autodj-switch-knob' })
                        )
                    ),

                    // BPM Range
                    h('div', { className: 'autodj-inline-row' },
                        h('span', { className: 'autodj-inline-label' }, 'BPM Range (\u00b1)'),
                        h('select', {
                            className: 'autodj-select',
                            value: bpmRange,
                            onChange: handleBpmRange,
                            'aria-label': 'BPM tolerance',
                        },
                            h('option', { value: 5 }, '5'),
                            h('option', { value: 10 }, '10'),
                            h('option', { value: 15 }, '15'),
                            h('option', { value: 20 }, '20')
                        )
                    ),

                    // Source
                    h('div', { className: 'autodj-inline-row' },
                        h('span', { className: 'autodj-inline-label' }, 'Source'),
                        h('select', {
                            className: 'autodj-select',
                            value: source,
                            onChange: handleSource,
                            'aria-label': 'Track source',
                        },
                            h('option', { value: 'hybrid' }, 'Hybrid'),
                            h('option', { value: 'library' }, 'Library'),
                            h('option', { value: 'recommendations' }, 'Recommendations')
                        )
                    ),

                    h('div', { className: 'autodj-divider' }),

                    // Preview
                    h('div', null,
                        h('div', { className: 'autodj-section-label' }, 'Up Next'),
                        h('div', { className: 'autodj-preview' },
                            // Fix 9: Loading state
                            isLoading
                                ? h('div', { className: 'autodj-loading' },
                                    h('div', { className: 'autodj-spinner' }),
                                    'Loading tracks...'
                                )
                                // Fix 1: Remove spread operator, use array directly
                                : previewTracks.length === 0
                                    ? h('div', { className: 'autodj-preview-empty' }, 'Enable Auto-DJ to see upcoming tracks')
                                    : previewTracks.map((t, i) =>
                                        h('div', { className: 'autodj-preview-track', key: i },
                                            // Fix 11: Album art thumbnail
                                            h('img', {
                                                className: 'autodj-preview-art',
                                                src: t.albumArt || '',
                                                alt: '',
                                                onError: (e) => { e.target.style.display = 'none'; }
                                            }),
                                            h('span', { className: 'autodj-preview-name' }, t.name || 'Unknown'),
                                            h('span', { className: 'autodj-preview-bpm' }, Math.round(t.features?.tempo || 0) + ' BPM'),
                                            h('span', { className: 'autodj-preview-key' }, t.features?.camelot || '--')
                                        )
                                    )
                        )
                    )
                ),

                // Footer
                h('div', { className: 'autodj-footer' },
                    h('button', { className: 'autodj-close-btn', onClick: handleClose }, 'Close')
                )
            )
        );
    }

    // ── Preview Update Hook (global) ────────────────────────────

    function updatePreviewTracks(tracks) {
        if (window.__autodjUpdatePreview) {
            window.__autodjUpdatePreview(tracks);
        }
    }

    // ── Topbar Button (Manual DOM Injection) ─────────────────────

    function openModal() {
        injectStyles();
        PopupModal.display({
            title: '',
            content: h(ModalContent),
            isLarge: false,
        });
    }

    function createTopbarButton() {
        // Try Spicetify.Topbar.Button first
        if (typeof Topbar !== 'undefined' && Topbar.Button) {
            try {
                // Fix 5: Use CONFIG.enabled for isActive
                new Topbar.Button(
                    'Auto-DJ',
                    `<svg role="img" height="16" width="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>`,
                    () => openModal(),
                    false,
                    CONFIG.enabled
                );
                console.log('[Auto-DJ] Topbar.Button created');
                return;
            } catch (e) {
                console.warn('[Auto-DJ] Topbar.Button failed, using manual injection', e);
            }
        }

        // Fallback: manual DOM injection
        let retries = 0;
        const MAX_RETRIES = 150;

        const waitForBar = () => {
            if (retries >= MAX_RETRIES) {
                console.warn('[Auto-DJ] Could not find top bar after', MAX_RETRIES, 'retries');
                return;
            }
            retries++;

            // Try multiple selectors for the top bar right side
            const rightContainer =
                document.querySelector('.main-topBar-topbarContentRight') ||
                document.querySelector('.main-actionButtons') ||
                document.querySelector('.main-topBar-right') ||
                document.querySelector('[data-testid="topbar-background"]') ||
                document.querySelector('.Root__globalNav');

            if (!rightContainer) {
                requestAnimationFrame(waitForBar);
                return;
            }

            // Prevent duplicate buttons
            if (document.getElementById('autodj-topbar-btn')) return;

            // Find an existing button to copy its class from
            const existingBtn = rightContainer.querySelector('button');

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;align-items:center;';

            // Create button
            const btn = document.createElement('button');
            btn.id = 'autodj-topbar-btn';
            btn.setAttribute('aria-label', 'Auto-DJ');
            btn.setAttribute('title', 'Auto-DJ');
            btn.setAttribute('data-testid', 'autodj-button');

            if (existingBtn) {
                btn.className = existingBtn.className;
            } else {
                btn.className = 'control-button';
            }

            btn.innerHTML = `<svg role="img" height="16" width="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>`;

            btn.addEventListener('click', openModal);

            wrapper.appendChild(btn);
            rightContainer.prepend(wrapper);

            console.log('[Auto-DJ] Button injected into top bar');
        };

        waitForBar();
    }

    // ── Init ────────────────────────────────────────────────────

    loadSettings();
    initQueueMonitor();
    createTopbarButton();

    console.log('[Auto-DJ] Loaded');
})();
