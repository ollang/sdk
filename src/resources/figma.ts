import { OllangClient } from '../client';
import { CreateFigmaOrderParams, CreateFigmaOrderResponse, FigmaOrderSummary } from '../types';

/** Import Figma files and track the orders created from them. */
export class Figma {
  constructor(private client: OllangClient) {}

  /** Imports a Figma file and creates translation orders in one step. */
  async createOrder(params: CreateFigmaOrderParams): Promise<CreateFigmaOrderResponse> {
    return this.client.post<CreateFigmaOrderResponse>('/integration/orders/figma/create', params);
  }

  /** Lists the orders created from a given Figma file. */
  async listOrders(fileKey: string): Promise<FigmaOrderSummary[]> {
    return this.client.get<FigmaOrderSummary[]>('/integration/orders/figma', { fileKey });
  }

  /** Checks the status of a single Figma order. */
  async orderStatus(orderId: string): Promise<FigmaOrderSummary> {
    return this.client.get<FigmaOrderSummary>(`/integration/orders/figma/${orderId}/status`);
  }
}
