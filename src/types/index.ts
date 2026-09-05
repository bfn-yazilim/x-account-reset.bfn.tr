export interface User {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}
export interface Post {
  id: string;
  text: string;
  author_id?: string;
  referenced_tweets?: {
    type: "retweeted" | "replied_to" | "quoted";
    id: string;
  }[];
}
export interface Page<T> {
  data?: T[];
  meta?: { next_token?: string };
  errors?: unknown[];
}
export type Category =
  "posts" | "replies" | "quotes" | "reposts" | "likes" | "following";
export type OperationStatus =
  "pending" | "running" | "success" | "failed" | "skipped";
export interface Operation {
  id: string;
  target: string;
  category: Category;
  status: OperationStatus;
  detail?: string;
}
