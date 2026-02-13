import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/chats", () => {
    return HttpResponse.json([
      {
        _id: "507f1f77bcf86cd799439011",
        title: "Mock Chat",
        createdAt: "2026-02-13T10:00:00.000Z",
        updatedAt: "2026-02-13T12:00:00.000Z",
        messageCount: 2,
      },
    ]);
  }),
  http.post("/api/chats", () => {
    return HttpResponse.json(
      {
        _id: "507f1f77bcf86cd799439012",
        title: "New Chat",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      },
      { status: 201 },
    );
  }),
];
