import { supabase } from '@/lib/supabase';

// Lists orders newest-first. Server caps at 200 by default (max 1000) so the
// payload stays bounded as the orders table grows. Pass `before` (an ISO
// `created_at` timestamp) to fetch the next page of older rows.
//
// Returns the full pagination envelope (`{ orders, limit, has_more }`) rather
// than a bare array so callers can render an honest "more exist" indicator
// instead of silently truncating dashboards / counts at the first page.
export const listOrders = async ({ limit, before } = {}) => {
  const body = {};
  if (limit) body.limit = limit;
  if (before) body.before = before;
  const { data, error } = await supabase.functions.invoke('list-orders', { body });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.reason || 'list_orders_failed');
  return {
    orders: data?.orders ?? [],
    limit: data?.limit ?? null,
    has_more: !!data?.has_more,
  };
};

export const updateOrderStatus = async (id, status) => {
  const { data, error } = await supabase.functions.invoke('update-order-status', {
    body: { id, status },
  });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.reason || 'update_order_status_failed');
  return data?.order;
};

export const deleteOrder = async (id) => {
  const { data, error } = await supabase.functions.invoke('delete-order', { body: { id } });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.reason || 'delete_order_failed');
};
