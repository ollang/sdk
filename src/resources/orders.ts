import { OllangClient } from '../client';
import {
  Order,
  CreateOrderParams,
  CreatedOrder,
  ListOrdersParams,
  OrderReviewInfo,
  OrdersListResponse,
  RunQcEvaluationParams,
  RunQcEvaluationResponse,
  RerunOrderParams,
  RerunOrderResponse,
} from '../types';
import { saveBuffer } from './_files';

export class Orders {
  constructor(private client: OllangClient) {}

  /**
   * Creates orders and returns a single one of them.
   *
   * A request can create several orders — one per entry in
   * `targetLanguageConfigs`, plus any prerequisite orders the order type needs —
   * but this method returns only one: for `aiDubbing` and `subtitle`, the order
   * of the requested type; otherwise the first order the API returns. Use
   * {@link createAll} to get every created order.
   */
  async create(params: CreateOrderParams): Promise<Order> {
    const response = await this.postCreate(params);

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

  /**
   * Creates orders and returns every order the request created.
   *
   * One request can create several orders: one per entry in
   * `targetLanguageConfigs`, and some order types (such as `aiDubbing`) also
   * create the orders they depend on. The list is not in any guaranteed order;
   * use each entry's `orderType` to tell them apart.
   */
  async createAll(params: CreateOrderParams): Promise<CreatedOrder[]> {
    return this.postCreate(params);
  }

  private async postCreate(params: CreateOrderParams): Promise<CreatedOrder[]> {
    const response = await this.client.post<CreatedOrder[]>('/integration/orders/create', params);

    if (!response || response.length === 0) {
      throw new Error('No order ID returned from API');
    }

    return response;
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

  /** Cancels a human review previously requested for an order. */
  async cancelHumanReview(orderId: string): Promise<void> {
    return this.client.post<void>(`/integration/orders/${orderId}/cancel-human-review`);
  }

  /** Requests a video with the finished subtitles burned in. */
  async requestSubtitleEmbedding(orderId: string): Promise<void> {
    return this.client.post<void>(`/integration/orders/${orderId}/subtitle-embedding`);
  }

  /**
   * Inspects the review gate an order is paused at, if any.
   *
   * Reports which team tag owns the gate, the review type, when the order
   * entered review, and who can clear it. Useful when an order sits in the
   * `review` status.
   */
  async reviewInfo(orderId: string): Promise<OrderReviewInfo> {
    return this.client.get<OrderReviewInfo>(`/integration/orders/${orderId}/review/info`);
  }

  /**
   * Exports an order's timestamps, transcriptions and translations as XLSX.
   *
   * Resolves to the raw file bytes. Use {@link exportXlsxToFile} to write them
   * straight to disk.
   */
  async exportXlsx(orderId: string): Promise<Buffer> {
    return this.client.getBuffer(`/integration/orders/${orderId}/export-xlsx`);
  }

  /** Exports an order as XLSX and saves the workbook to `filePath`. */
  async exportXlsxToFile(orderId: string, filePath: string): Promise<string> {
    return saveBuffer(await this.exportXlsx(orderId), filePath);
  }
}
