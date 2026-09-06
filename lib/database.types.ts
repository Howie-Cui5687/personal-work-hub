export type ItemType = 'task' | 'study' | 'note';
export type ItemStatus = 'planned' | 'active' | 'done';

export interface PrivateItem {
  id: string;
  user_id: string;
  item_type: ItemType;
  title: string;
  content: string;
  status: ItemStatus;
  progress: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      private_items: {
        Row: PrivateItem;
        Insert: {
          id?: string;
          user_id?: string;
          item_type: ItemType;
          title: string;
          content?: string;
          status?: ItemStatus;
          progress?: number;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          item_type: ItemType;
          title: string;
          content: string;
          status: ItemStatus;
          progress: number;
          due_date: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
