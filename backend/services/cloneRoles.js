import { isDeepStrictEqual } from 'node:util';

const denied = () => { throw Object.assign(new Error('ACCESS_DENIED'), { status: 403, code: 'ACCESS_DENIED' }); };
const hrKeys = ['employees', 'attendance', 'leaves', 'payslips', 'settings'];
const date = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const fieldsOnly = (row, fields) => Object.keys(row).every(field => fields.includes(field));
const read = () => ({ read: true, write: false });
const all = () => ({ read: true, write: true });
const append = () => ({ read: true, write: true, scope: 'collection', fields: [], create: true });
const collection = (fields, create = false, remove = false) => ({ read: true, write: true, scope: 'collection', fields, create, delete: remove });
const counter = field => ({ read: true, write: true, fields: [field] });
const define = (prefix, keys, manager, staff) => ({ prefix, keys, manager, staff });
const SYSTEMS = {
    'jaola-erp': define('jerp_', ['products', 'sales', 'expenses', 'production', 'settings'], ['owner', 'المالك'], {
        accountant: { label: 'المحاسب', rules: { products: collection(['qty']), sales: append(), expenses: collection(undefined, true, true), production: read(), settings: counter('invoiceSeq') } },
        storekeeper: { label: 'أمين المخزن', rules: { products: collection(undefined, true, true), production: append(), settings: read() } },
    }),
    'jaola-pos': define('jpos_', ['products', 'sales', 'shifts', 'settings'], ['manager', 'المدير'], {
        cashier: { label: 'الكاشير', rules: { products: read(), sales: append(), shifts: append(), settings: counter('receiptSeq') } },
    }),
    'jaola-restaurant-ops': define('jrest_', ['menu', 'orders', 'tickets', 'bills', 'settings'], ['manager', 'المدير'], {
        waiter: { label: 'النادل', rules: { menu: read(), orders: all(), tickets: collection([], true, true), bills: append(), settings: counter('billSeq') } },
        kitchen: { label: 'المطبخ', rules: { tickets: collection(['stage']), settings: read() } },
    }),
    'jaola-accounting': define('jacc_', ['accounts', 'entries', 'settings'], ['cfo', 'المدير المالي'], {
        accountant: { label: 'المحاسب', rules: { accounts: read(), entries: append(), settings: counter('entrySeq') } },
    }),
    'jaola-clinic': define('jclin_', ['patients', 'appts', 'visits', 'settings'], ['doctor', 'الطبيب'], {
        reception: { label: 'الاستقبال', rules: { patients: collection(undefined, true, true), appts: collection(undefined, true, true), settings: read() } },
        accountant: { label: 'المحاسب — قراءة مالية', rules: {
            patients: { ...read(), readFields: ['id', 'name'] }, visits: { ...read(), readFields: ['id', 'no', 'pid', 'date', 'fee'] }, settings: read(),
        } },
    }),
    'jaola-workshop': define('jwork_', ['customers', 'jobs', 'settings'], ['manager', 'المدير'], {
        tech: { label: 'الفنّي', rules: { customers: read(), jobs: collection(['stage', 'items']), settings: read() } },
        reception: { label: 'الاستقبال', rules: { customers: collection(undefined, true, true), jobs: collection(['stage'], true), settings: counter('jobSeq') } },
    }),
    'jaola-pharmacy': define('jphar_', ['meds', 'dispenses', 'settings'], ['manager', 'المدير'], {
        pharmacist: { label: 'الصيدلي', rules: { meds: collection(undefined, true, true), dispenses: append(), settings: counter('receiptSeq') } },
    }),
    'jaola-property': define('jprop_', ['units', 'contracts', 'payments', 'settings'], ['owner', 'المالك'], {
        accountant: { label: 'المحاسب', rules: { units: read(), contracts: read(), payments: append(), settings: counter('receiptSeq') } },
    }),
    'jaola-warehouse': define('jwh_', ['items', 'shipments', 'settings'], ['manager', 'مدير المستودع'], {
        operator: { label: 'مشغّل المستودع', rules: { items: collection(undefined, true, true), shipments: append(), settings: counter('shipSeq') } },
    }),
    'jaola-laundry': define('jlndry_', ['catalog', 'orders', 'settings'], ['reception', 'إدارة الاستقبال'], {
        operator: { label: 'مشغّل المغسلة', rules: { catalog: read(), orders: collection(['stage']), settings: read() } },
    }),
    'jaola-lawfirm': define('jlaw_', ['clients', 'cases', 'hearings', 'invoices', 'settings'], ['lawyer', 'المحامي'], {
        secretary: { label: 'السكرتير القانوني', rules: { clients: collection(undefined, true, true), cases: collection(['stage', 'status'], true), hearings: collection(undefined, true, true), invoices: read(), settings: { ...counter('clientSeq'), fields: ['clientSeq', 'caseSeq'] } } },
    }),
    'jaola-helpdesk': define('jhelp_', ['tickets', 'settings'], ['supervisor', 'المشرف'], {
        agent: { label: 'وكيل الدعم', rules: { tickets: collection(['stage', 'replies', 'resolvedAt'], true), settings: counter('ticketSeq') } },
    }),
    'jaola-fleet': define('jfleet_', ['vehicles', 'history', 'settings'], ['manager', 'مدير الأسطول'], {
        driver: { label: 'السائق — مركبته فقط', requiresRecord: true, rules: {
            vehicles: { ...collection(['odo', 'nextServiceOdo']), scope: 'own', ownerField: 'id' },
            history: { ...append(), scope: 'own', ownerField: 'vehicleId' }, settings: counter('maintSeq'),
        } },
    }),
    'jaola-vetclinic': define('jvet_', ['owners', 'pets', 'visits', 'settings'], ['vet', 'الطبيب البيطري'], {
        reception: { label: 'الاستقبال', rules: { owners: collection(undefined, true, true), pets: collection(undefined, true, true),
            visits: { ...read(), readFields: ['id', 'no', 'petId', 'fee', 'createdAt'] }, settings: counter('ownerSeq') } },
    }),
    'jaola-vetclinic-react': define('jvetr_', ['owners', 'pets', 'visits', 'settings'], ['vet', 'الطبيب البيطري'], {
        reception: { label: 'الاستقبال', rules: { owners: collection(undefined, true, true), pets: collection(undefined, true, true),
            visits: { ...read(), readFields: ['id', 'no', 'petId', 'fee', 'createdAt'] }, settings: counter('ownerSeq') } },
    }),
    'jaola-crypto-advisor': define('jcrypto_', ['settings', 'watchlist', 'timeframe', 'lang'], ['owner', 'مشغّل الحساب'], {}),
    'jaola-budget-advisor': define('jbudget_', ['settings', 'transactions', 'budgets', 'period', 'lang'], ['owner', 'مشغّل الحساب'], {}),
    'jaola-stock-advisor': define('jstock_', ['settings', 'watchlist', 'timeframe', 'lang'], ['owner', 'مشغّل الحساب'], {}),
};
const API_FAMILIES = { 'jaola-crypto-advisor': ['/api/public/crypto/'],
    'jaola-budget-advisor': ['/api/public/budget/', '/api/public/collections/'], 'jaola-stock-advisor': ['/api/public/stock/'] };
