import { deflateRawSync } from "node:zlib";

/** Zip minimo para probar lo que trae un .skill. Sin comprimir o con deflate. El lector no revisa CRC. */
export function makeZip(files: Record<string, string>, { deflate = false }: { deflate?: boolean } = {}): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const n = Buffer.from(name, "utf8");
    const raw = Buffer.from(content, "utf8");
    const data = deflate ? deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(n.length, 26);
    locals.push(local, n, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

/** .skill valido para <slug>: carpeta con SKILL.md (name = slug) y un script. */
export function skillPackage(slug: string, opts: { name?: string; deflate?: boolean } = {}): Buffer {
  return makeZip(
    {
      [`${slug}/SKILL.md`]: `---\nname: ${opts.name ?? slug}\ndescription: "Hace una cosa. Usalo cuando pidan algo."\n---\n\n# Prueba\n`,
      [`${slug}/scripts/run.py`]: "print(1)",
    },
    { deflate: opts.deflate },
  );
}
