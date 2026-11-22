-- Craft Player — Fase 2: colunas de progresso (rode DEPOIS do 001; não altera carteira_diamantes)
alter table public.craft_progresso
  add column if not exists inventario jsonb not null default '{}'::jsonb,                          -- {"tronco":12,"pedra":5,...}
  add column if not exists hotbar     jsonb not null default '[null,null,null,null,null,null,null,null]'::jsonb,
  add column if not exists posicao    jsonb,                                                       -- {"x":0,"y":3,"z":0,"yaw":0,"seed":20261119}
  add column if not exists stats      jsonb not null default '{"vida":100,"energia":100}'::jsonb;

-- craft_progresso.offline_save passa a guardar o mundo offline:
--   {"destruidos":{"t12":1763700000000,...},"estruturas":[{"id":"l1","tipo":"fundacao","x":..,"y":..,"z":..,"ry":..}]}
-- craft_mundos.edits guarda o mundo online (Mapa Aberto = id 'mapa_aberto'; salas = código da sala):
--   {"destruidos":{"t12":<epoch_ms de respawn>},"estruturas":[...],"proxId":42}

-- Garante que craft_mundos não tenha acesso público (service_role no servidor Node continua funcionando)
alter table public.craft_mundos enable row level security;
