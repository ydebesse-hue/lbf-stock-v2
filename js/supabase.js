// =============================================================
// LBF Stock v2 — Client Supabase REST (sans SDK)
// Vanilla JS, aucune dépendance npm
// =============================================================

class QueryBuilder {
  constructor(client, table) {
    this._c     = client;
    this._table = table;
    this._select = '*';
    this._filters = [];    // [{col, op, val}]
    this._orderCol = null;
    this._orderAsc = true;
    this._limitN   = null;
    this._isSingle = false;
    this._prefer   = 'return=representation';
  }

  // ── Colonnes à retourner ──────────────────────────────────
  select(cols) {
    this._select = cols || '*';
    return this;
  }

  // ── Filtres ───────────────────────────────────────────────
  eq(col, val)   { this._filters.push({ col, op: 'eq',   val }); return this; }
  neq(col, val)  { this._filters.push({ col, op: 'neq',  val }); return this; }
  gt(col, val)   { this._filters.push({ col, op: 'gt',   val }); return this; }
  lt(col, val)   { this._filters.push({ col, op: 'lt',   val }); return this; }
  gte(col, val)  { this._filters.push({ col, op: 'gte',  val }); return this; }
  lte(col, val)  { this._filters.push({ col, op: 'lte',  val }); return this; }
  ilike(col, val){ this._filters.push({ col, op: 'ilike',val }); return this; }

  in(col, vals) {
    this._filters.push({ col, op: 'in', val: `(${vals.join(',')})` });
    return this;
  }

  is(col, val) {
    this._filters.push({ col, op: 'is', val });
    return this;
  }

  // ── Tri, limite ───────────────────────────────────────────
  order(col, asc = true) {
    this._orderCol = col;
    this._orderAsc = asc;
    return this;
  }

  limit(n) {
    this._limitN = n;
    return this;
  }

  // Retourner un seul objet (erreur si 0 ou plusieurs résultats)
  single() {
    this._isSingle = true;
    this._limitN   = 1;
    return this;
  }

  // ── Construction de l'URL ─────────────────────────────────
  _buildParams(includeSelect = true) {
    const p = new URLSearchParams();
    if (includeSelect) p.set('select', this._select);
    for (const { col, op, val } of this._filters) {
      p.set(col, `${op}.${val}`);
    }
    if (this._orderCol) {
      p.set('order', `${this._orderCol}.${this._orderAsc ? 'asc' : 'desc'}`);
    }
    if (this._limitN !== null) p.set('limit', String(this._limitN));
    return p.toString();
  }

  _url(isRead = true) {
    const qs = this._buildParams(isRead);
    return `${this._c.url}/rest/v1/${this._table}?${qs}`;
  }

  _writeUrl() {
    // Pour PATCH/DELETE, on n'inclut pas select dans les filtres
    const p = new URLSearchParams();
    for (const { col, op, val } of this._filters) {
      p.set(col, `${op}.${val}`);
    }
    // Ajouter select pour avoir les données en retour
    p.set('select', this._select);
    return `${this._c.url}/rest/v1/${this._table}?${p.toString()}`;
  }

  // ── Exécution HTTP ────────────────────────────────────────
  async _fetch(method, body) {
    const url = (method === 'GET') ? this._url(true) : this._writeUrl();

    const headers = {
      'Content-Type':  'application/json',
      'apikey':         this._c.key,
      'Authorization': `Bearer ${this._c.key}`,
      'Prefer':         this._prefer,
    };

    if (this._isSingle) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      return { data: null, error: { message: `Réseau : ${err.message}` } };
    }

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const msg = json?.message || json?.hint || `HTTP ${res.status}`;
      return { data: null, error: { message: msg, details: json } };
    }

    return { data: json, error: null };
  }

  // ── API publique ──────────────────────────────────────────
  /** Lire */
  get() { return this._fetch('GET'); }

  /** Insérer une ou plusieurs lignes */
  insert(rows) { return this._fetch('POST', rows); }

  /** Mettre à jour les lignes qui matchent les filtres */
  update(values) { return this._fetch('PATCH', values); }

  /** Supprimer les lignes qui matchent les filtres */
  delete() { return this._fetch('DELETE', undefined); }

  /** Upsert (insert ou update si conflit sur clé primaire) */
  upsert(rows) {
    this._prefer = 'resolution=merge-duplicates,return=representation';
    return this._fetch('POST', rows);
  }
}

// =============================================================
// Client principal
// =============================================================
class SupabaseClient {
  constructor(url, key) {
    this.url = url.replace(/\/$/, '');
    this.key = key;
  }

  /** Construire une requête sur une table */
  from(table) {
    return new QueryBuilder(this, table);
  }

  /**
   * Appeler une fonction PostgreSQL (RPC)
   * @param {string} fn   — nom de la fonction
   * @param {object} args — paramètres
   */
  async rpc(fn, args = {}) {
    const url = `${this.url}/rest/v1/rpc/${fn}`;
    let res;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':         this.key,
          'Authorization': `Bearer ${this.key}`,
        },
        body: JSON.stringify(args),
      });
    } catch (err) {
      return { data: null, error: { message: `Réseau : ${err.message}` } };
    }

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const msg = json?.message || `HTTP ${res.status}`;
      return { data: null, error: { message: msg, details: json } };
    }

    return { data: json, error: null };
  }
}

// Instance partagée dans toute l'application
// Dépend de SUPABASE_URL et SUPABASE_ANON_KEY définis dans config.js
const db = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
