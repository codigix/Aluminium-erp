DELETE FROM _prisma_migrations WHERE migration_name IN (
  'initial_migration',
  '20260512_add_test_to_shapes',
  '20260512_add_new_table_and_column',
  '20260512_production_sync',
  '20260512_add_public_id_to_shapes',
  '20260512_add_public_id_to_vendors',
  '20260512_add_itemsPublic_id_to_item_groups'
);
