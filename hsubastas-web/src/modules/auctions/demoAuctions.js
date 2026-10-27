// Datos ilustrativos locales: nunca se escriben en Supabase.
const future = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
export const demoAuctions = [
  { id: 'demo-1', title: '10 computadoras para oficina', description: 'Equipos de escritorio con 16 GB de RAM, SSD de 512 GB y monitor. Incluir garantía y entrega en oficina.', category: 'Tecnología', city: 'La Paz', max_budget: 45000, ends_at: future(48), status: 'active' },
  { id: 'demo-2', title: 'Materiales para una nueva obra', description: 'Provisión de 100 bolsas de cemento de 50 kg. El presupuesto debe incluir transporte hasta la obra.', category: 'Construcción', city: 'Santa Cruz', max_budget: 6500, ends_at: future(24), status: 'active' },
  { id: 'demo-3', title: 'Limpieza integral de oficinas', description: 'Servicio de limpieza para oficinas de 250 m² durante un mes. Incluir materiales y cronograma de trabajo.', category: 'Servicios', city: 'Cochabamba', max_budget: 3800, ends_at: future(72), status: 'active' },
];
