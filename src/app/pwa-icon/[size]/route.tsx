import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512] as const;

export const generateStaticParams = () => SIZES.map((size) => ({ size: String(size) }));
export const dynamicParams = false;

/** Ícone do app: "G" preto sobre o vermelho do tema escuro, com margem para ícone "maskable". */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const requested = (await params).size;
  const size = SIZES.find((s) => String(s) === requested) ?? 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FF422A",
          color: "#000000",
          fontSize: size * 0.56,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        G
      </div>
    ),
    { width: size, height: size },
  );
}
