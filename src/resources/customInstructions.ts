import { OllangClient } from '../client';
import {
  CustomInstruction,
  CreateCustomInstructionParams,
  UpdateCustomInstructionParams,
  CustomInstructionSuggestion,
} from '../types';

export class CustomInstructions {
  constructor(private client: OllangClient) {}

  async list(): Promise<CustomInstruction[]> {
    return this.client.get<CustomInstruction[]>('/integration/custom-instructions');
  }

  async create(params: CreateCustomInstructionParams): Promise<CustomInstruction> {
    return this.client.post<CustomInstruction>('/integration/custom-instructions', params);
  }

  async update(
    instructionId: string,
    params: UpdateCustomInstructionParams
  ): Promise<CustomInstruction> {
    return this.client.patch<CustomInstruction>(
      `/integration/custom-instructions/${instructionId}`,
      params
    );
  }

  async delete(instructionId: string): Promise<void> {
    return this.client.delete<void>(`/integration/custom-instructions/${instructionId}`);
  }

  async suggestions(): Promise<CustomInstructionSuggestion[]> {
    return this.client.get<CustomInstructionSuggestion[]>(
      '/integration/custom-instructions/suggestions'
    );
  }
}
