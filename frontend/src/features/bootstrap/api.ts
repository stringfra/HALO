"use client";

import { apiFetch, parseJsonResponse } from "@/lib/api-client";

export type BootstrapNavigationItem = {
  key: string;
  label: string;
  href: string;
  section?: string;
};

export type BootstrapRoleCatalogEntry = {
  role_key: string;
  role_alias: string;
  legacy_role_alias: string;
};

export type BootstrapData = {
  tenant: {
    id: number;
    code: string;
    tenant_name: string;
    display_name: string;
    business_name: string;
    vertical_key: string;
    vertical_name: string;
    locale: string;
    timezone: string;
    branding: {
      product_name: string;
      logo_url: string | null;
      primary_color: string;
      secondary_color: string;
    };
    vertical_template?: {
      key: string;
      name: string;
      default_settings?: Record<string, unknown>;
      default_labels?: Record<string, string>;
      default_features?: Record<string, boolean>;
      default_modules?: Record<string, boolean>;
      default_roles?: string[];
    };
    activity_style?: {
      primary_rgb: {
        r: number;
        g: number;
        b: number;
      };
    };
    is_active: boolean;
  };
  current_user: {
    id: number;
    studio_id: number;
    role: string;
    role_alias: string;
    permissions: string[];
  };
  enabled_modules: Record<string, unknown>;
  feature_flags: Record<string, boolean>;
  feature_catalog?: Array<{
    key: string;
    module_key: string | null;
    category: string;
    description: string | null;
    dependencies: string[];
  }>;
  labels: Record<string, string>;
  custom_fields?: {
    schemas?: Record<
      string,
      {
        entity_key: string;
        core_fields: Array<{
          field_key: string;
          label: string;
          type: string;
          required: boolean;
          active: boolean;
          options: string[];
          sort_order: number;
          render_component: string;
          is_core: boolean;
          is_custom: boolean;
        }>;
        custom_fields: Array<{
          field_key: string;
          label: string;
          type: string;
          required: boolean;
          active: boolean;
          options: string[];
          sort_order: number;
          render_component: string;
          is_core: boolean;
          is_custom: boolean;
        }>;
        fields: Array<{
          field_key: string;
          label: string;
          type: string;
          required: boolean;
          active: boolean;
          options: string[];
          sort_order: number;
          render_component: string;
          is_core: boolean;
          is_custom: boolean;
        }>;
      }
    >;
  };
  limits?: Record<string, unknown>;
  workspace?: {
    default_route?: string;
    allowed_routes?: string[];
    search_placeholder?: string;
    workspace_label?: string;
  };
  roles: string[];
  role_catalog: BootstrapRoleCatalogEntry[];
  navigation: BootstrapNavigationItem[];
};

function normalizeApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:4000/api"
  );
}

const bootstrapEndpoint = `${normalizeApiBase()}/bootstrap`;

export async function getBootstrapData() {
  const response = await apiFetch(bootstrapEndpoint, {
    method: "GET",
  });

  return parseJsonResponse<BootstrapData>(response);
}
