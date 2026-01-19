import { supabase } from "../lib/supabaseClient";
import type { SyncApi } from "./types";

export const siteModeApi: SyncApi = {
  async createSnag(payload: unknown) {
    const { data, error } = await supabase
      .from("snags")
      .insert(payload as Record<string, unknown>)
      .select("id, created_at")
      .single();
    if (error) throw error;
    return { id: data.id, updatedAt: new Date(data.created_at).getTime() };
  },
  async updateSnag(id: string, payload: unknown) {
    const { data, error } = await supabase
      .from("snags")
      .update(payload as Record<string, unknown>)
      .eq("id", id)
      .select("created_at")
      .single();
    if (error) throw error;
    return { updatedAt: new Date(data.created_at).getTime() };
  },
  async deleteSnag(id: string) {
    const { error } = await supabase.from("snags").delete().eq("id", id);
    if (error) throw error;
  },
};