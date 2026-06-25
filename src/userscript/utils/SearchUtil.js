class SearchUtil {
    constructor() {
        this.entries = [];
        this.entriesByPath = new Map();
        this.entriesByKey = new Map();
        this.functionEntriesBySignature = new Map();
        this.visited = new WeakSet();
    }

    static get RESERVED_WORDS() {
        return new Set([
            'arguments',
            'async',
            'await',
            'break',
            'case',
            'catch',
            'class',
            'const',
            'continue',
            'debugger',
            'default',
            'delete',
            'do',
            'else',
            'enum',
            'export',
            'extends',
            'false',
            'finally',
            'for',
            'function',
            'if',
            'implements',
            'import',
            'in',
            'instanceof',
            'interface',
            'let',
            'new',
            'null',
            'package',
            'private',
            'protected',
            'public',
            'return',
            'static',
            'super',
            'switch',
            'this',
            'throw',
            'true',
            'try',
            'typeof',
            'undefined',
            'var',
            'void',
            'while',
            'with',
            'yield',
        ]);
    }

    stripComments(source) {
        if (!source) {
            return '';
        }

        let result = '';
        let index = 0;
        let state = 'code';

        while (index < source.length) {
            const char = source[index];
            const next = source[index + 1];

            if (state === 'line-comment') {
                if (char === '\n') {
                    state = 'code';
                    result += char;
                }
                index += 1;
                continue;
            }

            if (state === 'block-comment') {
                if (char === '*' && next === '/') {
                    state = 'code';
                    index += 2;
                    continue;
                }
                index += 1;
                continue;
            }

            if (state === 'single-quote' || state === 'double-quote') {
                result += char;
                if (char === '\\') {
                    result += next || '';
                    index += 2;
                    continue;
                }
                if (
                    (state === 'single-quote' && char === '\'')
                    || (state === 'double-quote' && char === '"')
                ) {
                    state = 'code';
                }
                index += 1;
                continue;
            }

            if (state === 'template') {
                result += char;
                if (char === '\\') {
                    result += next || '';
                    index += 2;
                    continue;
                }
                if (char === '`') {
                    state = 'code';
                }
                index += 1;
                continue;
            }

            if (char === '/' && next === '/') {
                state = 'line-comment';
                index += 2;
                continue;
            }

            if (char === '/' && next === '*') {
                state = 'block-comment';
                index += 2;
                continue;
            }

            if (char === '\'') {
                state = 'single-quote';
                result += char;
                index += 1;
                continue;
            }

            if (char === '"') {
                state = 'double-quote';
                result += char;
                index += 1;
                continue;
            }

            if (char === '`') {
                state = 'template';
                result += char;
                index += 1;
                continue;
            }

            result += char;
            index += 1;
        }

        return result;
    }

    normalizeWhitespace(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    normalizeFunctionSource(fn) {
        const source = typeof fn === 'function' ? fn.toString() : String(fn || '');
        return this.normalizeWhitespace(this.stripComments(source));
    }

    isIdentifierStart(char) {
        return /[A-Za-z_$]/.test(char);
    }

    isIdentifierChar(char) {
        return /[A-Za-z0-9_$]/.test(char);
    }

    getPreviousSignificantChar(source, startIndex) {
        for (let index = startIndex - 1; index >= 0; index -= 1) {
            const char = source[index];
            if (!/\s/.test(char)) {
                return char;
            }
        }
        return '';
    }

    getNextSignificantChar(source, startIndex) {
        for (let index = startIndex; index < source.length; index += 1) {
            const char = source[index];
            if (!/\s/.test(char)) {
                return char;
            }
        }
        return '';
    }

    extractStringLiterals(source) {
        const literals = new Set();
        const pattern = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;
        let match;

        while ((match = pattern.exec(source))) {
            literals.add(match[0]);
        }

        return Array.from(literals).sort();
    }

    extractMemberAccesses(source) {
        const members = new Set();
        const pattern = /\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
        let match;

        while ((match = pattern.exec(source))) {
            members.add(match[1]);
        }

        return Array.from(members).sort();
    }

    getFunctionSignature(fn) {
        try {
            const source = this.normalizeFunctionSource(fn);
            let signature = '';
            let index = 0;

            while (index < source.length) {
                const char = source[index];

                if (!this.isIdentifierStart(char)) {
                    signature += char;
                    index += 1;
                    continue;
                }

                let end = index + 1;
                while (end < source.length && this.isIdentifierChar(source[end])) {
                    end += 1;
                }

                const token = source.slice(index, end);
                const previous = this.getPreviousSignificantChar(source, index);
                const next = this.getNextSignificantChar(source, end);
                const shouldPreserve = SearchUtil.RESERVED_WORDS.has(token) || previous === '.';

                if (shouldPreserve) {
                    signature += token;
                } else if (next === ':') {
                    signature += 'key';
                } else {
                    signature += 'id';
                }

                index = end;
            }

            return this.normalizeWhitespace([
                fn.constructor && fn.constructor.name ? fn.constructor.name : 'Function',
                `arity:${typeof fn.length === 'number' ? fn.length : 0}`,
                signature,
            ].join(' '));
        } catch (error) {
            return null;
        }
    }

    async getLogicHash(fn) {
        return this.getFunctionSignature(fn);
    }

    getValueType(value) {
        if (value === null) {
            return 'null';
        }

        if (Array.isArray(value)) {
            return 'array';
        }

        return typeof value;
    }

    createPath(parentPath, key) {
        const stringKey = String(key);
        if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(stringKey)) {
            return parentPath ? `${parentPath}.${stringKey}` : stringKey;
        }
        return `${parentPath || 'root'}[${JSON.stringify(stringKey)}]`;
    }

    appendToIndex(map, key, value) {
        if (!key) {
            return;
        }

        const items = map.get(key);
        if (items) {
            items.push(value);
            return;
        }

        map.set(key, [value]);
    }

    describeValue(value) {
        const type = this.getValueType(value);
        const description = { type };

        if (type === 'function') {
            const source = this.normalizeFunctionSource(value);
            description.arity = value.length;
            description.name = value.name || '';
            description.signature = this.getFunctionSignature(value);
            description.sourceLength = source.length;
            description.strings = this.extractStringLiterals(source);
            description.members = this.extractMemberAccesses(source);
        } else if (type === 'object' || type === 'array') {
            try {
                description.ownKeys = Object.getOwnPropertyNames(value).sort();
            } catch (error) {
                description.ownKeys = [];
            }
        } else {
            description.value = value;
        }

        return description;
    }

    registerEntry(owner, key, value, path) {
        if (this.entriesByPath.has(path)) {
            return this.entriesByPath.get(path);
        }

        const entry = {
            owner,
            key,
            path,
            value,
            ...this.describeValue(value),
        };

        this.entries.push(entry);
        this.entriesByPath.set(path, entry);
        this.appendToIndex(this.entriesByKey, String(key), entry);

        if (entry.type === 'function' && entry.signature) {
            this.appendToIndex(this.functionEntriesBySignature, entry.signature, entry);
        }

        return entry;
    }

    async cacheScope(scope, depth = 0, maxDepth = 3, path = 'window') {
        if (!scope || (typeof scope !== 'object' && typeof scope !== 'function')) {
            return;
        }

        if (this.visited.has(scope) || depth > maxDepth) {
            return;
        }

        this.visited.add(scope);

        let descriptors = null;
        try {
            descriptors = Object.getOwnPropertyDescriptors(scope);
        } catch (error) {
            return;
        }

        const keys = Object.keys(descriptors);
        for (const key of keys) {
            const descriptor = descriptors[key];
            if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
                continue;
            }

            const item = descriptor.value;

            const itemPath = this.createPath(path, key);
            try {
                this.registerEntry(scope, key, item, itemPath);
            } catch (error) {
                continue;
            }

            if (item && (typeof item === 'object' || typeof item === 'function')) {
                try {
                    await this.cacheScope(item, depth + 1, maxDepth, itemPath);
                } catch (error) {
                    continue;
                }
            }
        }
    }

    findEntries(criteria = {}) {
        return this.entries.filter((entry) => {
            if (criteria.type && entry.type !== criteria.type) {
                return false;
            }

            if (criteria.key && entry.key !== criteria.key) {
                return false;
            }

            if (criteria.path && entry.path !== criteria.path) {
                return false;
            }

            if (criteria.pathIncludes && !entry.path.includes(criteria.pathIncludes)) {
                return false;
            }

            if (criteria.signature && entry.signature !== criteria.signature) {
                return false;
            }

            if (criteria.arity !== undefined && entry.arity !== criteria.arity) {
                return false;
            }

            if (criteria.members && criteria.members.some((member) => !entry.members || !entry.members.includes(member))) {
                return false;
            }

            if (criteria.strings && criteria.strings.some((stringLiteral) => !entry.strings || !entry.strings.includes(stringLiteral))) {
                return false;
            }

            if (criteria.ownKeys && criteria.ownKeys.some((ownKey) => !entry.ownKeys || !entry.ownKeys.includes(ownKey))) {
                return false;
            }

            if (typeof criteria.predicate === 'function' && !criteria.predicate(entry)) {
                return false;
            }

            return true;
        });
    }

    findFunctions(criteria = {}) {
        return this.findEntries({ ...criteria, type: 'function' });
    }

    getFunctionsBySignature(signature) {
        const entries = this.functionEntriesBySignature.get(signature) || [];
        return entries.map((entry) => entry.value);
    }

    getEntriesBySignature(signature) {
        return (this.functionEntriesBySignature.get(signature) || []).slice();
    }

    getEntriesByKey(key) {
        return (this.entriesByKey.get(String(key)) || []).slice();
    }

    getEntryByPath(path) {
        return this.entriesByPath.get(path) || null;
    }

    getFunctionByHash(signature) {
        return this.getFunctionsBySignature(signature)[0] || null;
    }

    getEntryByHash(signature) {
        const entries = this.functionEntriesBySignature.get(signature) || [];
        return entries[0] || null;
    }

    async primeWindow(win, options = {}) {
        const root = win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 3;
        await this.cacheScope(root, 0, maxDepth, 'window');
        return this;
    }
}
