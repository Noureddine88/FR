import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, BrowserRouter as Router, Routes, useNavigate, useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import {
  FiArchive,
  FiBarChart2,
  FiBox,
  FiCheckCircle,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiGrid,
  FiLayers,
  FiLogOut,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShoppingCart,
  FiTag,
  FiTruck,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import api from './api/axios.js';
import { generateQuotationPdf, generateDeliveryPdf, generateInvoicePdf } from './utils/commercialPdf.js';
import './App.css';

const navItems = [
  ['/', 'Tableau de bord', FiGrid],
  ['/articles', 'Articles', FiArchive],

  ['/designs', 'Designs', FiLayers],
  ['/colors', 'Couleurs', FiTag],
  ['/rolls', 'Stock', FiBox],
  ['/customers', 'Clients', FiUsers],
  ['/suppliers', 'Fournisseurs', FiTruck],
  ['/quotations', 'Devis', FiShoppingCart],
  ['/delivery-notes', 'Bons de livraison', FiTruck],
  ['/invoices', 'Factures', FiFileText],
  ['/reports', 'Rapports', FiFileText],
  ['/qr-codes', 'Codes QR', FiBarChart2],
];

const statusClass = {
  DISPONIBLE: 'success',
  STOCK_LIMITED: 'warning',
  INDISPONIBLE: 'danger',
};

const statusLabel = {
  DISPONIBLE: 'Disponible',
  STOCK_LIMITED: 'Stock limité',
  INDISPONIBLE: 'Indisponible',
};

const reportTypeLabels = {
  inventory: 'Inventaire',
  sales: 'Ventes',
  revenue: "Chiffre d'affaires",
  customers: 'Clients',
  suppliers: 'Fournisseurs',
  lowStock: 'Stock limité',
  deliveryNotes: 'Bons de livraison',
  quotations: 'Devis',
  invoices: 'Factures',
};

const quotationStatusLabels = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  REJECTED: 'Rejeté',
  EXPIRED: 'Expiré',
};

const deliveryNoteStatusLabels = {
  DRAFT: 'Brouillon',
  ACCEPTED: 'Accepté',
};

const paymentStatusLabels = {
  PAID: 'Payée',
  PARTIALLY_PAID: 'Partiellement payée',
  UNPAID: 'Non payée',
};

const money = (value) => Number(value || 0).toLocaleString('fr-TN', { style: 'currency', currency: 'TND' });
const meters = (value) => `${Number(value || 0).toLocaleString('fr-FR')} m`;
const formatArticleCode = (code) => {
  if (code === undefined || code === null || code === '') return '';
  const digits = String(code).replace(/\D/g, '');
  if (!digits) return String(code);
  return String(Number(digits)).padStart(4, '0');
};

