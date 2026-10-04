// ========== 多供应商管理（参考 AI-Marker-Suite ProviderManager） ==========
// 默认 5+1 API，模型 courseflow

const ProviderManager = {
    KEY: 'kezhou-providers',
    data: null,

    _defaults() {
        return {
            active: '5+1API',
            providers: {
                '5+1API': {
                    endpoint: 'https://api.ai.five-plus-one.com/v1/chat/completions',
                    apiKey: '',
                    models: {
                        'courseflow': { label: '课舟答题（推荐）', tags: ['推荐'], isBuiltin: true },
                        'mimo-v2.6-pro': { label: 'mimo-v2.6-pro', tags: [], isBuiltin: true },
                    },
                    activeModel: 'courseflow',
                    isBuiltin: true,
                    endpointLocked: true,
                },
                '自定义': {
                    endpoint: '',
                    apiKey: '',
                    models: { 'custom': { label: '自定义模型', tags: [] } },
                    activeModel: 'custom',
                    isBuiltin: true,
                },
            },
        };
    },

    init() {
        try {
            const saved = GM_getValue(this.KEY);
            if (saved) {
                this.data = JSON.parse(saved);
                // 合并默认（保证内置供应商存在）
                const d = this._defaults();
                for (const [name, p] of Object.entries(d.providers)) {
                    if (!this.data.providers[name]) this.data.providers[name] = p;
                    else if (p.models) {
                        for (const [mid, m] of Object.entries(p.models)) {
                            if (!this.data.providers[name].models[mid]) this.data.providers[name].models[mid] = m;
                        }
                    }
                }
            } else {
                this.data = this._defaults();
                this.save();
            }
        } catch (e) {
            this.data = this._defaults();
        }
        return this.data;
    },

    save() {
        try { GM_setValue(this.KEY, JSON.stringify(this.data)); } catch (e) { }
    },

    get() {
        if (!this.data) this.init();
        return this.data;
    },

    getActive() {
        const d = this.get();
        return d.providers[d.active] || d.providers['5+1API'] || Object.values(d.providers)[0];
    },

    getActiveConfig() {
        const p = this.getActive();
        return {
            endpoint: p.endpoint,
            apiKey: p.apiKey,
            model: p.activeModel || Object.keys(p.models)[0] || 'courseflow',
        };
    },

    setActive(name, modelId) {
        const d = this.get();
        if (d.providers[name]) {
            d.active = name;
            if (modelId) d.providers[name].activeModel = modelId;
            this.save();
        }
    },

    setKey(name, key) {
        const d = this.get();
        if (d.providers[name]) {
            d.providers[name].apiKey = key;
            this.save();
        }
    },

    setEndpoint(name, ep) {
        const d = this.get();
        if (d.providers[name]) {
            d.providers[name].endpoint = ep;
            this.save();
        }
    },
};