const HIDDEN_ACTIONS = {
    'jaola-erp': { accountant: ['addProduct', 'delProduct', 'addProduction'], storekeeper: ['saveSale', 'addExpense', 'delExpense'] },
    'jaola-pos': { cashier: ['addProduct', 'delProduct'] },
    'jaola-restaurant-ops': { waiter: ['addMenuItem', 'delMenuItem'], kitchen: ['addMenuItem', 'delMenuItem', 'openTable', 'closeTable', 'sendKitchen', 'addLine', 'incLine', 'decLine'] },
    'jaola-accounting': { accountant: ['addAccount', 'delAccount'] },
    'jaola-clinic': { reception: ['saveVisit', 'printVisit'], accountant: ['addPatient', 'delPatient', 'addAppt', 'delAppt', 'saveVisit', 'printVisit'] },
    'jaola-workshop': { tech: ['addCustomer', 'delCustomer', 'openJob'], reception: ['addJobItem', 'delJobItem'] },
    'jaola-property': { accountant: ['addTenant', 'addUnit', 'delUnit', 'endContract'] },
    'jaola-laundry': { operator: ['addGarment', 'addOrderLine', 'delOrderLine', 'submitOrder'] },
    'jaola-lawfirm': { secretary: ['openInvoiceForm', 'saveInvoice'] },
    'jaola-fleet': { driver: ['addVehicle'] },
    'jaola-vetclinic': { reception: ['openVisitForm', 'saveVisit'] },
};

