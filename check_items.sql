USE sales_erp;

SELECT 'PURCHASE_ORDER_ITEMS' as source, id, item_code, description, quantity 
FROM purchase_order_items 
WHERE purchase_order_id = (SELECT id FROM purchase_orders WHERE po_number = 'IPPSR25200356')
UNION ALL
SELECT 'CUSTOMER_PO_ITEMS' as source, id, item_code, description, quantity
FROM customer_po_items 
WHERE customer_po_id = (
  SELECT customer_po_id FROM sales_orders 
  WHERE id = (SELECT sales_order_id FROM purchase_orders WHERE po_number = 'IPPSR25200356')
);
