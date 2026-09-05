import type { Category, Operation, Post } from "../../types";
export const categories: {
  id: Category;
  name: string;
  description: string;
  verb: string;
}[] = [
  {
    id: "posts",
    name: "Posts",
    description: "Delete original posts you published.",
    verb: "Delete",
  },
  {
    id: "replies",
    name: "Replies",
    description: "Delete your replies in conversations.",
    verb: "Delete",
  },
  {
    id: "quotes",
    name: "Quote posts",
    description: "Delete your quotes. Original posts stay.",
    verb: "Delete",
  },
  {
    id: "reposts",
    name: "Reposts",
    description: "Undo reposts shared to your profile.",
    verb: "Undo",
  },
  {
    id: "likes",
    name: "Likes",
    description: "Remove your likes from other posts.",
    verb: "Remove",
  },
  {
    id: "following",
    name: "Following",
    description: "Unfollow accounts. Your followers stay.",
    verb: "Unfollow",
  },
];
export function classify(post: Post): Category {
  const refs = post.referenced_tweets ?? [];
  return refs.some((r) => r.type === "retweeted")
    ? "reposts"
    : refs.some((r) => r.type === "replied_to")
      ? "replies"
      : refs.some((r) => r.type === "quoted")
        ? "quotes"
        : "posts";
}
export function postOperation(post: Post): Operation {
  const category = classify(post);
  return {
    id: category + ":" + post.id,
    target:
      category === "reposts"
        ? post.referenced_tweets!.find((r) => r.type === "retweeted")!.id
        : post.id,
    category,
    status: "pending",
  };
}
export function selectOperations(
  operations: Operation[],
  selected: Category[],
) {
  const seen = new Set<string>();
  return operations.filter((o) => {
    const key = o.category + ":" + o.target;
    if (!selected.includes(o.category) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export const confirmed = (text: string) => text === "RESET";
