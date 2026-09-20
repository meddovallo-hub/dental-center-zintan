
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin','medical_affairs','reception')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  specialty VARCHAR(120) NOT NULL DEFAULT 'طبيب أسنان',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  UNIQUE(doctor_id, weekday, start_time)
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number VARCHAR(30) UNIQUE NOT NULL,
  patient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  service_id UUID REFERENCES services(id),
  doctor_id UUID REFERENCES doctors(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','confirmed','completed','cancelled')),
  notes VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- يمنع حجز نفس الطبيب في نفس التاريخ والوقت.
CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_slot
ON bookings(doctor_id, appointment_date, appointment_time)
WHERE status IN ('new','confirmed');

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS statistics (
  year INT PRIMARY KEY,
  root_canal INT NOT NULL DEFAULT 0,
  conservative INT NOT NULL DEFAULT 0,
  gum INT NOT NULL DEFAULT 0,
  extraction INT NOT NULL DEFAULT 0,
  opg INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(appointment_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