function ArticleLookup({ displayValue, onSelect, onClear, placeholder = 'Code article, design ou couleur' }) {
  const [search, setSearch] = useState(displayValue || '');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queryTokenRef = useRef('');

  useEffect(() => {
    setSearch(displayValue || '');
  }, [displayValue]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (e.target?.closest?.('.article-lookup') || e.target?.closest?.('.article-dropdown')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  useEffect(() => {
    const q = search.trim();
    if (!open) return;
    if (!q) {
      setSuggestions([]);
      setLoading(false);
      setError('');
      return;
    }

    const isNumeric = /^\d+$/.test(q);
    if (!isNumeric && q.length < 2) return;

    const token = `${Date.now()}-${Math.random()}`;
    queryTokenRef.current = token;
    setLoading(true);
    setError('');

    const t = setTimeout(async () => {
      try {
        const response = await api.get(`/api/rolls/search?q=${encodeURIComponent(q)}`);
        if (queryTokenRef.current !== token) return;
        setSuggestions(response.data || []);
      } catch (err) {
        if (queryTokenRef.current !== token) return;
        setError(err.response?.data?.message || err.message);
        setSuggestions([]);
      } finally {
        if (queryTokenRef.current !== token) return;
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [search, open]);

  return (
    <div className="article-lookup" style={{ position: 'relative' }}>
      <input
        className="form-control"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onClear?.();
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div
          className="article-dropdown customer-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #ddd',
            zIndex: 1000,
          }}
        >
          {loading ? (
            <div style={{ padding: 10, color: '#666' }}>Chargement...</div>
          ) : error ? (
            <div style={{ padding: 10, color: '#b35900' }}>{error}</div>
          ) : !search.trim() || suggestions.length === 0 ? (
            <div style={{ padding: 10, color: '#666' }}>Aucun résultat</div>
          ) : (
            suggestions.map((roll) => (
              <button
                type="button"
                key={roll.id}
                className="customer-option"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: '0',
                  cursor: 'pointer',
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setSearch(roll.suggestionLabel || `${formatArticleCode(roll.articleCode)} - ${roll.color?.design?.name} - ${roll.color?.displayName || roll.color?.code}`);
                  onSelect(roll);
                }}
              >
                <div style={{ fontWeight: 600 }}>{roll.suggestionLabel}</div>
                <div style={{ color: '#666', fontSize: 12 }}>{meters(roll.remainingMeters)} restants</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const valueOf = (row, name) => row?.[name] ?? '';
const toNumber = (value) => (value === '' || value === undefined ? undefined : Number(value));
const buildQuery = (values) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim() !== '') params.set(key, String(value).trim());
  });
  return params.toString();
};

const downloadBlob = async (path, fallbackName) => {
  const response = await api.get(path, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function useFetch(path, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = useRef(0);

  const load = useCallback(async () => {
    const t = ++token.current;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(path);
      if (t !== token.current) return;
      setData(response.data);
    } catch (err) {
      if (t !== token.current) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      if (t === token.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
    return () => { token.current++; };
  }, deps);

  return { data, setData, loading, error, reload: load };
}

function Autocomplete({ value, placeholder, options = [], getOptionLabel, getOptionValue, onChange, onSearch, disabled, required }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryToken = useRef('');

  useEffect(() => {
    if (onSearch) return;
    if (!options.length) { setInput(''); return; }
    if (value) {
      const opt = options.find((o) => String(getOptionValue(o)) === String(value));
      setInput(opt ? getOptionLabel(opt) : '');
    } else {
      setInput('');
    }
  }, [value, options, onSearch, getOptionLabel, getOptionValue]);

  useEffect(() => {
    if (!onSearch) return;
    if (value !== undefined && value !== null && String(value).trim()) {
      setInput(String(value));
    }
  }, [value, onSearch]);

  useEffect(() => {
    if (onSearch) return;
    if (!open) return;
    const q = input.trim().toLowerCase();
    setSuggestions(!q ? options : options.filter((opt) => (getOptionLabel(opt) || '').toLowerCase().includes(q)));
  }, [input, options, open, onSearch, getOptionLabel]);

  useEffect(() => {
    if (!onSearch) return;
    if (!open) return;
    const q = input.trim();
    if (!q) { setSuggestions([]); setIsLoading(false); return; }
    if (q.length < 2 && !/^\d+$/.test(q)) return;
    const token = `${Date.now()}-${Math.random()}`;
    queryToken.current = token;
    setIsLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await onSearch(q);
        if (queryToken.current !== token) return;
        setSuggestions(results);
      } catch { if (queryToken.current === token) setSuggestions([]); }
      finally { if (queryToken.current === token) setIsLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [input, open, onSearch]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!e.target?.closest?.('.autocomplete-wrapper')) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="autocomplete-wrapper" style={{ position: 'relative' }}>
      <input
        className="form-control"
        placeholder={placeholder}
        value={input}
        onChange={(e) => {
          const v = e.target.value;
          setInput(v);
          setOpen(true);
          if (!v.trim() && onChange) onChange('', null);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        required={required}
      />
      {open && (
        <div className="customer-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 240, overflowY: 'auto', background: '#fff', border: '1px solid #ddd', zIndex: 1000 }}>
          {isLoading ? (
            <div style={{ padding: 10, color: '#666' }}>Chargement...</div>
          ) : suggestions.length === 0 ? (
            <div style={{ padding: 10, color: '#666' }}>Aucun résultat</div>
          ) : (
            suggestions.map((opt) => (
              <button
                key={getOptionValue(opt)}
                type="button"
                className="customer-option"
                style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: '0', cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setInput(getOptionLabel(opt)); setOpen(false); if (onChange) onChange(getOptionValue(opt), opt); }}
              >
                {getOptionLabel(opt)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Shell({ children }) {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem('curtain_erp_token');
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FR</div>
          <div>
            <strong>KENZA PRO</strong>
            <span>Gestion du stock</span>
          </div>
        </div>
        <nav>
          {navItems.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="ghost-button" type="button" onClick={logout}>
          <FiLogOut />
          <span>Déconnexion</span>
        </button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function Protected({ children }) {
  return localStorage.getItem('curtain_erp_token') ? <Shell>{children}</Shell> : <Navigate to="/login" replace />;
}

function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await api.post(`/api/auth/${mode === 'login' ? 'login' : 'bootstrap'}`, form);
      localStorage.setItem('curtain_erp_token', response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand-mark large">FR</div>
        <h1>KENZA PRO</h1>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Connexion
          </button>
          <button type="button" className={mode === 'bootstrap' ? 'active' : ''} onClick={() => setMode('bootstrap')}>
            Premier admin
          </button>
        </div>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <input className="form-control" type="email" placeholder="admin@entreprise.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="form-control" type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn btn-dark w-100" type="submit">
          <FiCheckCircle /> Continuer
        </button>
      </form>
    </main>
  );
}

function PageHeader({ title, action, onReload }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      </div>
      <div className="header-actions">
        {onReload && (
          <button className="icon-button" type="button" onClick={onReload} title="Actualiser">
            <FiRefreshCw />
          </button>
        )}
        {action}
      </div>
    </div>
  );
}

function Dashboard() {
  const { data, loading, error, reload } = useFetch('/api/reports/dashboard');
  const totals = data.totals || {};

  return (
    <>
      <PageHeader title="Tableau de bord" onReload={reload} />
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="metric-grid">
        {[
          ['Références', totals.references, FiArchive],
          ['Devis', totals.quotations, FiShoppingCart],
          ['Devis acceptés', totals.acceptedQuotations, FiCheckCircle],
          ['BL total', totals.deliveryNotes, FiTruck],
          ['BL en attente', totals.deliveryNotesDraft, FiTruck],
          ['BL acceptés', totals.deliveryNotesAccepted, FiCheckCircle],
          ['Factures', totals.invoices, FiFileText],
          ['Rouleaux', totals.rolls, FiBox],
          ['Stock total', meters(totals.inventoryStock), FiGrid],
          ['CA factures du mois', money(totals.commercialRevenue), FiBarChart2],
          ['Ventes directes', totals.monthlySales, FiTag],
        ].map(([label, value, Icon]) => (
          <section className="metric" key={label}>
            <Icon />
            <span>{label}</span>
            <strong>{loading ? '...' : value ?? 0}</strong>
          </section>
        ))}
      </div>
      <div className="two-column">
        <section>
          <h2>Alertes stock</h2>
          <DataTable
            rows={data.alerts || []}
            columns={[
              ['Référence', (row) => row.design?.reference?.name],
              ['Design', (row) => row.design?.name],
              ['Couleur', (row) => row.displayName || row.code],
              ['Stock', (row) => meters(row.totalMeters)],
              ['Statut', (row) => <Badge status={row.status} />],
            ]}
          />
        </section>
        <section>
          <h2>Ventes récentes</h2>
          <DataTable
            rows={data.recentSales || []}
            columns={[
              ['Facture', 'invoiceNumber'],
              ['Client', (row) => row.customer?.fullName || row.customerName || 'Client de passage'],
              ['Mètres', (row) => meters(row.metersSold)],
              ['Total', (row) => money(row.totalAmount)],
            ]}
          />
        </section>
      </div>
    </>
  );
}

function Badge({ status }) {
  return <span className={`badge text-bg-${statusClass[status] || 'secondary'}`}>{statusLabel[status] || 'N/A'}</span>;
}

function DataTable({ rows, columns, actions }) {
  return (
    <div className="table-wrap">
      <table className="table table-hover align-middle">
        <thead>
          <tr>
            {columns.map(([label]) => (
              <th key={label}>{label}</th>
            ))}
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="empty-cell">
                Aucun enregistrement
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id || index}>
                {columns.map(([label, accessor]) => (
                  <td key={label}>{typeof accessor === 'function' ? accessor(row) : row[accessor]}</td>
                ))}
                {actions && <td className="table-actions">{actions(row)}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function FieldControl({ field, value, onChange, disabled = false }) {
  if (field.options) {
    return (
      <Autocomplete
        placeholder={field.label}
        options={field.options}
        getOptionLabel={(opt) => field.optionLabel ? field.optionLabel(opt) : opt.name || opt.code || opt.companyName}
        getOptionValue={(opt) => opt.id}
        value={value}
        onChange={(v) => onChange(v)}
        disabled={disabled}
        required={field.required !== false}
      />
    );
  }

  return (
    <input
      className="form-control"
      type={field.type || 'text'}
      step={field.step}
      placeholder={field.label}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      disabled={disabled}
    />
  );
}

function ResourcePage({ title, path, fields, columns, filters = [], transform = (x) => x }) {
  const [filterValues, setFilterValues] = useState({});
  const query = buildQuery(filterValues);
  const listPath = query ? `${path}?${query}` : path;
  const { data, loading, error, reload } = useFetch(listPath, [listPath]);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const reset = () => {
    setForm({});
    setEditing(null);
    setMessage('');
  };

  const startEdit = (row) => {
    const next = {};
    fields.forEach((field) => {
      next[field.name] = field.fromRow ? field.fromRow(row) : valueOf(row, field.name);
    });
    setForm(next);
    setEditing(row.id);
    setMessage('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (editing) {
        await api.put(`${path}/${editing}`, transform(form));
      } else {
        await api.post(path, transform(form));
      }
      reset();
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Supprimer cet enregistrement ?')) return;
    try {
      await api.delete(`${path}/${id}`);
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  return (
    <>
      <PageHeader title={title} onReload={reload} />
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-danger">{message}</div>}
      {filters.length > 0 && (
        <div className="filter-form">
          {filters.map((filter) => (
            <FieldControl
              key={filter.name}
              value={filterValues[filter.name] || ''}
              field={{ ...filter, required: false }}
              onChange={(value) => setFilterValues({ ...filterValues, [filter.name]: value })}
            />
          ))}
          <button className="btn btn-outline-secondary" type="button" onClick={() => setFilterValues({})}>
            <FiX /> Effacer
          </button>
        </div>
      )}
      <form className="toolbar-form" onSubmit={submit}>
        {fields.map((field) => (
          <FieldControl
            key={field.name}
            value={form[field.name] || ''}
            field={field}
            onChange={(value) => setForm({ ...form, [field.name]: value })}
          />
        ))}
        <button className="btn btn-dark" type="submit" disabled={saving}>
          {editing ? <FiEdit2 /> : <FiPlus />} {editing ? 'Enregistrer' : 'Ajouter'}
        </button>
        {editing && (
          <button className="btn btn-outline-secondary" type="button" onClick={reset}>
            <FiX /> Annuler
          </button>
        )}
      </form>
      {loading ? (
        <div className="loading">Chargement...</div>
      ) : (
        <DataTable
          rows={data}
          columns={columns}
          actions={(row) => (
            <div className="row-actions">
              <button className="btn btn-sm btn-outline-dark" type="button" onClick={() => startEdit(row)}>
                <FiEdit2 /> Modifier
              </button>
              <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => remove(row.id)}>
                Supprimer
              </button>
            </div>
          )}
        />
      )}
    </>
  );
}

function References() {
  return (
    <ResourcePage
      title="Articles"
      path="/api/references"
      fields={[{ name: 'name', label: 'Nom de l\'article', required: true }]}
      filters={[
        { name: 'search', label: 'Rechercher article, design, couleur, rouleau' },
        { name: 'minMeters', label: 'Mètres min', type: 'number', step: '0.01' },
        { name: 'maxMeters', label: 'Mètres max', type: 'number', step: '0.01' },
      ]}
      columns={[
        ['Code Article', (row) => String(row.articleCode ?? '').padStart(4, '0')],
        ['Nom', 'name'],
        ['Total', (row) => meters(row.totalMeters)],
        ['Designs', (row) => row.designCount ?? row.designs?.length ?? 0],
        ['Couleurs', (row) => row.colorCount ?? 0],
        ['Rouleaux', (row) => row.rollCount ?? 0],
      ]}
    />
  );
}

function Designs() {
  const { data: references } = useFetch('/api/references');
  const refOptions = references.map((r) => ({ ...r, codeLabel: `${String(r.articleCode ?? '').padStart(4, '0')} - ${r.name}` }));
  return (
    <ResourcePage
      title="Designs"
      path="/api/designs"
      fields={[
        { name: 'name', label: 'Nom du design', required: true },
        { name: 'referenceId', label: 'Article', options: refOptions, optionLabel: (r) => r.codeLabel, fromRow: (row) => row.referenceId, required: true },
      ]}
      filters={[
        { name: 'search', label: 'Rechercher design, article, couleur, rouleau' },
        { name: 'referenceId', label: 'Tous les articles', options: references, optionLabel: (r) => `${String(r.articleCode ?? '').padStart(4, '0')} - ${r.name}`, required: false },
        { name: 'status', label: 'Tous les statuts', options: Object.keys(statusClass).map((status) => ({ id: status, name: statusLabel[status] })), required: false },
        { name: 'minMeters', label: 'Mètres min', type: 'number', step: '0.01' },
        { name: 'maxMeters', label: 'Mètres max', type: 'number', step: '0.01' },
      ]}
      columns={[
        ['Code', (row) => String(row.designCode ?? '').padStart(4, '0')],
        ['Nom', 'name'],
        ['Référence', (row) => row.reference?.name],
        ['Total', (row) => meters(row.totalMeters)],
        ['Couleurs', (row) => row.colorCount ?? row.colors?.length ?? 0],
        ['Rouleaux', (row) => row.rollCount ?? 0],
      ]}
    />
  );
}

function Colors() {
  const { data: references } = useFetch('/api/references');
  const { data: designs } = useFetch('/api/designs');
  return (
    <ResourcePage
      title="Couleurs"
      path="/api/colors"
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'displayName', label: 'Nom affiché' },
        { name: 'designId', label: 'Design', options: designs, fromRow: (row) => row.designId, required: true },
      ]}
      filters={[
        { name: 'search', label: 'Rechercher couleur, design, article, rouleau' },
        { name: 'referenceId', label: 'Tous les articles', options: references, optionLabel: (r) => `${String(r.articleCode ?? '').padStart(4, '0')} - ${r.name}`, required: false },
        { name: 'designId', label: 'Tous les designs', options: designs, optionLabel: (design) => `${design.reference?.name || 'Référence'} / ${design.name}`, required: false },
        { name: 'status', label: 'Tous les statuts', options: Object.keys(statusClass).map((status) => ({ id: status, name: statusLabel[status] })), required: false },
        { name: 'minMeters', label: 'Mètres min', type: 'number', step: '0.01' },
        { name: 'maxMeters', label: 'Mètres max', type: 'number', step: '0.01' },
      ]}
      columns={[
        ['Code', 'code'],
        ['Nom', 'displayName'],
        ['Article', (row) => row.design?.reference?.name],
        ['Design', (row) => row.design?.name],
        ['Stock', (row) => meters(row.totalMeters)],
        ['Rouleaux', (row) => row.rollCount ?? 0],
        ['Statut', (row) => <Badge status={row.status} />],
      ]}
    />
  );
}

function Rolls() {
  const { data: colors } = useFetch('/api/colors');
  const { data: suppliers } = useFetch('/api/suppliers');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const rollsPath = searchQuery ? `/api/rolls?search=${encodeURIComponent(searchQuery)}` : '/api/rolls';
  const { data, reload } = useFetch(rollsPath, [searchQuery]);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const reset = () => {
    setForm({});
    setEditing(null);
    setMessage('');
  };

  const startEdit = (roll) => {
    setForm({
      colorId: roll.colorId,
      supplierId: roll.supplierId || '',
      meters: roll.meters,
      remainingMeters: roll.remainingMeters,
      purchasePrice: roll.purchasePrice,
      sellingPrice: roll.sellingPrice,
      notes: roll.notes || '',
    });
    setEditing(roll.id);
    setMessage('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const payload = {
        ...form,
        meters: toNumber(form.meters),
        remainingMeters: toNumber(form.remainingMeters),
        purchasePrice: toNumber(form.purchasePrice),
        sellingPrice: toNumber(form.sellingPrice),
      };
      if (editing) {
        await api.put(`/api/rolls/${editing}`, payload);
      } else {
        await api.post('/api/rolls', payload);
      }
      reset();
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Supprimer ce rouleau ?')) return;
    try {
      await api.delete(`/api/rolls/${id}`);
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  return (
    <>
      <PageHeader title="Stock" onReload={reload} />
      {message && <div className="alert alert-danger">{message}</div>}
      <form className="toolbar-form roll-form" onSubmit={submit}>
        <Autocomplete placeholder="Couleur" options={colors} getOptionLabel={(c) => `${c.design?.reference?.name} / ${c.design?.name} / ${c.code}`} getOptionValue={(c) => c.id} value={form.colorId} onChange={(v) => setForm({ ...form, colorId: v })} required />
        <Autocomplete placeholder="Fournisseur" options={suppliers} getOptionLabel={(s) => s.companyName} getOptionValue={(s) => s.id} value={form.supplierId} onChange={(v) => setForm({ ...form, supplierId: v })} />
        {[
          ['meters', 'Mètres initiaux'],
          ['remainingMeters', 'Mètres restants'],
          ['purchasePrice', 'Prix achat'],
          ['sellingPrice', 'Prix vente'],
        ].map(([name, label]) => (
          <input key={name} className="form-control" type="number" step="0.01" placeholder={label} value={form[name] || ''} onChange={(e) => setForm({ ...form, [name]: e.target.value })} required={name === 'meters'} />
        ))}
        <input className="form-control" placeholder="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="btn btn-dark" type="submit">{editing ? <FiEdit2 /> : <FiPlus />} {editing ? 'Enregistrer' : 'Ajouter'}</button>
        {editing && <button className="btn btn-outline-secondary" type="button" onClick={reset}><FiX /> Annuler</button>}
      </form>
      <div className="searchbar">
        <FiSearch />
        <input
          className="form-control"
          placeholder="Rechercher (code article, design, couleur)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>
      <DataTable
        rows={data}
        columns={[
          ['Article', (row) => row.color?.design?.reference?.name || '-'],
          ['Design', (row) => row.color?.design?.name],
          ['Couleur', (row) => row.color?.displayName || row.color?.code],
          ['Restant', (row) => meters(row.remainingMeters)],
          ['Prix', (row) => money(row.sellingPrice)],
        ]}
        actions={(row) => (
          <div className="row-actions">
            <button className="btn btn-sm btn-outline-dark" type="button" onClick={() => startEdit(row)}>
                <FiEdit2 /> Modifier
            </button>
            <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => remove(row.id)}>
              Supprimer
            </button>
          </div>
        )}
      />
    </>
  );
}

function Customers() {
  return (
    <ResourcePage
      title="Clients"
      path="/api/customers"
      fields={[
        { name: 'fullName', label: 'Nom', required: true },
        { name: 'phone', label: 'Téléphone', required: true },
        { name: 'email', label: 'Email' },
        { name: 'address', label: 'Adresse' },
        { name: 'matriculeFiscale', label: 'Matricule Fiscale' },
        { name: 'notes', label: 'Notes' },
      ]}
      columns={[
        ['Code Client', (row) => String(row.customerCode).padStart(4, '0')],
        ['Nom', 'fullName'],
        ['Téléphone', 'phone'],
        ['Email', 'email'],
        ['Matricule Fiscale', 'matriculeFiscale'],
      ]}
      filters={[
        { name: 'search', label: 'Rechercher (Code, Nom, Téléphone, Email, MF)' },
      ]}
    />
  );
}


function Suppliers() {
  return <ResourcePage title="Fournisseurs" path="/api/suppliers" fields={[{ name: 'companyName', label: 'Société', required: true }, { name: 'contactPerson', label: 'Contact' }, { name: 'phone', label: 'Téléphone', required: true }, { name: 'email', label: 'Email' }]} columns={[['Société', 'companyName'], ['Téléphone', 'phone'], ['Rouleaux', 'deliveredRolls'], ['Mètres', (row) => meters(row.purchasedMeters)], ['Valeur achat', (row) => money(row.purchaseValue)]]} />;
}

function Sales() {
  const { data: customers } = useFetch('/api/customers');
  const { data: sales, reload } = useFetch('/api/sales');
  const [form, setForm] = useState({ articleLabel: '' });
  const [selectedRoll, setSelectedRoll] = useState(null);

  useEffect(() => {
    if (selectedRoll && !form.pricePerMeter) {
      setForm((current) => ({ ...current, pricePerMeter: selectedRoll.sellingPrice }));
    }
  }, [selectedRoll?.id]);

  const submit = async (event) => {
    event.preventDefault();
    await api.post('/api/sales', { ...form, rollId: selectedRoll?.id });
    setForm({ articleLabel: '' });
    setSelectedRoll(null);
    await reload();
  };

  return (
    <>
      <PageHeader title="Ventes" onReload={reload} />
      <form className="toolbar-form sale-form" onSubmit={submit}>
        <Autocomplete placeholder="Client de passage" options={customers} getOptionLabel={(c) => `${String(c.customerCode).padStart(4, '0')} - ${c.fullName}`} getOptionValue={(c) => c.id} value={form.customerId} onChange={(v) => setForm({ ...form, customerId: v })} />
        <ArticleLookup
          displayValue={form.articleLabel}
          placeholder="Code article, design ou couleur"
          onSelect={(roll) => {
            setSelectedRoll(roll);
            setForm((current) => ({
              ...current,
              articleLabel: roll.suggestionLabel,
              pricePerMeter: current.pricePerMeter || roll.sellingPrice,
            }));
          }}
          onClear={() => {
            setSelectedRoll(null);
            setForm((current) => ({ ...current, articleLabel: '' }));
          }}
        />
        <input className="form-control" type="number" step="0.01" placeholder="Mètres vendus" value={form.metersSold || ''} onChange={(e) => setForm({ ...form, metersSold: e.target.value })} required />
        <input className="form-control" type="number" step="0.01" placeholder="Prix par mètre" value={form.pricePerMeter || ''} onChange={(e) => setForm({ ...form, pricePerMeter: e.target.value })} required />
        <strong>{money(Number(form.metersSold || 0) * Number(form.pricePerMeter || 0))}</strong>
        <button className="btn btn-dark" type="submit" disabled={!selectedRoll}>Facturer</button>
      </form>
      <DataTable rows={sales} columns={[['Facture', 'invoiceNumber'], ['Client', (row) => row.customer ? `${String(row.customer.customerCode).padStart(4, '0')} - ${row.customer.fullName}` : (row.customerName || 'Client de passage')], ['Article', (row) => formatArticleCode(row.roll?.articleCode)], ['Mètres', (row) => meters(row.metersSold)], ['Total', (row) => money(row.totalAmount)]]} />
    </>
  );
}

function Quotations() {
  const { data, reload } = useFetch('/api/commercial/quotations');
  const { data: allDesigns } = useFetch('/api/designs');

  // smooth customer autocomplete (backend driven)
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const customerQueryTokenRef = useRef('');
  const [form, setForm] = useState({ customerId: '', customerName: '', customerPhone: '', customerAddress: '', customerMatriculeFiscale: '', notes: '' });
  const itemKeyRef = useRef(1);
  const [items, setItems] = useState([{ _key: 0, rollId: '', articleCode: '', articleLabel: '', designation: '', quantity: '', unit: 'm', unitPriceHt: '', remiseRate: 0, tvaRate: 19, selectedDesignId: '', selectedColorId: '' }]);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);

  const setItem = (index, values) => setItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...values } : item)));
  const addItem = () => {
    setItems((prev) => [...prev, { _key: ++itemKeyRef.current, rollId: '', articleCode: '', articleLabel: '', designation: '', quantity: '', unit: 'm', unitPriceHt: '', remiseRate: 0, tvaRate: 19, selectedDesignId: '', selectedColorId: '' }]);
    setDesignSearches((prev) => [...prev, '']);
    setDesignDropdowns((prev) => [...prev, false]);
    setDesignSuggestions((prev) => [...prev, []]);
  };
  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setDesignSearches((prev) => prev.filter((_, i) => i !== index));
    setDesignDropdowns((prev) => prev.filter((_, i) => i !== index));
    setDesignSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ customerId: '', customerName: '', customerPhone: '', customerAddress: '', customerMatriculeFiscale: '', notes: '' });
    setCustomerSearch('');
    itemKeyRef.current = 1;
    setItems([{ _key: 0, rollId: '', articleCode: '', articleLabel: '', designation: '', quantity: '', unit: 'm', unitPriceHt: '', remiseRate: 0, tvaRate: 19, selectedDesignId: '', selectedColorId: '' }]);
    setDesignSearches(['']);
    setDesignDropdowns([false]);
    setDesignSuggestions([[]]);
  };

  const startEdit = (quotation) => {
    setEditingId(quotation.id);
    setForm({
      customerId: quotation.customerId || '',
      customerName: quotation.customerName || '',
      customerPhone: quotation.customerPhone || '',
      customerAddress: quotation.customerAddress || '',
      customerMatriculeFiscale: quotation.customer?.matriculeFiscale || '',
      notes: quotation.notes || '',
    });
    setCustomerSearch(quotation.customer ? `${String(quotation.customer.customerCode).padStart(4, '0')} - ${quotation.customer.fullName}` : (quotation.customerName || ''));
    const mapped = (quotation.items || []).map((item, i) => {
      const roll = item.roll;
      const color = roll?.color;
      const design = color?.design;
      return {
        _key: i,
        rollId: item.rollId || '',
        articleCode: item.articleCode || '',
        articleLabel: '',
        designation: item.designation || '',
        quantity: String(item.quantity || ''),
        unit: item.unit || 'm',
        unitPriceHt: String(item.unitPriceHt || ''),
        remiseRate: item.remiseRate ?? 0,
        tvaRate: item.tvaRate ?? 19,
        selectedDesignId: design?.id || '',
        selectedColorId: color?.id || '',
      };
    });
    setItems(mapped);
    setDesignSearches((quotation.items || []).map((item) => {
      const roll = item.roll;
      const color = roll?.color;
      const design = color?.design;
      if (design) {
        return `${formatArticleCode(design.designCode)} - ${design.reference?.name || ''} / ${design.name}`;
      }
      return item.designation || '';
    }));
    setDesignDropdowns(mapped.map(() => false));
    setDesignSuggestions(mapped.map(() => []));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Design autocomplete state (per-row)
  const [designSearches, setDesignSearches] = useState(['']);
  const [designDropdowns, setDesignDropdowns] = useState([false]);
  const [designSuggestions, setDesignSuggestions] = useState([[]]);
  const [designLoadingIdx, setDesignLoadingIdx] = useState(-1);
  const designQueryTokens = useRef({});

  // Close design dropdowns on outside click
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!e.target?.closest?.('.design-lookup-cell')) {
        setDesignDropdowns((prev) => prev.map(() => false));
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const onDesignSearchInput = (index, value) => {
    const newSearches = [...designSearches];
    newSearches[index] = value;
    setDesignSearches(newSearches);

    if (!value.trim()) {
      setItem(index, { selectedDesignId: '', selectedColorId: '', rollId: '', articleCode: '', articleLabel: '', designation: '', unitPriceHt: '' });
      const newSuggestions = [...designSuggestions];
      newSuggestions[index] = [];
      setDesignSuggestions(newSuggestions);
      setDesignDropdowns((prev) => { const d = [...prev]; d[index] = false; return d; });
      return;
    }

    // Sync typed text as designation for manual entry (no design selected)
    setItem(index, { designation: value });

    const q = value.trim();
    const isNumeric = /^\d+$/.test(q);
    if (!isNumeric && q.length < 2) return;

    const newDropdowns = [...designDropdowns];
    newDropdowns[index] = true;
    setDesignDropdowns(newDropdowns);

    const token = `${Date.now()}-${Math.random()}`;
    designQueryTokens.current[index] = token;
    setDesignLoadingIdx(index);

    const t = setTimeout(async () => {
      try {
        const response = await api.get(`/api/designs?search=${encodeURIComponent(q)}&limit=20`);
        if (designQueryTokens.current[index] !== token) return;
        const newSuggestions = [...designSuggestions];
        newSuggestions[index] = response.data || [];
        setDesignSuggestions(newSuggestions);
      } catch {
        if (designQueryTokens.current[index] !== token) return;
        const newSuggestions = [...designSuggestions];
        newSuggestions[index] = [];
        setDesignSuggestions(newSuggestions);
      } finally {
        if (designQueryTokens.current[index] === token) {
          setDesignLoadingIdx(-1);
        }
      }
    }, 250);

    return () => clearTimeout(t);
  };

  const selectDesignSuggestion = (index, design) => {
    const newSearches = [...designSearches];
    newSearches[index] = `${formatArticleCode(design.designCode)} - ${design.reference?.name} / ${design.name}`;
    setDesignSearches(newSearches);

    const newDropdowns = [...designDropdowns];
    newDropdowns[index] = false;
    setDesignDropdowns(newDropdowns);

    setItem(index, { selectedDesignId: design.id, selectedColorId: '', rollId: '', articleCode: formatArticleCode(design.designCode), articleLabel: '', designation: '', unitPriceHt: '' });
  };

  // Build available colors for each item based on selected design
  const colorsForDesign = (designId) => {
    if (!designId || !allDesigns) return [];
    const design = allDesigns.find((d) => d.id === designId);
    return design?.colors || [];
  };

  const selectColor = async (index, colorId) => {
    if (!colorId) {
      setItem(index, { selectedColorId: '', rollId: '', articleLabel: '', designation: '', unitPriceHt: '' });
      return;
    }
    // Fetch a roll for this color
    try {
      const response = await api.get(`/api/rolls?colorId=${encodeURIComponent(colorId)}&limit=1`);
      const rolls = response.data || [];
      const roll = rolls[0];
      if (roll) {
        const colorLabel = roll.color?.displayName || roll.color?.code || '';
        setItem(index, {
          selectedColorId: colorId,
          rollId: roll.id,
          articleLabel: roll.suggestionLabel || `${formatArticleCode(roll.articleCode)} - ${roll.color?.design?.name || ''} - ${colorLabel}`,
          designation: roll ? `${roll.color?.design?.name || ''} - ${colorLabel}`.trim() : '',
          unitPriceHt: roll.sellingPrice || '',
        });
      } else {
        // No roll found, just store the color selection
        const design = allDesigns?.find((d) => d.id === items[index]?.selectedDesignId);
        const color = design?.colors?.find((c) => c.id === colorId);
        const colorLabel = color?.displayName || color?.code || '';
        const desName = design?.name || '';
        setItem(index, {
          selectedColorId: colorId,
          rollId: '',
          articleLabel: `${desName} - ${colorLabel}`,
          designation: `${desName} - ${colorLabel}`,
          unitPriceHt: '',
        });
      }
    } catch {
      setItem(index, { selectedColorId: colorId });
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    const cleanItems = items.map((item) => {
      const { _key, articleLabel, selectedDesignId, selectedColorId, ...rest } = item;
      return {
        ...rest,
        rollId: rest.rollId || null,
        articleCode: rest.articleCode || rest.designation || '',
        designation: rest.designation || rest.articleCode || '',
        unit: rest.unit || 'm',
        tvaRate: rest.tvaRate ?? 19,
        remiseRate: rest.remiseRate ?? 0,
      };
    });
    try {
      if (editingId) {
        const res = await api.put(`/api/commercial/quotations/${editingId}`, {
          ...form,
          items: cleanItems,
          customerId: form.customerId || null,
          customerName: form.customerName || null,
          customerPhone: form.customerPhone || null,
          customerAddress: form.customerAddress || null,
          customerMatriculeFiscale: form.customerMatriculeFiscale || null,
        });
        // If BL was accepted, backend created a new devis — show its number
        if (res.data.id !== editingId) {
          setMessage(`Devis modifié et sauvegardé sous le nouveau numéro ${res.data.quotationNumber} (l'ancien est verrouillé car son BL est accepté)`);
        }
      } else {
        await api.post('/api/commercial/quotations', {
          ...form,
          items: cleanItems,
          customerId: form.customerId || null,
          customerName: form.customerName || null,
          customerPhone: form.customerPhone || null,
          customerAddress: form.customerAddress || null,
          customerMatriculeFiscale: form.customerMatriculeFiscale || null,
        });
      }
      resetForm();
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  const generateDelivery = async (quotation) => {
    setMessage('');
    try {
      await api.post(`/api/commercial/quotations/${quotation.id}/delivery-note`, {});
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };
  const remove = async (id) => { if(confirm('Supprimer ce devis ?')) { await api.delete(`/api/commercial/quotations/${id}`); reload(); } };


  const updateStatus = async (quotation, status) => {
    await api.patch(`/api/commercial/quotations/${quotation.id}/status`, { status });
    await reload();
  };

  // Close dropdown when clicking outside (fixes "Customer code ou nom" input issues)
  useEffect(() => {
    if (!customerDropdownOpen) return;

    const onDocMouseDown = (e) => {
      const target = e.target;
      if (target && (target.closest?.('.customer-lookup') || target.closest?.('.customer-dropdown'))) return;
      setCustomerDropdownOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [customerDropdownOpen]);

  // Debounced API call for customer suggestions
  useEffect(() => {
    const q = customerSearch.trim();
    if (!customerDropdownOpen) return;
    if (!q) {
      setCustomerSuggestions([]);
      setCustomerLoading(false);
      setCustomerError('');
      return;
    }

    const isNumeric = /^\d+$/.test(q);
    // Avoid hammering server for very small inputs unless numeric (keep exact matching)
    if (!isNumeric && q.length < 2) return;

    const token = `${Date.now()}-${Math.random()}`;
    customerQueryTokenRef.current = token;
    setCustomerLoading(true);
    setCustomerError('');

    const t = setTimeout(async () => {
      try {
        const response = await api.get(`/api/customers/search?q=${encodeURIComponent(q)}`);
        if (customerQueryTokenRef.current !== token) return;
        setCustomerSuggestions(response.data || []);
      } catch (err) {
        if (customerQueryTokenRef.current !== token) return;
        setCustomerError(err.response?.data?.message || err.message);
        setCustomerSuggestions([]);
      } finally {
        if (customerQueryTokenRef.current !== token) return;
        setCustomerLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [customerSearch, customerDropdownOpen]);

  return (
    <>
      <PageHeader title="Devis" onReload={reload} />
      {message && <div className="alert alert-danger">{message}</div>}
      <form className="toolbar-form roll-form" onSubmit={submit}>
        <div className="customer-lookup">
          <div style={{ position: 'relative' }}>
            <input
              className="form-control"
              placeholder="Code client ou nom"
              value={customerSearch}
              onChange={(e) => {
                const value = e.target.value;
                setCustomerSearch(value);
                setCustomerDropdownOpen(true);
              }}
              onFocus={() => setCustomerDropdownOpen(true)}
            />
            {customerDropdownOpen && (
              <div
                className="customer-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: 240,
                  overflowY: 'auto',
                  background: '#fff',
                  border: '1px solid #ddd',
                  zIndex: 1000,
                }}
              >
                {customerLoading ? (
                  <div style={{ padding: 10, color: '#666' }}>Chargement...</div>
                ) : customerError ? (
                  <div style={{ padding: 10, color: '#b35900' }}>{customerError}</div>
                ) : customerSuggestions.length === 0 ? (
                  <div style={{ padding: 10, color: '#666' }}>Aucun résultat</div>
                ) : (
                  customerSuggestions.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="customer-option"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: '0',
                        cursor: 'pointer',
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCustomerDropdownOpen(false);
                        setCustomerSearch(String(c.customerCode).padStart(4,'0') + ' - ' + (c.fullName || ''));
                        setForm({
                          ...form,
                          customerId: c.id,
                          customerName: c.fullName ?? '',
                          customerPhone: c.phone ?? '',
                          customerAddress: c.address ?? '',
                          customerMatriculeFiscale: c.matriculeFiscale ?? '',
                          // ensure exact code field stays coherent for PDFs
                          customerCode: c.customerCode,
                        });
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{String(c.customerCode).padStart(4,'0')} - {c.fullName}</div>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        {c.matriculeFiscale || c.email || ''}
                      </div>
                      {c.phone && <div style={{ color: '#666', fontSize: 12 }}>{c.phone}</div>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <input
            className="form-control"
            placeholder="Nom du client"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          />
          <input
            className="form-control"
            placeholder="Téléphone"
            value={form.customerPhone}
            onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
          />
          <input
            className="form-control"
            placeholder="Adresse"
            value={form.customerAddress}
            onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
          />
          <input
            className="form-control"
            placeholder="Matricule Fiscale"
            value={form.customerMatriculeFiscale}
            onChange={(e) => setForm({ ...form, customerMatriculeFiscale: e.target.value })}
          />
        </div>
        <input className="form-control" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="table-wrap">
          <table className="table align-middle">
            <thead>
              <tr><th>Design</th><th>Couleur</th><th>Qté</th><th>PU HT</th><th>Remise %</th><th>TVA %</th><th /></tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const colors = colorsForDesign(item.selectedDesignId);
                return (
                <tr key={item._key}>
                  <td className="design-lookup-cell" style={{ minWidth: 200, position: 'relative' }}>
                    <input
                      className="form-control"
                      placeholder="Code design, article"
                      value={designSearches[index] || ''}
                      onChange={(e) => onDesignSearchInput(index, e.target.value)}
                      onFocus={() => {
                        const newDropdowns = [...designDropdowns];
                        newDropdowns[index] = true;
                        setDesignDropdowns(newDropdowns);
                      }}
                    />
                    {designDropdowns[index] && (
                      <div
                        className="customer-dropdown"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          maxHeight: 240,
                          overflowY: 'auto',
                          background: '#fff',
                          border: '1px solid #ddd',
                          zIndex: 1000,
                        }}
                      >
                        {designLoadingIdx === index ? (
                          <div style={{ padding: 10, color: '#666' }}>Chargement...</div>
                        ) : !designSearches[index]?.trim() || designSuggestions[index]?.length === 0 ? (
                          <div style={{ padding: 10, color: '#666' }}>Aucun résultat</div>
                        ) : (
                          designSuggestions[index].map((design) => (
                            <button
                              type="button"
                              key={design.id}
                              className="customer-option"
                              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: '0', cursor: 'pointer' }}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectDesignSuggestion(index, design)}
                            >
                              <div style={{ fontWeight: 600 }}>
                                {formatArticleCode(design.designCode)} - {design.reference?.name} / {design.name}
                              </div>
                              <div style={{ color: '#666', fontSize: 12 }}>
                                {design.colorCount ?? design.colors?.length ?? 0} couleurs · {design.rollCount ?? 0} rouleaux
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <Autocomplete placeholder="Sélectionner couleur" options={colors} getOptionLabel={(c) => `${c.displayName || c.code}${c.status ? ` [${statusLabel[c.status] || c.status}]` : ''}`} getOptionValue={(c) => c.id} value={item.selectedColorId} onChange={(v) => selectColor(index, v)} disabled={!item.selectedDesignId} />
                  </td>
                  <td><input className="form-control" type="number" step="0.01" value={item.quantity} onChange={(e) => setItem(index, { quantity: e.target.value })} required /></td>
                  <td><input className="form-control" type="number" step="0.001" value={item.unitPriceHt} onChange={(e) => setItem(index, { unitPriceHt: e.target.value })} /></td>
                  <td><input className="form-control" type="number" step="0.01" min="0" max="100" value={item.remiseRate} onChange={(e) => setItem(index, { remiseRate: e.target.value })} /></td>
                  <td><input className="form-control" type="number" step="0.01" value={item.tvaRate} onChange={(e) => setItem(index, { tvaRate: e.target.value })} /></td>
                  <td><button className="btn btn-sm btn-outline-danger" type="button" onClick={() => removeItem(index)} disabled={items.length === 1}>Supprimer</button></td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={addItem}><FiPlus /> Article</button>
        {editingId ? (
          <>
            <button className="btn btn-dark" type="submit"><FiEdit2 /> Modifier devis</button>
            <button className="btn btn-outline-secondary" type="button" onClick={resetForm}><FiX /> Annuler</button>
          </>
        ) : (
          <button className="btn btn-dark" type="submit"><FiFileText /> Créer devis</button>
        )}
      </form>
      <DataTable
        rows={data}
        columns={[
          ['N° devis', 'quotationNumber'],
          ['Client', (row) => row.customer ? `${String(row.customer.customerCode).padStart(4, '0')} - ${row.customer.fullName}` : (row.customerName || 'Client de passage')],
          ['Statut', (row) => quotationStatusLabels[row.status] || row.status],
          ['Total', (row) => money(row.netToPay)],
          ['Date', (row) => new Date(row.createdAt).toLocaleDateString('fr-FR')],
        ]}
        actions={(row) => (
          <div className="row-actions">
            <Autocomplete options={Object.entries(quotationStatusLabels).map(([value, label]) => ({ value, label }))} getOptionLabel={(opt) => opt.label} getOptionValue={(opt) => opt.value} value={row.status} onChange={(v) => updateStatus(row, v)} />
            <button className="btn btn-sm btn-outline-dark" onClick={() => generateQuotationPdf(row).save(`${row.quotationNumber}.pdf`)}><FiDownload /></button>
            <button className="btn btn-sm btn-dark" onClick={() => generateDelivery(row)} disabled={Boolean(row.deliveryNote)}>BL</button>
            <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(row)}><FiEdit2 /></button>
            <button className="btn btn-sm btn-outline-danger" onClick={() => remove(row.id)}><FiX /></button>
          </div>
        )}
      />
    </>
  );
}

function DeliveryNotes() {
  const { data, reload } = useFetch('/api/commercial/delivery-notes');
  const [message, setMessage] = useState('');


  const acceptDelivery = async (delivery) => {
    if (!confirm(`Accepter le bon de livraison ${delivery.deliveryNumber} ?\nLe stock sera déduit automatiquement.`)) return;
    setMessage('');
    try {
      await api.post(`/api/commercial/delivery-notes/${delivery.id}/accept`);
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  const generateInvoice = async (delivery) => {
    setMessage('');
    try {
      await api.post(`/api/commercial/delivery-notes/${delivery.id}/invoice`, {});
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Supprimer ce bon de livraison ?')) return;
    setMessage('');
    try {
      await api.delete(`/api/commercial/delivery-notes/${id}`);
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  return (
    <>
      <PageHeader title="Bons de livraison" onReload={reload} />
      {message && <div className="alert alert-danger">{message}</div>}
      <DataTable
        rows={data}
        columns={[
          ['N° BL', 'deliveryNumber'],
          ['Client', (row) => row.customer ? `${String(row.customer.customerCode).padStart(4, '0')} - ${row.customer.fullName}` : (row.customerName || 'Client de passage')],
          ['Statut', (row) => <span className={`badge text-bg-${row.status === 'ACCEPTED' ? 'success' : 'warning'}`}>{deliveryNoteStatusLabels[row.status] || row.status}</span>],
          ['Date', (row) => new Date(row.createdAt).toLocaleDateString('fr-FR')],
          ['Quantité totale', (row) => meters(row.totalQuantity)],
          ['Facture', (row) => row.invoice?.invoiceNumber || '-'],
        ]}
        actions={(row) => (
          <div className="row-actions">
            {row.status === 'DRAFT' && (
              <button className="btn btn-sm btn-success" onClick={() => acceptDelivery(row)}><FiCheckCircle /></button>
            )}
            <button className="btn btn-sm btn-outline-dark" onClick={() => generateDeliveryPdf(row).save(`${row.deliveryNumber}.pdf`)}><FiDownload /></button>
            <button className="btn btn-sm btn-dark" onClick={() => generateInvoice(row)} disabled={row.status !== 'ACCEPTED' || Boolean(row.invoice)}>Facture</button>
            {/* Suppression uniquement si non accepté */}
            {row.status !== 'ACCEPTED' && (
              <button className="btn btn-sm btn-outline-danger" onClick={() => remove(row.id)}><FiX /></button>
            )}
          </div>
        )}
      />
    </>
  );
}

function Invoices() {
  const { data, reload } = useFetch('/api/commercial/invoices');
  const [message, setMessage] = useState('');

  const updatePayment = async (invoice, paymentStatus) => {
    await api.patch(`/api/commercial/invoices/${invoice.id}/payment`, { paymentStatus });
    await reload();
  };

  const remove = async (id) => {
    if (!confirm('Supprimer cette facture ?')) return;
    setMessage('');
    try {
      await api.delete(`/api/commercial/invoices/${id}`);
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  return (
    <>
      <PageHeader title="Factures" onReload={reload} />
      {message && <div className="alert alert-danger">{message}</div>}
      <DataTable
        rows={data}
        columns={[
          ['N° facture', 'invoiceNumber'],
          ['Client', (row) => row.customer ? `${String(row.customer.customerCode).padStart(4, '0')} - ${row.customer.fullName}` : (row.customerName || 'Client de passage')],
          ['Date', (row) => new Date(row.createdAt).toLocaleDateString('fr-FR')],
          ['Montant', (row) => money(row.netToPay)],
          ['Paiement', (row) => paymentStatusLabels[row.paymentStatus] || row.paymentStatus],
        ]}
        actions={(row) => (
          <div className="row-actions">
            <Autocomplete options={Object.entries(paymentStatusLabels).map(([value, label]) => ({ value, label }))} getOptionLabel={(opt) => opt.label} getOptionValue={(opt) => opt.value} value={row.paymentStatus} onChange={(v) => updatePayment(row, v)} />
            <button className="btn btn-sm btn-outline-dark" onClick={() => generateInvoicePdf(row).save(`${row.invoiceNumber}.pdf`)}><FiDownload /></button>
            <button className="btn btn-sm btn-outline-danger" onClick={() => remove(row.id)}><FiX /></button>
          </div>
        )}
      />
    </>
  );
}

function Reports() {
  const types = ['inventory', 'sales', 'revenue', 'customers', 'suppliers', 'lowStock', 'deliveryNotes', 'quotations', 'invoices'];
  const [type, setType] = useState('inventory');
  const [exportError, setExportError] = useState('');
  const { data, reload } = useFetch(`/api/reports/${type}`, [type]);
  const rows = data.rows || [];
  const columns = (data.columns || []).map((column) => [column, column]);

  const downloadReport = async (format) => {
    setExportError('');
    try {
      const response = await api.get(`/api/reports/${type}/${format}`, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `${type}_rapport.${format}`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.response?.data?.message || err.message);
    }
  };

  return (
    <>
      <PageHeader title="Rapports" onReload={reload} />
      {exportError && <div className="alert alert-danger">{exportError}</div>}
      <div className="report-toolbar">
        <Autocomplete options={types.map((item) => ({ value: item, label: reportTypeLabels[item] }))} getOptionLabel={(opt) => opt.label} getOptionValue={(opt) => opt.value} value={type} onChange={(v) => setType(v)} />
        <button className="btn btn-outline-dark" type="button" onClick={() => downloadReport('xlsx')}><FiDownload /> XLSX</button>
        <button className="btn btn-outline-dark" type="button" onClick={() => downloadReport('pdf')}><FiDownload /> PDF</button>
      </div>
      <section className="report-preview">
        <div className="report-summary">
          <h2>{data.title || reportTypeLabels[type]}</h2>
          <span>{rows.length} ligne{rows.length > 1 ? 's' : ''}</span>
        </div>
        {columns.length > 0 ? <DataTable rows={rows.slice(0, 100)} columns={columns} /> : <div className="empty-cell">Aucun enregistrement</div>}
      </section>
    </>
  );
}

function QRCodes() {
  const { data, reload } = useFetch('/api/qr');
  const references = data.references || [];
  const designs = data.designs || [];
  const regenerate = async (item) => {
    const group = item.type === 'design' ? 'designs' : 'references';
    await api.post(`/api/qr/${group}/${item.id}/regenerate`);
    await reload();
  };
  const cards = [...references, ...designs];

  return (
    <>
      <PageHeader title="Codes QR" onReload={reload} />
      <div className="qr-grid">
        {cards.map((item) => (
          <section className="qr-card" key={`${item.type}-${item.id}`}>
            {item.qrCodeUrl ? <img src={item.qrCodeUrl} alt={item.name} /> : <QRCodeCanvas value={`${location.origin}${item.publicPath}`} />}
            <span className="qr-type">{item.type === 'design' ? 'QR design' : 'QR référence'}</span>
            <h2>{item.name}</h2>
            {item.reference && <p>{item.reference.name}</p>}
            <p>{meters(item.totalMeters)}</p>
            <Link to={item.publicPath}>{item.publicPath}</Link>
            <button className="btn btn-sm btn-outline-dark" type="button" onClick={() => regenerate(item)}>Régénérer</button>
          </section>
        ))}
      </div>
    </>
  );
}

function StockPublicPage({ type }) {
  const { slug, id } = useParams();
  const path = type === 'design' ? `/api/design/${id}` : `/api/reference/${slug}`;
  const { data, loading, error, reload } = useFetch(path, [path]);
  const isDesign = type === 'design';
  const total = isDesign ? data.totalMeters : data.designs?.reduce((sum, design) => sum + Number(design.totalMeters || 0), 0);
  const overallStatus = total > 50 ? 'DISPONIBLE' : total > 0 ? 'STOCK_LIMITED' : 'INDISPONIBLE';

  if (loading) return <main className="public-page"><div className="loading">Chargement...</div></main>;
  if (error) return <main className="public-page"><div className="alert alert-danger">{error}</div></main>;

  const designs = isDesign ? [data] : data.designs;

  return (
    <main className="public-page">
      <div className="public-header">
        <div>
          <span className="public-brand">Stock rideaux</span>
          <h1>{isDesign ? data.name : data.name}</h1>
          {isDesign && <p>{data.reference?.name}</p>}
        </div>
        <button className="icon-button light" type="button" onClick={reload} title="Actualiser"><FiRefreshCw /></button>
      </div>
      <div className="public-summary">
        <Badge status={overallStatus} />
      </div>
      {designs.map((design) => (
        <section className="public-design" key={design.id}>
          <h2>{design.name}</h2>
          <div className="color-list">
            {design.colors.map((color) => (
              <div className="public-color" key={color.id}>
                <span>{color.displayName || color.code}</span>
                <Badge status={color.status} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function ReferencePublicPage() {
  return <StockPublicPage type="reference" />;
}

function ArticlePublicPage() {
  return <StockPublicPage type="reference" />;
}

function Articles() {
  // Backward-compatible alias for the old "Références" admin page
  return <References />;
}

export default function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/auth/login" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/article/:slug" element={<ArticlePublicPage />} />
        <Route path="/reference/:slug" element={<ReferencePublicPage />} />
        <Route path="/design/:id" element={<StockPublicPage type="design" />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/references" element={<Protected><References /></Protected>} />
        <Route path="/articles" element={<Protected><Articles /></Protected>} />
        <Route path="/designs" element={<Protected><Designs /></Protected>} />
        <Route path="/colors" element={<Protected><Colors /></Protected>} />
        <Route path="/rolls" element={<Protected><Rolls /></Protected>} />
        <Route path="/customers" element={<Protected><Customers /></Protected>} />
        <Route path="/suppliers" element={<Protected><Suppliers /></Protected>} />
        <Route path="/sales" element={<Protected><Sales /></Protected>} />
        <Route path="/quotations" element={<Protected><Quotations /></Protected>} />
        <Route path="/delivery-notes" element={<Protected><DeliveryNotes /></Protected>} />
        <Route path="/invoices" element={<Protected><Invoices /></Protected>} />
        <Route path="/reports" element={<Protected><Reports /></Protected>} />
        <Route path="/qr-codes" element={<Protected><QRCodes /></Protected>} />
      </Routes>
    </Router>
  );
}