const TRANSLATABLE_TYPES = new Set(['string', 'text', 'richtext']);
const SCALAR_TYPES = new Set(['string', 'text', 'richtext', 'enumeration', 'email', 'password']);

export interface StrapiSchemaConfig {
  fieldsByContentType: Record<string, string[]>;
  fetchedAt: number;
}

interface ContentTypeAttribute {
  type: string;
  pluginOptions?: { i18n?: { localized?: boolean } };
  component?: string;
  repeatable?: boolean;
  [key: string]: unknown;
}

interface ContentTypeSchema {
  attributes: Record<string, ContentTypeAttribute>;
  [key: string]: unknown;
}

interface ContentTypeItem {
  uid: string;
  apiID?: string;
  schema: ContentTypeSchema;
  [key: string]: unknown;
}

interface ComponentAttribute {
  type: string;
  component?: string;
  repeatable?: boolean;
  [key: string]: unknown;
}

interface ComponentSchema {
  attributes: Record<string, ComponentAttribute>;
  [key: string]: unknown;
}

interface ComponentItem {
  uid: string;
  schema: ComponentSchema;
  [key: string]: unknown;
}

function getComponentTranslatablePaths(
  componentUid: string,
  componentsMap: Map<string, ComponentSchema>,
  prefix: string,
  visited: Set<string>,
  parentRepeatable?: boolean
): string[] {
  if (visited.has(componentUid)) return [];
  visited.add(componentUid);

  const schema = componentsMap.get(componentUid);
  if (!schema || !schema.attributes) return [];

  const pathPrefix = parentRepeatable && prefix ? `${prefix}[]` : prefix;
  const paths: string[] = [];
  for (const [attrName, attr] of Object.entries(schema.attributes)) {
    const fullPath = pathPrefix ? `${pathPrefix}.${attrName}` : attrName;
    if (attr.type === 'component' && attr.component) {
      const nested = getComponentTranslatablePaths(
        attr.component,
        componentsMap,
        fullPath,
        visited,
        attr.repeatable
      );
      paths.push(...nested);
    } else if (TRANSLATABLE_TYPES.has(attr.type)) {
      paths.push(attr.repeatable ? `${fullPath}[]` : fullPath);
    }
  }
  return paths;
}

export function parseStrapiSchema(
  contentTypesData: ContentTypeItem[],
  componentsData: ComponentItem[]
): Record<string, string[]> {
  const componentsMap = new Map<string, ComponentSchema>();
  for (const item of componentsData) {
    if (item.uid && item.schema) {
      componentsMap.set(item.uid, item.schema);
    }
  }

  const fieldsByContentType: Record<string, string[]> = {};

  for (const item of contentTypesData) {
    if (!item.uid || !item.uid.startsWith('api::')) continue;
    const apiID = item.apiID || item.uid.split('.').pop() || item.uid;
    const attrs = item.schema?.attributes;
    if (!attrs) continue;

    const paths: string[] = [];
    for (const [attrName, attr] of Object.entries(attrs)) {
      const localized = attr.pluginOptions?.i18n?.localized === true;
      if (!localized && attr.type !== 'relation') continue;

      if (TRANSLATABLE_TYPES.has(attr.type)) {
        paths.push(attrName);
      } else if (attr.type === 'component' && attr.component && localized) {
        const visited = new Set<string>();
        const nested = getComponentTranslatablePaths(
          attr.component,
          componentsMap,
          attrName,
          visited,
          attr.repeatable
        );
        paths.push(...nested);
      }
    }
    if (paths.length > 0) {
      fieldsByContentType[apiID] = paths;
    }
  }

  return fieldsByContentType;
}

export async function fetchStrapiSchema(
  strapiBaseUrl: string,
  adminJwt: string
): Promise<{ contentTypes: ContentTypeItem[]; components: ComponentItem[] }> {
  const base = strapiBaseUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${adminJwt}`,
    'Content-Type': 'application/json',
  };

  const [ctRes, compRes] = await Promise.all([
    fetch(`${base}/content-type-builder/content-types`, { headers }),
    fetch(`${base}/content-type-builder/components`, { headers }),
  ]);

  if (!ctRes.ok) {
    const text = await ctRes.text();
    throw new Error(`Content-types request failed (${ctRes.status}): ${text}`);
  }
  if (!compRes.ok) {
    const text = await compRes.text();
    throw new Error(`Components request failed (${compRes.status}): ${text}`);
  }

  const contentTypes = (await ctRes.json()).data || [];
  const components = (await compRes.json()).data || [];
  return { contentTypes, components };
}

export async function loadStrapiSchema(
  strapiBaseUrl: string,
  adminJwt: string
): Promise<StrapiSchemaConfig> {
  const { contentTypes, components } = await fetchStrapiSchema(strapiBaseUrl, adminJwt);
  const fieldsByContentType = parseStrapiSchema(contentTypes, components);
  return {
    fieldsByContentType,
    fetchedAt: Date.now(),
  };
}
