-- Habilitar la extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Restaurants
CREATE TABLE public.restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    logo TEXT,
    colores JSONB, -- Ej: {"primary": "#1F2937", "background": "#F3F4F6"}
    grupo_id UUID, -- Agrupación para cross-selling
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tables
CREATE TABLE public.tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    capacidad INTEGER NOT NULL CHECK (capacidad > 0),
    zona TEXT NOT NULL,
    orden_prioridad INTEGER DEFAULT 0, -- Orden de ocupación preferente
    coordenadas_plano JSONB, -- Ej: {"x": 100, "y": 200, "w": 50, "h": 50}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Clients
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT,
    etiquetas_crm JSONB, -- Ej: ["VIP", "Alergia Gluten", "Mesa Ventana"]
    valoracion_interna INTEGER DEFAULT 5 CHECK (valoracion_interna >= 1 AND valoracion_interna <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bookings
CREATE TYPE booking_status AS ENUM ('pendiente', 'reconfirmada', 'cancelada', 'completada');
CREATE TYPE booking_origin AS ENUM ('web', 'telefono', 'ia', 'cover_channels');

CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id),
    table_id UUID REFERENCES public.tables(id),
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    comensales INTEGER NOT NULL CHECK (comensales > 0),
    estado booking_status DEFAULT 'pendiente',
    origen booking_origin DEFAULT 'web',
    politica_cancelacion_id UUID, -- Referencia a la regla de retención Stripe si la hay
    notas_cliente TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Waitlist
CREATE TABLE public.waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id),
    fecha DATE NOT NULL,
    comensales INTEGER NOT NULL CHECK (comensales > 0),
    flexibilidad_horaria JSONB, -- Ej: {"start": "20:00", "end": "22:00"}
    estado TEXT DEFAULT 'esperando',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Pricing Rules (Dinámico)
CREATE TABLE public.pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    dias_semana JSONB, -- Ej: [5, 6] (Viernes, Sábado)
    modificador_precio DECIMAL(5,2), -- Ej: 1.20 para +20%
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Rooms (Salas)
CREATE TABLE public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    capacidad_maxima INTEGER,
    layout_config JSONB DEFAULT '{}'::jsonb, -- Konva tables state
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Business Settings
CREATE TABLE public.business_settings (
    restaurant_id UUID PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    configuracion_formulario JSONB DEFAULT '{"pedir_dni": false, "pedir_alergias": true}'::jsonb,
    horarios_apertura JSONB DEFAULT '{}'::jsonb,
    plantillas_email JSONB DEFAULT '{}'::jsonb,
    dias_especiales JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) - Basic Policies Setup
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Nota: En un entorno de producción, las políticas RLS se ajustarían 
-- para permitir lecturas a clientes (anon o authenticated) y escrituras a admin.

-- ==========================================
-- 9. Shifts & Overrides (Dynamic Capacity)
-- ==========================================
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., 'Comida', 'Cena'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    default_capacity INTEGER NOT NULL DEFAULT 50,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;

CREATE TABLE public.shift_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    capacity_override INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shift_id, date)
);
ALTER TABLE public.shift_overrides DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 10. RPC: Check Overlapping Availability
-- ==========================================
CREATE OR REPLACE FUNCTION check_availability(
    p_restaurant_id UUID, 
    p_fecha DATE, 
    p_hora TIME, 
    p_pax INTEGER,
    p_duration_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_shift RECORD;
    v_capacity INTEGER;
    v_end_time TIME;
    v_overlapping_pax INTEGER;
BEGIN
    -- 1. Encontrar el turno activo para la hora solicitada
    SELECT * INTO v_shift
    FROM public.shifts
    WHERE restaurant_id = p_restaurant_id
      AND start_time <= p_hora
      AND end_time > p_hora
    LIMIT 1;

    -- Si no hay turno configurado, no hay disponibilidad
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Calcular la capacidad real (priorizar override sobre default)
    SELECT capacity_override INTO v_capacity
    FROM public.shift_overrides
    WHERE shift_id = v_shift.id AND date = p_fecha;

    IF v_capacity IS NULL THEN
        v_capacity := v_shift.default_capacity;
    END IF;

    -- 3. Calcular solapamiento
    -- Fin de la nueva reserva
    v_end_time := p_hora + (p_duration_minutes || ' minutes')::INTERVAL;

    -- Sumar todas las reservas existentes que solapan con [p_hora, v_end_time]
    SELECT COALESCE(SUM(comensales), 0) INTO v_overlapping_pax
    FROM public.bookings
    WHERE restaurant_id = p_restaurant_id
      AND fecha = p_fecha
      AND estado != 'cancelada'
      AND hora < v_end_time
      AND COALESCE(end_time, hora + (v_shift.duration_minutes || ' minutes')::INTERVAL) > p_hora;

    -- 4. Devolver si hay plazas suficientes
    RETURN (v_capacity - v_overlapping_pax) >= p_pax;
END;
$$ LANGUAGE plpgsql;
