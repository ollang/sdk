import { OllangClient } from '../client';
import {
  CreateProjectByUrlParams,
  ListProjectsParams,
  Project,
  ProjectsListResponse,
} from '../types';

export class Projects {
  constructor(private client: OllangClient) {}

  async get(projectId: string): Promise<Project> {
    return this.client.get<Project>(`/integration/project/${projectId}`);
  }

  async list(params?: ListProjectsParams): Promise<ProjectsListResponse> {
    const queryParams: any = {};

    if (params?.pageOptions) {
      const { page, take, search, orderBy, orderDirection } = params.pageOptions;
      if (page !== undefined) queryParams.page = page;
      if (take !== undefined) queryParams.take = take;
      if (search) queryParams.search = search;
      if (orderBy) queryParams.orderBy = orderBy;
      if (orderDirection) queryParams.orderDirection = orderDirection;
    }

    return this.client.get<ProjectsListResponse>('/integration/project', queryParams);
  }

  /**
   * Creates a project from a file the platform fetches itself.
   *
   * The file at `url` is downloaded server-side, so its bytes never pass
   * through your process. Prefer this over `uploads.direct` for large remote
   * files.
   */
  async createByUrl(params: CreateProjectByUrlParams): Promise<Project> {
    return this.client.post<Project>('/integration/project/create-by-url', params);
  }
}
