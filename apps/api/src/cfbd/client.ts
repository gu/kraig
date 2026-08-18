import { ApiConfig } from "@/config";
import ky from "ky";

export const cfbdClient = ky.create({
  headers: {
    Authorization: `Bearer ${ApiConfig.CFBD_API_KEY}`,
  },
});
