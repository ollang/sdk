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
    const response = await this.client.post<Array<{ orderId: string; orderType?: string }>>(
      '/integration/orders/create',
      params
    );

    if (!response || response.length === 0) {
      throw new Error('No order ID returned from API');
    }

    let orderId = response[0].orderId;

    const targetType = params.orderType;
    if (response.length > 1 && (targetType === 'aiDubbing' || targetType === 'subtitle')) {
      const match = response.find((r) => r.orderType === targetType);
      if (match) {
        orderId = match.orderId;
      } else {
        for (const item of response) {
          const order = await this.get(item.orderId);
          const type = (order as any).type ?? (order as any).orderType;
          if (type === targetType) {
            orderId = item.orderId;
            break;
          }
        }
      }
    }

    return {
      id: orderId,
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
