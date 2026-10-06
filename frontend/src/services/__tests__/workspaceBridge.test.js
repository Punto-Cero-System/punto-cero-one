/**
 * Puente de datos One → Core Legal OS.
 * Verifica transporte (URL, pcl_token, errores) y normalización de contratos.
 */
import {
  snakeToCamel, camelizeKeys, toList, humanDate,
  adaptKpis, adaptClients, adaptCases, adaptAppointments,
  adaptDocuments, adaptInvoices, adaptMessages, adaptDarwin,
} from '../coreLegalAdapter';
import {
  getBridgeToken, getClients, getCases, getAppointments,
  getWorkspaceDashboard, getWorkspaceSnapshot, BRIDGE_BASE, BridgeError,
} from '../workspaceBridge';

describe('adaptador de datos — Core Legal → One', () => {
  it('convierte snake_case y `_id` de forma estable', () => {
    expect(snakeToCamel('client_name')).toBe('clientName');
    expect(snakeToCamel('case_number')).toBe('caseNumber');
    expect(snakeToCamel('_id')).toBe('id');
    expect(snakeToCamel('name')).toBe('name'); // ya limpio, no se inventa
  });

  it('camelizeKeys recorre objetos y arrays sin perder datos', () => {
    const out = camelizeKeys({ a_b: [{ c_d: 1 }], keep: 'sí' });
    expect(out.aB[0].cD).toBe(1);
    expect(out.keep).toBe('sí');
  });

  it.each([
    [[1, 2], 2],
    [{ items: [1] }, 1],
    [{ data: [1, 2, 3] }, 3],
    [{ threads: [1] }, 1],
    [null, 0],
    [undefined, 0],
    [{}, 0],
  ])('toList normaliza el envoltorio %p', (payload, expected) => {
    expect(toList(payload)).toHaveLength(expected);
  });

  it('humanDate nunca lanza con basura', () => {
    expect(humanDate(null)).toBe('—');
    expect(humanDate('no-es-fecha')).toBe('no-es-fecha');
    expect(humanDate('2026-08-30T09:00:00')).toContain('2026');
  });

  it('adapta las entidades reales del Core Legal', () => {
    expect(adaptKpis({ total_cases: 1, active_cases: 1 })).toEqual({ totalCases: 1, activeCases: 1 });

    const [client] = adaptClients([{ _id: 'x1', name: 'Juan', cases: 2, registerDate: '2026-09-03' }]);
    expect(client).toMatchObject({ id: 'x1', name: 'Juan', cases: 2 });

    const [kase] = adaptCases([{ _id: 'k1', case_number: 'CAS-1', client_name: 'Juan', status: 'active' }]);
    expect(kase).toMatchObject({ id: 'k1', caseNumber: 'CAS-1', clientName: 'Juan', status: 'active' });

    const [appt] = adaptAppointments([{ _id: 'a1', title: 'Audiencia', date: '2026-08-30', time: '09:00' }]);
    expect(appt).toMatchObject({ id: 'a1', title: 'Audiencia', time: '09:00' });

    expect(adaptDocuments(null)).toEqual([]);
    expect(adaptInvoices([{ _id: 'f1', amount: 100 }])[0]).toMatchObject({ id: 'f1', amount: 100, currency: 'COP' });
    expect(adaptMessages({ threads: [{ _id: 't1', unread: 2 }] })[0]).toMatchObject({ id: 't1', unread: true });
  });

  it('adaptDarwin lee el estado real del Core Legal', () => {
    const d = adaptDarwin({ status: 'operational', activity: [{ action: 'professional.agenda', executed_at: '2026-09-24' }] });
    expect(d.operational).toBe(true);
    expect(d.activities).toBe(1);
    expect(d.lastAction).toBe('professional.agenda');
  });
});

describe('puente de datos — transporte hacia :8001', () => {
  const json = (body, ok = true, status = 200) => Promise.resolve({
    ok, status, json: () => Promise.resolve(body),
  });

  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  it('apunta al Core Legal y NUNCA al backend propio de One', () => {
    expect(BRIDGE_BASE).toBe('http://127.0.0.1:8001/api');
    expect(BRIDGE_BASE).not.toContain(':8000');
  });

  it('lee el pcl_token existente y no crea autenticación nueva', async () => {
    localStorage.setItem('pcl_token', 'jwt-de-prueba');
    expect(getBridgeToken()).toBe('jwt-de-prueba');

    global.fetch.mockReturnValue(json([]));
    await getClients();

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8001/api/clients/');
    expect(opts.headers.Authorization).toBe('Bearer jwt-de-prueba');
  });

  it('sin token no rompe: simplemente no envía Authorization', async () => {
    global.fetch.mockReturnValue(json([]));
    await getClients();
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it.each([
    ['/dashboard/kpis', getWorkspaceDashboard],
    ['/clients/', getClients],
    ['/cases/', getCases],
    ['/appointments/', getAppointments],
  ])('cada módulo llama a su endpoint del Core Legal (%s)', async (path, fn) => {
    global.fetch.mockReturnValue(json([]));
    await fn();
    expect(global.fetch.mock.calls[0][0]).toBe(`http://127.0.0.1:8001/api${path}`);
  });

  it.each([
    [401, 'Sesión'],
    [403, 'permiso'],
    [404, 'no disponible'],
  ])('traduce HTTP %i a un mensaje utilizable', async (status, expected) => {
    global.fetch.mockReturnValue(json({ detail: null }, false, status));
    await expect(getCases()).rejects.toThrow(expected);
    await expect(getCases()).rejects.toBeInstanceOf(BridgeError);
  });

  it('sin red no lanza TypeError, lanza BridgeError', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getCases()).rejects.toBeInstanceOf(BridgeError);
  });

  it('el snapshot sobrevive a un módulo caído (Promise.allSettled)', async () => {
    global.fetch.mockImplementation((url) => (
      String(url).includes('/clients/')
        ? Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) })
        : json([{ _id: 'k1', case_number: 'CAS-1' }])
    ));

    const snap = await getWorkspaceSnapshot();
    expect(snap.cases.data[0].caseNumber).toBe('CAS-1');
    expect(snap.clients.error).toMatch(/permiso/);
    expect(snap.cases.error).toBeNull();
  });
});
