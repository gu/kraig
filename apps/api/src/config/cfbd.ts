import { client } from "cfbd";

export function loadCfbdClient(apiKey: string) {
  client.setConfig({
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