// UI guidance mirrors the server grants; it is never used as authorization.
function memberUi(cloneId, role) {
    return { hiddenActions: ['saveSettings', ...(HIDDEN_ACTIONS[cloneId]?.[role] || [])], hiddenViews: ['settings'] };
}

export function cloneRoleBinding(cloneId) {
    if (cloneId === 'jaola-hr') return { key: 'jhr_employees', labelField: 'name' };
    if (cloneId === 'jaola-fleet') return { key: 'jfleet_vehicles', labelField: 'plate' };
    return null;
}

/** Explicit server policy registry. Unsupported clone/role combinations fail closed. */
export function cloneRoleOptions(cloneId) {
    const system = Object.hasOwn(SYSTEMS, cloneId) ? SYSTEMS[cloneId] : null;
    if (system) return [{ id: system.manager[0], label: system.manager[1], requiresRecord: false },
        ...Object.entries(system.staff).map(([id, role]) => ({ id, label: role.label, requiresRecord: !!role.requiresRecord }))];
    if (cloneId !== 'jaola-hr') return [];
    return [
        { id: 'manager', label: 'مدير الموارد البشرية', requiresRecord: false },
        { id: 'employee', label: 'موظف — سجلاته فقط', requiresRecord: true },
    ];
}
export function resolveCloneRole(cloneId, role, recordId = '') {
    const system = Object.hasOwn(SYSTEMS, cloneId) ? SYSTEMS[cloneId] : null;
    if (system) {
        if (role === system.manager[0]) return { uiRole: role, apiFamilies: API_FAMILIES[cloneId] || [], rules: Object.fromEntries(system.keys.map(key => [system.prefix + key, all()])) };
        const policy = Object.hasOwn(system.staff, role) ? system.staff[role] : null;
        return policy && (!policy.requiresRecord || recordId) ? { uiRole: role, ui: memberUi(cloneId, role), rules: Object.fromEntries(Object.entries(policy.rules).map(([key, rule]) => [system.prefix + key, rule])) } : null;
    }
    if (cloneId !== 'jaola-hr') return null;
    if (role === 'manager') return { uiRole: 'manager', rules: Object.fromEntries(hrKeys.map(key => ['jhr_' + key, { read: true, write: true }])) };
    if (role !== 'employee' || !recordId) return null;
    return { uiRole: 'employee', rules: {
        jhr_settings: { read: true, write: false },
        jhr_employees: { read: true, write: false, scope: 'own', ownerField: 'id' },
        jhr_payslips: { read: true, write: false, scope: 'own', ownerField: 'eid' },
        jhr_attendance: { read: true, write: true, scope: 'own', ownerField: 'eid', fields: ['out'], create: true, validate(row) {
            const time = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '');
            if (!fieldsOnly(row, ['id', 'eid', 'date', 'in', 'out']) || !date(row.date) || !time(row.in) || (row.out && !time(row.out))) denied();
        } },
        jhr_leaves: { read: true, write: true, scope: 'own', ownerField: 'eid', fields: ['from', 'to', 'reason'], create: true, validate(row, previous) {
            if (previous && isDeepStrictEqual(row, previous)) return;
            if (!fieldsOnly(row, ['id', 'eid', 'from', 'to', 'reason', 'status']) || row.status !== 'pending' || (previous && previous.status !== 'pending')
                || !date(row.from) || !date(row.to)
                || row.to < row.from || typeof row.reason !== 'string' || row.reason.length > 2000) denied();
        } },
    } };
}
