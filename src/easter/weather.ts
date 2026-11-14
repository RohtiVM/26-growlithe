import "server-only";
import { z } from "zod";
import { parseEasterOverride, resolveEasterEgg, type EasterEgg, type Weather } from "./egg";

/** Palmas (TO), onde fica o Shopping Capim Dourado. Nenhum dado do visitante é enviado (D4). */
const OPEN_METEO =
  "https://api.open-meteo.com/v1/forecast?latitude=-10.18&longitude=-48.33&current=precipitation,weather_code&timezone=America%2FAraguaina";

const OpenMeteoResponse = z.object({
  current: z.object({ precipitation: z.number().nonnegative(), weather_code: z.number().int() }),
});

/** Clima atual de Palmas, com cache de 10 min. Falha ou demora > 2,5 s vira `null` (critério 4). */
export const fetchPalmasWeather = async (): Promise<Weather | null> => {
  try {
    const res = await fetch(OPEN_METEO, { next: { revalidate: 600 }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const parsed = OpenMeteoResponse.safeParse(await res.json());
    if (!parsed.success) return null;
    return { precipitation: parsed.data.current.precipitation, weatherCode: parsed.data.current.weather_code };
  } catch {
    return null;
  }
};

/** Efeito a mostrar nesta requisição. O clima só é buscado quando não é madrugada nem demonstração. */
export const getEasterEgg = async (rawOverride: string | string[] | undefined): Promise<EasterEgg | null> => {
  const override = parseEasterOverride(rawOverride);
  const now = new Date();
  const quick = resolveEasterEgg({ now, weather: null, override });
  if (quick !== null) return quick;
  return resolveEasterEgg({ now, weather: await fetchPalmasWeather(), override: null });
};
