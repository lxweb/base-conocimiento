CREATE TABLE IF NOT EXISTS materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE IF NOT EXISTS ramas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_id uuid NOT NULL REFERENCES materias (id),
  name text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE IF NOT EXISTS temas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rama_id uuid NOT NULL REFERENCES ramas (id),
  name text NOT NULL,
  position integer NOT NULL,
  priority text NOT NULL CHECK (priority IN ('normal', 'alta', 'maxima')),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0)
);

CREATE TABLE IF NOT EXISTS conocimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tema_id uuid NOT NULL REFERENCES temas (id),
  title text NOT NULL,
  explanation text NOT NULL,
  example text,
  link text,
  position integer NOT NULL,
  archived_at timestamptz,
  consecutive_full_successes integer NOT NULL DEFAULT 0,
  base_interval_days integer NOT NULL DEFAULT 0,
  due_on date,
  had_full_success boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conocimiento_id uuid NOT NULL REFERENCES conocimientos (id),
  type text NOT NULL CHECK (type IN ('boolean', 'multiple_choice', 'written')),
  prompt text NOT NULL,
  correct boolean,
  expected_answer text,
  last_asked_on date
);

CREATE TABLE IF NOT EXISTS opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta_id uuid NOT NULL REFERENCES preguntas (id) ON DELETE CASCADE,
  text text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('falsa', 'verdadera', 'completa')),
  position integer NOT NULL
);

CREATE TABLE IF NOT EXISTS relaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL REFERENCES conocimientos (id),
  to_id uuid NOT NULL REFERENCES conocimientos (id),
  type text NOT NULL CHECK (type IN ('prerrequisito', 'profundiza', 'ejemplo', 'contradice')),
  CHECK (from_id <> to_id),
  UNIQUE (from_id, to_id)
);

CREATE TABLE IF NOT EXISTS medios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conocimiento_id uuid NOT NULL REFERENCES conocimientos (id),
  kind text NOT NULL CHECK (kind IN ('image', 'video')),
  stored_name text NOT NULL,
  bytes bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_date date NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sesion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id uuid NOT NULL REFERENCES sesiones (id),
  position integer NOT NULL,
  conocimiento_id uuid NOT NULL REFERENCES conocimientos (id),
  snapshot jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_item_id uuid NOT NULL REFERENCES sesion_items (id),
  outcome text NOT NULL CHECK (outcome IN ('pleno', 'parcial', 'error')),
  answered_at timestamptz NOT NULL,
  applied_at timestamptz
);
