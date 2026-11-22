-- Craft Player — Fase 3 (rode DEPOIS de sql/001 e sql/002). Não altera public.carteira_diamantes.
-- Observação: a tabela de compras criada na Fase 1 se chama craft_itens_adquiridos (com "itens").

-- 1) Cosméticos equipados por jogador: {"skin":"skin_sombra","ferramenta":"ferr_ouro","efeito":"efeito_brasas"}
alter table public.craft_progresso
  add column if not exists equipados jsonb not null default '{}'::jsonb;

-- 2) O backend (service_role) chama a compra atômica via RPC: debita diamantes + registra o item
grant execute on function public.craft_comprar_item(text, text) to service_role;

-- 3) Catálogo inicial (tipo: skin = personagem | ferramenta = skin de ferramenta | cosmetico = efeito visual)
--    meta guarda as cores/efeitos que o jogo aplica (e que os outros jogadores veem no multiplayer).
insert into public.craft_catalogo (item_id, nome, tipo, preco_diamantes, raridade, ativo, meta) values
  -- Skins de personagem
  ('skin_explorador', 'Explorador',          'skin', 500,  'comum',    true, '{"corpo":"#7a5a2a","calca":"#3b3b2b","pele":"#d9a779","chapeu":"#a07a3a"}'),
  ('skin_cacador',    'Caçador da Mata',     'skin', 1200, 'incomum',  true, '{"corpo":"#2f5a3a","calca":"#3a2a1a","pele":"#e0b48c","chapeu":"#254a30"}'),
  ('skin_minerador',  'Minerador Veterano',  'skin', 1500, 'raro',     true, '{"corpo":"#d6a02a","calca":"#4a4a4a","pele":"#c99669","chapeu":"#e8c14a"}'),
  ('skin_sombra',     'Sombra Noturna',      'skin', 3000, 'epico',    true, '{"corpo":"#1c1c28","calca":"#101018","pele":"#b8a0c8"}'),
  ('skin_lendario',   'Rei do Hub',          'skin', 6000, 'lendario', true, '{"corpo":"#e0b020","calca":"#7a1e1e","pele":"#f0c8a0","chapeu":"#ffd84a"}'),
  -- Skins de ferramentas (aplicadas em machados, picaretas e espadas)
  ('pic_ferro_polido','Ferramentas Polidas', 'ferramenta', 800,  'incomum', true, '{"cabeca":"#c9d2dc","cabo":"#8a5a33","brilho":false}'),
  ('ferr_ouro',       'Ferramentas Douradas','ferramenta', 1800, 'raro',    true, '{"cabeca":"#ffd24a","cabo":"#6b4423","brilho":true}'),
  ('ferr_gelo',       'Ferramentas de Gelo', 'ferramenta', 2000, 'raro',    true, '{"cabeca":"#8fe6ff","cabo":"#bcd6e0","brilho":true}'),
  ('ferr_carmesim',   'Ferramentas Carmesim','ferramenta', 2200, 'epico',   true, '{"cabeca":"#e0383e","cabo":"#2a1a1a","brilho":true}'),
  ('ferr_ametista',   'Ferramentas Ametista','ferramenta', 2500, 'epico',   true, '{"cabeca":"#b46bff","cabo":"#3b2a55","brilho":true}'),
  -- Efeitos visuais (rastro = partículas ao andar | aura = partículas ao redor do corpo)
  ('efeito_brasas',   'Rastro de Brasas',    'cosmetico', 900,  'incomum', true, '{"cor":"#ff8a3d","tipo":"rastro"}'),
  ('efeito_neon',     'Rastro Neon',         'cosmetico', 2000, 'raro',    true, '{"cor":"#5affd8","tipo":"rastro"}'),
  ('efeito_sakura',   'Aura de Sakura',      'cosmetico', 1600, 'raro',    true, '{"cor":"#ffb0d0","tipo":"aura"}'),
  ('efeito_estrelas', 'Aura Estelar',        'cosmetico', 1400, 'raro',    true, '{"cor":"#ffe27a","tipo":"aura"}')
on conflict (item_id) do update
  set nome = excluded.nome, tipo = excluded.tipo, preco_diamantes = excluded.preco_diamantes,
      raridade = excluded.raridade, ativo = excluded.ativo, meta = excluded.meta;
