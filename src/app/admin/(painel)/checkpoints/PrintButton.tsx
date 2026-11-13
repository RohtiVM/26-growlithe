"use client";

export function PrintButton() {
  return (
    <button
      className="btn"
      onClick={() => {
        window.print();
      }}
    >
      🖨️ Imprimir todos os QR Codes
    </button>
  );
}
