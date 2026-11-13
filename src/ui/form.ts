/** Lê um campo de texto do formulário. `FormData.get` pode devolver um `File`; aqui isso vira "". */
export const formText = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};
