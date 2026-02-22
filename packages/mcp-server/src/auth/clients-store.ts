import { randomUUID } from 'node:crypto';

type ClientInfo = { client_id: string; [key: string]: unknown };

export class InMemoryClientsStore {
  private clients = new Map<string, ClientInfo>();

  async getClient(clientId: string): Promise<ClientInfo | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(clientMetadata: Record<string, unknown>): Promise<ClientInfo> {
    const clientId = randomUUID();
    const client: ClientInfo = {
      ...clientMetadata,
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.clients.set(clientId, client);
    return client;
  }
}
