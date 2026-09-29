export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type PendingAnswer = {
  id: string;
  sessionItemId: string;
  answeredAt: string;
  booleanChoice: boolean | null;
  optionId: string | null;
  writtenText: string | null;
  equivalent: boolean | null;
};

type Json = Record<string, unknown>;

export function createApi(baseUrl: string, token: () => string | null) {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("content-type", "application/json");
    const current = token();
    if (current) headers.set("authorization", `Bearer ${current}`);
    try {
      return await fetch(`${baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new Error("red");
    }
  }

  async function read(path: string, init?: RequestInit): Promise<unknown> {
    const response = await request(path, init);
    if (response.status === 401) throw new ApiError(401, "token");
    if (!response.ok) throw new ApiError(response.status, "api");
    if (response.status === 204) return null;
    return response.json();
  }

  return {
    async login(password: string): Promise<{ token: string }> {
      const response = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (response.status === 401) throw new ApiError(401, "credenciales");
      if (!response.ok) throw new ApiError(response.status, "api");
      return response.json() as Promise<{ token: string }>;
    },
    materias() {
      return read("/materias") as Promise<unknown>;
    },
    createMateria(name: string) {
      return read("/materias", { method: "POST", body: JSON.stringify({ name }) });
    },
    createRama(materiaId: string, name: string) {
      return read(`/materias/${materiaId}/ramas`, { method: "POST", body: JSON.stringify({ name }) });
    },
    createTema(ramaId: string, name: string, priority: string) {
      return read(`/ramas/${ramaId}/temas`, {
        method: "POST",
        body: JSON.stringify({ name, priority }),
      });
    },
    createConocimiento(temaId: string, body: Json) {
      return read(`/temas/${temaId}/conocimientos`, { method: "POST", body: JSON.stringify(body) });
    },
    updateConocimiento(id: string, body: Json) {
      return read(`/conocimientos/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    archive(id: string) {
      return read(`/conocimientos/${id}/archive`, { method: "POST" });
    },
    restore(id: string) {
      return read(`/conocimientos/${id}/restore`, { method: "POST" });
    },
    saveQuestion(conocimientoId: string, body: Json) {
      return read(`/conocimientos/${conocimientoId}/preguntas`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    saveRelation(fromId: string, toId: string, type: string) {
      return read("/relaciones", {
        method: "PUT",
        body: JSON.stringify({ fromId, toId, type }),
      });
    },
    openSession(localDate: string) {
      return read("/sesiones", { method: "POST", body: JSON.stringify({ localDate }) });
    },
    async submitAnswer(answer: PendingAnswer): Promise<{ status: "applied" | "rejected" | "unauthorized" }> {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/respuestas`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token() ? { authorization: `Bearer ${token()}` } : {}),
          },
          body: JSON.stringify({ answers: [answer] }),
        });
      } catch {
        throw new Error("red");
      }
      if (response.status === 401) return { status: "unauthorized" };
      let body: { results?: Array<{ status?: string }> };
      try {
        body = (await response.json()) as { results?: Array<{ status?: string }> };
      } catch {
        throw new Error("red");
      }
      const status = body.results?.[0]?.status;
      if (response.status === 200 && status === "applied") return { status: "applied" };
      if (response.status === 422 && status === "rejected") return { status: "rejected" };
      throw new Error("red");
    },
  };
}
