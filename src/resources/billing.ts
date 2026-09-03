import { OllangClient } from '../client';
import { ConsumptionListResponse, CreditWallet, ListConsumptionParams } from '../types';

/** Credit balance and per-order consumption history. */
export class Billing {
  constructor(private client: OllangClient) {}

  /** Retrieves the credit wallet: balance and currency. */
  async credits(): Promise<CreditWallet> {
    return this.client.get<CreditWallet>('/integration/credits');
  }

  /**
   * Lists credit consumption entries.
   *
   * Pagination maps to `pageOptions[...]` query parameters and filters to
   * `filter[...]`.
   */
  async consumption(params?: ListConsumptionParams): Promise<ConsumptionListResponse> {
    const queryParams: any = {};

    if (params?.pageOptions) {
      const { page, take, search, orderBy, orderDirection } = params.pageOptions;
      if (page !== undefined) queryParams['pageOptions[page]'] = page;
      if (take !== undefined) queryParams['pageOptions[take]'] = take;
      if (search) queryParams['pageOptions[search]'] = search;
      if (orderBy) queryParams['pageOptions[orderBy]'] = orderBy;
      if (orderDirection) queryParams['pageOptions[orderDirection]'] = orderDirection;
    }

    if (params?.filter) {
      for (const [key, value] of Object.entries(params.filter)) {
        if (value !== undefined) queryParams[`filter[${key}]`] = value;
      }
    }

    return this.client.get<ConsumptionListResponse>('/integration/consumption', queryParams);
  }
}
