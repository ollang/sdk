import { OllangClient } from '../client';
import {
  Order,
  CreateOrderParams,
  ListOrdersParams,
  OrdersListResponse,
  RunQcEvaluationParams,
  RunQcEvaluationResponse,
  RerunOrderParams,
  RerunOrderResponse,
} from '../types';

export class Orders {
  constructor(private client: OllangClient) {}

  async create(params: CreateOrderParams): Promise<Order> {
    const response = await this.client.post<Array<{ orderId: string }>>(
      '/integration/orders/create',
      params
    );

    if (!response || response.length === 0) {
      throw new Error('No order ID returned from API');
    }

    return {
      id: response[0].orderId,
      orderType: params.orderType,
      level: params.level,
      projectId: params.projectId,
      targetLanguageConfigs: params.targetLanguageConfigs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Order;
  }

  async list(params?: ListOrdersParams): Promise<OrdersListResponse> {
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
      const { status, orderType, projectId } = params.filter;
      if (status) queryParams['filter[status]'] = status;
      if (orderType) queryParams['filter[type]'] = orderType;
      if (projectId) queryParams['filter[projectId]'] = projectId;
    }

    return this.client.get<OrdersListResponse>('/integration/orders', queryParams);
  }

  async get(orderId: string): Promise<Order> {
    return this.client.get<Order>(`/integration/orders/${orderId}`);
  }

  async cancel(orderId: string): Promise<void> {
    return this.client.post<void>(`/integration/orders/cancel/${orderId}`);
  }

  async requestHumanReview(orderId: string): Promise<void> {
    return this.client.post<void>(`/integration/orders/${orderId}/human-review`);
  }

  async runQcEvaluation(
    orderId: string,
    params?: RunQcEvaluationParams
  ): Promise<RunQcEvaluationResponse> {
    return this.client.post<RunQcEvaluationResponse>(`/integration/orders/${orderId}/qc`, params);
  }

  async rerun(orderId: string, params?: RerunOrderParams): Promise<RerunOrderResponse> {
    return this.client.post<RerunOrderResponse>(`/integration/orders/${orderId}/rerun`, params);
  }
}
