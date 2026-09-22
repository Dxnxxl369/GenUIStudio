-- Definición de la tabla: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT,
  code TEXT,
  category TEXT,
  contactName TEXT,
  email TEXT,
  phone TEXT,
  rating DECIMAL,
  status TEXT,
  leadTimeDays INTEGER,
  paymentTerm TEXT,
  totalSpent INTEGER,
  activeOrders INTEGER,
  country TEXT,
  avatarUrl TEXT,
  notes TEXT
);

-- Datos iniciales para suppliers
INSERT INTO suppliers (id, name, code, category, contactName, email, phone, rating, status, leadTimeDays, paymentTerm, totalSpent, activeOrders, country, avatarUrl, notes) VALUES ('sup-1', 'TechSolutions Global S.A.', 'SUP-TECH-001', 'Tecnología', 'Alejandro Mendoza', 'a.mendoza@techsolutions.com', '+34 912 345 678', 4.8, 'Preferente', 5, '30 días', 145000, 3, 'España', 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150', 'Proveedor estratégico para infraestructura de servidores y portátiles corporativos.');
INSERT INTO suppliers (id, name, code, category, contactName, email, phone, rating, status, leadTimeDays, paymentTerm, totalSpent, activeOrders, country, avatarUrl, notes) VALUES ('sup-2', 'Logística Ibérica Express', 'SUP-LOG-002', 'Logística', 'Carmen Santamaría', 'csantamaria@ibericaexpress.es', '+34 933 445 566', 4.2, 'Activo', 2, '15 días', 89000, 1, 'España', 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150', 'Gestión de última milla y envíos nacionales urgentes.');
INSERT INTO suppliers (id, name, code, category, contactName, email, phone, rating, status, leadTimeDays, paymentTerm, totalSpent, activeOrders, country, avatarUrl, notes) VALUES ('sup-3', 'EcoPack & Sustentabilidad', 'SUP-PKG-003', 'Embalaje', 'Marc Dubois', 'm.dubois@ecopack.fr', '+33 1 42 68 55 00', 4.6, 'Activo', 10, '45 días', 45200, 2, 'Francia', 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150', 'Cajas de cartón reciclado y cintas biodegradables.');
INSERT INTO suppliers (id, name, code, category, contactName, email, phone, rating, status, leadTimeDays, paymentTerm, totalSpent, activeOrders, country, avatarUrl, notes) VALUES ('sup-4', 'Metalúrgica del Norte', 'SUP-RAW-004', 'Materia Prima', 'Javier Echeverría', 'jecheverria@metalnorte.com', '+34 944 112 233', 3.9, 'En Revisión', 15, '30 días', 210000, 0, 'España', 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150', 'Suministro de perfiles de aluminio y acero estructural.');
INSERT INTO suppliers (id, name, code, category, contactName, email, phone, rating, status, leadTimeDays, paymentTerm, totalSpent, activeOrders, country, avatarUrl, notes) VALUES ('sup-5', 'CloudScale Data Services', 'SUP-SRV-005', 'Servicios', 'Sarah Jenkins', 'sjenkins@cloudscale.io', '+1 415 889 0021', 4.9, 'Preferente', 1, 'Contado', 78500, 1, 'Estados Unidos', 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=150', 'Licenciamiento enterprise cloud y ciberseguridad.');
INSERT INTO suppliers (id, name, code, category, contactName, email, phone, rating, status, leadTimeDays, paymentTerm, totalSpent, activeOrders, country, avatarUrl, notes) VALUES ('sup-6', 'Químicos Industriales Levante', 'SUP-RAW-006', 'Materia Prima', 'Dolores Fuertes', 'dfuertes@qlevante.es', '+34 963 778 899', 3.5, 'Suspendido', 12, '30 días', 34000, 0, 'España', 'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=150', 'Retrasos recurrentes en entregas durante el Q3.');
INSERT INTO suppliers (id, name, code, category, contactName, email, phone, rating, status, leadTimeDays, paymentTerm, totalSpent, activeOrders, country, avatarUrl, notes) VALUES ('sup-7', 'Precision Instruments AG', 'SUP-TECH-007', 'Tecnología', 'Hans Gruber', 'h.gruber@precision.ch', '+41 44 211 44 55', 4.7, 'Activo', 7, '60 días', 125000, 2, 'Suiza', 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=150', 'Sensores de alta precisión para cadena de montaje.');
