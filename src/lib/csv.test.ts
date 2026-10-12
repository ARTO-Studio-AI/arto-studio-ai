import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("lee comillas, comas y saltos de linea dentro de un campo", () => {
    expect(parseCsv('id,texto\r\nBR-0001,"Hola, ""marca""\nsegunda linea"\n')).toEqual([
      ["id", "texto"],
      ["BR-0001", 'Hola, "marca"\nsegunda linea'],
    ]);
  });
  it("ignora el BOM y las filas vacias", () => {
    expect(parseCsv("﻿a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("conserva celdas vacias", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([["a", "b", "c"], ["1", "", "3"]]);
  });
  it("avisa de comillas sin cerrar", () => {
    expect(() => parseCsv('a\n"abierto')).toThrow("comillas");
  });
});

describe("csvCell y toCsv", () => {
  it("neutraliza formulas y escapa comillas", () => {
    expect(csvCell("=SUMA(A1)")).toBe(`"'=SUMA(A1)"`);
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
  });
  it("ida y vuelta sin perder nada", () => {
    const text = toCsv(["id", "t"], [{ id: "BR-0001", t: 'linea 1\nlinea, "2"' }]);
    expect(parseCsv(text)).toEqual([["id", "t"], ["BR-0001", 'linea 1\nlinea, "2"']]);
  });
});
