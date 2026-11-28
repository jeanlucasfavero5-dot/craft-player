-- Craft Player — Fase 4 (rode depois do 001, 002 e 003). Não altera public.carteira_diamantes.
-- Baús e Totens ficam dentro de craft_mundos.edits (jsonb) — não precisam de tabela nova.
-- Mochilas de morte ficam só na memória da sala (expiram em 5 min).
alter table public.craft_progresso
  add column if not exists conquistas   jsonb not null default '[]'::jsonb,   -- ["primeira_fogueira","cacador",...]
  add column if not exists estatisticas jsonb not null default '{}'::jsonb;   -- {"kills":0,"mortes":0,"tempo_s":0,"construcoes":0}
