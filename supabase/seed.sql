-- Dados de demonstração (fictícios). Recompensas entram por seed no MVP (D5).
-- Admin e lojista: depois do primeiro login, use private.grant_staff (ver a migration).

insert into public.stores (id, name, cnpj, category) values
  ('a1000000-0000-4000-8000-000000000001', 'Moda Cerrado', '11222333000181', 'vestuario'),
  ('a1000000-0000-4000-8000-000000000002', 'Burger do Jalapão', '22333444000172', 'alimentacao'),
  ('a1000000-0000-4000-8000-000000000003', 'Livraria Palmas', '33444555000163', 'livraria')
on conflict (id) do nothing;

insert into public.checkpoints (id, store_id, label, is_entrance) values
  ('c1000000-0000-4000-8000-000000000001', null, 'Entrada principal', true),
  ('c1000000-0000-4000-8000-000000000002', null, 'Praça de alimentação', false),
  ('c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Moda Cerrado — vitrine', false),
  ('c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', 'Livraria Palmas — balcão', false)
on conflict (id) do nothing;

insert into public.rewards (id, title, cost_points, benefit, stock, min_tier) values
  ('b1000000-0000-4000-8000-000000000001', '2h de estacionamento grátis', 300,
    '{"kind": "free_parking", "hours": 2}', null, 'bronze'),
  ('b1000000-0000-4000-8000-000000000002', '15% na Moda Cerrado', 500,
    '{"kind": "discount_percent", "percent": 15, "storeId": "a1000000-0000-4000-8000-000000000001"}', 50, 'prata'),
  ('b1000000-0000-4000-8000-000000000003', 'Milkshake grátis no Burger do Jalapão', 400,
    '{"kind": "gift", "description": "Um milkshake de 300 ml", "storeId": "a1000000-0000-4000-8000-000000000002"}', 100, 'bronze')
on conflict (id) do nothing;
