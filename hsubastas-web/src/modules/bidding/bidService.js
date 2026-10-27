import { getSupabaseClient } from '../../js/supabaseClient.js';
import { validateAmount } from '../auctions/marketplaceService.js';

export function createBidService(getClient = getSupabaseClient) {
  async function client() {
    const result = await getClient();
    if (!result) throw new Error('AUTH_REQUIRED');
    return result;
  }
  return {
    async list(id) {
      const { data, error } = await (await client()).rpc('list_auction_offers', { p_auction_id: id });
      if (error) throw error;
      return data;
    },
    async submit(id, amount) {
      const { data, error } = await (await client()).rpc('submit_bid', { p_auction_id: id, p_amount: validateAmount(amount) });
      if (error) throw error;
      return data;
    },
    async award(auctionId, bidId) {
      const { data, error } = await (await client()).rpc('award_bid_with_contact', { p_auction_id: auctionId, p_bid_id: bidId });
      if (error) throw error;
      return data;
    },
  };
}
