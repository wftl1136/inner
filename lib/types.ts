export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_path: string | null;
  plus: boolean;
  created_at?: string;
};

export type MiniProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_path'>;

export type Post = {
  id: string;
  author_id: string;
  body: string;
  image_path: string | null;
  repost_of: string | null;
  allow_reposts: boolean;
  created_at: string;
  author: MiniProfile;
  original?: (Omit<Post, 'original' | 'likes' | 'comments'> & { author: MiniProfile }) | null;
  likes?: { count: number }[];
  comments?: { count: number }[];
};

export type Story = {
  id: string;
  author_id: string;
  image_path: string;
  caption: string;
  created_at: string;
};

export type FriendRequest = {
  id: string;
  from_id: string;
  to_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  shared_post_id: string | null;
  created_at: string;
  read_at: string | null;
};

export type Call = {
  id: string;
  caller_id: string;
  callee_id: string;
  kind: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed' | 'cancelled';
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
};

export const PROFILE_FIELDS = 'id,username,display_name,avatar_path';
