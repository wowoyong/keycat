import { describe, it, expect, vi, beforeEach } from "vitest";
import { addChatBubble, getChatBubble } from "../chat";

describe("Chat Bubble", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should create and retrieve a chat bubble", () => {
    addChatBubble("user1", "Alice", "Hello!");
    const bubble = getChatBubble("user1");

    expect(bubble).not.toBeNull();
    expect(bubble!.text).toBe("Hello!");
    expect(bubble!.name).toBe("Alice");
  });

  it("should return null for non-existent user", () => {
    const bubble = getChatBubble("nonexistent");
    expect(bubble).toBeNull();
  });

  it("should expire after duration", () => {
    vi.useFakeTimers();

    addChatBubble("user2", "Bob", "Hi there");
    expect(getChatBubble("user2")).not.toBeNull();

    // Advance time past expiration (5000ms)
    vi.advanceTimersByTime(5001);

    expect(getChatBubble("user2")).toBeNull();

    vi.useRealTimers();
  });

  it("should not expire before duration", () => {
    vi.useFakeTimers();

    addChatBubble("user3", "Charlie", "Test");

    // Advance time but not past expiration
    vi.advanceTimersByTime(3000);

    expect(getChatBubble("user3")).not.toBeNull();

    vi.useRealTimers();
  });

  it("should overwrite previous bubble for same user", () => {
    addChatBubble("user4", "Dave", "First message");
    addChatBubble("user4", "Dave", "Second message");

    const bubble = getChatBubble("user4");
    expect(bubble!.text).toBe("Second message");
  });

  it("should handle multiple users independently", () => {
    addChatBubble("a", "Alice", "msg A");
    addChatBubble("b", "Bob", "msg B");

    expect(getChatBubble("a")!.text).toBe("msg A");
    expect(getChatBubble("b")!.text).toBe("msg B");
  });
});
