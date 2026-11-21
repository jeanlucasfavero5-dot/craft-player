-- Craft Player — expansão do Supabase (NÃO altera public.carteira_diamantes)
-- Pré-requisito: carteira_diamantes.id_jogador é PRIMARY KEY (como no seu print).

-- 1) Progresso / configurações por jogador (1 linha por jogador)
create table if not exists public.craft_progresso (
  id_jogador   text primary key references public.carteira_diamantes(id_jogador) on delete cascade,
  config       jsonb not null default '{"qualidade":"auto","sensibilidade":1.0,"invertY":false,"volumeGeral":0.8,"volumeMusica":0.6,"volumeEfeitos":0.8,"controleTouch":"joystick"}'::jsonb,
  offline_save jsonb,                          -- snapshot do modo offline (sincronização)
  ultimo_modo  text check (ultimo_modo in ('offline','mapa_aberto','sala')),
  tempo_jogado_s bigint not null default 0,
  criado_em    timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2) Catálogo de itens/skins (vendidos com diamantes)
create table if not exists public.craft_catalogo (
  item_id         text primary key,
  nome            text not null,
  tipo            text not null check (tipo in ('skin','ferramenta','cosmetico','pacote','outro')),
  preco_diamantes integer not null check (preco_diamantes >= 0),
  raridade        text not null default 'comum',
  ativo           boolean not null default true,
  meta            jsonb not null default '{}'::jsonb
);

-- 3) Itens adquiridos (inventário permanente de compras)
create table if not exists public.craft_itens_adquiridos (
  id           bigserial primary key,
  id_jogador   text not null references public.carteira_diamantes(id_jogador) on delete cascade,
  item_id      text not null references public.craft_catalogo(item_id),
  preco_pago   integer not null,
  adquirido_em timestamptz not null default now(),
  unique (id_jogador, item_id)
);
create index if not exists idx_craft_itens_jogador on public.craft_itens_adquiridos(id_jogador);

-- 4) Salas online personalizadas (persistência leve; estado em tempo real fica no Node)
create table if not exists public.craft_salas (
  codigo        text primary key,              -- ex.: 'K7QX2M'
  nome          text not null,
  id_dono       text not null references public.carteira_diamantes(id_jogador) on delete cascade,
  publica       boolean not null default false,
  max_jogadores smallint not null default 8 check (max_jogadores between 2 and 32),
  seed          bigint not null default (floor(random()*2147483647))::bigint,
  config        jsonb not null default '{}'::jsonb,
  criada_em     timestamptz not null default now()
);

-- 5) Mundos persistentes (Mapa Aberto = 1 linha; salas podem salvar também) — usado a partir da Fase 2
create table if not exists public.craft_mundos (
  id         text primary key,                 -- 'mapa_aberto' ou código da sala
  seed       bigint not null,
  edits      jsonb not null default '[]'::jsonb, -- blocos/estruturas alterados
  updated_at timestamptz not null default now()
);
insert into public.craft_mundos (id, seed)
values ('mapa_aberto', 20261119) on conflict do nothing;

-- 6) Compra atômica (debita diamantes + registra item numa transação)
create or replace function public.craft_comprar_item(p_id_jogador text, p_item_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preco integer;
  v_saldo integer;
begin
  select preco_diamantes into v_preco from craft_catalogo where item_id = p_item_id and ativo;
  if v_preco is null then raise exception 'item_indisponivel'; end if;

  if exists (select 1 from craft_itens_adquiridos where id_jogador = p_id_jogador and item_id = p_item_id) then
    raise exception 'item_ja_adquirido';
  end if;

  update carteira_diamantes
     set diamantes = diamantes - v_preco, updated_at = now()
   where id_jogador = p_id_jogador and diamantes >= v_preco
   returning diamantes into v_saldo;
  if v_saldo is null then raise exception 'saldo_insuficiente'; end if;

  insert into craft_itens_adquiridos (id_jogador, item_id, preco_pago) values (p_id_jogador, p_item_id, v_preco);
  return v_saldo;
end $$;
revoke all on function public.craft_comprar_item(text, text) from public, anon, authenticated;

-- 7) Segurança: RLS ligado e SEM policies para anon/authenticated.
-- Só o servidor Node (service_role, via variável de ambiente no Render) acessa estas tabelas.
alter table public.craft_progresso        enable row level security;
alter table public.craft_catalogo         enable row level security;
alter table public.craft_itens_adquiridos enable row level security;
alter table public.craft_salas            enable row level security;
alter table public.craft_mundos           enable row level security;

-- 8) Seeds de exemplo
insert into public.craft_catalogo (item_id, nome, tipo, preco_diamantes, raridade) values
  ('skin_explorador', 'Explorador', 'skin', 500, 'comum'),
  ('skin_minerador',  'Minerador Veterano', 'skin', 1500, 'raro'),
  ('pic_ferro_polido','Picareta de Ferro Polido', 'ferramenta', 800, 'raro')
on conflict do nothing;
